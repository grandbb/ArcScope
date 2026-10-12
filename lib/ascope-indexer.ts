import { erc20Abi, formatUnits, parseAbi, type Address } from "viem";
import { mainnetClient, tokenFacts, verifyMainnet } from "./ascope-mainnet";
import type { DAO, DefiPosition, NFTAsset } from "./types";

/** A Blockscout-compatible Arc indexer can be configured without exposing credentials to browsers. */
export async function indexedJson(path: string) {
  await verifyMainnet();
  const origin = process.env.ASCOPE_BLOCKSCOUT_API_URL?.replace(/\/$/, "") || "https://explorer.arc.io/api/v2";
  const response = await fetch(`${origin}${path}`, { headers: process.env.ASCOPE_INDEXER_API_KEY ? { "x-api-key": process.env.ASCOPE_INDEXER_API_KEY } : {}, next: { revalidate: 60 }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("Arc NFT/holder index is unavailable. A working Arc Mainnet indexer is required; no holdings are inferred from missing data.");
  return response.json();
}
export async function readNfts(address: string, pageKey: string | null) {
  let query = "";
  if (pageKey) {
    const params = new URLSearchParams(pageKey);
    if (pageKey.length > 512 || [...params.keys()].some(key => !["token_contract_address_hash", "token_id", "token_type", "items_count"].includes(key))) throw new Error("Invalid NFT page cursor");
    query = `?${params}`;
  }
  const data = await indexedJson(`/addresses/${address}/nft${query}`);
  if (!Array.isArray(data.items)) throw new Error("Invalid NFT index response");
  const items: NFTAsset[] = data.items.flatMap((group: any) => (group.token_instances ?? []).map((nft: any) => {
    const metadata = nft.metadata ?? {};
    return { id: `${group.token?.address_hash}:${nft.id}`, name: metadata.name || `${group.token?.name ?? "NFT"} #${nft.id}`, collection: group.token?.name ?? group.token?.address_hash, image: nft.image_url ?? metadata.image ?? "", description: metadata.description, traits: (metadata.attributes ?? []).filter((a: any) => a.trait_type && a.value !== undefined).map((a: any) => ({ traitType: String(a.trait_type), value: String(a.value) })) };
  }));
  return { items, nextPageKey: data.next_page_params ? new URLSearchParams(data.next_page_params).toString() : undefined, coverage: "Arc Mainnet indexed NFT ownership; floor prices are unavailable without market coverage." };
}

function configuredAddresses(variable: string) {
  const addresses = (process.env[variable] ?? "").split(",").map(a => a.trim());
  return addresses.filter(a => /^0x[0-9a-f]{40}$/i.test(a)) as Address[];
}
export async function readDefi(address: string): Promise<DefiPosition[]> {
  await verifyMainnet();
  const vaults = configuredAddresses("ASCOPE_ERC4626_VAULTS");
  if (!vaults.length) throw new Error("DeFi positions are unavailable: verified Arc Mainnet vault/protocol contracts have not been configured.");
  const abi = parseAbi(["function balanceOf(address) view returns (uint256)", "function asset() view returns (address)", "function convertToAssets(uint256) view returns (uint256)"]);
  const head = await mainnetClient.getBlock({ blockTag: "finalized" });
  return (await Promise.all(vaults.map(async vault => {
    const shares = await mainnetClient.readContract({ address: vault, abi, functionName: "balanceOf", args: [address as Address], blockNumber: head.number });
    if (!shares) return [];
    const [asset, amount, vaultFacts] = await Promise.all([mainnetClient.readContract({ address: vault, abi, functionName: "asset", blockNumber: head.number }), mainnetClient.readContract({ address: vault, abi, functionName: "convertToAssets", args: [shares], blockNumber: head.number }), tokenFacts(vault)]);
    const facts = await tokenFacts(asset);
    return [{ id: vault, protocol: vaultFacts.name, type: "Lending" as const, deposited: null, value: facts.price === null ? null : Number(formatUnits(amount, facts.decimals)) * facts.price, pnl: null, apy: null }];
  }))).flat();
}
export async function readDaos(address: string): Promise<DAO[]> {
  await verifyMainnet();
  const tokens = configuredAddresses("ASCOPE_GOVERNANCE_TOKENS");
  if (!tokens.length) throw new Error("DAO memberships are unavailable: verified Arc Mainnet governance contracts have not been configured.");
  const block = await mainnetClient.getBlock({ blockTag: "finalized" });
  return (await Promise.all(tokens.map(async token => {
    const balance = await mainnetClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [address as Address], blockNumber: block.number });
    if (!balance) return [];
    const facts = await tokenFacts(token);
    let votes = null;
    try { votes = Number(formatUnits(await mainnetClient.readContract({ address: token, abi: parseAbi(["function getVotes(address) view returns (uint256)"]), functionName: "getVotes", args: [address as Address], blockNumber: block.number }), facts.decimals)); } catch { /* Holdings do not imply delegated votes. */ }
    return [{ symbol: facts.symbol, name: facts.name, balance: Number(formatUnits(balance, facts.decimals)), votingPower: votes, governanceUrl: `https://explorer.arc.io/address/${token}` }];
  }))).flat();
}

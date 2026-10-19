import { unstable_cache } from "next/cache";
import { createPublicClient, custom, erc20Abi, formatUnits, http, type Address } from "viem";
import { arcMainnet } from "./chains";
import type { GasData, Portfolio, TokenBalance } from "./types";
import { readWalletDiscovery } from "./ascope-wallet-discovery";

export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const rpc = http(arcMainnet.rpcUrls.default.http[0], { batch: { batchSize: 8, wait: 20 }, timeout: 8_000, retryCount: 0 })({chain:arcMainnet,retryCount:0});
let nextRpcAt = 0;
const pacedRpc = custom({request: async (args) => {
  for (let attempt=0; ; attempt++) {
    const start = Math.max(Date.now(),nextRpcAt); nextRpcAt=start+125;
    if (start>Date.now()) await new Promise(resolve=>setTimeout(resolve,start-Date.now()));
    try {return await rpc.request(args);}
    catch(error) {
      if(attempt>=2 || !(error instanceof Error) || !/rate limit|exceeds defined limit|429/i.test(error.message)) throw error;
      await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
    }
  }
}}, {retryCount:0});
export const mainnetClient = createPublicClient({ chain: arcMainnet, transport: pacedRpc });
export const verifyMainnet = unstable_cache(async () => {
  if (await mainnetClient.getChainId() !== 5042) throw new Error("Data provider is not Arc Mainnet (5042)");
  return true;
}, ["ascope-mainnet-chain-v1", arcMainnet.rpcUrls.default.http[0]], { revalidate: 60 });

export async function marketJson(path: string) {
  const response = await fetch(`https://api.geckoterminal.com/api/v2/networks/arc${path}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Arc market data unavailable (${response.status})`);
  return response.json();
}
export function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export const tokenFacts = unstable_cache(async (address: string) => {
  await verifyMainnet();
  const target = address as Address;
  const code = await mainnetClient.getCode({ address: target });
  if (!code || code === "0x") throw new Error("No token contract exists at this address on Arc Mainnet");
  const [name, symbol, decimals, supply] = await Promise.all([
    mainnetClient.readContract({ address: target, abi: erc20Abi, functionName: "name" }),
    mainnetClient.readContract({ address: target, abi: erc20Abi, functionName: "symbol" }),
    mainnetClient.readContract({ address: target, abi: erc20Abi, functionName: "decimals" }),
    mainnetClient.readContract({ address: target, abi: erc20Abi, functionName: "totalSupply" }),
  ]);
  let market = null;
  try {
    const batch = await trackedTokenMarkets();
    if (batch[address.toLowerCase()]) market = batch[address.toLowerCase()];
    else { const body = await marketJson(`/tokens/${address}`); if (body.data?.id?.toLowerCase() === `arc_${address.toLowerCase()}`) market = body.data.attributes; }
  } catch { /* Token remains readable when no market is indexed. */ }
  return { address, name, symbol, decimals, supply: Number(formatUnits(supply, decimals)), price: finiteNumber(market?.price_usd), marketCap: finiteNumber(market?.market_cap_usd), volume24h: finiteNumber(market?.volume_usd?.h24) };
}, ["ascope-token-facts-v2", arcMainnet.rpcUrls.default.http[0]], { revalidate: 60 });

/** Discovery is explicitly limited to configured contracts and returned Arc market tokens. */
export const trackedTokens = unstable_cache(async () => {
  const addresses = new Set<string>([USDC_ADDRESS, ...(process.env.ASCOPE_TOKEN_ADDRESSES ?? "").split(",").map(a => a.trim().toLowerCase()).filter(a => /^0x[0-9a-f]{40}$/.test(a))]);
  try {
    const body = await marketJson("/pools?include=base_token,quote_token");
    for (const token of body.included ?? []) if (token.type === "token" && token.id?.startsWith("arc_") && /^0x[0-9a-f]{40}$/i.test(token.attributes?.address) && BigInt(token.attributes.address) !== BigInt(0)) addresses.add(token.attributes.address.toLowerCase());
  } catch { /* Native balances do not depend on market discovery. */ }
  return [...addresses].slice(0, 30);
}, ["ascope-tracked-tokens-v1"], { revalidate: 300 });

const cachedTokenMarkets = unstable_cache(async () => {
  const addresses = await trackedTokens();
  const body = await marketJson(`/tokens/multi/${addresses.join(",")}`);
  const entries: Record<string, any> = {};
  for (const token of body.data ?? []) if (token.id?.startsWith("arc_") && /^0x[0-9a-f]{40}$/i.test(token.attributes?.address)) entries[token.attributes.address.toLowerCase()] = token.attributes;
  return entries;
}, ["ascope-token-market-batch-v1"], { revalidate: 60 });
let pendingMarkets: ReturnType<typeof cachedTokenMarkets> | null = null;
async function trackedTokenMarkets() {
  if (pendingMarkets) return pendingMarkets;
  const request = cachedTokenMarkets();
  pendingMarkets = request;
  try {return await request;} finally {pendingMarkets=null;}
}

export const readPortfolio = unstable_cache(async (address: string): Promise<Portfolio> => {
  await verifyMainnet();
  const head = await mainnetClient.getBlock({ blockTag: "finalized" });
  const blockNumber = head.number;
  const [native, sentCount, discovery] = await Promise.all([
    mainnetClient.getBalance({ address: address as Address, blockNumber }),
    mainnetClient.getTransactionCount({ address: address as Address, blockNumber }), readWalletDiscovery(address).catch(() => null),
  ]);
  const addresses = discovery ? discovery.tokens.map(t => t.address) : await trackedTokens();
  const issues: string[] = discovery?.discovery === "catalog" ? [`Explorer discovery unavailable (${discovery.discoveryIssue}); balances are verified against the AScope Arc asset catalog. Assets outside this catalog may be missing.`] : discovery ? [] : ["Complete token discovery unavailable; showing tracked contracts only."];
  const quotes: Record<string, number> = {};
  for (let offset = 0; offset < addresses.length; offset += 30) {
    try {
      const body = await marketJson(`/tokens/multi/${addresses.slice(offset, offset + 30).join(",")}`);
      for (const item of body.data ?? []) {
        const price = finiteNumber(item.attributes?.price_usd);
        if (item.id === `arc_${item.attributes?.address?.toLowerCase()}` && price !== null) quotes[item.attributes.address.toLowerCase()] = price;
      }
    } catch { /* Explorer quotes remain available when market quotes are missing. */ }
  }
  const balance = Number(formatUnits(native, 18));
  const tokens: TokenBalance[] = [{ address: USDC_ADDRESS, name: "USD Coin (native)", symbol: "USDC", balance, price: 1, value: balance, change24h: null, allocation: 0 }];
  const unreadableTokens: string[] = [];
  // Native USDC and the 6-decimal ERC-20 facade are the same holdings: count once.
  const candidates = addresses.filter(a => a.toLowerCase() !== USDC_ADDRESS).slice(0, 200);
  if (addresses.length > 200) issues.push("Only the first 200 discovered token contracts were read.");
  for (let offset = 0; offset < candidates.length; offset += 5) {
    await Promise.all(candidates.slice(offset, offset + 5).map(async tokenAddress => {
      try {
        const amount = await mainnetClient.readContract({ address: tokenAddress as Address, abi: erc20Abi, functionName: "balanceOf", args: [address as Address], blockNumber });
        if (!amount) return;
        const indexed = discovery?.tokens.find(t => t.address === tokenAddress);
        const facts = indexed ? { address: tokenAddress, name: indexed.name, symbol: indexed.symbol, decimals: await mainnetClient.readContract({ address: tokenAddress as Address, abi: erc20Abi, functionName: "decimals", blockNumber }), price: quotes[tokenAddress] ?? indexed.price } : await tokenFacts(tokenAddress);
        const tokenBalance = Number(formatUnits(amount, facts.decimals));
        tokens.push({ ...facts, balance: tokenBalance, value: facts.price === null ? null : tokenBalance * facts.price, change24h: null, allocation: 0 });
      } catch { unreadableTokens.push(tokenAddress); }
    }));
  }
  const totalValue = tokens.reduce((sum, token) => sum + (token.value ?? 0), 0);
  let nftCount: number | null = null, nftCollections: number | null = null;
  if (discovery) {
    try {
      const counts = await Promise.all(discovery.collections.map(async c => c.type === "ERC-721" ? Number(await mainnetClient.readContract({ address: c.address as Address, abi: erc20Abi, functionName: "balanceOf", args: [address as Address], blockNumber })) : c.count));
      if (counts.some(n => !Number.isSafeInteger(n) || n < 0)) throw Error("Invalid NFT count");
      nftCount = counts.reduce((sum, n) => sum + n, 0);
      nftCollections = counts.filter(n=>n>0).length;
    } catch { issues.push("NFT ownership count could not be fully verified."); }
  }
  for (const token of tokens) token.allocation = totalValue ? (token.value ?? 0) / totalValue * 100 : 0;
  return { address, totalValue, walletValue: totalValue, change24h: null, tokenCount: tokens.length, nftCount, nftCollections, transactionCount: sentCount, tokens, blockNumber: String(blockNumber), updatedAt: new Date().toISOString(), coverage: "ArcScan-discovered tokens (or the AScope contract catalog when discovery is unavailable) with finalized on-chain balances. Prices: GeckoTerminal, with ArcScan quotes as fallback. Unpriced assets and NFT market values are excluded. Native USDC is counted once at $1 per unit. ERC-721 counts are verified on-chain; ERC-1155 quantities follow the explorer snapshot.", unreadableTokens, coverageIssues: issues };
}, ["ascope-portfolio-v4", arcMainnet.rpcUrls.default.http[0]], { revalidate: 60 });

export const readRecentBlocks = unstable_cache(async () => {
  await verifyMainnet();
  const head = await mainnetClient.getBlock({ blockTag: "finalized" });
  const blocks = [];
  for (let offset = 0; offset < 60; offset += 20) blocks.push(...await Promise.all(Array.from({ length: Math.min(20, Number(head.number) - offset + 1) }, (_, index) => mainnetClient.getBlock({ blockNumber: head.number - BigInt(offset + index), includeTransactions: true }))));
  return blocks.map(block => ({ number: Number(block.number), timestamp: Number(block.timestamp) * 1000, transactionCount: block.transactions.length, addresses: [...new Set(block.transactions.flatMap(tx => [tx.from, ...(tx.to ? [tx.to] : [])]).map(a => a.toLowerCase()))] })).sort((a,b) => a.number - b.number);
}, ["ascope-network-blocks-v1", arcMainnet.rpcUrls.default.http[0]], { revalidate: 30 });

export async function readNetwork() {
  const [blocks, gas] = await Promise.all([readRecentBlocks(), mainnetClient.getGasPrice()]);
  const seconds = (blocks.at(-1)!.timestamp - blocks[0].timestamp) / 1000;
  const measured = blocks.slice(1);
  const bins = new Map<number, {count: number; addresses: Set<string>}>();
  for (const block of measured) {
    const bin = bins.get(block.timestamp) ?? {count:0,addresses:new Set<string>()};
    bin.count += block.transactionCount;
    for (const address of block.addresses) bin.addresses.add(address);
    bins.set(block.timestamp,bin);
  }
  return { name: "Arc Mainnet", tps: seconds > 0 ? measured.reduce((sum,b) => sum + b.transactionCount, 0) / seconds : 0, blockTime: seconds / measured.length, gas: Number(gas) / 1e9, dailyTransactions: null, activeAddresses: new Set(blocks.flatMap(b => b.addresses)).size,
    fromBlock: blocks[0].number, toBlock: blocks.at(-1)!.number, updatedAt: new Date().toISOString(), history: [...bins].map(([time,bin]) => ({time:new Date(time).toISOString(),tps:bin.count,addresses:bin.addresses.size})) };
}

export async function readGas(): Promise<GasData> {
  await verifyMainnet();
  const head = await mainnetClient.getBlock({ blockTag: "finalized" });
  const fees = await mainnetClient.getFeeHistory({ blockCount: 60, blockNumber: head.number, rewardPercentiles: [10, 50, 90] });
  const blocks = await readRecentBlocks();
  const byBlock = new Map(blocks.map(b => [b.number, b.timestamp]));
  const med = (values: bigint[]) => [...values].sort((a,b) => a < b ? -1 : a > b ? 1 : 0)[Math.floor(values.length/2)] ?? BigInt(0);
  const base = fees.baseFeePerGas.at(-1)!;
  const waitSeconds = blocks.length > 1 ? (blocks.at(-1)!.timestamp - blocks[0].timestamp) / 1000 / (blocks.length - 1) : null;
  const tiers = (["slow", "standard", "fast"] as const).map((name,i) => {
    const gwei = Number(base + med((fees.reward ?? []).map(row => row[i]))) / 1e9;
    return { name, gwei, usd: gwei * 21_000 * 1e-9, waitSeconds };
  });
  return { tiers, nativePrice: 1, nativeSymbol: "USDC", updatedAt: new Date().toISOString(), history: fees.baseFeePerGas.slice(0,-1).flatMap((fee,i) => {
    const timestamp = byBlock.get(Number(fees.oldestBlock) + i);
    if (!timestamp) return [];
    const rewards = fees.reward?.[i] ?? [BigInt(0),BigInt(0),BigInt(0)];
    return [{ time: new Date(timestamp).toISOString(), slow: Number(fee + rewards[0]) / 1e9, standard: Number(fee + rewards[1]) / 1e9, fast: Number(fee + rewards[2]) / 1e9 }];
  }), coverage: "Observed 10th/50th/90th percentile priority fees plus base fee in 60 finalized blocks. Transfer costs assume 21,000 gas; inclusion times are not guaranteed." };
}

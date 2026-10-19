import { load } from "cheerio";
import { unstable_cache } from "next/cache";
import type { NFTAsset } from "./types";
import { arcAssetCatalog } from "./ascope-arc-asset-catalog";

const scan = "https://arc.etherscan.io";
const addressPattern = /^0x[0-9a-f]{40}$/i;
export function parseWalletDiscovery(html: string, address: string) {
  const $ = load(html), root = $("#ContentPlaceHolder1_tokenbalance");
  if (!addressPattern.test(address) || !$("title").text().includes("ArcScan") || !html.toLowerCase().includes(address.toLowerCase()) || !root.length) throw Error("Wallet holdings discovery unavailable");
  const tokens: { address: string; name: string; symbol: string; price: number | null }[] = [];
  const collections: { address: string; name: string; symbol: string; count: number; type: string }[] = [];
  root.find('a[href^="/token/"]').each((_, element) => {
    const link = $(element), url = new URL(link.attr("href")!, scan);
    const contract = url.pathname.split("/")[2]?.toLowerCase();
    if (!addressPattern.test(contract) || url.searchParams.get("a")?.toLowerCase() !== address.toLowerCase()) throw Error("Unexpected wallet holding address");
    const type = link.find(".badge").toArray().map(e => $(e).text().trim()).find(t => /^ERC-(721|1155)$/.test(t));
    const name = link.find(".list-name [data-bs-title]").attr("data-bs-title") ?? link.find(".list-name").text().trim();
    const symbol = link.find("img").attr("alt") || contract;
    if (type) {
      const countText = link.find(".badge").toArray().map(e => $(e).text().trim()).find(t => /^x[\d,]+$/.test(t));
      collections.push({ address: contract, name, symbol, count: countText ? Number(countText.slice(1).replace(/,/g, "")) : 1, type });
    } else {
      const rate = link.find(".list-usd-rate").text().replace(/[@,$\s]/g, "");
      const price = rate && Number.isFinite(Number(rate)) && Number(rate) > 0 ? Number(rate) : null;
      tokens.push({ address: contract, name: name.replace(/ \([^)]*\)$/, ""), symbol, price });
    }
  });
  const text = root.text().replace(/\s+/g, " ");
  const expectedTokens = Number(text.match(/ERC-20 Tokens\s*\(([\d,]+)\)/)?.[1]?.replace(/,/g, "") ?? 0);
  const expectedCollections = Number(text.match(/NFT Tokens\s*\(([\d,]+)\)/)?.[1]?.replace(/,/g, "") ?? 0);
  if (tokens.length !== expectedTokens || collections.length !== expectedCollections) throw Error("Explorer wallet discovery is incomplete");
  return { tokens, collections, source: `${scan}/address/${address}`, discovery: "explorer" as const, discoveryIssue: null as string | null };
}

export const readWalletDiscovery = unstable_cache(async (address: string) => {
  if (!addressPattern.test(address)) throw Error("Invalid wallet address");
  try {
    const r = await fetch(`${scan}/address/${address}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw Error(`Explorer HTTP ${r.status}`);
    return parseWalletDiscovery(await r.text(), address);
  } catch (error) {
    // Use a transparent contract catalog when discovery is unavailable. Ownership
    // and balances are still read from RPC; never ship account-specific snapshots.
    return { tokens: arcAssetCatalog.tokens, collections: arcAssetCatalog.collections, source: scan, discovery: "catalog" as const, discoveryIssue: error instanceof Error ? error.message : "Explorer unavailable" };
  }
}, ["ascope-wallet-discovery-v2"], { revalidate: 60 });

export function parseNftInventory(html: string, contract: string, collection: string) {
  const $ = load(html), items: NFTAsset[] = [];
  if (!/A total of [\d,]+ token/i.test($("body").text())) throw Error("NFT inventory unavailable");
  $('a[href^="/token/"]').each((_, el) => {
    const url = new URL($(el).attr("href")!, scan), tokenId = url.searchParams.get("a");
    if (url.pathname.toLowerCase() !== `/token/${contract.toLowerCase()}` || !tokenId || !/^\d+$/.test(tokenId)) return;
    const id = `${contract}:${tokenId}`;
    if (!items.some(n => n.id === id)) items.push({ id, contractAddress: contract, tokenId, name: `${collection} #${tokenId}`, collection, image: "", traits: [], sourceUrl: `${scan}/nft/${contract}/${tokenId}` });
  });
  const pageCount = Number($("body").text().match(/Page\s+\d+\s+of\s+(\d+)/i)?.[1] ?? 1);
  const total = Number($("body").text().match(/A total of ([\d,]+) token/i)?.[1].replace(/,/g, ""));
  return { items, pageCount, total };
}

export const readCollectionInventory = unstable_cache(async (address: string, contract: string, name: string) => {
  if (![address, contract].every(a => addressPattern.test(a))) throw Error("Invalid NFT inventory address");
  const items: NFTAsset[] = [];
  let pages = 1, expected = 0;
  for (let page = 1; page <= pages; page++) {
    const url = `${scan}/token/generic-tokenholder-inventory?m=light&contractAddress=${contract}&a=${address}&pUrl=token&p=${page}`;
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw Error("NFT inventory unavailable");
    const result = parseNftInventory(await r.text(), contract, name);
    pages = result.pageCount;
    expected = result.total;
    if (pages > 20) throw Error("NFT collection exceeds inventory page limit");
    items.push(...result.items);
  }
  if (items.length !== expected || new Set(items.map(i=>i.id)).size !== expected) throw Error("Incomplete NFT inventory");
  return items;
}, ["ascope-nft-inventory-v1"], { revalidate: 60 });

import { unstable_cache } from "next/cache";
import { finiteNumber, marketJson, tokenFacts } from "./ascope-mainnet";
import { readTokenTransfers } from "./ascope-activity";
import { indexedJson } from "./ascope-indexer";
export const readTokenAnalytics = unstable_cache(async (address: string) => {
  const facts = await tokenFacts(address);
  const unavailable: string[] = [];
  let candles: Array<{time: number; open: number; high: number; low: number; close: number; volume: number}> = [];
  let sourceUrl: string | null = null;
  try {
    const pools = await marketJson(`/tokens/${address}/pools`);
    const matching = (pools.data ?? []).filter((p: any) => p.id?.startsWith("arc_") && [p.relationships?.base_token?.data?.id, p.relationships?.quote_token?.data?.id].some((id: string) => id?.toLowerCase() === `arc_${address.toLowerCase()}`)).sort((a: any,b: any) => Number(b.attributes.reserve_in_usd) - Number(a.attributes.reserve_in_usd));
    const pool = matching[0];
    if (!pool) throw new Error("No tracked pool");
    const market = await marketJson(`/pools/${pool.attributes.address}/ohlcv/hour?aggregate=1&limit=168&currency=usd&token=${address}`);
    const base = market.meta?.base?.address?.toLowerCase(), quote = market.meta?.quote?.address?.toLowerCase();
    if (base && quote && base !== address.toLowerCase() && quote !== address.toLowerCase()) throw new Error("Market token mismatch");
    candles = (market.data?.attributes?.ohlcv_list ?? []).filter((p: unknown[]) => Array.isArray(p) && p.length >= 6 && p.slice(0,6).every(v => typeof v === "number" && Number.isFinite(v) && v >= 0)).map((p: number[]) => ({time:p[0],open:p[1],high:p[2],low:p[3],close:p[4],volume:p[5]})).sort((a: any,b: any) => a.time-b.time);
    sourceUrl = `https://www.geckoterminal.com/arc/pools/${pool.attributes.address}`;
    if (!candles.length) unavailable.push("Hourly price history");
  } catch { unavailable.push("Hourly price history"); }
  let transfers: Awaited<ReturnType<typeof readTokenTransfers>> | null = null;
  try { transfers = await readTokenTransfers(address); } catch { unavailable.push("Recent transfers"); }
  let holders: Array<{address: string; balance: number}> = [];
  try {
    const body = await indexedJson(`/tokens/${address}/holders`);
    if (!Array.isArray(body.items)) throw new Error("Invalid holder index");
    holders = body.items.map((item: any) => ({address:item.address?.hash,balance:finiteNumber(item.value) === null ? null : Number(item.value)/10**facts.decimals})).filter((h: any) => /^0x[0-9a-f]{40}$/i.test(h.address) && h.balance !== null);
  } catch { unavailable.push("Holder rankings"); }
  return {...facts, candles, transfers: transfers?.items ?? [], transferCoverage: transfers?.coverage, holders, unavailable, sourceUrl, updatedAt: new Date().toISOString()};
}, ["ascope-token-analytics-v1"], {revalidate:60});

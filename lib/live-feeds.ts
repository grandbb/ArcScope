import type { TrendingToken, WhaleTransaction } from "./types";

export const USDC_EMITTER = "0xfffffffffffffffffffffffffffffffffffffffe";
export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const WHALE_BLOCK_WINDOW = 120;
export interface TransferLog {
  address: string; topics: string[]; data: string; transactionHash: string;
  blockNumber: string; logIndex: string; removed?: boolean;
}
export interface WhaleFeed {
  data: WhaleTransaction[];
  meta: { fromBlock: number; toBlock: number; fetchedAt: string };
}

export async function readTransferWindow(from: number, to: number, read: (start: number, end: number) => Promise<TransferLog[]>): Promise<TransferLog[]> {
  async function chunk(start: number, end: number): Promise<TransferLog[]> {
    try { return await read(start, end); }
    catch (error) {
      if (start === end || !(error instanceof Error) || !/max.*results|range|too many/i.test(error.message)) throw error;
      const middle = Math.floor((start + end) / 2);
      return [...await chunk(start, middle), ...await chunk(middle + 1, end)];
    }
  }
  const ranges: Promise<TransferLog[]>[] = [];
  for (let start = from; start <= to; start += 30) ranges.push(chunk(start, Math.min(start + 29, to)));
  return (await Promise.all(ranges)).flat();
}

export function whaleCandidates(logs: TransferLog[]): TransferLog[] {
  const unique = new Map<string, TransferLog>();
  for (const log of logs) {
    if (log.removed || log.address.toLowerCase() !== USDC_EMITTER || log.topics[0] !== TRANSFER_TOPIC || log.topics.length !== 3) continue;
    if (!/^0x[0-9a-f]{64}$/i.test(log.data) || !log.topics.slice(1).every(t => /^0x[0-9a-f]{64}$/i.test(t))) continue;
    // Exclude mint/burn. Read only the unified 18-decimal emitter to avoid double counting.
    if (log.topics.slice(1).some(t => BigInt(t) === BigInt(0)) || BigInt(log.data) < BigInt("100000000000000000000000")) continue;
    unique.set(`${log.transactionHash}:${log.logIndex}`, log);
  }
  return [...unique.values()].sort((a, b) => parseInt(b.blockNumber, 16) - parseInt(a.blockNumber, 16) || parseInt(b.logIndex, 16) - parseInt(a.logIndex, 16)).slice(0, 10);
}

interface Pool {
  id: string;
  attributes: { address: string; base_token_price_usd: string | null; reserve_in_usd: string; market_cap_usd: string | null; price_change_percentage: { h1?: string; h24?: string }; volume_usd: { h24?: string } };
  relationships: { base_token: { data: { id: string } } };
}
interface Token { id: string; type: string; attributes: { address: string; name: string; symbol: string } }
export interface PoolResponse { data: Pool[]; included: Token[] }
function numeric(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

/** Rank one representative (most liquid returned) pool per token, not chain-wide totals. */
export function poolMovers(response: PoolResponse): TrendingToken[] {
  if (!Array.isArray(response.data) || !Array.isArray(response.included)) throw new Error("Invalid market response");
  const tokens = new Map(response.included.filter(t => t.type === "token" && t.id.startsWith("arc_")).map(t => [t.id, t.attributes]));
  const selected = new Map<string, { liquidity: number; token: TrendingToken }>();
  for (const pool of response.data) {
    if (!pool.id.startsWith("arc_")) continue;
    const token = tokens.get(pool.relationships?.base_token?.data?.id);
    const a = pool.attributes;
    if (!token || !/^0x[0-9a-f]{40}$/i.test(token.address) || !/^0x[0-9a-f]{40,64}$/i.test(a.address)) continue;
    const price = numeric(a.base_token_price_usd), volume = numeric(a.volume_usd?.h24), liquidity = numeric(a.reserve_in_usd), change = numeric(a.price_change_percentage?.h24);
    if (price === null || price <= 0 || volume === null || volume <= 0 || liquidity === null || liquidity < 10_000 || change === null) continue;
    const key = token.address.toLowerCase();
    if ((selected.get(key)?.liquidity ?? -1) >= liquidity) continue;
    const marketCap = numeric(a.market_cap_usd);
    selected.set(key, { liquidity, token: {
      rank: 0, address: token.address, name: token.name, symbol: token.symbol, price,
      change1h: numeric(a.price_change_percentage?.h1), change24h: change, change7d: null,
      volume24h: volume, marketCap: marketCap !== null && marketCap >= 0 ? marketCap : null,
      sourceUrl: `https://www.geckoterminal.com/arc/pools/${a.address}`,
    } });
  }
  return [...selected.values()].map(x => x.token).sort((a, b) => Math.abs(b.change24h!) - Math.abs(a.change24h!)).slice(0, 10).map((token, index) => ({ ...token, rank: index + 1 }));
}

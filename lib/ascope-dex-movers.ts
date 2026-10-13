import type { TrendingToken } from "./types";

// DEX Screener indexes Arc's ERC-20 USDC interface and native USDC separately.
export const ARC_MOVERS_QUOTES = [
  "0x3600000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000",
] as const;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function numeric(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** One most-liquid returned Arc USDC pool per base-token contract, ranked by absolute movement. */
export function dexScreenerMovers(responses: unknown[]): TrendingToken[] {
  const selected = new Map<string, { liquidity: number; token: TrendingToken }>();
  for (const response of responses) {
    if (!Array.isArray(response)) throw new Error("Invalid DEX Screener response");
    for (const value of response) {
      const pair = record(value), base = record(pair.baseToken), quote = record(pair.quoteToken);
      const quoteAddress = quote.address;
      if (pair.chainId !== "arc" || typeof pair.pairAddress !== "string"
        || !/^0x(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(pair.pairAddress)
        || typeof base.address !== "string" || !/^0x[0-9a-f]{40}$/i.test(base.address)
        || typeof base.name !== "string" || !base.name.trim()
        || typeof base.symbol !== "string" || !base.symbol.trim()
        || typeof quoteAddress !== "string"
        || !ARC_MOVERS_QUOTES.some(address => address === quoteAddress.toLowerCase())) continue;
      const liquidity = numeric(record(pair.liquidity).usd);
      const price = numeric(pair.priceUsd), volume24h = numeric(record(pair.volume).h24);
      const changes = record(pair.priceChange), change24h = numeric(changes.h24);
      if (liquidity === null || liquidity < 10_000 || price === null || price <= 0
        || volume24h === null || volume24h <= 0 || change24h === null) continue;
      const key = base.address.toLowerCase();
      if ((selected.get(key)?.liquidity ?? -1) >= liquidity) continue;
      const marketCap = numeric(pair.marketCap);
      selected.set(key, { liquidity, token: {
        rank: 0, address: key, name: base.name, symbol: base.symbol, price,
        change1h: numeric(changes.h1), change24h, change7d: null, volume24h,
        marketCap: marketCap !== null && marketCap >= 0 ? marketCap : null,
        sourceUrl: `https://dexscreener.com/arc/${pair.pairAddress.toLowerCase()}`,
      } });
    }
  }
  return [...selected.values()].map(item => item.token)
    .sort((a, b) => Math.abs(b.change24h!) - Math.abs(a.change24h!) || a.address.localeCompare(b.address))
    .slice(0, 10).map((token, index) => ({ ...token, rank: index + 1 }));
}

export async function readArcDexMovers(read: (address: string) => Promise<unknown>): Promise<TrendingToken[]> {
  const results = await Promise.allSettled(ARC_MOVERS_QUOTES.map(address => read(address)));
  return dexScreenerMovers(results.map(result => {
    if (result.status === "rejected") throw new Error("Arc DEX Screener pools unavailable", { cause: result.reason });
    return result.value;
  }));
}

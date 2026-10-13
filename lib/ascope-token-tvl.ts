export interface ArcTvlToken {
  rank: number;
  address: string;
  name: string;
  symbol: string;
  tvlUsd: number;
  priceUsd: number | null;
  volume24hUsd: number | null;
  sourceUrl: string;
}

export interface ArcTokenTvlFeed {
  data: ArcTvlToken[];
  meta: {
    source: "GeckoTerminal";
    fetchedAt: string;
    poolsScanned: number;
    tokensScanned: number;
    unavailableTokens: number;
  };
}

// Keep a cold refresh to seven provider requests at most (3 pages + 4 token batches).
// The public API shares a small rate limit with the other Arc dashboard feeds.
export const ARC_TVL_POOL_PAGES = 3;
const TOKEN_BATCH_SIZE = 30;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function usd(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function arcAddress(id: unknown): string | null {
  return typeof id === "string" && /^arc_0x[0-9a-f]{40}$/i.test(id)
    ? id.slice(4).toLowerCase() : null;
}

function rows(value: unknown): unknown[] {
  const data = record(value).data;
  if (!Array.isArray(data)) throw new Error("Invalid Arc liquidity response");
  return data;
}

/** Discover both sides of the provider's top pools; pool reserves are never token TVL. */
export function discoverArcTvlTokens(pages: unknown[]): { addresses: string[]; poolsScanned: number } {
  const pools = new Set<string>();
  const addresses = new Set<string>();
  for (const page of pages) {
    for (const value of rows(page)) {
      const pool = record(value);
      if (pool.type !== "pool" || typeof pool.id !== "string" || !/^arc_0x[0-9a-f]{40,64}$/i.test(pool.id)) continue;
      const relationships = record(pool.relationships);
      const base = arcAddress(record(record(relationships.base_token).data).id);
      const quote = arcAddress(record(record(relationships.quote_token).data).id);
      if (!base || !quote) throw new Error("Arc pool token addresses unavailable");
      pools.add(pool.id.toLowerCase());
      addresses.add(base);
      addresses.add(quote);
    }
  }
  return { addresses: [...addresses].sort(), poolsScanned: pools.size };
}

/** Use each token's own USD reserves across indexed Arc pools, without summing pair TVL. */
export function rankArcTvlTokens(responses: unknown[], addresses: string[]): {
  data: ArcTvlToken[]; unavailableTokens: number;
} {
  const candidates = new Set(addresses.map(address => address.toLowerCase()));
  const reported = new Set<string>();
  const tokens = new Map<string, ArcTvlToken>();
  for (const response of responses) {
    for (const value of rows(response)) {
      const token = record(value);
      const address = arcAddress(token.id);
      const attributes = record(token.attributes);
      if (token.type !== "token" || !address || !candidates.has(address)
        || typeof attributes.address !== "string" || attributes.address.toLowerCase() !== address) continue;
      const tvlUsd = usd(attributes.total_reserve_in_usd);
      if (tvlUsd === null || typeof attributes.name !== "string" || !attributes.name.trim()
        || typeof attributes.symbol !== "string" || !attributes.symbol.trim()) continue;
      reported.add(address);
      if (tvlUsd === 0 || tokens.has(address)) continue;
      tokens.set(address, {
        rank: 0, address, name: attributes.name, symbol: attributes.symbol, tvlUsd,
        priceUsd: usd(attributes.price_usd), volume24hUsd: usd(record(attributes.volume_usd).h24),
        sourceUrl: `https://www.geckoterminal.com/arc/tokens/${address}`,
      });
    }
  }
  return {
    data: [...tokens.values()].sort((a, b) => b.tvlUsd - a.tvlUsd || a.address.localeCompare(b.address))
      .slice(0, 10).map((token, index) => ({ ...token, rank: index + 1 })),
    unavailableTokens: candidates.size - reported.size,
  };
}

export async function readArcTokenTvl(read: (path: string) => Promise<unknown>): Promise<ArcTokenTvlFeed> {
  // A failed page or batch must not silently produce an incomplete leaderboard.
  const pages = await Promise.allSettled(Array.from({ length: ARC_TVL_POOL_PAGES },
    (_, index) => read(`networks/arc/pools?page=${index + 1}`)));
  const discovery = discoverArcTvlTokens(pages.map(result => {
    if (result.status === "rejected") throw new Error("Arc pool discovery unavailable", { cause: result.reason });
    return result.value;
  }));
  const batches: string[][] = [];
  for (let start = 0; start < discovery.addresses.length; start += TOKEN_BATCH_SIZE) {
    batches.push(discovery.addresses.slice(start, start + TOKEN_BATCH_SIZE));
  }
  const responses = await Promise.allSettled(batches.map(batch =>
    read(`networks/arc/tokens/multi/${batch.join(",")}`)));
  const ranking = rankArcTvlTokens(responses.map(result => {
    if (result.status === "rejected") throw new Error("Arc token reserves unavailable", { cause: result.reason });
    return result.value;
  }), discovery.addresses);
  return {
    data: ranking.data,
    meta: {
      source: "GeckoTerminal", fetchedAt: new Date().toISOString(),
      poolsScanned: discovery.poolsScanned, tokensScanned: discovery.addresses.length,
      unavailableTokens: ranking.unavailableTokens,
    },
  };
}

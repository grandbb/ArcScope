"use client";
import { useTrendingTokens } from "@/hooks/useTrendingTokens";
import { TrendingTokens } from "@/components/trending/TrendingTokens";
import { TableSkeleton } from "@/components/shared/Skeleton";
export function TopMovers() {
  const query = useTrendingTokens();
  return <section><div className="mb-4 flex items-center gap-3"><span className="brand-gradient h-8 w-1 rounded-full" /><div><h2 className="font-bold tracking-tight">Top movers</h2><p className="text-xs text-muted-foreground">Arc DEX pool prices · largest 24h moves, up or down</p></div></div>{query.isLoading ? <TableSkeleton /> : <TrendingTokens tokens={query.data ?? []} error={query.isError} onRetry={() => void query.refetch()} />}</section>;
}

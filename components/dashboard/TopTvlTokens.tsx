"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Landmark, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMetric } from "@/lib/dashboard";
import { ARC_TVL_POOL_PAGES, type ArcTokenTvlFeed } from "@/lib/ascope-token-tvl";

const fullUsd = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 2,
}).format(value);

export function TopTvlTokens() {
  const query = useQuery({
    queryKey: ["token-tvl", "arc-mainnet"],
    queryFn: async (): Promise<ArcTokenTvlFeed> => {
      const response = await fetch("/api/token-tvl");
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Arc token TVL unavailable");
      }
      return response.json();
    },
    staleTime: 60_000, refetchInterval: 60_000, retry: false,
  });
  const feed = query.data;
  const outdated = feed && Date.now() - Date.parse(feed.meta.fetchedAt) > 10 * 60_000;
  return <section aria-labelledby="top-tvl-tokens" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="brand-gradient h-8 w-1 rounded-full" />
        <div><h2 id="top-tvl-tokens" className="font-bold tracking-tight">Top 10 tokens by TVL</h2>
          <p className="mt-1 text-xs text-muted-foreground">Arc Mainnet · DEX liquidity in USD · highest to lowest</p></div>
      </div>
      <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}
        aria-label="Refresh token TVL" className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted disabled:opacity-50">
        <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
      </button>
    </div>
    <div className="glass overflow-hidden rounded-2xl">
      <p className="border-b p-4 text-xs leading-relaxed text-muted-foreground">
        TVL is each token’s USD reserves across GeckoTerminal-indexed Arc DEX pools. Candidates come from up to {ARC_TVL_POOL_PAGES * 20} top Arc pools; lending and other DeFi deposits are excluded.
      </p>
      {query.isError && <p role="alert" className="border-b border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-500">
        {feed ? "Unable to refresh token TVL. Previously fetched rankings may be outdated." : query.error.message}{" "}
        <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className="underline disabled:opacity-50">Retry</button>
      </p>}
      {!!feed?.meta.unavailableTokens && <p role="status" className="border-b border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-500">
        TVL was not reported for {feed.meta.unavailableTokens} discovered tokens. Rankings include only tokens with reported reserves.
      </p>}
      {outdated && !query.isError && <p role="status" className="border-b border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-500">
        Showing the last available snapshot. TVL data is more than 10 minutes old; updates will resume when the provider recovers.
      </p>}
      {query.isLoading ? <div role="status" aria-label="Loading token TVL"><TableSkeleton rows={10} /></div>
        : feed?.data.length ? <Table className="min-w-[640px]">
          <TableHeader><TableRow>
            <TableHead scope="col" className="w-16 pl-4">Rank</TableHead>
            <TableHead scope="col">Token</TableHead>
            <TableHead scope="col" className="text-right">TVL · USD</TableHead>
            <TableHead scope="col" className="text-right">Price</TableHead>
            <TableHead scope="col" className="pr-4 text-right">Volume · 24h</TableHead>
          </TableRow></TableHeader>
          <TableBody>{feed.data.map(token => <TableRow key={token.address}>
            <TableCell className="pl-4 font-mono text-muted-foreground">{String(token.rank).padStart(2, "0")}</TableCell>
            <TableCell className="py-3">
              <a href={token.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-medium text-primary hover:underline">
                {token.symbol}<ExternalLink className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only"> · View {token.name} on GeckoTerminal (opens in a new tab)</span>
              </a>
              <p className="max-w-56 truncate text-xs text-muted-foreground" title={token.name}>{token.name}</p>
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground" title={token.address}>{token.address.slice(0, 6)}…{token.address.slice(-4)}</p>
            </TableCell>
            <TableCell className="text-right font-mono font-semibold text-primary" title={fullUsd(token.tvlUsd)}>{formatMetric(token.tvlUsd, true)}</TableCell>
            <TableCell className="text-right font-mono">{token.priceUsd === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumSignificantDigits: 6 }).format(token.priceUsd)}</TableCell>
            <TableCell className="pr-4 text-right font-mono" title={token.volume24hUsd === null ? undefined : fullUsd(token.volume24hUsd)}>{token.volume24hUsd === null ? "—" : formatMetric(token.volume24hUsd, true)}</TableCell>
          </TableRow>)}</TableBody>
        </Table> : feed && <EmptyState icon={Landmark} title="No Arc token TVL available" description="No tokens with positive reported DEX reserves were returned. Use Refresh to check again." />}
      <div className="flex flex-wrap justify-between gap-2 border-t p-4 text-xs text-muted-foreground">
        <p>Source: <a href="https://www.geckoterminal.com/arc/pools" target="_blank" rel="noreferrer" className="underline underline-offset-4">GeckoTerminal</a> · checks every minute · shared snapshots update about every 5 min · — means not reported</p>
        {feed && <p>{feed.meta.poolsScanned} pools · {feed.meta.tokensScanned} tokens scanned · Fetched <time dateTime={feed.meta.fetchedAt}>{new Date(feed.meta.fetchedAt).toLocaleTimeString()}</time></p>}
      </div>
    </div>
  </section>;
}

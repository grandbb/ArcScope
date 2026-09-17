"use client";
import type { TrendingToken } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
export function TrendingTokens({ tokens, error, onRetry }: { tokens: TrendingToken[]; error?: boolean; onRetry?: () => void }) {
  if (error) return <p role="alert" className="rounded-xl border p-5 text-sm text-amber-500">Arc market data unavailable. <button onClick={onRetry} className="underline">Retry</button></p>;
  if (!tokens.length) return <EmptyState title="No qualifying Arc pools" description="No tokens with sufficient liquidity and price-change data were returned by the provider." />;
  return <div className="glass overflow-hidden rounded-2xl">
    <p className="border-b p-4 text-xs leading-relaxed text-muted-foreground">Source: <a href="https://www.geckoterminal.com/arc/pools" target="_blank" rel="noreferrer" className="underline">GeckoTerminal</a> · Ranked by absolute 24h price change among returned top Arc pools with ≥$10,000 liquidity. One representative pool per token; volume is pool-specific. Refreshes every 60s. — means not reported.</p>
    <div className="overflow-x-auto"><Table className="min-w-[850px]"><TableHeader><TableRow>{["Rank", "Token / source pool", "Price", "1h", "24h", "7d", "Pool volume · 24h", "Market cap"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{tokens.map(token => <TableRow key={token.address}>
        <TableCell className="font-mono">{String(token.rank).padStart(2, "0")}</TableCell>
        <TableCell><a href={token.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">{token.name} ↗</a><p className="text-xs text-muted-foreground" title={token.address}>{token.symbol}</p></TableCell>
        <TableCell className="font-mono">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumSignificantDigits: 6 }).format(token.price)}</TableCell>
        {[token.change1h, token.change24h, token.change7d].map((change, index) => <TableCell key={index} className={`font-mono ${change === null ? "text-muted-foreground" : change >= 0 ? "text-emerald-500" : "text-red-500"}`}>{change === null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}</TableCell>)}
        <TableCell className="font-mono">${formatNumber(token.volume24h)}</TableCell><TableCell className="font-mono">{token.marketCap === null ? "—" : `$${formatNumber(token.marketCap)}`}</TableCell>
      </TableRow>)}</TableBody>
    </Table></div>
  </div>;
}

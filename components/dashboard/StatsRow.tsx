"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, BarChart3, CalendarDays, Coins, Fuel, Landmark, Layers, RefreshCw } from "lucide-react";
import { formatMetric, type DashboardMetrics } from "@/lib/dashboard";
import { StatCard } from "./StatCard";

export function StatsRow() {
  const query = useQuery({
    queryKey: ["dashboard", "arc-mainnet"],
    queryFn: async (): Promise<DashboardMetrics> => {
      const response = await fetch("/api/dashboard");
      if (!response.ok) throw new Error("Dashboard metrics unavailable");
      return (await response.json()).data;
    },
    staleTime: 60_000, refetchInterval: 60_000, retry: 1,
  });
  const data = query.data;
  const usd = (value: number | null | undefined) => formatMetric(value ?? null, true);
  const cards = [
    { label: "TOTAL VALUE LOCKED (TVL)", value: usd(data?.tvl), detail: "USD locked in Arc DeFi protocols", icon: Landmark, highlight: true },
    { label: "DEX TOTAL VOLUME", value: usd(data?.dexVolumeTotal), detail: "All-time tracked trading volume · USD", icon: BarChart3, highlight: true },
    { label: "DEX VOLUME · 24H", value: usd(data?.dexVolume24h), detail: "Trading volume over the last 24 hours", icon: ArrowLeftRight, change: data?.dexChange24h },
    { label: "DEX VOLUME · 7D", value: usd(data?.dexVolume7d), detail: "Trading volume over the last 7 days", icon: CalendarDays, change: data?.dexChange7d, changeLabel: "previous 7d", unavailableChangeLabel: "previous 7d" },
    { label: "DEX VOLUME · 30D", value: usd(data?.dexVolume30d), detail: "Trading volume over the last 30 days", icon: CalendarDays, change: data?.dexChange30d, changeLabel: "previous 30d", unavailableChangeLabel: "previous 30d" },
    { label: "PROTOCOL FEES · 24H", value: usd(data?.fees24h), detail: "Fees paid to tracked Arc protocols · USD", icon: Coins, change: data?.feesChange24h, changeLabel: "previous 24h" },
    { label: "TRACKED DEX PROTOCOLS", value: formatMetric(data?.dexProtocols ?? null), detail: "Protocols listed in DefiLlama’s Arc DEX dataset", icon: Layers },
    { label: "CURRENT GAS PRICE", value: data?.gasGwei == null ? "Unavailable" : `${formatMetric(data.gasGwei)} Gwei`, detail: "Arc RPC quote · network fees paid in USDC", icon: Fuel },
  ];
  return <section aria-labelledby="ecosystem-metrics" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="ecosystem-metrics" className="font-bold tracking-tight">Arc ecosystem overview</h2>
        <p className="mt-1 text-xs text-muted-foreground">Mainnet · USD metrics · refreshes every minute</p></div>
      <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted disabled:opacity-50">
        <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
      </button>
    </div>
    {(query.isError || !!data?.unavailableSources.length) && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-500">
      {query.isError ? "Unable to refresh metrics. Previously fetched values may be outdated." : `Temporarily unavailable: ${data?.unavailableSources.join(", ")}. Other metrics are still shown.`} Use Refresh to retry.
    </p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <StatCard key={card.label} {...card} loading={query.isLoading} />)}</div>
    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
      <p>Sources: <a href="https://defillama.com/chain/arc" target="_blank" rel="noreferrer" className="underline underline-offset-4">DefiLlama</a> · Arc RPC. Coverage and reporting periods follow the provider.</p>
      {data && <p>Fetched <time dateTime={data.fetchedAt}>{new Date(data.fetchedAt).toLocaleTimeString()}</time> · provider cache up to 5 min</p>}
    </div>
  </section>;
}

"use client";
import { useWhaleAlerts } from "@/hooks/useWhaleAlerts";
import { WhaleAlertCard } from "./WhaleAlertCard";
import { EmptyState } from "@/components/shared/EmptyState";
export function WhaleAlerts() {
  const query = useWhaleAlerts();
  const alerts = query.data?.data ?? [];
  return <article className="glass overflow-hidden rounded-2xl">
    <header className="border-b bg-gradient-to-r from-[hsl(var(--chart-3)/.07)] to-transparent p-5">
      <h2 className="font-bold tracking-tight">Arc whale alerts</h2>
      <p className="mt-1 text-xs text-muted-foreground">Confirmed USDC transfers ≥100,000 · latest 120 blocks · refreshes every 15s</p>
      <p className="mt-1 text-xs text-muted-foreground">Source: Arc RPC · mint/burn excluded · recent window, not full history</p>
    </header>
    {query.isError ? <div role="alert" className="p-5 text-sm text-amber-500">Transfer feed unavailable. <button className="underline" onClick={() => void query.refetch()}>Retry</button></div> :
      query.isLoading ? <p role="status" className="p-5 text-sm text-muted-foreground">Checking confirmed Arc transfers…</p> :
      <div className="divide-y divide-border/70">{alerts.length ? alerts.map(alert => <WhaleAlertCard key={`${alert.hash}:${alert.logIndex}`} alert={alert} />) : <EmptyState title="No large transfers in this window" description="No qualifying USDC transfers were found in the latest 120 scanned blocks." />}</div>}
    {query.data && <p className="border-t p-4 text-xs text-muted-foreground">{query.isError ? "Last successful scan" : "Scanned blocks"} #{query.data.meta.fromBlock.toLocaleString()}–#{query.data.meta.toBlock.toLocaleString()} · {new Date(query.data.meta.fetchedAt).toLocaleTimeString()}</p>}
  </article>;
}

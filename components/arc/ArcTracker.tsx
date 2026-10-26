"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ExternalLink, RefreshCw, Coins } from "lucide-react";
import type { ArcTrackerSnapshot } from "@/lib/ascope-arc-tracker";
import { TokenAllocation } from "./TokenAllocation";

const scan = "https://arc.etherscan.io";
const contract = "0xa12cd81d0f9988e3d60c4b6a0d52d368ef3c788d";
const colors = ["#a78bfa", "#22d3ee", "#f472b6", "#60a5fa", "#34d399", "#fbbf24", "#818cf8", "#fb923c", "#2dd4bf", "#e879f9", "#64748b"];
const num = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 6 });
const short = (address: string) => `${address.slice(0, 8)}…${address.slice(-6)}`;
function timeAgo(timestamp: number, now: number) {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (minutes < 1) return "<1 M ago";
  if (minutes < 60) return `${minutes} M ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} H ago`;
  const days = Math.floor(minutes / 1440);
  return `${days} ${days === 1 ? "Day" : "Days"} ago`;
}
function AddressLink({ address, label }: { address: string; label?: string | null }) {
  return <a href={`${scan}/address/${address}`} target="_blank" rel="noreferrer" title={label ? `${label} · ${address}` : address} className={`${label ? "font-medium" : "font-mono"} text-xs text-cyan-400 hover:underline`}>{label || short(address)} ↗</a>;
}
export function ArcTracker() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 60000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  const query = useQuery<{ data: ArcTrackerSnapshot | null; delayed: boolean; source: "onchain" | "snapshot"; checkedAt: string }>({
    queryKey: ["ascope-arc-tracker"], queryFn: async () => {
      const response = await fetch("/api/arc-tracker");
      if (!response.ok) throw Error("ARC data is temporarily unavailable.");
      return response.json();
    }, staleTime: 60000, refetchInterval: 300000, refetchOnWindowFocus: true, retry: 1,
  });
  const data = query.data?.data;
  const chart = data ? [...data.holders.map(h => ({ name: h.label || h.address, value: h.balance })), ...(data.other > 0 ? [{ name: "Other holders", value: data.other }] : [])] : [];
  return <div className="space-y-6 pb-20 md:pb-4">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-primary">Explore · Arc Mainnet</p><h1 className="flex items-center gap-3 text-3xl font-bold"><Coins className="text-primary" /> ARC Tracker</h1><p className="mt-2 text-sm text-muted-foreground">Token supply, ownership distribution and the latest transfers.</p></div>
      <button onClick={() => query.refetch()} disabled={query.isFetching} className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</button>
    </header>
    <a href={`${scan}/token/${contract}`} target="_blank" rel="noreferrer" className="flex w-fit max-w-full items-center gap-2 break-all rounded-xl border bg-card px-4 py-3 font-mono text-xs text-muted-foreground">{contract}<ExternalLink className="h-4 w-4 shrink-0" /></a>
    {query.isPending && <div role="status" className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">Loading ARC supply, holders and transfers…</div>}
    {(query.isError || query.data?.delayed || (!query.isPending && !data)) && <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-400">{data ? "On-chain refresh is temporarily unavailable. Showing the latest verified snapshot." : "ARC on-chain data is temporarily unavailable. Please retry shortly."}</p>}
    {data && <>
      <div className="grid gap-4 sm:grid-cols-3">{[["Total supply", `${num(data.supply)} ARC`], ["Holder addresses", num(data.holderCount)], ["Top 10 concentration", `${(100 - data.other / data.supply * 100).toFixed(2)}%`]].map(([label, value]) => <div key={label} className="rounded-2xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 break-words text-2xl font-bold tracking-tight">{value}</p></div>)}</div>
      <TokenAllocation />
      <section className="rounded-2xl border bg-card p-5 md:p-6"><h2 className="text-xl font-semibold">Who holds ARC?</h2><p className="mt-1 text-sm text-muted-foreground">Top 10 addresses as a share of total supply. Other holders are grouped together.</p>
        <div className="mt-4 grid items-center gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <div role="img" aria-label="ARC holder distribution. Exact balances and percentages are listed in the adjacent table." className="h-80 min-w-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chart} dataKey="value" nameKey="name" innerRadius="54%" outerRadius="83%" stroke="none" paddingAngle={1}>{chart.map((item, i) => <Cell key={item.name} fill={colors[i]} />)}</Pie><Tooltip wrapperStyle={{ zIndex: 20 }} content={({ active, payload }) => {
            const holder = payload?.[0];
            if (!active || !holder) return null;
            return <div className="max-w-[min(360px,calc(100vw-48px))] rounded-xl border border-slate-500 bg-[#131724] px-4 py-3 text-sm text-slate-50 shadow-xl">
              <p className={`font-medium ${String(holder.name).startsWith("0x") ? "whitespace-nowrap font-mono text-[10px] sm:text-[11px]" : "break-words"}`}>{holder.name}</p>
              <p className="mt-2 font-semibold tabular-nums">Balance : {num(Number(holder.value))} ARC</p>
            </div>;
          }} /></PieChart></ResponsiveContainer></div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-3">Holder</th><th className="py-3 text-right">Balance (ARC)</th><th className="py-3 pl-4 text-right">Supply %</th></tr></thead><tbody>{data.holders.map((h, i) => <tr key={h.address} className="border-b border-white/5"><td className="py-3"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: colors[i] }} /><span className="mr-2 text-xs text-muted-foreground">{i + 1}</span><AddressLink address={h.address} label={h.label} /></td><td className="py-3 text-right tabular-nums">{num(h.balance)}</td><td className="py-3 pl-4 text-right tabular-nums">{h.share.toFixed(4)}%</td></tr>)}{data.other > 0 && <tr><td className="pt-3 text-muted-foreground">● Other holders</td><td className="pt-3 text-right">{num(data.other)}</td><td className="pl-4 pt-3 text-right">{(data.other / data.supply * 100).toFixed(4)}%</td></tr>}</tbody></table></div>
        </div><p className="mt-5 text-xs leading-relaxed text-muted-foreground">Addresses are not necessarily individual people. Public names from ArcScan and Arc Explorer replace addresses when available; hover a name to see its address. A public label does not verify a personal identity. Total supply is not circulating supply.</p>
      </section>
      <section className="rounded-2xl border bg-card p-5 md:p-6"><h2 className="text-xl font-semibold">Latest 10 transfers</h2><p className="mt-1 text-sm text-muted-foreground">Most recent finalized ARC token transfers on Arc Mainnet, newest first.</p><div className="mt-4 overflow-x-auto"><table className="w-full whitespace-nowrap text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground">{["Time (UTC)", "From", "To", "Amount (ARC)", "Transaction"].map(label => <th className="px-3 py-3 first:pl-0" key={label}>{label}</th>)}</tr></thead><tbody>{data.transfers.map((tx, i) => <tr key={`${tx.hash}:${i}`} className="border-b border-white/5"><td className="py-4 pr-3 text-xs text-muted-foreground"><time dateTime={new Date(tx.timestamp).toISOString()}>{new Date(tx.timestamp).toISOString().replace("T", " ").slice(0, 19)}</time>{now !== null && <div className="mt-1">({timeAgo(tx.timestamp, now)})</div>}</td><td className="px-3"><AddressLink address={tx.from} label={tx.fromLabel} /></td><td className="px-3"><AddressLink address={tx.to} label={tx.toLabel} /></td><td className="px-3 tabular-nums">{num(tx.amount)}</td><td className="px-3"><a className="text-xs text-primary hover:underline" href={`${scan}/tx/${tx.hash}`} target="_blank" rel="noreferrer">{short(tx.hash)} ↗</a></td></tr>)}</tbody></table></div></section>
      <p className="text-xs leading-relaxed text-muted-foreground">Source: finalized Arc Mainnet data · Names: <a className="text-primary hover:underline" href="https://explorer.arc.io/token/0xA12Cd81d0f9988E3d60c4B6a0D52D368Ef3c788d?tab=holders" target="_blank" rel="noreferrer">Arc Explorer</a> · Data updated {new Date(data.updatedAt).toISOString().replace("T", " ").slice(0, 19)} UTC · Finalized block {data.checkedBlock?.toLocaleString("en-US") ?? "—"} · Shared data refreshes every 55 minutes; this page checks for updates every 5 minutes.</p>
    </>}
  </div>;
}

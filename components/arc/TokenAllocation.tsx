"use client";

import { Building2, ExternalLink, ShieldCheck, Sprout } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const initialSupply = 10_000_000_000;
const whitepaper = "https://6778953.fs1.hubspotusercontent-na1.net/hubfs/6778953/PDFs/arc_whitepaper.pdf#page=10";
const allocations = [
  {
    name: "Ecosystem", share: 60, color: "#34d399", icon: Sprout,
    description: "Token sales, developer grants, network growth programs and broader participation in the network.",
  },
  {
    name: "Circle", share: 25, color: "#a78bfa", icon: Building2,
    description: "Protocol development, network operations, staking, governance and administration of ecosystem programs.",
  },
  {
    name: "Long-Term Reserve", share: 15, color: "#fb923c", icon: ShieldCheck,
    description: "Long-term resilience, strategic flexibility, critical infrastructure and economic stabilization.",
  },
].map(item => ({ ...item, value: initialSupply * item.share / 100 }));

export function TokenAllocation() {
  return (
    <section aria-labelledby="ascope-token-allocation" className="relative overflow-hidden rounded-2xl border bg-card p-5 md:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-400/5 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.2em] text-emerald-400">ARC tokenomics</p>
          <h2 id="ascope-token-allocation" className="text-xl font-semibold">Token allocation</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">How the initial 10 billion ARC is allocated across the ecosystem, Circle and the long-term reserve.</p>
        </div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-xs font-medium text-emerald-400">Initial allocation</span>
      </div>

      <div className="relative mt-6 grid items-center gap-6 md:grid-cols-[.85fr_1.15fr] xl:gap-10">
        <div className="relative mx-auto h-72 w-full max-w-sm sm:h-80">
          <div role="img" aria-label="Initial ARC token allocation: Ecosystem 60%, Circle 25%, Long-Term Reserve 15%." className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={allocations} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="91%" startAngle={90} endAngle={-270} paddingAngle={3} stroke="none">
                  {allocations.map(item => <Cell key={item.name} fill={item.color} />)}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value.toLocaleString("en-US")} ARC`, name]}
                  contentStyle={{ background: "#131724", border: "1px solid #64748b", borderRadius: 12, padding: "12px 16px", fontSize: 14, color: "#f8fafc", boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)" }}
                  itemStyle={{ color: "#f8fafc", fontWeight: 600 }}
                  wrapperStyle={{ zIndex: 20 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">Initial supply</span>
            <span className="mt-2 text-5xl font-semibold tracking-tight">10B</span>
            <span className="mt-1 text-sm font-medium text-muted-foreground">ARC</span>
          </div>
        </div>

        <div className="space-y-3">
          {allocations.map(({ name, share, value, color, icon: Icon, description }) => (
            <div key={name} className="rounded-xl border bg-background/40 p-4 transition-colors hover:bg-background/70">
              <div className="flex items-start gap-3">
                <div className="rounded-lg border p-2" style={{ color, borderColor: `${color}30`, backgroundColor: `${color}10` }}><Icon className="h-4 w-4" aria-hidden="true" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="text-sm font-semibold">{name}</h3>
                    <span className="text-2xl font-semibold tabular-nums" style={{ color }}>{share}%</span>
                  </div>
                  <p className="mt-1 text-xs font-medium tabular-nums text-muted-foreground">{value.toLocaleString("en-US")} ARC</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
                  <div aria-hidden="true" className="mt-3 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: color }} /></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mt-6 flex flex-wrap items-start justify-between gap-3 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
        <p className="max-w-xl">Indicative initial allocation from the ARC whitepaper, separate from current wallet holdings. Exact unlock and release schedules are to be announced according to the whitepaper.</p>
        <a href={whitepaper} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 font-medium text-primary hover:underline">ARC whitepaper · p. 10<ExternalLink className="h-3 w-3" aria-hidden="true" /></a>
      </div>
    </section>
  );
}

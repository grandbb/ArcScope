import type { LucideIcon } from "lucide-react";

export function StatCard({ label, value, detail, change, icon: Icon, loading = false, highlight = false }: {
  label: string; value: string; detail: string; change?: number | null;
  icon: LucideIcon; loading?: boolean; highlight?: boolean;
}) {
  return <article className={`glass group relative min-w-0 overflow-hidden rounded-2xl p-5 transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 ${highlight ? "border-primary/30 bg-primary/5" : ""}`}>
    <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
    <div className="flex items-start justify-between gap-2">
      <p className="text-[10px] font-bold tracking-[.14em] text-muted-foreground">{label}</p>
      <span className="brand-gradient grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"><Icon className="h-4 w-4" aria-hidden="true" /></span>
    </div>
    {loading ? <div className="mt-2 h-9 w-32 animate-pulse rounded bg-muted" role="status" aria-label={`Loading ${label}`} /> :
      <p className="mt-2 break-words text-3xl font-black tracking-tight tabular-nums" title={value}>{value}</p>}
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{detail}</p>
    {!loading && change !== null && change !== undefined && <p className={`mt-2 text-xs font-semibold ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
      {change >= 0 ? "+" : ""}{change.toFixed(2)}% <span className="font-normal text-muted-foreground">vs. previous 24h</span>
    </p>}
  </article>;
}

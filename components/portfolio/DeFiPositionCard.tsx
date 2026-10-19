import type { DefiPosition } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
export function DeFiPositionCard({ position }: { position: DefiPosition }) {
 return <article className="glass rounded-2xl p-5">
  <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 font-bold text-primary">{position.protocol[0]}</span><div><h3 className="font-semibold">{position.protocol}</h3><p className="text-xs text-muted-foreground">{position.type}</p></div></div><Badge className="shrink-0 bg-emerald-500/10 text-emerald-500">{position.apy === null ? position.type : `${position.apy}% APY`}</Badge></div>
  <div className="mt-5 grid grid-cols-2 gap-3"><div><p className="text-[10px] text-muted-foreground">CURRENT ASSETS</p><p className="mt-1 font-mono">{position.value === null ? "Unpriced" : formatCurrency(position.value)}</p></div><div><p className="text-[10px] text-muted-foreground">DEBT</p><p className="mt-1 font-mono">{formatCurrency(position.debt ?? 0)}</p></div></div>
  {position.detail&&<p className="mt-4 text-xs leading-relaxed text-muted-foreground">{position.detail}</p>}{position.sourceUrl&&<a href={position.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-primary hover:underline">View position source ↗</a>}
 </article>;
}

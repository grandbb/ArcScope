import { ArrowUpRight } from "lucide-react";
import type { WhaleTransaction } from "@/lib/types";
import { formatAddress, timeAgo } from "@/lib/formatters";
import { getChain } from "@/lib/chains";
export function WhaleAlertCard({ alert }: { alert: WhaleTransaction }) {
  return <div className="p-4">
    <div className="flex items-center justify-between gap-2"><span className="rounded-lg bg-amber-500/10 px-2 py-1 font-mono text-xs text-amber-500">{alert.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} {alert.symbol}</span><span className="text-[10px] text-muted-foreground">{timeAgo(alert.timestamp)}</span></div>
    <div className="mt-3 flex items-center gap-2 text-xs"><span title={alert.from}>{formatAddress(alert.from)}</span><ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" /><span title={alert.to}>{formatAddress(alert.to)}</span></div>
    <a href={`${getChain("arc").explorerUrl}/tx/${alert.hash}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary underline">View confirmed transaction ↗</a>
  </div>;
}

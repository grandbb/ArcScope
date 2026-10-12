import type { Transaction } from "@/lib/types";
export function ActivityHeatmap({transactions}: {transactions: Transaction[]}) {
 const days = new Map<string,number>(); for (const tx of transactions) {const day=new Date(tx.timestamp).toISOString().slice(0,10);days.set(day,(days.get(day)??0)+1);}
 return <section className="glass rounded-2xl p-4"><h2 className="font-semibold">Loaded wallet activity</h2><p className="text-xs text-muted-foreground">Counts from the confirmed outgoing transactions loaded below; unqueried dates are not assumed to be zero.</p><div className="mt-4 flex flex-wrap gap-2">{[...days].sort((a,b)=>a[0].localeCompare(b[0])).map(([day,count]) => <div key={day} className="rounded-lg border bg-primary/10 p-3 text-xs"><p>{day}</p><p className="mt-1 font-mono">{count} transactions</p></div>)}</div></section>;
}

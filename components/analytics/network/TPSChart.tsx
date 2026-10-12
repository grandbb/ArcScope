"use client";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NetworkStat } from "@/hooks/useNetworkStats";
export function TPSChart({data = []}: {data?: NetworkStat["history"]}) { return <section className="glass rounded-2xl p-4"><h2 className="font-semibold">Transactions per observed second</h2><p className="text-xs text-muted-foreground">Actual transaction counts grouped by finalized block timestamp</p><div className="mt-4 h-60"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><XAxis dataKey="time" hide/><YAxis fontSize={10}/><Tooltip labelFormatter={v => new Date(v).toLocaleTimeString()}/><Line dataKey="tps" stroke="#8b5cf6" dot={false}/></LineChart></ResponsiveContainer></div></section>; }

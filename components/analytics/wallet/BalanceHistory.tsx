"use client";
import { useQuery } from "@tanstack/react-query";
import { Area,AreaChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis } from "recharts";
import { MainnetUnavailable } from "@/components/shared/MainnetUnavailable";
export function BalanceHistory({address}: {address:string}) {
 const query=useQuery({queryKey:["ascope-native-history",address],queryFn:async()=>{const response=await fetch(`/api/wallet/${address}/history`);const body=await response.json();if(!response.ok)throw new Error(body.error??"Historical balances unavailable");return body.data as Array<{date:string;balance:number;blockNumber:number}>;},staleTime:300_000,retry:false});
 if(query.isLoading)return <section className="glass rounded-2xl p-5">Reading confirmed historical USDC balances…</section>;
 if(query.error)return <MainnetUnavailable title="Historical USDC balance unavailable" reason={query.error.message}/>;
 return <section className="glass rounded-2xl p-4"><h2 className="font-semibold">Native USDC balance history</h2><p className="text-xs text-muted-foreground">Archive RPC snapshots at five-day UTC boundaries + current balance · up to 30 days · native USDC only</p><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={query.data}><CartesianGrid strokeDasharray="3 3" opacity={.1}/><XAxis dataKey="date" hide/><YAxis fontSize={10}/><Tooltip labelFormatter={value=>new Date(value).toLocaleString()}/><Area dataKey="balance" stroke="#06b6d4" fill="#06b6d433"/></AreaChart></ResponsiveContainer></div></section>;
}

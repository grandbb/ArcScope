"use client";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
const data = Array.from({length:24},(_,hour)=>({hour:`${hour}:00`,tps:14+Math.sin(hour/2)*3}));
export function TPSChart(){return <section className="glass rounded-2xl p-4"><h2 className="font-semibold">Network TPS</h2><div className="mt-4 h-60"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><XAxis dataKey="hour" hide/><YAxis fontSize={10}/><Tooltip/><Line dataKey="tps" stroke="#8b5cf6" dot={false}/></LineChart></ResponsiveContainer></div></section>;}

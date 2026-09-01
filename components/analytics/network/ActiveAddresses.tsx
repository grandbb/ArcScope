"use client";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
const data=Array.from({length:30},(_,day)=>({day:day+1,addresses:420000+day*2400+Math.sin(day)*18000}));
export function ActiveAddresses(){return <section className="glass rounded-2xl p-4"><h2 className="font-semibold">Active addresses</h2><div className="mt-4 h-60"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><XAxis dataKey="day" hide/><YAxis fontSize={10}/><Tooltip/><Area dataKey="addresses" stroke="#06b6d4" fill="#06b6d433"/></AreaChart></ResponsiveContainer></div></section>;}

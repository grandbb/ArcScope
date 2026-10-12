"use client";
import { useQuery } from "@tanstack/react-query";
import type { Transaction } from "@/lib/types";
export interface TokenAnalyticsData {address: string; name: string; symbol: string; price: number | null; marketCap: number | null; volume24h: number | null; supply: number; candles: Array<{time:number;open:number;high:number;low:number;close:number;volume:number}>; transfers: Transaction[]; transferCoverage?: string; holders: Array<{address:string;balance:number}>; unavailable: string[]; sourceUrl: string | null; updatedAt: string }
export function useTokenAnalytics(address?: string) {return useQuery({queryKey:["ascope-token-analytics",address],enabled:Boolean(address),queryFn:async()=>{const response=await fetch(`/api/token/${address}`);const body=await response.json() as {data:TokenAnalyticsData;error?:string};if(!response.ok)throw new Error(body.error??"Token analytics unavailable");return body.data;},staleTime:60_000});}

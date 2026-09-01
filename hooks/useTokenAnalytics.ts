"use client";
import { useQuery } from "@tanstack/react-query";
export interface TokenAnalyticsData { address: string; name: string; symbol: string; price: number; marketCap: number; volume24h: number; supply: number; candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> }
export function useTokenAnalytics(address?: string) { return useQuery({ queryKey: ["token-analytics", address], enabled: Boolean(address), queryFn: async () => { const response = await fetch(`/api/token/${address}`); const body = await response.json() as { data: TokenAnalyticsData; error?: string }; if (!response.ok) throw new Error(body.error ?? "Token analytics unavailable"); return body.data; } }); }

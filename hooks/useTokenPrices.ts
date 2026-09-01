"use client";
import { useQuery } from "@tanstack/react-query";
export function useTokenPrices(ids: string[]) { return useQuery({ queryKey: ["prices", ids], enabled: ids.length > 0, queryFn: async () => { const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`); if (!response.ok) throw new Error("Token prices unavailable"); return response.json() as Promise<Record<string, { usd: number; usd_24h_change: number }>>; }, staleTime: 30_000 }); }

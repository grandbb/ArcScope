"use client";
import { useQuery } from "@tanstack/react-query";
import type { ApiResponse, Portfolio } from "@/lib/types";
import { useSettingsStore } from "@/stores/useSettingsStore";
export function usePortfolio(address?: string) { const chain=useSettingsStore((state)=>state.chain); return useQuery({ queryKey: ["portfolio", address, chain], enabled: Boolean(address), queryFn: async () => { const response = await fetch(`/api/portfolio/${address}?chain=${chain}`); const body = await response.json() as ApiResponse<Portfolio>; if (!response.ok) throw new Error(body.error ?? "Portfolio unavailable"); return body.data; } }); }

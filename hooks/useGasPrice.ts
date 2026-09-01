"use client";
import { useQuery } from "@tanstack/react-query";
import type { ApiResponse, GasData } from "@/lib/types";
import { useSettingsStore } from "@/stores/useSettingsStore";
export function useGasPrice() { const chain = useSettingsStore((state) => state.chain); return useQuery({ queryKey: ["gas", chain], queryFn: async () => { const response = await fetch(`/api/gas?chain=${chain}`); const body = await response.json() as ApiResponse<GasData>; if (!response.ok) throw new Error(body.error ?? "Gas data unavailable"); return body.data; }, refetchInterval: 15_000 }); }

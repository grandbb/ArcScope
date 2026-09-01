"use client";
import { useQuery } from "@tanstack/react-query";
import type { ApiResponse, DefiPosition } from "@/lib/types";
export function useDeFiPositions(address?: string) { return useQuery({ queryKey: ["defi", address], enabled: Boolean(address), queryFn: async () => { const response = await fetch(`/api/defi/${address}`); const body = await response.json() as ApiResponse<DefiPosition[]>; if (!response.ok) throw new Error(body.error ?? "DeFi positions unavailable"); return body.data; } }); }

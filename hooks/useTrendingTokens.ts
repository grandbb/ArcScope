"use client";
import { useQuery } from "@tanstack/react-query";
import type { ApiResponse, TrendingToken } from "@/lib/types";
export function useTrendingTokens() { return useQuery({ queryKey: ["trending"], queryFn: async () => { const response = await fetch("/api/trending"); const body = await response.json() as ApiResponse<TrendingToken[]>; if (!response.ok) throw new Error(body.error ?? "Trending tokens unavailable"); return body.data; }, refetchInterval: 30_000 }); }

"use client";
import { useQuery } from "@tanstack/react-query";
import type { WhaleFeed } from "@/lib/live-feeds";
export function useWhaleAlerts() {
  return useQuery({ queryKey: ["whales", "arc-mainnet"], queryFn: async (): Promise<WhaleFeed> => {
    const response = await fetch("/api/whale");
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Whale feed unavailable");
    return body;
  }, staleTime: 15_000, refetchInterval: 15_000, retry: 1 });
}

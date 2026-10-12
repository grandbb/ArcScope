"use client";
import { useQuery } from "@tanstack/react-query";
export interface NetworkStat { name: string; tps: number; blockTime: number; gas: number; dailyTransactions: number | null; activeAddresses: number; fromBlock: number; toBlock: number; updatedAt: string; history: Array<{time: string; tps: number | null; addresses: number}> }
export function useNetworkStats() { return useQuery({ queryKey: ["ascope-network-stats"], queryFn: async (): Promise<NetworkStat[]> => { const response = await fetch("/api/network"); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Network data unavailable"); return body.data; }, staleTime: 30_000, refetchInterval: 30_000 }); }

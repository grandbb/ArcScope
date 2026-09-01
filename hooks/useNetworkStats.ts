"use client";
import { useQuery } from "@tanstack/react-query";
export interface NetworkStat { name: string; tps: number; blockTime: number; gas: number; dailyTransactions: number; activeAddresses: number }
export function useNetworkStats() { return useQuery({ queryKey: ["network-stats"], queryFn: async (): Promise<NetworkStat[]> => [{ name: "Arc Testnet", tps: 58.4, blockTime: 0.5, gas: 20, dailyTransactions: 1860000, activeAddresses: 286420 }], staleTime: 30_000 }); }

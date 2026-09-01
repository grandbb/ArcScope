"use client";
import { useQuery } from "@tanstack/react-query";
export interface WalletAnalyticsData { address: string; balance: number; txCount: number; firstTx: string; lastActive: string; uniqueContracts: number; history: Array<{ date: string; balance: number; send: number; receive: number; contract: number }> }
export function useWalletAnalytics(address?: string) { return useQuery({ queryKey: ["wallet-analytics", address], enabled: Boolean(address), queryFn: async () => { const response = await fetch(`/api/wallet/${address}`); const body = await response.json() as { data: WalletAnalyticsData; error?: string }; if (!response.ok) throw new Error(body.error ?? "Wallet analytics unavailable"); return body.data; } }); }

"use client";
import { usePortfolio } from "./usePortfolio";
export function useTokenBalances(address?: string) { const query = usePortfolio(address); return { ...query, data: query.data?.tokens ?? [] }; }

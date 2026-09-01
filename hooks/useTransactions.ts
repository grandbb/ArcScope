"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ApiResponse, Transaction } from "@/lib/types";
export function useTransactions(address?: string) { return useInfiniteQuery({ queryKey: ["transactions", address], enabled: Boolean(address), initialPageParam: "", queryFn: async ({ pageParam }) => { const response = await fetch(`/api/transactions/${address}?pageKey=${encodeURIComponent(pageParam)}`); const body = await response.json() as ApiResponse<{ items: Transaction[]; nextPageKey?: string }>; if (!response.ok) throw new Error(body.error ?? "Transactions unavailable"); return body.data; }, getNextPageParam: (last) => last.nextPageKey }); }

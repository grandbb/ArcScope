"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ApiResponse, NFTAsset } from "@/lib/types";
export function useNFTs(address?: string) { return useInfiniteQuery({ queryKey: ["nfts", address], enabled: Boolean(address), initialPageParam: "", queryFn: async ({ pageParam }) => { const response = await fetch(`/api/nfts/${address}?pageKey=${encodeURIComponent(pageParam)}`); const body = await response.json() as ApiResponse<{ items: NFTAsset[]; nextPageKey?: string }>; if (!response.ok) throw new Error(body.error ?? "NFTs unavailable"); return body.data; }, getNextPageParam: (last) => last.nextPageKey }); }

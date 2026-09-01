"use client";
import { useQuery } from "@tanstack/react-query";
import type { DAO } from "@/lib/types";
export function useDAOMemberships(address?: string) { return useQuery({ queryKey: ["daos", address], enabled: Boolean(address), queryFn: async (): Promise<DAO[]> => [{ symbol: "ENS", name: "ENS DAO", balance: 42.8, votingPower: 0.0012, governanceUrl: "https://snapshot.org/#/ens.eth" }] }); }

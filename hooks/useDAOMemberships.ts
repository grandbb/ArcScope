"use client";
import { useQuery } from "@tanstack/react-query";
import type { DAO } from "@/lib/types";
export function useDAOMemberships(address?: string) { return useQuery({ queryKey: ["ascope-daos", address], enabled: Boolean(address), queryFn: async (): Promise<DAO[]> => { const response = await fetch(`/api/daos/${address}`); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "DAO data unavailable"); return body.data; } }); }

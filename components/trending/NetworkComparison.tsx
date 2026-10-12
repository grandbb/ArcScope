"use client";
import { useNetworkStats } from "@/hooks/useNetworkStats"; import { NetworkStats } from "@/components/analytics/network/NetworkStats"; import { CardSkeleton } from "@/components/shared/Skeleton";
export function NetworkComparison(){const query=useNetworkStats(); return query.isLoading?<div className="grid gap-4 md:grid-cols-3"><CardSkeleton count={3}/></div>:query.error ? <p role="alert">Arc Mainnet data unavailable. Please retry.</p> : <NetworkStats networks={query.data ?? []}/>;}

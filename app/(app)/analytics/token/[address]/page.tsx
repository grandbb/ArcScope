"use client";
import { useTokenAnalytics } from "@/hooks/useTokenAnalytics";
import { TokenOverview } from "@/components/analytics/token/TokenOverview";
import { PriceCandlestick } from "@/components/analytics/token/PriceCandlestick";
import { TransferVolume } from "@/components/analytics/token/TransferVolume";
import { HolderDistribution } from "@/components/analytics/token/HolderDistribution";
import { RecentTransfers } from "@/components/analytics/token/RecentTransfers";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { MainnetUnavailable } from "@/components/shared/MainnetUnavailable";
export default function TokenPage({params}:{params:{address:string}}){const query=useTokenAnalytics(params.address);if(query.isLoading)return <div className="grid gap-4"><CardSkeleton count={5}/></div>;if(query.error||!query.data)throw query.error??new Error("Arc token unavailable");const token=query.data;return <div className="space-y-6"><TokenOverview token={token}/>{token.sourceUrl&&<p className="text-xs text-muted-foreground">Market source: <a href={token.sourceUrl} target="_blank" rel="noreferrer" className="text-primary underline">GeckoTerminal · selected Arc pool</a> · On-chain supply is Arc-local. Market capitalization is provider-reported global coverage.</p>}{token.candles.length?<><PriceCandlestick candles={token.candles}/><TransferVolume candles={token.candles}/></>:<MainnetUnavailable title="Arc price history unavailable"/>}<HolderDistribution holders={token.holders} unavailable={token.unavailable.includes("Holder rankings")}/>{token.unavailable.includes("Recent transfers")?<MainnetUnavailable title="Recent transfers unavailable"/>:<><p className="text-xs text-muted-foreground">{token.transferCoverage}</p><RecentTransfers transactions={token.transfers}/></>}</div>;}

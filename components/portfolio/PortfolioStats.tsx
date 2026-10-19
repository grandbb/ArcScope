import { Coins, Image, Landmark, Wallet } from "lucide-react";
import { MetricCard } from "@/components/shared/MetricCard";
import type { Portfolio } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";
export function PortfolioStats({ portfolio: p }: { portfolio: Portfolio }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <MetricCard label="Wallet assets" value={formatCurrency(p.walletValue ?? p.totalValue)} icon={Wallet}/>
    <MetricCard label="DeFi assets" value={p.defiValue == null ? "Unavailable" : formatCurrency(p.defiValue)} icon={Landmark}/>
    <MetricCard label="DeFi debt" value={p.defiDebt == null ? "Unavailable" : formatCurrency(p.defiDebt)} icon={Coins}/>
    <MetricCard label="NFTs owned" value={p.nftCount === null ? "Unavailable" : String(p.nftCount)} icon={Image}/>
  </div>;
}

"use client";
import { PageHeader } from "@/components/layout/PageHeader";
import { WalletOverview } from "@/components/analytics/wallet/WalletOverview";
import { BalanceHistory } from "@/components/analytics/wallet/BalanceHistory";
import { TxFrequency } from "@/components/analytics/wallet/TxFrequency";
import { InteractionMap } from "@/components/analytics/wallet/InteractionMap";
import { ExportCSV } from "@/components/analytics/wallet/ExportCSV";
import { TokenBalances } from "@/components/portfolio/TokenBalances";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { useWalletAnalytics } from "@/hooks/useWalletAnalytics";
export default function WalletAnalyticsPage({params}:{params:{address:string}}){const query=useWalletAnalytics(params.address);if(query.isLoading)return <div className="grid gap-4"><CardSkeleton count={6}/></div>;if(query.error||!query.data)throw query.error??new Error("Wallet analytics unavailable");return <div className="space-y-6"><PageHeader title="Arc wallet explorer" description={params.address} breadcrumbs={[{label:"Analytics",href:"/analytics"},{label:"Wallet"}]} actions={<ExportCSV transactions={query.data.transactions}/>}/><WalletOverview wallet={query.data}/><p className="text-xs text-muted-foreground">{query.data.coverage}</p><div className="grid gap-4 xl:grid-cols-2"><BalanceHistory address={params.address}/><TxFrequency history={query.data.frequency}/></div><InteractionMap data={query.data.interactions}/><TokenBalances tokens={query.data.tokens}/></div>;}

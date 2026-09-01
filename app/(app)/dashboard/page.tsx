import Image from "next/image";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { LiveBlockFeed } from "@/components/dashboard/LiveBlockFeed";
import { WhaleAlerts } from "@/components/dashboard/WhaleAlerts";
import { TopMovers } from "@/components/dashboard/TopMovers";

export default function DashboardPage() {
  return <div className="space-y-6">
    <section className="brand-ring relative overflow-hidden rounded-[24px] border border-primary/15 bg-card/70 p-5 backdrop-blur-xl sm:p-6">
      <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute right-24 top-8 h-32 w-32 rounded-full bg-accent/10 blur-3xl" />
      <PageHeader
        title="Arc Network command center"
        description="Live network intelligence, stable USDC fees, and ecosystem momentum in one focused view."
        eyebrow="Realtime intelligence"
        actions={<div className="relative hidden h-20 w-36 sm:block"><Image src="/ascope-logo.png" alt="AScope" fill sizes="144px" className="object-contain" priority /></div>}
      />
    </section>
    <StatsRow />
    <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]"><LiveBlockFeed /><WhaleAlerts /></section>
    <TopMovers />
  </div>;
}

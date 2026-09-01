import { Gauge, Rabbit, Turtle } from "lucide-react";
import type { GasTier } from "@/lib/types";
import { LiveIndicator } from "@/components/shared/LiveIndicator";

const icons = { slow: Turtle, standard: Gauge, fast: Rabbit } as const;

/** Arc fees lead with their stable USD/USDC value; Gwei remains a technical detail. */
export function GasTracker({ tiers }: { tiers: GasTier[] }) {
  return <section>
    <div className="mb-3 flex items-center justify-between">
      <div><h2 className="text-lg font-semibold">Current Arc fees</h2><p className="text-xs text-muted-foreground">Native gas is paid in USDC</p></div>
      <LiveIndicator />
    </div>
    <div className="grid gap-4 md:grid-cols-3">{tiers.map((tier) => {
      const Icon = icons[tier.name];
      return <article key={tier.name} className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between"><span className="capitalize text-sm font-medium">{tier.name}</span><Icon className="h-5 w-5 text-primary"/></div>
        <p className="mt-4 font-mono text-3xl font-bold">${tier.usd.toFixed(6)}</p>
        <p className="mt-2 text-sm text-muted-foreground">{tier.gwei.toFixed(1)} Gwei · {tier.waitSeconds >= 60 ? `~${Math.ceil(tier.waitSeconds / 60)} min` : `~${tier.waitSeconds} sec`}</p>
      </article>;
    })}</div>
  </section>;
}

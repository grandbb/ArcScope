import { unstable_cache } from "next/cache";
import type { ArcTrackerSnapshot } from "./ascope-arc-tracker";
import { mainnetClient } from "./ascope-mainnet";
import { refreshArcOnChain } from "./ascope-arc-chain";
import bootstrap from "../public/ascope-arc-snapshot.json";

let lastGood: ArcTrackerSnapshot = bootstrap;
let pending: Promise<ArcTrackerSnapshot> | null = null;
// Successful finalized snapshots only. The scheduled updater also saves a
// durable checkpoint hourly, so cold starts never depend on an old process.
const cached = unstable_cache(async () => {
  pending ??= refreshArcOnChain(mainnetClient, lastGood).finally(() => { pending = null; });
  return pending;
}, ["ascope-arc-tracker-onchain-v1"], { revalidate: 3300 });

export async function getArcTracker() {
  try {
    const data = await cached();
    lastGood = data;
    return { data, delayed: Date.now() - Date.parse(data.updatedAt) > 3600000, source: "onchain" as const, checkedAt: new Date().toISOString() };
  } catch (error) {
    console.warn("ARC tracker refresh failed:", error instanceof Error ? error.message : "Unknown on-chain error");
    return { data: lastGood, delayed: true, source: "snapshot" as const, checkedAt: new Date().toISOString() };
  }
}

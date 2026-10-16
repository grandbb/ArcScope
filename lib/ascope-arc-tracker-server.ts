import { unstable_cache } from "next/cache";
import { ARC_SOURCE, ARC_SCAN, ARC_TOKEN, parseArcTracker, type ArcTrackerSnapshot } from "./ascope-arc-tracker";
import bootstrap from "@/public/ascope-arc-snapshot.json";

let lastGood: ArcTrackerSnapshot = bootstrap;
let pending: Promise<ArcTrackerSnapshot> | null = null;
async function refresh() {
  const response = await fetch(ARC_SOURCE, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Error("ARC explorer unavailable");
  const summary = await response.text();
  const sid = summary.match(/var sid = '([a-f0-9]+)'/)?.[1];
  if (!sid) throw Error("Explorer session unavailable");
  // Keep the explorer's anonymous page session on the server; never expose cookies.
  const cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  const paths = [`generic-tokenholders2?m=light&a=${ARC_TOKEN}&p=1`, `generic-tokentxns2?m=light&contractAddress=${ARC_TOKEN}&a=&sid=${sid}&p=1`];
  const [holders, transfers] = await Promise.all(paths.map(async path => {
    const result = await fetch(`${ARC_SCAN}/token/${path}`, { headers: { cookie, referer: ARC_SOURCE }, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!result.ok) throw Error("Explorer data unavailable");
    return result.text();
  }));
  return parseArcTracker(summary, holders, transfers);
}
// Cache failures too, so many visitors cannot repeatedly hit the explorer during an outage.
const cached = unstable_cache(async () => {
  try {
    pending ??= refresh().finally(() => { pending = null; });
    return { data: await pending, delayed: false };
  } catch (error) {
    console.warn("ARC tracker refresh failed:", error instanceof Error ? error.message : "Unknown source error");
    return { data: null, delayed: true };
  }
}, ["ascope-arc-tracker-v3"], { revalidate: 300 });
export async function getArcTracker() {
  const result = await cached();
  if (result.data) lastGood = result.data;
  return { data: result.data ?? lastGood, delayed: result.delayed };
}

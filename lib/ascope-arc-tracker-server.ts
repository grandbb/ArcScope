import { unstable_cache } from "next/cache";
import { ARC_SOURCE, ARC_SCAN, ARC_TOKEN, parseArcTracker, type ArcTrackerSnapshot } from "./ascope-arc-tracker";
import bootstrap from "@/public/ascope-arc-snapshot.json";

let lastGood: ArcTrackerSnapshot = bootstrap;
let pending: Promise<ArcTrackerSnapshot> | null = null;
const explorerHeaders = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "user-agent": "Mozilla/5.0 (compatible; AScope/1.0; +https://arc-scope.vercel.app)",
};
async function refresh() {
  const response = await fetch(ARC_SOURCE, { headers: explorerHeaders, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error("ARC explorer unavailable");
  const summary = await response.text();
  const sid = summary.match(/var sid = '([a-f0-9]+)'/)?.[1];
  if (!sid) throw Error("Explorer session unavailable");
  // Keep the explorer's anonymous page session on the server; never expose cookies.
  const setCookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie") ?? ""];
  const cookie = setCookies.filter(Boolean).map(value => value.split(";")[0]).join("; ");
  const paths = [`generic-tokenholders2?m=light&a=${ARC_TOKEN}&p=1`, `generic-tokentxns2?m=light&contractAddress=${ARC_TOKEN}&a=&sid=${sid}&p=1`];
  const [holders, transfers] = await Promise.all(paths.map(async path => {
    const result = await fetch(`${ARC_SCAN}/token/${path}`, { headers: { ...explorerHeaders, cookie, referer: ARC_SOURCE }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!result.ok) throw Error("Explorer data unavailable");
    return result.text();
  }));
  return parseArcTracker(summary, holders, transfers);
}
// Only successful snapshots enter the shared cache. A transient provider failure
// must not freeze the bundled fallback for another cache lifetime.
const cached = unstable_cache(async () => {
  pending ??= refresh().finally(() => { pending = null; });
  return pending;
}, ["ascope-arc-tracker-v6"], { revalidate: 3300 });
export async function getArcTracker() {
  try {
    const data = await cached();
    lastGood = data;
    return { data, delayed: false, source: "live" as const, checkedAt: new Date().toISOString() };
  } catch (error) {
    console.warn("ARC tracker refresh failed:", error instanceof Error ? error.message : "Unknown source error");
    return { data: lastGood, delayed: true, source: "scheduled" as const, checkedAt: new Date().toISOString() };
  }
}

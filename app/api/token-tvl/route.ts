import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { readArcTokenTvl, type ArcTokenTvlFeed } from "@/lib/ascope-token-tvl";

// Cache the complete route, so Vercel ISR can collapse cold and stale requests.
// Keep all regenerations at one origin; a browser refresh never bypasses this.
export const revalidate = 60;
export const preferredRegion = "sin1";

type Attempt = { ok: true; feed: ArcTokenTvlFeed } | { ok: false; error: string };
let retryAt = 0;

// Cache failures as well as successes in the shared Data Cache. Otherwise each
// ISR retry (or new function instance) could immediately hit the provider again.
const cachedAttempt = unstable_cache(async (): Promise<Attempt> => {
  if (Date.now() < retryAt) return { ok: false, error: "Liquidity provider cooldown" };
  try {
    const feed = await readArcTokenTvl(async path => {
      const response = await fetch(`https://api.geckoterminal.com/api/v2/${path}`, {
        headers: { accept: "application/json" },
        // unstable_cache bypasses the nested fetch cache, keeping pages together.
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 429) {
        const hint = response.headers.get("Retry-After");
        const seconds = hint === null ? NaN : Number(hint);
        const delay = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(hint ?? "") - Date.now();
        retryAt = Math.max(retryAt, Date.now() + Math.max(300_000, Number.isFinite(delay) ? delay : 0));
      }
      if (!response.ok) throw new Error(`Liquidity provider returned ${response.status}`);
      return response.json();
    });
    return { ok: true, feed };
  } catch (error) {
    console.warn("[AScope token TVL] Provider refresh failed", error);
    return { ok: false, error: "Arc token TVL is temporarily unavailable." };
  }
}, ["ascope-arc-token-tvl-attempt-v3"], { revalidate: 300 });

// Also coalesce callers in local development or a self-hosted single process.
let pendingAttempt: Promise<Attempt> | null = null;

export async function GET() {
  pendingAttempt ??= cachedAttempt().finally(() => { pendingAttempt = null; });
  const attempt = await pendingAttempt;
  // A failed regeneration must throw: returning a 502/503 would replace the last
  // successful ISR snapshot. Vercel keeps serving that snapshot on this error.
  if (!attempt.ok) throw new Error(attempt.error);
  return NextResponse.json(attempt.feed);
}

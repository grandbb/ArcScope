import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { arcProtocols, parseTvlHistory, stablecoinSummary, type ArcEcosystem } from "@/lib/ascope-defillama";
import { metricNumber } from "@/lib/dashboard";
export const dynamic = "force-dynamic";
async function json(url: string) {
  const r = await fetch(url, { next: { revalidate: 300 }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw Error("DefiLlama unavailable");
  return r.json();
}
// Cache the small Arc-only result; the global /protocols payload can exceed
// Next's fetch-cache item limit.
const protocolsForArc = unstable_cache(async () => {
  const r = await fetch("https://api.llama.fi/protocols", { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw Error("Protocol rankings unavailable");
  return arcProtocols(await r.json());
}, ["ascope-defillama-arc-protocols-v1"], { revalidate: 300 });
function overviewMetric(value: any) {
  if (value?.chain !== "Arc" || metricNumber(value.total24h) === null) throw Error("Arc overview unavailable");
  return value;
}
export async function GET() {
  const names = ["TVL history", "Protocol rankings", "Stablecoins", "App revenue"];
  const [history, protocols, stablecoins, revenue] = await Promise.allSettled([
    json("https://api.llama.fi/v2/historicalChainTvl/Arc").then(parseTvlHistory),
    protocolsForArc(),
    json("https://stablecoins.llama.fi/stablecoincharts/Arc").then(stablecoinSummary),
    json("https://api.llama.fi/overview/fees/Arc?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyRevenue").then(overviewMetric),
  ] as const);
  const data: ArcEcosystem = {
    history: history.status === "fulfilled" ? history.value : [], protocols: protocols.status === "fulfilled" ? protocols.value : [],
    stablecoins: stablecoins.status === "fulfilled" ? stablecoins.value : null,
    revenue24h: revenue.status === "fulfilled" && revenue.value.chain === "Arc" ? metricNumber(revenue.value.total24h) : null,
    fetchedAt: new Date().toISOString(), unavailable: [history,protocols,stablecoins,revenue].flatMap((r,i) => r.status === "rejected" ? [names[i]] : []),
  };
  return NextResponse.json({ data }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" } });
}

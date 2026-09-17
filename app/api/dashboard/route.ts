import { NextResponse } from "next/server";
import { alchemyRpc, hexToNumber } from "@/lib/alchemy";
import { metricNumber, type DashboardMetrics } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

async function llama(path: string): Promise<unknown> {
  const response = await fetch(`https://api.llama.fi/${path}`, {
    next: { revalidate: 300 }, signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Provider returned ${response.status}`);
  return response.json();
}

function overview(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || !("chain" in value) || value.chain !== "Arc") {
    throw new Error("Arc metrics unavailable");
  }
  return value as Record<string, unknown>;
}

export async function GET() {
  const filters = "?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true";
  const results = await Promise.allSettled([
    llama("v2/chains").then((value) => {
      if (!Array.isArray(value)) throw new Error("Chain data unavailable");
      const chain = value.find((item) => item?.name === "Arc" && Number(item.chainId) === 5042);
      const tvl = metricNumber(chain?.tvl);
      if (tvl === null) throw new Error("Arc TVL unavailable");
      return tvl;
    }),
    llama(`overview/dexs/Arc${filters}`).then(overview),
    llama(`overview/fees/Arc${filters}`).then(overview),
    alchemyRpc<string>("eth_gasPrice").then((hex) => {
      const gas = metricNumber(hexToNumber(hex) / 1e9);
      if (gas === null) throw new Error("Gas quote unavailable");
      return gas;
    }),
  ] as const);
  const [tvl, dexResult, feesResult, gas] = results;
  const dex = dexResult.status === "fulfilled" ? dexResult.value : {};
  const fees = feesResult.status === "fulfilled" ? feesResult.value : {};
  const sources = ["TVL", "DEX volume", "Protocol fees", "Arc RPC"];
  const change = dex.change_1d;
  const data: DashboardMetrics = {
    tvl: tvl.status === "fulfilled" ? tvl.value : null,
    dexVolume24h: metricNumber(dex.total24h),
    dexVolume7d: metricNumber(dex.total7d),
    dexVolume30d: metricNumber(dex.total30d),
    dexVolumeTotal: metricNumber(dex.totalAllTime),
    dexChange24h: typeof change === "number" && Number.isFinite(change) ? change : null,
    dexProtocols: Array.isArray(dex.protocols) ? dex.protocols.length : null,
    fees24h: metricNumber(fees.total24h),
    gasGwei: gas.status === "fulfilled" ? gas.value : null,
    fetchedAt: new Date().toISOString(),
    unavailableSources: results.flatMap((result, i) => result.status === "rejected" ? [sources[i]] : []),
  };
  return NextResponse.json({ data }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
}

import { NextResponse } from "next/server";
import { poolMovers, type PoolResponse } from "@/lib/live-feeds";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const response = await fetch("https://api.geckoterminal.com/api/v2/networks/arc/pools?include=base_token,quote_token", { headers: { accept: "application/json" }, next: { revalidate: 60 }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("Market provider unavailable");
    const data = poolMovers(await response.json() as PoolResponse);
    return NextResponse.json({ data, meta: { source: "GeckoTerminal", fetchedAt: new Date().toISOString(), scope: "Top returned Arc pools; highest-liquidity returned pool per base token; ranked by absolute 24h price change; minimum liquidity $10,000" } }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" } });
  } catch {
    return NextResponse.json({ data: [], error: "Arc market data is temporarily unavailable. Please retry." }, { status: 502 });
  }
}

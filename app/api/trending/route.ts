import { NextResponse } from "next/server";
import { readArcDexMovers } from "@/lib/ascope-dex-movers";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const data = await readArcDexMovers(async address => {
      const response = await fetch(`https://api.dexscreener.com/token-pairs/v1/arc/${address}`, {
        headers: { accept: "application/json" }, next: { revalidate: 60 }, signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error("Market provider unavailable");
      return response.json();
    });
    return NextResponse.json({ data, meta: { source: "DEX Screener", fetchedAt: new Date().toISOString(), scope: "Returned Arc USDC pools; highest-liquidity returned pool per base token; ranked by absolute 24h price change; minimum liquidity $10,000" } }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" } });
  } catch {
    return NextResponse.json({ data: [], error: "Arc market data is temporarily unavailable. Please retry." }, { status: 502 });
  }
}

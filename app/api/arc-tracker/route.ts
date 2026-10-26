import { NextResponse } from "next/server";
import { getArcTracker } from "@/lib/ascope-arc-tracker-server";
// Read finalized mainnet data at runtime, never during prerender.
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  const result = await getArcTracker();
  return NextResponse.json(result, { headers: { "Cache-Control": result.delayed ? "no-store" : "public, s-maxage=60, stale-while-revalidate=30" } });
}

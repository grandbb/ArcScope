import { NextResponse } from "next/server";
import { getArcTracker } from "@/lib/ascope-arc-tracker-server";
// The anonymous explorer session must be fetched at runtime, never during prerender.
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  return NextResponse.json(await getArcTracker(), { headers: { "Cache-Control": "public, s-maxage=3300, stale-while-revalidate=300" } });
}

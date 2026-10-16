import { NextResponse } from "next/server";
import { getArcTracker } from "@/lib/ascope-arc-tracker-server";
export const revalidate = 300;
export const preferredRegion = "sin1";
export async function GET() {
  return NextResponse.json(await getArcTracker(), { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}

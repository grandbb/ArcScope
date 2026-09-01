import { NextResponse } from "next/server"; import { CACHE_HEADER } from "@/lib/constants"; import { mockTrending } from "@/lib/mock-data";
export async function GET() { try { return NextResponse.json({ data: mockTrending }, { headers: { "Cache-Control": CACHE_HEADER } }); } catch { return NextResponse.json({ data: [], error: "Could not load trending assets" }, { status: 500 }); } }

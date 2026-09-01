import { NextResponse } from "next/server"; import { CACHE_HEADER } from "@/lib/constants"; import { mockWhales } from "@/lib/mock-data";
export async function GET() { try { return NextResponse.json({ data: mockWhales }, { headers: { "Cache-Control": CACHE_HEADER } }); } catch { return NextResponse.json({ data: [], error: "Could not load whale transactions" }, { status: 500 }); } }

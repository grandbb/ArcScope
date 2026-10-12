import { NextResponse } from "next/server";
import { isValidAddress } from "./validators";
import { CACHE_HEADER } from "./constants";

export async function mainnetResponse(request: Request, read: () => Promise<unknown>, address?: string) {
  if (address && !isValidAddress(address)) return NextResponse.json({ data: null, error: "Invalid Arc wallet or contract address" }, { status: 400 });
  if ((new URL(request.url).searchParams.get("chain") ?? "arc") !== "arc") return NextResponse.json({ data: null, error: "Only Arc Mainnet is supported" }, { status: 400 });
  try { return NextResponse.json({ data: await read() }, { headers: { "Cache-Control": CACHE_HEADER } }); }
  catch (error) { return NextResponse.json({ data: null, error: error instanceof Error ? error.message.split("\n")[0] : "Mainnet provider unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } }); }
}

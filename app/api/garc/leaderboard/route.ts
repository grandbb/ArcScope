import { NextResponse } from "next/server";
import { GARC_CONTRACT_ADDRESS } from "@/lib/garc";
import { paginateGarc } from "@/lib/garc-leaderboard";
import { getGarcLeaderboard } from "@/lib/garc-leaderboard-server";
import { isAddress } from "viem";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") ?? 1);
  const wallet = params.get("wallet")?.trim() || null;
  if (!Number.isSafeInteger(page) || page < 1 || (wallet && !isAddress(wallet, { strict: false }))) {
    return NextResponse.json({ error: "Enter a valid page and a complete wallet address (0x followed by 40 hexadecimal characters)." }, { status: 400 });
  }
  try {
    const snapshot = await getGarcLeaderboard();
    const data = params.get("snapshot") === "1" ? snapshot : paginateGarc(snapshot, page, wallet, GARC_CONTRACT_ADDRESS);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("gARC leaderboard unavailable", error);
    return NextResponse.json({ error: "Could not verify the complete gARC leaderboard on Arc Mainnet. Please retry." }, { status: 503 });
  }
}

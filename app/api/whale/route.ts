import { NextResponse } from "next/server";
import { alchemyRpc } from "@/lib/alchemy";
import { TRANSFER_TOPIC, USDC_EMITTER, WHALE_BLOCK_WINDOW, whaleCandidates, readTransferWindow, type TransferLog } from "@/lib/live-feeds";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET() {
  try {
    const latest = await alchemyRpc<string>("eth_blockNumber");
    const toBlock = Number(BigInt(latest));
    const fromBlock = Math.max(0, toBlock - WHALE_BLOCK_WINDOW + 1);
    const logs = await readTransferWindow(fromBlock, toBlock, (start, end) => alchemyRpc<TransferLog[]>("eth_getLogs", [{ address: USDC_EMITTER, topics: [TRANSFER_TOPIC], fromBlock: `0x${start.toString(16)}`, toBlock: `0x${end.toString(16)}` }]));
    const candidates = whaleCandidates(logs);
    const blockNumbers = [...new Set(candidates.map(log => log.blockNumber))];
    const blocks = await Promise.all(blockNumbers.map(async number => {
      const block = await alchemyRpc<{ timestamp: string } | null>("eth_getBlockByNumber", [number, false]);
      if (!block) throw new Error("Block timestamp unavailable");
      return [number, Number(BigInt(block.timestamp)) * 1000] as const;
    }));
    const timestamps = new Map(blocks);
    const data = candidates.map(log => ({
      hash: log.transactionHash, logIndex: Number(BigInt(log.logIndex)), blockNumber: Number(BigInt(log.blockNumber)),
      from: `0x${log.topics[1].slice(-40)}`, to: `0x${log.topics[2].slice(-40)}`,
      value: Number(BigInt(log.data)) / 1e18, symbol: "USDC", timestamp: timestamps.get(log.blockNumber)!,
    }));
    return NextResponse.json({ data, meta: { fromBlock, toBlock, fetchedAt: new Date().toISOString() } }, { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=15" } });
  } catch {
    return NextResponse.json({ data: [], error: "Arc transfer feed is temporarily unavailable. Please retry." }, { status: 502 });
  }
}

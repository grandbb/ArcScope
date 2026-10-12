import type { Address } from "viem";
import { rankGarcEvents, type GarcLeaderboardSnapshot, type GarcRankingEvent } from "./garc-leaderboard";

// Only the immutable existing deployment uses this original event message.
export const DEPLOYED_GARC_EVENT_MESSAGE = "gARC | ArcScope";
export interface GarcIndexEvent extends Omit<GarcRankingEvent, "walletCount" | "totalCount" | "timestamp"> {
  walletCount: string; totalCount: string; timestamp: string;
}
export interface GarcCheckpoint {
  chainId: number; contract: Address; blockNumber: string; blockHash: string;
  totalGreetings: string; updatedAt: string; events: GarcIndexEvent[];
}

export function checkpointSnapshot(checkpoint: GarcCheckpoint): GarcLeaderboardSnapshot {
  return {
    entries: rankGarcEvents(checkpoint.events.map(event => ({ ...event, walletCount: BigInt(event.walletCount), totalCount: BigInt(event.totalCount), timestamp: BigInt(event.timestamp) })), BigInt(checkpoint.totalGreetings)),
    totalGreetings: checkpoint.totalGreetings, blockNumber: checkpoint.blockNumber, updatedAt: checkpoint.updatedAt,
  };
}

export function verifyEventRange(events: GarcIndexEvent[], before: bigint, after: bigint): GarcIndexEvent[] {
  const unique = new Map(events.map(event => [`${event.transactionHash.toLowerCase()}:${event.logIndex}`, event]));
  const ordered = [...unique.values()].sort((a, b) => BigInt(a.totalCount) < BigInt(b.totalCount) ? -1 : 1);
  if (after < before || BigInt(ordered.length) !== after - before || ordered.some((event, index) => BigInt(event.totalCount) !== before + BigInt(index + 1))) {
    throw new Error("Incomplete gARC event range.");
  }
  return ordered;
}

/** Skip empty history using the monotonic on-chain counter; fetch logs only in changed ranges. */
export async function readChangedGarcEvents(from: bigint, to: bigint, before: bigint, after: bigint, reader: {
  countAt(block: bigint): Promise<bigint>;
  events(from: bigint, to: bigint, before: bigint, after: bigint): Promise<GarcIndexEvent[]>;
}): Promise<GarcIndexEvent[]> {
  if (after < before) throw new Error("gARC counter moved backwards.");
  if (after === before) return [];
  if (from > to) throw new Error("Invalid gARC block range.");
  if (to - from < BigInt(5000)) return verifyEventRange(await reader.events(from, to, before, after), before, after);
  const middle = (from + to) / BigInt(2);
  const count = await reader.countAt(middle);
  if (count < before || count > after) throw new Error("Invalid gARC counter history.");
  // Sequential branches bound the public RPC load; empty halves need no further requests.
  const left = await readChangedGarcEvents(from, middle, before, count, reader);
  const right = await readChangedGarcEvents(middle + BigInt(1), to, count, after, reader);
  return [...left, ...right];
}

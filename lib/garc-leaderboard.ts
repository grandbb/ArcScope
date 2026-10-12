import { getAddress, isAddress, type Address } from "viem";

export const GARC_PAGE_SIZE = 100;
export interface GarcRanking { rank: number; wallet: Address; count: string; lastGreetingAt: number }
export interface GarcLeaderboardSnapshot {
  entries: GarcRanking[]; totalGreetings: string; blockNumber: string; updatedAt: string; syncDelayed?: boolean;
}
export interface GarcLeaderboardResponse {
  entries: GarcRanking[]; page: number; pageSize: number; totalPages: number; totalWallets: number;
  totalGreetings: string; blockNumber: string; updatedAt: string; contract: Address; syncDelayed?: boolean;
  search: { wallet: Address; entry: GarcRanking | null; page: number | null } | null;
}
export interface GarcRankingEvent {
  wallet: Address; walletCount: bigint; totalCount: bigint; timestamp: bigint;
  transactionHash: string; logIndex: number;
}

// Require the complete global sequence: a truncated RPC response must never become an incorrect rank.
export function rankGarcEvents(events: GarcRankingEvent[], totalGreetings: bigint): GarcRanking[] {
  const unique = new Map(events.map(event => [`${event.transactionHash.toLowerCase()}:${event.logIndex}`, event]));
  const ordered = [...unique.values()].sort((a, b) => a.totalCount < b.totalCount ? -1 : a.totalCount > b.totalCount ? 1 : 0);
  if (BigInt(ordered.length) !== totalGreetings) throw new Error("Incomplete gARC history. Please retry.");
  const wallets = new Map<string, { wallet: Address; count: bigint; first: bigint; timestamp: bigint }>();
  ordered.forEach((event, index) => {
    if (event.totalCount !== BigInt(index + 1) || !isAddress(event.wallet, { strict: false })) throw new Error("Invalid gARC history.");
    const key = event.wallet.toLowerCase();
    const previous = wallets.get(key);
    if (event.walletCount !== (previous?.count ?? BigInt(0)) + BigInt(1)) throw new Error("Incomplete wallet greeting history.");
    wallets.set(key, { wallet: getAddress(event.wallet), count: event.walletCount, first: previous?.first ?? event.totalCount, timestamp: event.timestamp });
  });
  return [...wallets.values()].sort((a, b) => a.count !== b.count ? (a.count > b.count ? -1 : 1) : a.first < b.first ? -1 : 1)
    .map((entry, index) => ({ rank: index + 1, wallet: entry.wallet, count: entry.count.toString(), lastGreetingAt: Number(entry.timestamp) }));
}

export function paginateGarc(snapshot: GarcLeaderboardSnapshot, requestedPage: number, wallet: string | null, contract: Address): GarcLeaderboardResponse {
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) throw new Error("Invalid page.");
  if (wallet && !isAddress(wallet, { strict: false })) throw new Error("Enter a complete EVM wallet address (0x followed by 40 hexadecimal characters).");
  const totalPages = Math.max(1, Math.ceil(snapshot.entries.length / GARC_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const entry = wallet ? snapshot.entries.find(item => item.wallet.toLowerCase() === wallet.toLowerCase()) ?? null : null;
  return {
    ...snapshot, entries: snapshot.entries.slice((page - 1) * GARC_PAGE_SIZE, page * GARC_PAGE_SIZE),
    page, pageSize: GARC_PAGE_SIZE, totalPages, totalWallets: snapshot.entries.length, contract,
    search: wallet ? { wallet: getAddress(wallet), entry, page: entry ? Math.ceil(entry.rank / GARC_PAGE_SIZE) : null } : null,
  };
}

import { unstable_cache } from "next/cache";
import { createPublicClient, http, type Address } from "viem";
import { arcMainnet } from "./chains";
import { GARC_CONTRACT_ADDRESS, GARC_MESSAGE, verifyGarcContract } from "./garc";
import { garcAbi } from "./generated/garc";
import { rankGarcEvents, type GarcRankingEvent, type GarcLeaderboardSnapshot } from "./garc-leaderboard";
import deployment from "@/public/contracts/ArcGarc.mainnet.json";

const client = createPublicClient({ chain: arcMainnet, transport: http(undefined, { batch: { batchSize: 20, wait: 25 }, timeout: 10_000, retryCount: 2, retryDelay: 1000 }) });
const CHUNK_SIZE = BigInt(5000);
type CachedEvent = Omit<GarcRankingEvent, "walletCount" | "totalCount" | "timestamp"> & { walletCount: string; totalCount: string; timestamp: string };

async function readEvents(contract: Address, from: string, to: string): Promise<CachedEvent[]> {
  const [logs, before, after] = await Promise.all([
    client.getContractEvents({ address: contract, abi: garcAbi, eventName: "Garc", fromBlock: BigInt(from), toBlock: BigInt(to), strict: true }),
    BigInt(from) === BigInt(deployment.blockNumber) ? Promise.resolve(BigInt(0)) : client.readContract({ address: contract, abi: garcAbi, functionName: "totalGreetings", blockNumber: BigInt(from) - BigInt(1) }),
    client.readContract({ address: contract, abi: garcAbi, functionName: "totalGreetings", blockNumber: BigInt(to) }),
  ]);
  const events = logs.filter(log => !log.removed && log.args.message === GARC_MESSAGE).map(log => ({
    wallet: log.args.wallet, walletCount: log.args.walletCount.toString(), totalCount: log.args.totalCount.toString(),
    timestamp: log.args.timestamp.toString(), transactionHash: log.transactionHash, logIndex: log.logIndex,
  }));
  const sequence = events.map(event => BigInt(event.totalCount)).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  if (BigInt(sequence.length) !== after - before || sequence.some((count, index) => count !== before + BigInt(index + 1))) {
    throw new Error("Incomplete gARC history chunk. Please retry.");
  }
  return events;
}
// Finalized, complete historical chunks are reusable across Vercel instances; the open tail stays live.
const readHistoricalEvents = unstable_cache(readEvents, ["garc-finalized-events-v1", String(arcMainnet.id), arcMainnet.rpcUrls.default.http[0]], { revalidate: false });

async function readSnapshot(): Promise<GarcLeaderboardSnapshot> {
  const contract = GARC_CONTRACT_ADDRESS;
  if (contract.toLowerCase() !== deployment.contractAddress.toLowerCase()) throw new Error("Leaderboard deployment configuration mismatch.");
  await verifyGarcContract(contract, client);
  const block = await client.getBlock({ blockTag: "finalized" });
  const start = BigInt(deployment.blockNumber);
  if (block.number < start) throw new Error("gARC deployment is not finalized yet.");
  const total = await client.readContract({ address: contract, abi: garcAbi, functionName: "totalGreetings", blockNumber: block.number });
  const ranges: Array<{ from: bigint; to: bigint; complete: boolean }> = [];
  for (let from = start; from <= block.number; from += CHUNK_SIZE) {
    const end = from + CHUNK_SIZE - BigInt(1);
    ranges.push({ from, to: end < block.number ? end : block.number, complete: end <= block.number });
  }
  const events: CachedEvent[] = [];
  // Bound concurrency to avoid flooding the public RPC during an initial history scan.
  for (let offset = 0; offset < ranges.length; offset += 2) {
    const batch = await Promise.all(ranges.slice(offset, offset + 2).map(range =>
      (range.complete ? readHistoricalEvents : readEvents)(contract, range.from.toString(), range.to.toString())));
    events.push(...batch.flat());
  }
  return {
    entries: rankGarcEvents(events.map(event => ({ ...event, walletCount: BigInt(event.walletCount), totalCount: BigInt(event.totalCount), timestamp: BigInt(event.timestamp) })), total),
    totalGreetings: total.toString(), blockNumber: block.number.toString(), updatedAt: new Date().toISOString(),
  };
}

export const getGarcLeaderboard = unstable_cache(readSnapshot, ["garc-leaderboard-v1", GARC_CONTRACT_ADDRESS, arcMainnet.rpcUrls.default.http[0]], { revalidate: 15 });

import { unstable_cache } from "next/cache";
import { createPublicClient, http } from "viem";
import { arcMainnet } from "./chains";
import { GARC_CONTRACT_ADDRESS, verifyGarcContract } from "./garc";
import { garcAbi } from "./generated/garc";
import { checkpointSnapshot, DEPLOYED_GARC_EVENT_MESSAGE, readChangedGarcEvents, verifyEventRange, type GarcCheckpoint } from "./ascope-garc-index";
import bootstrap from "@/public/contracts/ascope-garc-index.json";

const client = createPublicClient({ chain: arcMainnet, transport: http(undefined, { batch: { batchSize: 20, wait: 25 }, timeout: 4000, retryCount: 1, retryDelay: 500 }) });
const cacheKey = ["ascope-garc-index-v2", GARC_CONTRACT_ADDRESS, arcMainnet.rpcUrls.default.http[0], bootstrap.blockHash];
let latest: GarcCheckpoint = bootstrap as GarcCheckpoint;
let pending: Promise<GarcCheckpoint> | undefined;

const verifyDeployment = unstable_cache(async () => {
  await verifyGarcContract(GARC_CONTRACT_ADDRESS, client);
  return true;
}, [...cacheKey, "deployment"], { revalidate: 3600 });

const countAt = unstable_cache(async (block: string) =>
  (await client.readContract({ address: GARC_CONTRACT_ADDRESS, abi: garcAbi, functionName: "totalGreetings", blockNumber: BigInt(block) })).toString(),
[...cacheKey, "finalized-counter"], { revalidate: false });

const readRange = unstable_cache(async (from: string, to: string, before: string, after: string) => {
  const logs = await client.getContractEvents({ address: GARC_CONTRACT_ADDRESS, abi: garcAbi, eventName: "Garc", fromBlock: BigInt(from), toBlock: BigInt(to), strict: true });
  return verifyEventRange(logs.filter(log => !log.removed && log.args.message === DEPLOYED_GARC_EVENT_MESSAGE).map(log => ({
    wallet: log.args.wallet, walletCount: log.args.walletCount.toString(), totalCount: log.args.totalCount.toString(),
    timestamp: log.args.timestamp.toString(), transactionHash: log.transactionHash, logIndex: log.logIndex,
  })), BigInt(before), BigInt(after));
}, [...cacheKey, "finalized-events"], { revalidate: false });

async function refreshCheckpoint(): Promise<GarcCheckpoint> {
  await verifyDeployment();
  const block = await client.getBlock({ blockTag: "finalized" });
  const previous = latest;
  if (block.number < BigInt(previous.blockNumber)) throw new Error("RPC is behind the verified gARC checkpoint.");
  const total = await client.readContract({ address: GARC_CONTRACT_ADDRESS, abi: garcAbi, functionName: "totalGreetings", blockNumber: block.number });
  const additional = await readChangedGarcEvents(BigInt(previous.blockNumber) + BigInt(1), block.number, BigInt(previous.totalGreetings), total, {
    countAt: async middle => BigInt(await countAt(middle.toString())),
    events: (from, to, before, after) => readRange(from.toString(), to.toString(), before.toString(), after.toString()),
  });
  const checkpoint: GarcCheckpoint = {
    chainId: arcMainnet.id, contract: GARC_CONTRACT_ADDRESS, blockNumber: block.number.toString(), blockHash: block.hash,
    totalGreetings: total.toString(), updatedAt: new Date().toISOString(), events: [...previous.events, ...additional],
  };
  checkpointSnapshot(checkpoint);
  if (BigInt(checkpoint.blockNumber) >= BigInt(latest.blockNumber)) latest = checkpoint;
  return checkpoint;
}

const readCheckpoint = unstable_cache(async () => {
  if (!pending) pending = refreshCheckpoint().finally(() => { pending = undefined; });
  return pending;
}, cacheKey, { revalidate: 60 });

export async function getGarcLeaderboard() {
  if (GARC_CONTRACT_ADDRESS.toLowerCase() !== bootstrap.contract.toLowerCase() || arcMainnet.id !== bootstrap.chainId) {
    throw new Error("Leaderboard deployment configuration mismatch.");
  }
  try {
    const checkpoint = await readCheckpoint();
    if (BigInt(checkpoint.blockNumber) >= BigInt(latest.blockNumber)) latest = checkpoint;
    return checkpointSnapshot(latest);
  } catch {
    console.warn("gARC refresh unavailable; serving the last completely verified checkpoint.");
    return { ...checkpointSnapshot(latest), syncDelayed: true };
  }
}

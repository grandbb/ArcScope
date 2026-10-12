import { unstable_cache } from "next/cache";
import { formatUnits, toHex, type Address } from "viem";
import { mainnetClient, verifyMainnet } from "./ascope-mainnet";
import { arcMainnet } from "./chains";

const timestampAt = unstable_cache(async (number: number) => Number((await mainnetClient.getBlock({blockNumber: BigInt(number)})).timestamp), ["ascope-block-timestamp-v1",arcMainnet.rpcUrls.default.http[0]], {revalidate:false});
/** Return the last finalized block at or before a requested timestamp, never an estimated height. */
export async function blockAtTime(target: number, low: number, high: number, timeAt: (block: number) => Promise<number>): Promise<number | null> {
  let lowerTime = await timeAt(low), upperTime = await timeAt(high);
  if (target < lowerTime) return null;
  if (target >= upperTime) return high;
  while (high - low > 1) {
    const fraction = upperTime > lowerTime ? (target-lowerTime)/(upperTime-lowerTime) : 0.5;
    const probe = Math.max(low+1, Math.min(high-1, Math.floor(low+(high-low)*(fraction > 0.05 && fraction < 0.95 ? fraction : 0.5))));
    const timestamp = await timeAt(probe);
    if (timestamp <= target) {low=probe;lowerTime=timestamp;} else {high=probe;upperTime=timestamp;}
  }
  return low;
}
export const readBalanceHistory = unstable_cache(async (address: string) => {
  await verifyMainnet();
  const head = await mainnetClient.getBlock({blockTag:"finalized"});
  const end = Number(head.timestamp);
  // Fixed UTC five-day boundaries reuse immutable archive reads across refreshes.
  const interval = 5*86400;
  const boundary = Math.floor(end/interval)*interval;
  const timestamps = [...Array.from({length:6},(_,i)=>boundary-(5-i)*interval),end];
  const points = await Promise.all(timestamps.map(async timestamp => {
    const block = await blockAtTime(timestamp,0,Number(head.number),timestampAt);
    if (block === null) return null;
    const balance = BigInt(await mainnetClient.request({method:"eth_getBalance",params:[address as Address,toHex(block)]}));
    return {date:new Date(timestamp*1000).toISOString(),balance:Number(formatUnits(balance,18)),blockNumber:block};
  }));
  return points.filter((point): point is NonNullable<typeof point> => point !== null);
}, ["ascope-native-balance-history-v2",arcMainnet.rpcUrls.default.http[0]], {revalidate:300});

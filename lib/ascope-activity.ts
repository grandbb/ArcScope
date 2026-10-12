import { unstable_cache } from "next/cache";
import { formatUnits, toHex, type Address, type Hash } from "viem";
import { mainnetClient, verifyMainnet, USDC_ADDRESS, tokenFacts } from "./ascope-mainnet";
import { arcMainnet } from "./chains";
import { TRANSFER_TOPIC, USDC_EMITTER } from "./live-feeds";
import type { Transaction } from "./types";

// viem 2.21 treats blockNumber: 0n as latest here. Send the explicit RPC quantity.
export const readHistoricalNonce = unstable_cache(async (address: string, block: string) => Number(BigInt(await mainnetClient.request({method:"eth_getTransactionCount",params:[address as Address,toHex(BigInt(block))]}))), ["ascope-historical-nonce-v2",arcMainnet.rpcUrls.default.http[0]], { revalidate: false });
const blockTransactions = unstable_cache(async (block: string) => {
  const result = await mainnetClient.getBlock({ blockNumber: BigInt(block), includeTransactions: true });
  return { timestamp: Number(result.timestamp) * 1000, transactions: result.transactions.map(tx => ({ hash: tx.hash, from: tx.from, to: tx.to, value: tx.value.toString(), input: tx.input, nonce: tx.nonce })) };
}, ["ascope-transaction-block-v1",arcMainnet.rpcUrls.default.http[0]], { revalidate: false });
const receiptFacts = unstable_cache(async (hash: string) => {
  const receipt = await mainnetClient.getTransactionReceipt({ hash: hash as Hash });
  return { status: receipt.status === "success" ? "success" as const : "failed" as const, gasFee: Number(formatUnits(receipt.gasUsed * receipt.effectiveGasPrice, 18)) };
}, ["ascope-transaction-receipt-v1",arcMainnet.rpcUrls.default.http[0]], { revalidate: false });

/** Nonce changes locate actual outgoing transactions without scanning millions of empty blocks. */
export async function outgoingBlocks(from: number, to: number, before: number, after: number, minimumNonce: number, readCount: (block: number) => Promise<number>, maximumNonce = after): Promise<number[]> {
  if (after < before) throw new Error("Transaction counter moved backwards");
  if (after <= minimumNonce || before >= maximumNonce || before === after || from > to) return [];
  if (from === to) return [from];
  const mid = Math.floor((from + to) / 2);
  const count = await readCount(mid);
  if (count < before || count > after) throw new Error("Invalid historical transaction counter");
  const [left, right] = await Promise.all([
    outgoingBlocks(from, mid, before, count, minimumNonce, readCount, maximumNonce),
    outgoingBlocks(mid + 1, to, count, after, minimumNonce, readCount, maximumNonce),
  ]);
  return [...left, ...right];
}

const readTransactionPage = unstable_cache(async (address: string, endNonce: number) => {
  const head = await mainnetClient.getBlock({ blockTag: "finalized" });
  const sentCount = await mainnetClient.getTransactionCount({ address: address as Address, blockNumber: head.number });
  if (!Number.isSafeInteger(endNonce) || endNonce < 0 || endNonce > sentCount) throw new Error("Invalid transaction page cursor");
  const minimum = Math.max(0, endNonce - 10);
  const baseline = await readHistoricalNonce(address, "0");
  const blocks = await outgoingBlocks(1, Number(head.number), baseline, sentCount, minimum, block => readHistoricalNonce(address, String(block)), endNonce);
  const items: Transaction[] = [];
  for (let offset = 0; offset < blocks.length; offset += 5) {
    await Promise.all(blocks.slice(offset, offset + 5).map(async block => {
      const data = await blockTransactions(String(block));
      const matches = data.transactions.filter(tx => tx.from.toLowerCase() === address.toLowerCase() && tx.nonce >= minimum && tx.nonce < endNonce);
      await Promise.all(matches.map(async tx => {
        const facts = await receiptFacts(tx.hash);
        items.push({ ...facts, hash: tx.hash, from: tx.from, to: tx.to ?? "", type: tx.to === null || tx.input !== "0x" ? "contract" : "send", value: Number(formatUnits(BigInt(tx.value), 18)), symbol: "USDC", timestamp: data.timestamp });
      }));
    }));
  }
  // Verify every requested outgoing nonce was found; never present truncated pages as complete.
  if (items.length !== endNonce - Math.max(baseline, minimum)) throw new Error("Could not verify the complete outgoing transaction page");
  return { items: items.sort((a,b) => b.timestamp - a.timestamp || a.hash.localeCompare(b.hash)), nextPageKey: minimum > baseline ? String(minimum) : undefined, fromBlock: blocks[0] ?? null };
}, ["ascope-immutable-transaction-page-v1",arcMainnet.rpcUrls.default.http[0]], { revalidate: false });

const cachedActivity = unstable_cache(async (address: string, cursor = "") => {
  await verifyMainnet();
  const head = await mainnetClient.getBlock({blockTag:"finalized"});
  const sentCount = await mainnetClient.getTransactionCount({address:address as Address,blockNumber:head.number});
  const endNonce = cursor ? Number(cursor) : sentCount;
  if (!Number.isSafeInteger(endNonce) || endNonce < 0 || endNonce > sentCount) throw new Error("Invalid transaction page cursor");
  const page = await readTransactionPage(address,endNonce);
  return {...page,sentCount,toBlock:Number(head.number),coverage:"Confirmed outgoing wallet transactions, 10 per page. Incoming transfers and internal calls are not included in this list.",updatedAt:new Date().toISOString()};
}, ["ascope-wallet-activity-v3",arcMainnet.rpcUrls.default.http[0]], {revalidate:60});
const pendingActivity = new Map<string, ReturnType<typeof cachedActivity>>();
export async function readActivity(address: string, cursor = "") {
  const key = `${address.toLowerCase()}:${cursor}`;
  const pending = pendingActivity.get(key);
  if (pending) return pending;
  const next = cachedActivity(address.toLowerCase(),cursor);
  pendingActivity.set(key,next);
  try {return await next;} finally {pendingActivity.delete(key);}
}

export async function readTokenTransfers(address: string) {
  await verifyMainnet();
  const facts = await tokenFacts(address);
  const head = await mainnetClient.getBlock({ blockTag: "finalized" });
  const fromBlock = head.number > BigInt(120) ? head.number - BigInt(119) : BigInt(0);
  const emitter = address.toLowerCase() === USDC_ADDRESS ? USDC_EMITTER : address;
  const raw = await mainnetClient.request({method:"eth_getLogs",params:[{address:emitter as Address,fromBlock:toHex(fromBlock),toBlock:toHex(head.number),topics:[TRANSFER_TOPIC]}]});
  const logs = raw.map(log => ({...log,blockNumber:BigInt(log.blockNumber!),logIndex:Number(BigInt(log.logIndex!))}));
  const selected = logs.filter(log => log.topics.length === 3 && /^0x[0-9a-f]{64}$/i.test(log.data)).slice(-20).reverse();
  const items = await Promise.all(selected.map(async log => {
    const [block, receipt] = await Promise.all([mainnetClient.getBlock({ blockNumber: log.blockNumber! }), receiptFacts(log.transactionHash!)]);
    return { ...receipt, hash: log.transactionHash!, from: `0x${log.topics[1]!.slice(-40)}`, to: `0x${log.topics[2]!.slice(-40)}`, value: Number(formatUnits(BigInt(log.data), address.toLowerCase() === USDC_ADDRESS ? 18 : facts.decimals)), symbol: facts.symbol, timestamp: Number(block.timestamp) * 1000, type: "send" as const, logIndex: log.logIndex };
  }));
  return { items, fromBlock: String(fromBlock), toBlock: String(head.number), coverage: "Latest 20 ERC-20 transfers in the last 120 finalized blocks. NFT transfers are excluded." };
}

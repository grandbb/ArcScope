import { erc20Abi, formatUnits, parseAbiItem, type Address } from "viem";
import type { ArcTrackerSnapshot } from "./ascope-arc-tracker";
import type { mainnetClient } from "./ascope-mainnet";
import publicNames from "../public/ascope-arc-address-labels.json";
import holderRegistry from "../public/ascope-arc-holder-addresses.json";

const token = "0xa12cd81d0f9988e3d60c4b6a0d52d368ef3c788d" as Address;
const zeroAddress = "0x0000000000000000000000000000000000000000";
const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const labels = new Map<string, string>(Object.entries(publicNames.labels));

type ChainTransfer = {
  hash: `0x${string}`;
  from: Address;
  to: Address;
  value: bigint;
  block: bigint;
  logIndex: number;
};

async function readTransfers(client: typeof mainnetClient, fromBlock: bigint, toBlock: bigint) {
  const transfers: ChainTransfer[] = [];
  for (let start = fromBlock; start <= toBlock; start += BigInt(10_000)) {
    const end = start + BigInt(9_999) < toBlock ? start + BigInt(9_999) : toBlock;
    const logs = await client.getLogs({ address: token, event: transferEvent, fromBlock: start, toBlock: end, strict: true });
    for (const log of logs) {
      if (!log.transactionHash || log.blockNumber === null || log.logIndex === null || !log.args.from || !log.args.to || log.args.value === undefined) throw Error("Incomplete finalized ARC Transfer log");
      transfers.push({ hash: log.transactionHash, from: log.args.from, to: log.args.to, value: log.args.value, block: log.blockNumber, logIndex: log.logIndex });
    }
  }
  return transfers;
}

export async function refreshArcOnChain(client: typeof mainnetClient, lastGood: ArcTrackerSnapshot): Promise<ArcTrackerSnapshot> {
  if (await client.getChainId() !== 5042) throw Error("ARC tracker provider is not Arc Mainnet (5042)");
  const finalized = await client.getBlock({ blockTag: "finalized" });
  const checkedBlock = BigInt(lastGood.checkedBlock ?? holderRegistry.checkedBlock);
  const chainTransfers = checkedBlock < finalized.number
    ? await readTransfers(client, checkedBlock + BigInt(1), finalized.number)
    : [];

  if (checkedBlock > finalized.number) throw Error("ARC finalized block is behind the verified snapshot");
  const knownAddresses = new Set<string>((lastGood.holderAddresses ?? holderRegistry.addresses).map(address => address.toLowerCase()));
  for (const transfer of chainTransfers) {
    if (transfer.from.toLowerCase() !== zeroAddress) knownAddresses.add(transfer.from.toLowerCase());
    if (transfer.to.toLowerCase() !== zeroAddress) knownAddresses.add(transfer.to.toLowerCase());
  }

  const [decimals, rawSupply, ...rawBalances] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: "decimals", blockNumber: finalized.number }),
    client.readContract({ address: token, abi: erc20Abi, functionName: "totalSupply", blockNumber: finalized.number }),
    ...[...knownAddresses].map(address => client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [address as Address], blockNumber: finalized.number })),
  ]);
  const supply = Number(formatUnits(rawSupply, decimals));
  const heldSupply = rawBalances.reduce((sum, value) => sum + value, BigInt(0));
  if (rawSupply <= BigInt(0) || heldSupply !== rawSupply) throw Error("Incomplete ARC holder registry: balances do not reconcile with total supply");
  const balances = [...knownAddresses].map((address, index) => ({
    address,
    balance: Number(formatUnits(rawBalances[index], decimals)),
  })).filter(holder => holder.balance > 0).sort((a, b) => b.balance - a.balance);
  const holders = balances.slice(0, 10).map(holder => ({
    ...holder,
    share: holder.balance / supply * 100,
    label: labels.get(holder.address) ?? null,
  }));

  const blockTimes = new Map<number, number>();
  for (const block of [...new Set(chainTransfers.map(transfer => Number(transfer.block)))]) {
    const data = await client.getBlock({ blockNumber: BigInt(block) });
    blockTimes.set(block, Number(data.timestamp) * 1000);
  }
  const newest = chainTransfers.map(transfer => ({
    hash: transfer.hash,
    from: transfer.from.toLowerCase(),
    to: transfer.to.toLowerCase(),
    fromLabel: labels.get(transfer.from.toLowerCase()) ?? null,
    toLabel: labels.get(transfer.to.toLowerCase()) ?? null,
    amount: Number(formatUnits(transfer.value, decimals)),
    timestamp: blockTimes.get(Number(transfer.block))!,
    block: Number(transfer.block),
    logIndex: transfer.logIndex,
  }));
  const transfers = [...newest, ...lastGood.transfers]
    .sort((a, b) => b.block - a.block || (b.logIndex ?? 0) - (a.logIndex ?? 0))
    .filter((transfer, index, all) => all.findIndex(item => item.hash.toLowerCase() === transfer.hash.toLowerCase() && (item.logIndex ?? 0) === (transfer.logIndex ?? 0)) === index)
    .slice(0, 10);

  return {
    supply,
    holderCount: balances.length,
    holders,
    other: Math.max(0, supply - holders.reduce((sum, holder) => sum + holder.balance, 0)),
    transfers,
    updatedAt: new Date().toISOString(),
    checkedBlock: Number(finalized.number),
    holderAddresses: [...knownAddresses],
  };
}

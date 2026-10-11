import { decodeEventLog, encodeFunctionData, isAddress, type Address, type Hex } from "viem";
import { garcAbi, garcRuntimeBytecode, garcRemixRuntimeBytecode } from "./generated/garc";

export const GARC_CHAIN_ID = 5042;
export const GARC_MESSAGE = "gARC | ArcScope";
// Verified successful deployment on chain 5042 from the project owner's wallet.
export const GARC_MAINNET_CONTRACT_ADDRESS = "0x582d4b53f1b261f73a343fcc9137ba9772e6eb50" as Address;
const configuredAddress = process.env.NEXT_PUBLIC_GARC_CONTRACT_ADDRESS?.trim();
export const GARC_CONTRACT_ADDRESS = configuredAddress && isAddress(configuredAddress) ? configuredAddress as Address : GARC_MAINNET_CONTRACT_ADDRESS;

export function garcTransaction(account: Address, contract: Address) {
  return { account, to: contract, value: BigInt(0), data: encodeFunctionData({ abi: garcAbi, functionName: "greet" }), chainId: GARC_CHAIN_ID } as const;
}

export function isGarcTransaction(transaction: { from: Address; to: Address | null; value: bigint; input: Hex }, account: Address, contract: Address): boolean {
  const expected = garcTransaction(account, contract);
  return transaction.from.toLowerCase() === account.toLowerCase() && transaction.to?.toLowerCase() === contract.toLowerCase()
    && transaction.value === BigInt(0) && transaction.input.toLowerCase() === expected.data.toLowerCase();
}

export function hasGarcEvent(logs: readonly { address: Address; data: Hex; topics: readonly Hex[] }[], account: Address, contract: Address): boolean {
  return logs.some(log => {
    if (log.address.toLowerCase() !== contract.toLowerCase()) return false;
    try {
      const decoded = decodeEventLog({ abi: garcAbi, eventName: "Garc", data: log.data, topics: log.topics as [Hex, ...Hex[]] });
      return decoded.args.wallet.toLowerCase() === account.toLowerCase() && decoded.args.message === GARC_MESSAGE;
    } catch { return false; }
  });
}

// Solidity appends CBOR compiler metadata. A Remix source path changes only this trailer.
export function executableRuntime(code: Hex): Hex {
  if (code.length < 6) return code;
  const metadataBytes = Number.parseInt(code.slice(-4), 16);
  const start = code.length - (metadataBytes + 2) * 2;
  if (start < 2 || metadataBytes === 0) return code;
  const firstByte = Number.parseInt(code.slice(start, start + 2), 16);
  return firstByte >= 0xa0 && firstByte <= 0xbf ? code.slice(0, start) as Hex : code;
}

export async function verifyGarcContract(contract: Address, client: {
  getChainId(): Promise<number>; getCode(args: { address: Address }): Promise<Hex | undefined>;
}) {
  if (await client.getChainId() !== GARC_CHAIN_ID) throw new Error("RPC network mismatch. Please use Arc Mainnet.");
  if (!isAddress(contract)) throw new Error("Invalid gARC contract address.");
  const code = await client.getCode({ address: contract });
  const expected = [garcRuntimeBytecode, garcRemixRuntimeBytecode].map(runtime => executableRuntime(runtime).toLowerCase());
  if (!code || !expected.includes(executableRuntime(code).toLowerCase())) throw new Error("This address is not the verified ArcScope gARC contract on Arc Mainnet.");
}

export async function prepareGarc(account: Address, contract: Address, client: {
  getChainId(): Promise<number>;
  getCode(args: { address: Address }): Promise<Hex | undefined>;
  estimateGas(args: { account: Address; to: Address; value: bigint; data: Hex }): Promise<bigint>;
}) {
  await verifyGarcContract(contract, client);
  const transaction = garcTransaction(account, contract);
  const gas = await client.estimateGas(transaction);
  return { ...transaction, gas: gas + gas / BigInt(5) };
}

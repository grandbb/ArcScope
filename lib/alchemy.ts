import { getChain } from "./chains";
import type { ChainSlug } from "./types";

interface RpcEnvelope<T> { result?: T; error?: { message: string } }
async function requestRpc<T>(method: string, params: readonly unknown[] = [], chain: ChainSlug = "arc"): Promise<T> {
  const response = await fetch(getChain(chain).rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), next: { revalidate: 30 }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`RPC request failed (${response.status})`);
  const payload = await response.json() as RpcEnvelope<T>; if (payload.error || payload.result === undefined) throw new Error(payload.error?.message ?? "RPC returned no result"); return payload.result;
}
export const hexToNumber = (hex: string): number => Number.parseInt(hex, 16);
export const hexToEther = (hex: string): number => Number(BigInt(hex)) / 1e18;

/** Reject stale testnet overrides before reading mainnet data. */
export async function alchemyRpc<T>(method: string, params: readonly unknown[] = [], chain: ChainSlug = "arc"): Promise<T> {
  const id = await requestRpc<string>("eth_chainId", [], chain);
  if (hexToNumber(id) !== getChain(chain).id) throw new Error(`RPC network mismatch: expected Arc Mainnet (${getChain(chain).id})`);
  return requestRpc<T>(method, params, chain);
}

import { getChain } from "./chains";
import type { ChainSlug } from "./types";

interface RpcEnvelope<T> { result?: T; error?: { message: string } }
export async function alchemyRpc<T>(method: string, params: readonly unknown[] = [], chain: ChainSlug = "arc"): Promise<T> {
  const response = await fetch(getChain(chain).rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), next: { revalidate: 30 } });
  if (!response.ok) throw new Error(`RPC request failed (${response.status})`);
  const payload = await response.json() as RpcEnvelope<T>; if (payload.error || payload.result === undefined) throw new Error(payload.error?.message ?? "RPC returned no result"); return payload.result;
}
export const hexToNumber = (hex: string): number => Number.parseInt(hex, 16);
export const hexToEther = (hex: string): number => Number(BigInt(hex)) / 1e18;

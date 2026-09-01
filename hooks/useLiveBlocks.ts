"use client";

import { useCallback, useMemo, useState } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { getChain } from "@/lib/chains";
import type { Block } from "@/lib/types";
import { useWebSocket } from "./useWebSocket";

interface SubscriptionFrame { params?: { result?: { number?: string; gasUsed?: string; gasLimit?: string; miner?: string; timestamp?: string } } }
export function useLiveBlocks() {
  const chain = useSettingsStore((state) => state.chain); const [blocks, setBlocks] = useState<Block[]>([]); const [error] = useState<Error | null>(null);
  const onMessage = useCallback((unknownFrame: unknown) => { const frame = unknownFrame as SubscriptionFrame; const head = frame.params?.result; if (!head?.number) return; const block: Block = { number: Number.parseInt(head.number, 16), transactionCount: 0, gasUsed: Number.parseInt(head.gasUsed ?? "0x0", 16), gasLimit: Number.parseInt(head.gasLimit ?? "0x0", 16), miner: head.miner ?? "", timestamp: Number.parseInt(head.timestamp ?? "0x0", 16) * 1000 }; setBlocks((current) => [block, ...current.filter((item) => item.number !== block.number)].slice(0, 20)); }, []);
  const options = useMemo(() => ({ url: getChain(chain).wsUrl, onMessage }), [chain, onMessage]);
  const { readyState } = useWebSocket(options); return { blocks, isConnected: readyState === "connected", error };
}

"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, webSocket } from "viem";
import { arcMainnet, getChain } from "@/lib/chains";
import type { Block } from "@/lib/types";

export function useLiveBlocks() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isConnected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    const config = getChain("arc");
    const client = createPublicClient({
      chain: arcMainnet,
      transport: config.wsUrl ? webSocket(config.wsUrl) : http(config.rpcUrl),
      pollingInterval: 4_000,
    });
    let disposed = false;
    let unwatch: (() => void) | undefined;
    const fail = (cause: Error) => { if (!disposed) { setError(cause); setConnected(false); } };
    void client.getChainId().then((id) => {
      if (disposed) return;
      if (id !== arcMainnet.id) throw new Error(`Expected Arc Mainnet (${arcMainnet.id}), received chain ${id}`);
      unwatch = client.watchBlocks({
        emitOnBegin: true,
        onBlock: (head) => {
          if (disposed || head.number === null) return;
          const block: Block = {
            number: Number(head.number), transactionCount: head.transactions.length,
            gasUsed: Number(head.gasUsed), gasLimit: Number(head.gasLimit),
            miner: head.miner, timestamp: Number(head.timestamp) * 1000,
          };
          setBlocks((items) => [block, ...items.filter((item) => item.number !== block.number)].slice(0, 20));
          setConnected(true); setError(null);
        },
        onError: fail,
      });
    }).catch(fail);
    return () => { disposed = true; unwatch?.(); };
  }, []);
  return { blocks, isConnected, error };
}

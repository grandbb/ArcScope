import { mainnetResponse } from "@/lib/ascope-api";
import { readPortfolio, mainnetClient } from "@/lib/ascope-mainnet";
import { readActivity } from "@/lib/ascope-activity";
import type { Address } from "viem";
export const maxDuration = 60;
export async function GET(request: Request, { params }: { params: { address: string } }) { return mainnetResponse(request, async () => {
  const [portfolio, activity] = await Promise.all([readPortfolio(params.address), readActivity(params.address)]);
  const interactions = new Map<string, number>();
  const frequency = new Map<string, {date: string; send: number; receive: number; contract: number}>();
  const contracts = await Promise.all([...new Set(activity.items.filter(t => t.type === "contract" && t.to).map(t => t.to))].map(async address => (await mainnetClient.getCode({address: address as Address})) !== undefined && (await mainnetClient.getCode({address: address as Address})) !== "0x" ? address : null));
  for (const tx of activity.items) {
    const day = new Date(tx.timestamp).toISOString().slice(0,10);
    const point = frequency.get(day) ?? {date: day, send: 0, receive: 0, contract: 0};
    if (tx.type === "contract" || tx.type === "mint") point.contract++; else point.send++;
    frequency.set(day, point);
    if (contracts.includes(tx.to)) interactions.set(tx.to, (interactions.get(tx.to) ?? 0) + 1);
  }
  return { address: params.address, balance: portfolio.tokens[0].balance, txCount: activity.sentCount, firstTx: null,
    lastActive: activity.items[0] ? new Date(activity.items[0].timestamp).toISOString() : null, uniqueContracts: interactions.size,
    history: [], frequency: [...frequency.values()].sort((a,b) => a.date.localeCompare(b.date)), transactions: activity.items, tokens: portfolio.tokens,
    interactions: [...interactions].map(([name,size]) => ({name,size})).sort((a,b) => b.size-a.size), coverage: activity.coverage + " Frequency and interactions cover the latest 10 outgoing transactions. The earliest activity requires a complete account index.", updatedAt: activity.updatedAt };
}, params.address); }

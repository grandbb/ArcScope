import { defineChain } from "viem";
import type { ChainConfig, ChainSlug } from "./types";

const rpcUrl = process.env.NEXT_PUBLIC_ARC_RPC_URL?.trim() || "https://rpc.mainnet.arc.io";
const wsUrl = process.env.NEXT_PUBLIC_ARC_WS_URL?.trim() || "";
export const arcMainnet = defineChain({
  id: 5042,
  name: "Arc Mainnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl], ...(wsUrl ? { webSocket: [wsUrl] } : {}) } },
  blockExplorers: { default: { name: "Arc Explorer", url: "https://explorer.arc.io" } },
  testnet: false,
});
export const CHAINS: ChainConfig[] = [
  { id: arcMainnet.id, slug: "arc", name: arcMainnet.name, shortName: "ARC", nativeCurrency: arcMainnet.nativeCurrency.symbol, icon: "/chain-icons/arc.svg", color: "#1F7AFA", rpcUrl, wsUrl, explorerUrl: arcMainnet.blockExplorers.default.url, alchemyNetwork: "arc-mainnet" },
];
export const getChain = (slug: string) => CHAINS.find((chain) => chain.slug === slug) ?? CHAINS[0];

import type { ChainConfig, ChainSlug } from "./types";
export const CHAINS: ChainConfig[] = [
  { id: 5042002, slug: "arc", name: "Arc Testnet", shortName: "ARC", nativeCurrency: "USDC", icon: "/chain-icons/arc.svg", color: "#1F7AFA", rpcUrl: process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network", wsUrl: process.env.NEXT_PUBLIC_ARC_WS_URL ?? "wss://rpc.testnet.arc.network", explorerUrl: "https://testnet.arcscan.app", alchemyNetwork: "arc-testnet" },
];
export const getChain = (slug: string) => CHAINS.find((chain) => chain.slug === slug) ?? CHAINS[0];

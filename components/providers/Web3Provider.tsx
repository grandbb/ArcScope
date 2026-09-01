"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { defineChain } from "viem";

/** Official Arc Testnet chain definition. USDC is the native gas asset. */
export const arcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network"], webSocket: [process.env.NEXT_PUBLIC_ARC_WS_URL ?? "wss://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "Arcscan", url: "https://testnet.arcscan.app" } },
  testnet: true,
});

const config = getDefaultConfig({
  appName: "ArcScope",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "00000000000000000000000000000000",
  chains: [arcTestnet],
  ssr: true,
});

/** Wallet transports and modal UI intentionally expose Arc Testnet only. */
export function Web3Provider({ children }: Readonly<{ children: React.ReactNode }>) {
  return <WagmiProvider config={config}><RainbowKitProvider initialChain={arcTestnet} theme={darkTheme({ accentColor: "#1F7AFA", borderRadius: "medium" })}>{children}</RainbowKitProvider></WagmiProvider>;
}

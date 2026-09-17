"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { arcMainnet } from "@/lib/chains";

const config = getDefaultConfig({
  appName: "ArcScope",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || "00000000000000000000000000000000",
  chains: [arcMainnet],
  ssr: true,
});

/** Wallet transports and modal UI intentionally expose Arc Mainnet only. */
export function Web3Provider({ children }: Readonly<{ children: React.ReactNode }>) {
  return <WagmiProvider config={config}><RainbowKitProvider initialChain={arcMainnet} theme={darkTheme({ accentColor: "#1F7AFA", borderRadius: "medium" })}>{children}</RainbowKitProvider></WagmiProvider>;
}

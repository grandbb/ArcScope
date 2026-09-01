"use client";

import { Moon, Sun, Wifi } from "lucide-react";
import { useTheme } from "next-themes";
import { SearchBar } from "./SearchBar";
import { NetworkSelector } from "./NetworkSelector";
import { ConnectWalletButton } from "@/components/shared/ConnectWalletButton";
import { useLiveBlocks } from "@/hooks/useLiveBlocks";

export function TopBar() {
  const { setTheme, resolvedTheme } = useTheme();
  const { isConnected } = useLiveBlocks();
  return <header className="sticky top-0 z-30 flex h-[76px] items-center gap-3 border-b border-white/5 bg-background/72 px-4 backdrop-blur-2xl md:px-7 xl:px-8">
    <SearchBar />
    <NetworkSelector />
    <div className={`hidden items-center gap-2 rounded-lg border border-white/5 bg-card/60 px-3 py-2 text-[11px] font-semibold sm:flex ${isConnected ? "text-emerald-400" : "text-amber-400"}`}><span className="relative flex h-2 w-2"><span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 ${isConnected ? "bg-emerald-400" : "bg-amber-400"}`}/><span className={`relative h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-amber-400"}`}/></span><Wifi className="h-3.5 w-3.5"/> {isConnected ? "Live data" : "Reconnecting"}</div>
    <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Toggle theme" className="grid h-9 w-9 place-items-center rounded-xl border border-white/5 bg-card/60 text-muted-foreground transition-colors hover:text-foreground">{resolvedTheme === "dark" ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}</button>
    <ConnectWalletButton />
  </header>;
}

"use client";

import { ThemeProvider } from "./ThemeProvider";
import { QueryProvider } from "./QueryProvider";
import { Toaster } from "sonner";
import dynamic from "next/dynamic";

// WalletConnect touches IndexedDB, so the wallet boundary is intentionally browser-only.
const Web3Provider = dynamic(() => import("./Web3Provider").then((module) => module.Web3Provider), { ssr: false, loading: () => <div className="grid min-h-screen place-items-center bg-background"><div className="flex items-center gap-3 text-sm text-muted-foreground"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">A</span><span>Loading ArcScope…</span></div></div> });

/** Provider composition is kept shallow so client hydration stays predictable. */
export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ThemeProvider><QueryProvider><Web3Provider>{children}</Web3Provider><Toaster richColors position="bottom-right"/></QueryProvider></ThemeProvider>;
}

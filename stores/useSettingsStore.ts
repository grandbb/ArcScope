"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChainSlug } from "@/lib/types";

type Currency = "USD" | "ETH" | "BTC";
interface SettingsState { theme: "light" | "dark" | "system"; currency: Currency; chain: ChainSlug; refreshInterval: 0 | 15 | 30 | 60; setTheme: (theme: SettingsState["theme"]) => void; setCurrency: (currency: Currency) => void; setChain: (chain: ChainSlug) => void; setRefreshInterval: (interval: SettingsState["refreshInterval"]) => void }
export const useSettingsStore = create<SettingsState>()(persist((set) => ({ theme: "system", currency: "USD", chain: "arc", refreshInterval: 30, setTheme: (theme) => set({ theme }), setCurrency: (currency) => set({ currency }), setChain: (chain) => set({ chain }), setRefreshInterval: (refreshInterval) => set({ refreshInterval }) }), { name: "arcscope-settings", version: 2, migrate: (persisted) => ({ ...(persisted as Partial<SettingsState>), chain: "arc" }) }));

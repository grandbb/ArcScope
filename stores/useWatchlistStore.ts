"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WatchlistItem } from "@/lib/types";

interface WatchlistState { items: WatchlistItem[]; add: (item: WatchlistItem) => void; remove: (id: string) => void; clear: () => void; importItems: (items: WatchlistItem[]) => void }
export const useWatchlistStore = create<WatchlistState>()(persist((set) => ({ items: [], add: (item) => set((state) => ({ items: state.items.some((saved) => saved.id === item.id) ? state.items : [...state.items, item] })), remove: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })), clear: () => set({ items: [] }), importItems: (items) => set({ items }) }), { name: "arcscope-watchlist" }));

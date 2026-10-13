import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Address } from "viem";
import { migrateStorageKey } from "@/lib/storage";

migrateStorageKey("arcscope-garc-mainnet-contract", "ascope-garc-mainnet-contract");

export const useGarcStore = create<{ contract?: Address; setContract: (contract: Address) => void }>()(
  persist(set => ({ contract: undefined, setContract: contract => set({ contract }) }), { name: "ascope-garc-mainnet-contract" }),
);

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Address } from "viem";

export const useGarcStore = create<{ contract?: Address; setContract: (contract: Address) => void }>()(
  persist(set => ({ contract: undefined, setContract: contract => set({ contract }) }), { name: "arcscope-garc-mainnet-contract" }),
);

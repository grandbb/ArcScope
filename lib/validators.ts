import { isAddress } from "viem";
export const isValidAddress = (value: string): boolean => isAddress(value);
export const isENSName = (value: string): boolean => /^[a-z0-9-]+\.eth$/i.test(value);
export const isTxHash = (value: string): boolean => /^0x[a-fA-F0-9]{64}$/.test(value);

export const CACHE_HEADER = "public, s-maxage=30, stale-while-revalidate=60";
export const COINGECKO_API = "https://api.coingecko.com/api/v3";
export const DEFAULT_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
export const GAS_UNITS = { "USDC Transfer": 21_000, "ERC-20 Transfer": 65_000, "ERC-20 Approve": 46_000, "Token Swap": 180_000, "NFT Mint (ERC-721)": 150_000, "Contract Deploy": 1_200_000 } as const;
export const KNOWN_TOKENS: Record<string, string> = { USDC: "0x3600000000000000000000000000000000000000", EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", USYC: "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C", ETH: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", UNI: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984" };

export type ChainSlug = "arc";
export interface ChainConfig { id: number; slug: ChainSlug; name: string; shortName: string; nativeCurrency: string; icon: string; color: string; rpcUrl: string; wsUrl: string; explorerUrl: string; alchemyNetwork: string }
export interface TokenBalance { address: string; symbol: string; name: string; logo?: string; balance: number; price: number | null; value: number | null; change24h: number | null; allocation: number }
export interface Portfolio { address: string; ensName?: string; totalValue: number; change24h: number | null; tokenCount: number; nftCount: number | null; transactionCount: number; tokens: TokenBalance[]; blockNumber?: string; updatedAt?: string; coverage?: string; unreadableTokens?: string[]; walletValue?: number; defiValue?: number | null; defiDebt?: number | null; defiPositions?: DefiPosition[]; coverageIssues?: string[]; defiSources?: string[]; nftCollections?: number | null }
export interface Block { number: number; transactionCount: number; gasUsed: number; gasLimit: number; miner: string; timestamp: number }
export interface WhaleTransaction { hash: string; from: string; to: string; value: number; symbol: string; timestamp: number; fromLabel?: string; toLabel?: string; logIndex?: number; blockNumber?: number }
export interface GasTier { name: "slow" | "standard" | "fast"; gwei: number; usd: number; waitSeconds: number | null }
export interface GasData { tiers: GasTier[]; nativePrice: number; nativeSymbol: string; updatedAt: string; history: Array<{ time: string; slow: number; standard: number; fast: number }>; coverage?: string }
export interface TrendingToken { rank: number; address: string; name: string; symbol: string; price: number; change1h: number | null; change24h: number | null; change7d: number | null; volume24h: number; marketCap: number | null; sourceUrl?: string }
export interface Transaction { hash: string; type: "send" | "receive" | "swap" | "mint" | "contract"; from: string; to: string; value: number; symbol: string; gasFee: number; timestamp: number; status: "success" | "failed"; logIndex?: number }
export interface NFTAsset { id: string; name: string; collection: string; image: string; floorPrice?: number; description?: string; traits: Array<{ traitType: string; value: string }>; contractAddress?: string; tokenId?: string; sourceUrl?: string }
export interface DefiPosition { id: string; protocol: string; type: "Lending" | "Borrowing" | "LP" | "Staking"; deposited: number | null; value: number | null; pnl: number | null; apy: number | null; debt?: number; receiptToken?: string; detail?: string; sourceUrl?: string }
export interface DAO { symbol: string; name: string; balance: number; votingPower: number | null; governanceUrl: string }
export interface ApiResponse<T> { data: T; error?: string }
export interface WatchlistItem { id: string; type: "address" | "token"; label: string; address: string; chain: ChainSlug }
export type TimeRange = "1H" | "6H" | "24H" | "7D" | "30D" | "90D" | "1Y" | "ALL";

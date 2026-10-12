# AScope Arc Mainnet data

All production imports of fixture data and synthetic charts have been removed. Missing source data is represented as unavailable, not as zero or an empty wallet.

## Connected now

- Portfolio: finalized native USDC balance (18 decimals) and ERC-20 balances for tracked Arc contracts. The 6-decimal USDC facade is not counted a second time. Native USDC uses a $1 unit valuation; unpriced assets retain their real balance and are excluded from priced totals.
- Token discovery: GeckoTerminal Arc pool tokens plus optional ASCOPE_TOKEN_ADDRESSES. This is a tracked subset, not a complete inventory. Failed reads are reported.
- Transactions: outgoing transactions found by historical account nonce changes, verified against actual blocks and receipts; 10 per page. Outgoing counts exclude incoming/internal transactions.
- History: archive RPC native USDC balance snapshots at fixed five-day boundaries plus the current balance, up to 30 days since genesis. This is not a historical valuation of all assets.
- Network: actual senders, recipients, block times and TPS over 60 finalized blocks. Active counts are sample counts, not daily totals.
- Gas: eth_feeHistory base fees and observed 10/50/90 percentiles. Costs are estimates using disclosed gas units, not simulated transaction receipts.
- Token explorer: on-chain metadata and supply, Arc market prices and pool OHLCV, recent ERC-20 transfers. Provider market capitalization can be global and is labelled accordingly.
- Watchlist: actual current tracked portfolio values/token prices.
- gARC: existing verified deployment and incremental finalized event index.

## Coverage requiring additional configuration

A public explorer currently responds HTTP 403 to server API reads. Arcscan's API currently responds HTTP 530. The application must not treat these failures as an empty wallet.

- ASCOPE_BLOCKSCOUT_API_URL: a working Blockscout-compatible Arc Mainnet API v2 base URL for NFT ownership and holder rankings. Defaults to the official explorer API; if blocked, the UI reports unavailable.
- ASCOPE_INDEXER_API_KEY: optional server-only x-api-key header for that provider. Never use a NEXT_PUBLIC key.
- ASCOPE_ERC4626_VAULTS: comma-separated verified Arc Mainnet ERC-4626 vault contracts. Share balances and convertToAssets are read at a finalized block. This adapter does not cover every lending, LP or staking protocol. Deposit history, PnL and APY remain unavailable without a protocol history/market feed.
- ASCOPE_GOVERNANCE_TOKENS: comma-separated verified Arc Mainnet governance token contracts. Real balances and getVotes (where supported) are displayed. A token balance is not assumed to imply delegated votes.
- ASCOPE_TOKEN_ADDRESSES: additional Arc ERC-20 contracts to include in portfolio discovery.
- NFT market rankings require an Arc NFT marketplace sales feed; Ethereum collection fixtures have been removed.

The UI keeps limited data coverage explicit. Full account incoming/internal history, all NFT ownership, chain-wide daily metrics and every DeFi protocol require a complete working indexer and verified protocol adapters. These are not claimed to be complete until configured and validated.

# AScope ecosystem and portfolio coverage

The dashboard supplements its existing DefiLlama TVL/DEX/fee cards with live
stablecoin capitalization, app revenue, perpetual volume, daily TVL history and
all protocol rankings available for Arc. Protocol rankings use `chainTvls.Arc`,
not global TVL. Protocol TVLs can overlap and are never added to derive chain TVL.
Provider requests are cached for five minutes and failed datasets are labeled
unavailable. Sources: [DefiLlama Arc](https://defillama.com/chain/arc),
[public API docs](https://api-docs.defillama.com/).

## Portfolio discovery and valuation

The portfolio remains Arc Mainnet only (5042). ArcScan's public address holdings
list discovers ERC-20 and NFT collections. The parser checks reported counts
against discovered entries and fails closed on truncated markup. Native USDC
and discovered ERC-20 balances are read at one finalized block. Native USDC and
its six-decimal facade are counted once. ERC-721 `balanceOf` gives ownership
counts, including LP position NFTs; ERC-1155 quantities follow the explorer
snapshot. Prices come from GeckoTerminal, then ArcScan quotes. Missing prices
stay null, holdings remain visible, and these tokens are excluded from USD totals.
If discovery fails, tracked contracts remain readable with a partial-coverage note.
The adapter reads at most 200 ERC-20 contracts and reports that cap if reached.

Net value = priced wallet assets + supported DeFi assets − supported DeFi debt.
ERC-4626/Morpho receipt tokens represented by a DeFi position are removed from
wallet valuation and the wallet token list to prevent double counting. NFTs are
counted but not assigned floor/market values. Historical charts remain the
existing wallet-history adapter; no complete historical DeFi valuation is inferred.

Supported position adapters:

- Aave v4: the official [GraphQL API](https://www.aave.com/docs/aave-v4/getting-started/graphql)
  user summary filtered strictly to chain 5042, including supplied assets and debt.
- Morpho: official [API](https://docs.morpho.org/developers/api/get-started/)
  vault V1/V2 and direct-market supplied/collateral assets and borrowing on Arc.
- Held ERC-4626 vault shares: `asset`, `balanceOf`, and `convertToAssets` at the
  portfolio block, valued using the underlying asset quote.
- Held Uniswap v4 position NFTs: Arc's verified PositionManager
  `0x6049c9a0e26405c0985f9e3685c87d0ae917f82b` and PoolManager
  `0x8366a39cc670b4001a1121b8f6a443a643e40951` only. Inventory token IDs are verified
  through `ownerOf`. Pool keys, liquidity, ticks, and slot0 are read on-chain.
  Principal is estimated from liquidity/current square-root price and tick bounds;
  accrued fees use the verified v4 `StateLibrary` storage layout and uint256
  wraparound arithmetic. Values include unclaimed LP fees. Contract source:
  [PositionManager](https://arc.etherscan.io/address/0x6049c9a0e26405c0985f9e3685c87d0ae917f82b#code).

These are supported positions, not universal DeFi coverage. Other protocols,
staked/transferred-away LP NFTs and NFT market valuations are not covered.
Missing provider results produce coverage notes, not a claim that the wallet has
zero positions. When every DeFi source fails, DeFi summary values remain null.
On-chain, protocol-API and price snapshots can have different timestamps.

NFT gallery: Blockscout is used when available; public ArcScan token-holder
inventory is the fallback when Blockscout is inaccessible. Every inventory page
must be complete, with distinct token IDs and at most 20 pages per collection.
Unavailable metadata images are left blank. The summary NFT count is independent
of pagination in the gallery.

Validation: `node --test tests/ascope-mainnet.test.cjs tests/ascope-portfolio-ecosystem.test.cjs`,
`npm run typecheck`, `npm run build`. Reduced public ArcScan fixtures were captured
on 2026-10-19 without cookies. Live validation of the user-provided wallet observed
38 NFTs across 10 collections and a Uniswap v4 USDC/EURC position; USD estimates
are live values and are not hardcoded or shipped as a wallet snapshot.

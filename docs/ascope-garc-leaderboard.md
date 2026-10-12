# AScope gARC leaderboard cache

The leaderboard ships a verified checkpoint of the immutable owner-deployed Arc Mainnet contract. The browser renders those rankings immediately, then refreshes the complete snapshot in the background. Searching a wallet and navigating 100-wallet pages use the same downloaded snapshot, so these actions do not wait for another RPC request.

The server caches verified checkpoints for 60 seconds. The browser checks every 30 seconds; normally new finalized greetings appear within 1–2 minutes. The API continues supporting `page` and `wallet`, while `snapshot=1` returns the complete ranked snapshot for local pagination and lookup.

Each refresh checks the finalized on-chain `totalGreetings()` counter. When it is unchanged, no historical logs are fetched. When it increases, the index reads only events after the checkpoint; counter-based subdivision skips empty ranges and limits each log request to 5,000 blocks. Complete finalized ranges are cached. The global sequence and each wallet count must agree with the contract before replacing the checkpoint. Concurrent refreshes share one request per server instance.

RPC failures keep the last completely verified rankings. The original verification timestamp is preserved, and the page shows an update delay when the snapshot exceeds two minutes or refreshing fails. It never treats an incomplete update as a verified ranking.

The existing immutable deployment emits its original `gARC | ArcScope` message. This string is used only to read its existing events; visible copy uses AScope. This change does not deploy another contract or send transactions.

Refresh the bundled checkpoint manually with:

```sh
node scripts/ascope-garc-checkpoint.cjs
```

The script verifies chain ID 5042 and the recorded deployment runtime hash, reads finalized events, checks their complete sequence against the contract counter, and writes `public/contracts/ascope-garc-index.json`.

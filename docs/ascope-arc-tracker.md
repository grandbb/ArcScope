# ARC Tracker

`/arc-tracker` is a separate Explore menu entry. It tracks only ARC contract
`0xa12cd81d0f9988e3d60c4b6a0d52d368ef3c788d` on Arc Mainnet.

The Token allocation section presents the indicative initial allocation from the
[ARC whitepaper, page 10](https://6778953.fs1.hubspotusercontent-na1.net/hubfs/6778953/PDFs/arc_whitepaper.pdf#page=10):
60% Ecosystem (6 billion ARC), 25% Circle (2.5 billion ARC), and 15% Long-Term
Reserve (1.5 billion ARC), calculated from the initial 10 billion supply.
These categories are separate from observed wallet holdings. The section retains
the whitepaper's qualification that exact unlock/release schedules are to be
announced; it does not infer wallet identities or circulating supply from allocations.

The server reads finalized Arc Mainnet data over the public RPC. ArcScan blocks
Vercel and GitHub datacenter requests with HTTP 403, so explorer HTML is no longer
required for refreshes. The existing HTML parser remains for historical fixtures.
No API credentials or user login are required.

The full 36-holder registry was checked against Arc Explorer on 2026-10-26.
Each refresh scans subsequent ERC-20 Transfer logs in provider-compatible ranges
of at most 10,000 blocks, discovers new addresses, and reads all balances and
totalSupply at one finalized block. Raw integer balances must reconcile exactly
with totalSupply before a snapshot can be accepted. All discovered addresses and
the checked block persist in the snapshot. Zero-balance addresses remain in this
registry so later transfers are handled correctly. The latest 10 transfers merge
the verified checkpoint with new logs, ordered by block and log index.

Next Data Cache retains successful snapshots for 45 minutes, leaving room for
background revalidation and browser polling within an hour; failures are never
cached as successful results. The CDN caches successful responses for 60 seconds
and failed refresh responses use no-store. Browser clients check every 5 minutes.
The GitHub workflow runs hourly at minute 17, invokes the same on-chain reader,
and commits its verified checkpoint, triggering a production deployment even
with no visitors. GitHub scheduled starts can be delayed by the platform; the
runtime refresh independently keeps active pages current. During RPC failures,
the UI explicitly marks the last verified snapshot as delayed.

The pie chart uses total supply as its denominator, with the remaining balance
grouped as Other holders. These addresses are not verified personal identities.
Holder, From and To links display public explorer names when available, with the
full address in the link tooltip and the original address as its destination.
Names are read from table link tooltips or untruncated link text and shared by
case-insensitive address across both tables. Missing names fall back to shortened
addresses. Public explorer labels are not proof of a person's identity.

On 2026-10-16, ArcScan showed no names for the 20 distinct addresses in the
bundled snapshot. A subsequent check of all 36 holders on
[Arc Explorer](https://explorer.arc.io/token/0xA12Cd81d0f9988E3d60c4B6a0D52D368Ef3c788d?tab=holders)
found the public label **FBO ARC presale** for
`0x67e2a7ad4e9c2cfe63a265a053f87fb675ac1269`; the other 35 holder links displayed
addresses. This corrects the earlier ArcScan-only research, which missed that label.
`public/ascope-arc-address-labels.json` retains the exact observed name, source URL
and check date. These manually checked names supplement live ArcScan labels and
are included in the bundled fallback snapshot. They do not update automatically
from Arc Explorer; recheck the source when editing this registry. Allocation
percentages or common funding are not used to infer ownership.
Supply is not circulating supply. Current balances are read at the displayed
finalized block; transfer timestamps are explicitly UTC. Public names are
manually checked explorer labels and do not automatically change via the RPC.

Validation: `node --test tests/ascope-arc-tracker.test.cjs tests/ascope-arc-chain.test.cjs`, `npm run typecheck`,
and `npm run build`. Fixtures are reduced public ArcScan HTML captured on
2026-10-16; they contain no cookies or session identifiers.

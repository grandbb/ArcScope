# ARC Tracker

`/arc-tracker` is a separate Explore menu entry. It tracks only ARC contract
`0xa12cd81d0f9988e3d60c4b6a0d52d368ef3c788d` on Arc Mainnet.

The server reads ArcScan's public token summary and its holders/transfer tables.
It maintains the anonymous explorer session for the related table requests;
cookies stay on the server. No API credentials or user login are required.
The parser validates the token identity, supply, holder ranking, addresses,
transfer order and all ten transfer rows. Source markup changes fail closed.

Next Data Cache stores each result, including unsuccessful refreshes, for five
minutes. The route also uses a shared CDN cache; requests within one process
are coalesced. A warm process can retain its last successful snapshot during
an outage; cold processes use the bundled public ArcScan snapshot in
`public/ascope-arc-snapshot.json`, captured during release validation. The UI
shows unavailability or a delayed-data notice and the retrieval timestamp.
The public explorer has no availability guarantee; if automated requests are
restricted, replace this adapter with a licensed indexer rather than bypassing
access controls. The dashboard is unchanged.

The pie chart uses total supply as its denominator, with the remaining balance
grouped as Other holders. These addresses are not verified personal identities.
Holder, From and To links display ArcScan's public name when available, with the
full address in the link tooltip and the original address as its destination.
Names are read from table link tooltips or untruncated link text and shared by
case-insensitive address across both tables. Missing names fall back to shortened
addresses. Public explorer labels are not proof of a person's identity.

On 2026-10-16, all 20 distinct addresses in the bundled holder/transfer snapshot
were checked against their public ArcScan address pages. All returned address-only
page titles with no public name in the summary. Exact-address web searches also
returned no owner attribution for these addresses. No owner names were added to
the bundled snapshot, and allocation percentages or common funding were not used
to infer ownership. This finding applies to this snapshot, not every ARC wallet.
Supply is not circulating supply, and data is an explorer snapshot rather than
an atomic on-chain block snapshot. Transfer timestamps are explicitly UTC.

Validation: `node --test tests/ascope-arc-tracker.test.cjs`, `npm run typecheck`,
and `npm run build`. Fixtures are reduced public ArcScan HTML captured on
2026-10-16; they contain no cookies or session identifiers.

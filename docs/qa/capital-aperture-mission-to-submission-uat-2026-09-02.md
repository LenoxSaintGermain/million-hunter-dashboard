# Capital Aperture mission-to-submission production UAT — 2026-09-02

## Result

PASS. The owner-scoped production journey now presents a concise mission-to-submission path, recognizes the existing IWM play as already in motion, and routes directly to its immutable queued-order receipt instead of offering a duplicate research decision.

No proposal, approval, submission, broker order, account mutation, or fill-mirroring action was performed during this verification.

## Release receipt

- Source commit: `156358b2e88247a52f345ebc504b90d625c2b7f7`
- Supporting UX commit: `e8879bd57afab0d53f81671a76f43b422c166472`
- Cloud Build: `422c94f7-594f-42f2-a6ad-4ffaa20c2d8a`
- Container digest: `sha256:18aa7c48c6acae397a1fd8223a1626f137aec599dcd64de8049af1632a849363`
- Cloud Run revision: `capital-aperture-00038-6tx`
- Traffic: 100% on the revision above
- Public URL: `https://third-signal-capital-aperture.web.app/aperture`
- Verified: `2026-09-02T17:48:02Z` / `2026-09-02 01:48:03 PM EDT`
- Public health: HTTP 200 with `ok: true`

## Journey checked

1. Opened the production Today workspace in the authenticated owner session.
2. Confirmed the visible path: `Mission -> Play Slate -> Ticket -> Submit`.
3. Confirmed the compact Capital Mission explanation and touch-sized help control.
4. Confirmed suggested missions explain that rank means the best-supported research path for the thesis, account, and timeframe, not a return forecast.
5. Confirmed the page heading is `Today's plays`; paper/live language is isolated to the explicit account mode and safety boundary.
6. Confirmed the active IWM thesis no longer appears as an unsized decision-ready card after an order already exists.
7. Confirmed the replacement state: `Already in motion` with one action, `Open Play Desk`.
8. Opened Play Desk and followed the IWM order receipt.
9. Confirmed the broker-accepted state and duplicate-prevention guard.

## Existing IWM submission receipt

- Thesis: `UAT — IWM Queue-at-Open Day Trade`
- Decision Run: `570001`
- Candidate: `420001`
- Instrument: `IWM shares`
- Side / quantity: `BUY 1 share`
- Order type / duration: `LIMIT / DAY`
- Limit: `$290.57`
- Destination: `Alpaca Paper — AI Thesis`
- Status: `Accepted / queued at paper broker`
- Duplicate guard: `Paper order already exists · do not duplicate`
- Ticket counters: `0 waiting for review`, `0 ready to submit`, `1 accepted / queued`, `0 executed`

This is an existing immutable receipt. It was inspected, not recreated.

## Queue invariants

Before and after this UAT:

- Choose: `4 -> 4`
- Approve / send: `0 -> 0`
- Monitor / in motion: `5 -> 5`
- New broker orders: `0`

Visible in-motion records remained MGM call, DKNG put, IWM shares, DKNG call, and NU call.

## Mobile and usability checks

- Viewport: 390 x 844; effective content width 351 px.
- Horizontal overflow: none (`clientWidth 351`, `scrollWidth 351`).
- Mission path remained readable at mobile width.
- Mission title and edit control stack without collision.
- Decision rail compresses to two columns.
- Context help is available beside Capital Mission, suggested missions, and Today's plays.
- The default surface exposes one next action; deeper detail remains optional.

## Automated verification

- Focused Capital Aperture test set: 132 passed.
- Type check: passed.
- Production build: passed.
- Existing warnings: analytics placeholder warnings and bundle-size warning; neither blocked this flow.

## Third Signal Method ship log

- Team: Third Signal Lab
- Project: Third Signal Lab Agency
- Primary label: Research OS
- Issue: Clarify Capital Mission to account submission path
- Ship: branch `codex/aperture-play-desk`; commits `e8879bd5` and `156358b2`; build `422c94f7-594f-42f2-a6ad-4ffaa20c2d8a`; revision `capital-aperture-00038-6tx`; production URL and UAT evidence above.
- Remaining risk: a live-account destination is not enabled in this UAT. The generic wording is ready to reflect account mode, while all present execution remains explicitly paper-only and human-approved.

No live Linear connector was available in this run; the entry above is ready to sync.

# Capital Aperture — three-thesis end-to-end production UAT

- Date: 2026-09-02 EDT
- Owner-scoped operator: Lenox
- Production: `https://third-signal-capital-aperture.web.app`
- Paper destination: `Alpaca Paper — AI Thesis` · external account `PA3X46OF7EKJ`
- Source commit: `c428b7e769c53ca7b17942912e53fdc8aafe952b`
- Cloud Build: `68282a28-5932-487f-bea2-185276beabfd` · `SUCCESS`
- Image digest: `sha256:ac49ea2bb3e4121ba86e2bb4a976fa62b790763a3b88c309dd0c45aea1ba56f7`
- Cloud Run revision: `capital-aperture-00041-kcr` · explicitly routed to 100%

## Result

Three distinct thesis journeys are present and traceable from the owner-scoped saved thesis through research, decision, exact ticket, and the current broker lifecycle receipt. The pass reused existing accepted or filled paper orders instead of creating duplicates. No approval, submission, broker order, provider-setting change, invite change, or database migration occurred.

| Thesis and play type | Thesis and research proof | Decision and exact ticket | Final production receipt |
| --- | --- | --- | --- |
| `CH Capital — AI Growth Watchlist Options` · defined-risk long option | Saved thesis is visible in the owner thesis library. Research run `510001` reviewed four declared symbols and retained candidate `360004` for NU. | The exact ticket is `NU261120C00014000`, one Nov. 20, 2026 `$14` call, LIMIT/DAY at `$1.54`, maximum premium loss `$154`. | Broker accepted/queued. The screen says `Paper order already exists · do not duplicate`, with `0 waiting`, `0 ready`, `1 accepted / queued`, `0 executed`. |
| `UAT — Football Season Regulatory Split (Defined-Risk Options)` · catalyst/regulation option | Saved thesis is visible with the New York regulatory primary-source basis. Research run `360001` retains candidate `240002` for MGM. | The exact ticket is `MGM261120C00040000`, one Nov. 20, 2026 `$40` call, LIMIT/DAY at `$4.20`, maximum premium loss `$420`. | Filled at `$4.20` premium and in motion. One click opens `Check whether thesis still holds`; after the repair, the MGM panel contains no DKNG monitoring findings. |
| `UAT — IWM Queue-at-Open Day Trade` · bounded share trade | Saved thesis is the active context. Research run `570001` reviewed one symbol and retained candidate `420001`. | The exact ticket is one IWM share, LIMIT/DAY at `$290.57`, maximum planned loss `$5`, queued for the next eligible regular session. | Broker accepted/queued. Duplicate creation is blocked, with `0 waiting`, `0 ready`, `1 accepted / queued`, `0 executed`. |

## Defect found and closed

The MGM monitor originally listed DKNG monitoring findings because the monitor list query was scoped only to research run `360001`. The repair binds both the client request and owner-scoped server query to the selected `candidateId`. Production now shows MGM's own monitoring surface and an empty-state invitation to run MGM checks; DKNG findings no longer leak into it.

Regression coverage in `server/aperture/lifecycleSafetyContract.test.ts` asserts that the selected candidate is preserved in the monitoring request and that the database query filters by candidate as well as run.

## Final safety and queue receipt

- Play Desk: `0` plays to decide, `0` paper tickets to approve/send, `5` plays in motion.
- The three required thesis/play receipts are all visible from the same Play Desk.
- Broker-order count before / after this UAT: `5 / 5`.
- New proposals: `0`.
- Approvals: `0`.
- Submissions: `0`.
- New broker orders: `0`.
- Browser console errors in the final production pass: `0`.
- Public `/aperture/plays`: HTTP `200`.
- Public bundle release marker: exact source commit `c428b7e769c53ca7b17942912e53fdc8aafe952b`.

## Verification

- `pnpm check`: pass.
- Focused monitoring and lifecycle tests: 11 / 11 pass.
- Production build: pass.
- Database-disabled broad suite: 846 tests pass; the 31 documented database/key-dependent tests remain unavailable without exposing production data to the test runner. The monitoring change introduced no new test failure.

## Human-action boundary

No fresh approval or submission was required because all three journeys already had authoritative broker lifecycle receipts. Any new proposal must still stop for a new action-time `APPROVE PAPER` confirmation and a separate action-time `SUBMIT PAPER` confirmation.

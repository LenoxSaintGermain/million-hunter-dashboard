# Sandbox journey repair — September 21, 2026

Scope: user-authorized Alpaca paper UAT, never live trading. Existing risk limits,
evidence requirements, and separate approval/submission remain authoritative.

## Reproduced and repaired

- Real preflight account-refresh tests reproduced timestamp-only renewal of manual
  declarations and failed broker reads. Both now retain their previous timestamp.
- Successful refresh requires a matching paper-account identity and a recent
  provider timestamp. Buying power updates with the returned balances.
- The legacy off-market runner is now inert: no imports, database, credentials,
  account writes, or order approvals. Its historical implementation remains in Git.
- Ticket loading/error states cannot display an empty order queue or offer a
  duplicate builder while the order read is unresolved.
- Removed hard-coded Monday-opening promises. Broker acceptance is not a fill.
- Share risk in the confirmation is labeled planned loss at the modeled stop.

The prefilled paper confirmation remains an explicit two-step operator interaction:
opening the dialog does not submit. This is intentionally retained for the user's
sandbox workflow; server checks and the final confirmation are not bypassed.

## Validation before deployment

- Full unit lane: 2,585 passed, 10 skipped, using DATABASE_URL= and two workers.
- Additional rendered Execute loading/error regression tests: 2 passed.
- TypeScript passed before the final rendered test addition; rerun before release.
- Initial parallel run exposed six outdated copy contracts from the prior release
  and one timing-sensitive performance assertion. Updated copy contracts retain
  the behavioral guards. The unchanged timing assertion passes with bounded workers.
- No production orders mutated by these tests. Isolated integration result and
  live release receipt are recorded below when verified, not inferred.

## First release and live sandbox execution

- Source `4934d03448e727bfadd441aca0dd4f12433228fc`, Cloud Build
  `a03b0e52-9cbd-40e6-89c7-e007671be400`, revision `capital-aperture-00210-yew`.
- Staged and public read-only release checks: 6/6 each; then 100% production traffic.
- Isolated integration: 287 passed, 2 skipped. Disposable database removed.
- User explicitly authorized paper approval/submission. Existing approved RWM
  order 360001 (run 780001, candidate 630001), one share, was submitted once via
  the explicit confirmation. Broker accepted; Mirror fills subsequently showed
  one share filled at $14.08. Approval was already recorded before this test.
- No duplicate RWM order, no PSX submission, no live order, no exit or hedge.

## Blocking finding discovered after the fill

Monitoring rendered an unrelated MGM call with fabricated mark, bid/ask, P&L,
Greeks, market catalysts, and stop proximity. Missing evidence also generated
an all-clear. This was production code, not a labeled fixture. Two rendered
regression tests reproduced both defects before repair.

The repair removes these fallback facts. It displays only selected-order facts;
current quote/P&L/Greeks remain explicitly unmeasured. Monitoring categories use
the shared evidence/freshness presentation. A saved review is not proof that a
thesis is intact. Slow checks remain pending instead of inviting duplicate work.
This screen cannot construct an exit from an unverified holding or guessed account.
The portfolio's reconciled-position workflow remains the appropriate exit surface.

## Monitoring release and browser retest

- Source `a17f09581e5336dcda082cbac43723f2948b271b`, build
  `2fa45df3-efc1-42ee-ad50-a654fe7e879b`, revision `capital-aperture-00212-fiy`.
- Staged/public checks 6/6 each; configuration fingerprint unchanged.
- Hard reload retained exactly one filled RWM ticket. Monitoring showed RWM
  shares and the recorded $14.08 fill, not MGM options or fabricated telemetry.
- A deliberate account snapshot refresh showed RWM, quantity one, in holdings.
- First monitoring request returned four records: two required fresh evidence.
  The mobile "Need a source" preset plus explicit Save recorded
  `needs_fresh_evidence` for finding 360001, without resolving it or changing orders.
- One deliberate retry returned a new set of four checks. Three had usable
  cited results; catalyst 390001 remained unverified. Market-context finding
  390004 was flagged and left unresolved. Provider citations are not independent
  verification of the narrative's factual accuracy.
- The previous four checks remained in history. An exact finding link carried
  run 780001, candidate 630001, order 360001, finding 390004 and its version.
- Mobile override 390x844: document width and scroll width both 386 CSS pixels;
  category controls 110px tall, refresh 44px. Screenshot inspected; override reset.
  This is a responsive check, not a user-tested usability or full accessibility claim.

This retest found one more unsafe shortcut: a one-click review action wrote a
precomposed "verified/intact" conclusion, while disconnected exit/hedge buttons
remained visible. Source `c5dc15a` removes these, preserves editable presets plus
explicit Save, and removes duplicate display of the selected finding. A rendered
test failed before the change and passed afterward. Release receipt follows.

## Test boundaries and outstanding capability limits

- Latest unit lane: 2,591 passed, 10 skipped; TypeScript passed.
- Integration lane earlier in this repair: 287 passed, 2 skipped, disposable DB.
  Subsequent changes were client presentation and regression tests only.
- An initial generic `pnpm test` invocation included DB-required suites with
  DATABASE_URL deliberately empty and failed. The proper separated unit and
  isolated integration lanes above are the reported results; no test used prod DB.
- This pass exercised an already-approved ticket through submission, fill,
  holdings sync, monitoring, and review. Fresh-account thesis creation, new
  approval, exit/hedge execution, and realized-P&L closure were not rerun here.
- The legacy RWM test ticket retained its $100 limit and $95 modeled stop.
  This validates sandbox plumbing, not the quality of those trading assumptions.
- Current marks/P&L/Greeks are not measured on this monitoring surface; no fake
  replacements are supplied. One provider check remains unverified and one
  finding requires operator assessment. No blanket all-clear is warranted.

## Final release receipt and signoff scope

- Runtime source: `c5dc15adfa91bd7872050a954534df360a06b371`.
- Cloud Build: `3c26e33d-8093-402c-abf4-39a7aa34a2eb` (SUCCESS).
- Revision: `capital-aperture-00214-hab`, 100% production traffic.
- Public URL: https://third-signal-capital-aperture.web.app/aperture
- Tagged URL: https://uat-c5dc15ad---capital-aperture-oxiyp4dcpq-uc.a.run.app
- Staged and public checks: 6/6 each; public receipt at 2026-09-21T16:06:32Z.
- Service configuration unchanged; no schema/auth/secrets changes.
- Final hard reload reopened the exact market finding with its version intact.
  DOM confirmed one selected-finding card, no instant-exit shortcut; explicit
  review choices and Save remained. No horizontal overflow at 1188px desktop.
- Final Today mobile screenshot at 390x844 showed paper account/mode, binding
  constraint, partial monitoring state, and the RWM review action in the first
  viewport. Document/scroll width both 386px. Viewport override reset afterward.
- Today retained the RWM unknown catalyst and flagged market check, plus PSX's
  approved/not-submitted state, despite the different active thesis. No all-clear.
- One explicit outcome recomputation reported one filled order, zero closed
  trades and process-only sufficiency. This is not a verified profitable outcome
  or a full audit of performance arithmetic. The RWM position remains open.
- Linear THI-266 ship-log sync unavailable because the connector required
  reauthentication. This receipt is ready to sync; no comment was falsely claimed.

**Result:** repaired and live-tested approved paper ticket → explicit submission
→ broker fill → holdings sync → sourced monitoring → exact-version review →
returning briefing. Full fresh-thesis-to-exit UAT and provider fact verification
remain outside this pass; this is not blanket user-release or trading-quality signoff.

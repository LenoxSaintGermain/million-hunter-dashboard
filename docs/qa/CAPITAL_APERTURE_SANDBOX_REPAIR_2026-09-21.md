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

Final release and browser retest are pending at the time of this entry. Do not
treat the successful paper fill as complete UAT signoff.

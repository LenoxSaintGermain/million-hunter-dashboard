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

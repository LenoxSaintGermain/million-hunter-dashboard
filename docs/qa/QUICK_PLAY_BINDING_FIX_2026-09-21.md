# Quick Play binding repair

## Outcome

Implemented locally; not deployed. Language QA instructions are in `LANGUAGE_VALIDATION_AGENT_PROMPT.md`.

The legacy action independently selected the newest account and completed research run. A regression test reproduced the resulting mission/run/account binding mismatch. That endpoint now rejects example strategies before database access or order creation.

The replacement Quick Plays path selects up to three intraday long-share candidates from completed, cited research with completed evidence reviews. It preserves the exact user, account, candidate, research run, decision and current revision. Current price checks and existing risk controls precede preparation. Approval and submission remain separate actions in the existing order lifecycle.

## Safeguards

- No client-supplied market prices, symbols or catalyst claims become order authority.
- A budget can reduce sizing, never expand the saved plan's risk allowance.
- Stale prices, missing evidence, closed sessions and mismatched records block preparation.
- Changed order terms require another check. Retrying an existing prepared order opens that record rather than creating another.
- A modeled share stop is planned loss, not guaranteed maximum loss or a broker protective order.
- Initial page reads do not create orders, research or approvals.

## Validation

- Unit suite: 2,637 passed; 18 skipped.
- Disposable-database integration suite: 295 passed; 2 skipped. Wrong-owner, account, candidate and revision cases included. Integration construction is stubbed; this is not broker execution proof.
- TypeScript and production build passed.
- Local isolated browser: opened Quick Plays, verified honest empty state, changed budget to $100, followed recovery to `/aperture/mission?objective=1&capital=100`, and verified declared capital $100. No draft was saved and no order was created in this browser check.
- Production database was excluded from test execution.

## Remaining acceptance

Positive desktop/mobile browser journey through current-price preview, order preparation, explicit approval, explicit practice submission and reconciliation remains unverified for this new path. No live-broker or user-tested usability claim is made.

This phase does not provide a market-wide catalyst feed, options Quick Plays, streaming prices, automatic exits or automatic protective stop/target orders. Example catalysts and backtests remain non-actionable.

## Tracking handoff

THI-266: Quick Play binding repair and language QA prompt. Linear requires reauthentication; this record is ready to sync, not posted. No production build or revision was created in this turn.

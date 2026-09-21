# Fresh thesis UAT — September 21, 2026

Authorized scope: authenticated production UI, Alpaca paper only. Declared test
capital $2,000, requested planned-loss ceiling $200; tighter constraints win.

## New source and reproduced blocker

- Created `UAT Diesel Margins · Fresh Journey · Sep 21` through New thesis.
- Canonical source 1050001; Capital projection 660001. Full name and belief saved.
- Belief explicitly treats a diesel shock as an unverified hypothesis, not a fact.
- Save-and-use navigated to the exact new-thesis Mission URL.
- Mission displayed `Saved Mission context unavailable`; explicit retry failed.
- Cloud request logs show the unscoped `aperture.runway.latest` returning 412.
  The page unnecessarily made an unrelated historical receipt a prerequisite
  for a new thesis. No new research, approval or order was created.

## Repair

Source 80888ce scopes receipt reads: new-thesis handoffs read no unrelated latest
receipt; completed handoffs still recover their exact receipt. Disabled query
cache data/errors cannot contaminate the new handoff. Ordinary Mission recovery
and server receipt validation are unchanged. No historical record was rewritten.

- Three new scope tests failed before implementation, then passed.
- 29 focused tests passed; TypeScript passed.
- Full isolated-from-production unit lane: 2,594 passed, 10 skipped.
- Build 576964ad-3c14-462a-95d5-83ccddc72ebf submitted; deployment and connected
  retest are not yet claimed.

Full fresh-thesis-to-exit acceptance remains pending.

## Connected retest and sandbox closure

- 80888ce deployed as `capital-aperture-00216-yig`, 100% traffic; staged/public
  checks passed 6/6. Exact original handoff reopened successfully.
- Selected Alpaca Paper — Execution Rail, entered $2,000 / $200, shares only,
  no profit target. Saved draft persisted with the new canonical thesis.
- Risk preview returned 412, even after a real broker balance refresh. Existing
  RWM opening fill carried no measured planned-risk value. The UI suppressed
  the actionable refusal behind generic refresh copy. 0524469 exposes safe
  precondition reasons and a route to active orders; its rendered regression
  failed before the repair and passed afterward.
- Scoped cleanup of the one-share RWM test position: created closing proposal
  390001 without auto-approval, explicitly approved it, separately confirmed
  paper submission, then mirrored fills. Sell filled at $14.07; prior buy $14.08.
  This is a one-cent gross price difference, not independently verified net P&L.
- Portfolio refresh at 12:51:07 ET showed ten holdings and no RWM (was eleven).
  No PSX submission or other holding change was requested.
- Exit receipt incorrectly described the position as open. Risk aggregation
  also counted fully offset historical fills as current exposure. 7e67b86
  removes only fully matched filled exposure from the risk sum; unknown,
  partial, mismatched, and over-closed exposure remains fail-closed. Both preview
  and publication-time risk reads use the same pure calculation.
- Play Desk still fabricated Greeks from fixed 0.50 delta / 2% theta / 3% vega
  assumptions and claimed risk clearance without proof. Removed those formulas
  and the false all-clear; unavailable portfolio Greeks are labeled unmeasured.
- Isolated integration: 287 passed, 2 skipped, 18 files. Receipt
  `/tmp/capital-isolated-integration.QoGzdV`; disposable database/user removed.
- 0524469's build succeeded but was not deployed separately. Build
  `a5415f33-2d99-4d03-a932-072f71a8930d` includes both follow-up fixes.

Remaining: connected retest of the combined repair and the new Mission outcome.

## Final connected receipt

- Runtime `7e67b867fa7dc8c91cd64f7fe2719ffca8fd20ce`, revision
  `capital-aperture-00218-wes`, 100% production traffic. Staged and public release
  checks 6/6; public verified at 17:04:41 UTC. Service configuration unchanged.
- Latest unit lane: 2,601 passed, 10 skipped. TypeScript passed. Two old source
  contracts required updating to distinguish closing-fill review from opening
  position monitoring; their new assertions preserve that distinction.
- Reloaded the same saved draft: risk preview now shows $15 effective risk,
  $200 requested ceiling, $55 remaining aggregate headroom. No limit was raised.
- Clicked Underwrite once. Mission 960001 / revision 1320001 completed with
  `No candidate has sourced evidence sufficient to form a tactical thesis`.
  Reopening condition: add a current source and re-underwrite. No new diesel
  research run, proposal, approval or broker order was created.
- Exact result URL reopened with thesis, account, $2,000 capital, shares,
  requested and effective risk retained. Mobile viewport override 390x844
  yielded actual document width/scroll width 351/351 CSS px (no overflow).
  Screenshot inspected; this is not physical-device or user-tested usability.
  Override reset before desktop checks.
- Closing ticket now says closing order filled, not position open. Both RWM
  fill receipts remain visible. Recomputed outcome records two fills and one
  closed trade, process-only sufficiency; no positive-expectancy claim.
- Play Desk shows zero open order-linked positions, PSX still approved/not
  submitted, and no invented Greeks or risk-band all-clear.

### Honest remaining scope

This verifies fresh-thesis → persisted Mission → underwriting → no-trade, and
the existing RWM test's separate paper approval → submission → fill → closure.
It does not prove a newly generated diesel play → evidence → entry journey;
that requires adequate sourced evidence. No evidence gate was bypassed.

Non-blocking follow-up observations: Desk's summary says `awaiting a fill` for
an approved/unsubmitted ticket; a scheduled RWM review remains after closure;
the legacy run's cockpit names its original manual research account while the
ticket correctly names the execution account. Outcome labels count two filled
orders as two candidates and round the one-cent difference to whole dollars.
These remain UX/reporting gaps, not a blanket clean-release signoff.

Linear THI-266 remains ready to sync from this receipt; connector reauthentication
was required in the previous pass. No external tracking comment is claimed.

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

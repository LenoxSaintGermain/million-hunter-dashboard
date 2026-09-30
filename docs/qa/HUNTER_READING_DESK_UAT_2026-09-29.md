# Reading desk release / operator UAT

Surface: Orbital / Signal Hunter. Tracking: THI-266.

## Scope

- Deal: compact source receipt; Senior reading rail; one selected working pane; specialists, memo, financing, outreach and LOI remain available. Removed duplicate orchestration area and floating Co-Pilot.
- Scan: opportunity portraits and source-reported financials; removed hardcoded activity, qualitative comparisons and invented analyst quote. Unknown fields stay unknown.
- Capital: main decision and account context side by side; source-gap disclosure with persistent warning; position stories; mobile Briefing / Positions focus; horizontal position browsing. Research cards show thesis, evidence and outstanding checks. Missing cluster limits are not zero utilization. Saved filters are not labeled live.
- Public UAT: `/walkthrough/capital-desk` uses the real briefing components with frozen synthetic records, no API queries or persistence. Linked from `/walkthrough`. This is visual/interaction UAT, not broker or research integration proof.

## Release inputs

- Source: `bd7a6eb949cab76773587ad6bb99950952ea9b4f`, including deal/Scan commit `961f4b8`.
- Source pushed to origin/main.
- Clean detached checkout: `/tmp/signal-hunter-reading-desk-release`.
- Frozen input hash: `f6b384645d61f1211e604c78cfa8cd4ae874bf8f58930c78f0db27d8014094fb`.
- Cloud Build: `305ac52e-12a9-496e-8d97-ad0258ee65c2`.
- Unrelated dirty backend and investor edits excluded. No database migration, data cleanup, real research run, seller contact or paper order was performed.

## Validation

- Exact clean checkout: TypeScript and production build passed.
- Unit lane: 244 files passed, 4 skipped; 2,731 tests passed, 18 skipped. `DATABASE_URL=` throughout. Credential/integration lanes were not run.
- Existing browser fixture checks for deal/Scan: all ten working panes; desktop/tablet/mobile layouts; no action-triggering mutations when reading panes.
- Capital browser inspection: wide and tablet two-column briefing; narrow Briefing / Positions switch; horizontal browsing from DEMO-A to DEMO-B; order details expose synthetic basis and saved mark; thesis-gap action moves focus to the sample review. No horizontal document overflow observed at narrow/tablet widths.
- Build warning remains: large shared client bundle. This release does not resolve code-splitting/performance debt.

## Operator acceptance checklist

1. Open the public Capital preview without signing in; open the thesis gap and sample calculation. Refresh must explain that the sample is frozen.
2. On mobile, switch to Positions, swipe between records, expand terms, then return to Briefing. Stale status and the review-needed indicator remain visible.
3. Sign in on the production domain; inspect actual Capital account context, source gaps and positions. Missing values must not become zero.
4. Open `/deal/3660001`: inspect the receipt, then move between Senior sections. Opening a section must not run an agent. Financing assumptions remain disclosed.
5. Open `/scan`: inspect reported/unknown amounts and follow an opportunity. No fake activity stream or score-derived qualitative assertions should remain.
6. Real provider runs and paper proposals are separate explicit operator actions. UAT inspection does not authorize them.

## Deployment receipt

- Cloud Build succeeded at 2026-09-30T01:45:23Z.
- Image: `gcr.io/third-signal-v2/capital-aperture@sha256:6698df6715ae94ae12eb329ea78bcda19d2ae316e0fa365aab1b10f38929cf9c`.
- Revision: `capital-aperture-00260-bej`, promoted to 100% traffic after staged checks.
- Rollback revision retained: `capital-aperture-00258-civ`.
- Runtime fingerprint unchanged after excluding image and RELEASE_SHA: `ec4f3f633e5af7c27bfb553e4a93dbb43115ddb40a6556623e96226f3f723ff3`.
- Staged smoke: 9/9 passed at 2026-09-30T01:48:31Z. Exact SHA, all three updated surfaces, public preview, API health, and unauthenticated account denial checked. No mutations.
- Production smoke: 9/9 passed at 2026-09-30T01:49:29Z on the Firebase domain, exact source SHA verified.
- Public preview loaded in the staged and production browsers without login. Staged refresh interaction returns the frozen-fixture explanation; no browser errors reported.
- Production: https://third-signal-capital-aperture.web.app/walkthrough/capital-desk
- Existing signed-in browser session successfully loaded production Capital with the new reading layout, three saved positions, stale labels, missing boundary state and the unchanged portfolio constraint. Deal 3660001 showed the source receipt and Senior rail; opening Challenge the cash left analysis explicitly not yet run. No agent run or trade action was invoked.
- Provider and order workflows still require operator acceptance; a visual preview and read-only route inspection do not certify them.

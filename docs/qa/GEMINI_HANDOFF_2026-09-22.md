# Gemini takeover — Capital Aperture

## Start here

Continue Quick Play acceptance testing, not a redesign. All completed application changes are published. The positive Quick Play order journey is **not yet certified**. Do not confuse a healthy deployment with completed trading UAT.

Repository: `/Volumes/Mini_2T/lenoxparis data/Dev/million-hunter-dashboard`.
Read `AGENTS.md` completely before editing. Reconcile `git status`, branch, local HEAD and origin/main before pulling; preserve other agents' work. Current branch is `codex/aperture-play-desk`.

Production: https://third-signal-capital-aperture.web.app

## Verified release, September 22

- Application source: `d8d176486d0935f1017838276428785b1b4b7845`.
- Documentation baseline before this handoff: `f876959be672c52aabed67161987bd4307528781`, verified on both origin/main and origin/codex/aperture-play-desk. Working tree was clean.
- Cloud Build: `a0748e62-564b-4a42-89ea-be73dda9771d`.
- Production: `capital-aperture-00222-fit`, freshly verified at 100% traffic. Previous revision: `capital-aperture-00220-sun`.
- Public smoke repeated at `2026-09-22T11:11:08.033Z`: 6/6 passed, zero mutations. App shell, exact bundle SHA, compact Today copy, API JSON health and unauthenticated account denial passed.
- Documentation-only commits after application source do not require another application deploy.
- No schema migration or authentication/broker-mode change. No order was approved, sent or canceled during release verification.

## Read these records

- [Quick Play implementation and release receipt](QUICK_PLAY_BINDING_FIX_2026-09-21.md)
- [Language QA agent prompt](LANGUAGE_VALIDATION_AGENT_PROMPT.md)
- [Language release evidence](CAPITAL_APERTURE_LANGUAGE_RELEASE_2026-09-21.md)
- [Language library](../CAPITAL_APERTURE_LANGUAGE_LIBRARY.md)

The documentation skill informed this handoff's runbook structure: verified state, prerequisites, explicit steps, recovery and outstanding evidence.

## What changed

The legacy quickHit.authorize action chose newest account and newest research independently. It could produce a mission/run/account mismatch and accepted sample-derived inputs. It now rejects before database/order creation. Do not restore it or make PLUG/BTAI/SOUN illustrative cards executable.

New `aperture.quickPlay.list / preview / prepare` binds the exact user, account, decision, revision, research run and candidate. It uses existing completed cited research, existing evidence gates, current SIP checks, existing risk/preflight and order deduplication. Preparation produces an order for review; it does not approve or submit.

Phase 1 is **intraday long shares only**, up to three qualifying ideas. It is not a fresh market-wide catalyst feed, options engine, streaming terminal or automatic stop/target service. Planned stop loss is not guaranteed maximum loss. Missing capacity or no qualifying idea is a valid result, not permission to bypass a gate.

Key implementation: `server/aperture/quickPlay.ts`, `server/apertureRouter.ts`, `client/src/components/aperture/QuickPlayWorkspace.tsx`, `client/src/pages/aperture/ApertureDeploy.tsx`. Regression tests are `server/aperture/quickPlay*.test.*`, including binding, workspace and integration tests.

## Critical correction to the external QA report

The report marked Quick Play PASS after using **Find my best play**, custom capital and Any/Today/This week/Long term. That is the existing research-ranking mode. It does **not** validate the new Quick Plays flow.

Navigate `/aperture/deploy` and explicitly select **Quick Plays · $25–$100**. Record the selected mode in screenshots. Keep examples, research-ranking and Quick Plays separate in results.

## Remaining language defects — not fixed or deployed

- `client/src/pages/aperture/AperturePlayDesk.tsx` still contains **Sync Broker Telemetry** (confirmed in source September 22). Proposed: **Refresh account status**, after verifying what the action actually refreshes.
- Same file contains **+ Draft Paper Ticket**. Align with the language library, e.g. **Prepare practice order**, only if accurate to its behavior.
- **Alpaca Paper — Execution Rail** was reported as an account label. Determine whether it is persisted account naming before changing presentation. Preserve the exact account identity and official broker destination; do not globally rewrite stored records.
- Scope/severity in external report varied P2/P3; these are outstanding polish findings, not proof of a broken order boundary.

## Before market open: isolated tests

`.env` points at production TiDB. Never run normal tests/dev mutations against it. Do not print secrets.

```sh
export PATH="/opt/homebrew/opt/node@26/bin:/opt/homebrew/bin:$PATH"
DATABASE_URL= pnpm exec vitest run --config vitest.unit.config.ts --maxWorkers=1 --minWorkers=1
DATABASE_URL= pnpm check
DATABASE_URL= pnpm build
DATABASE_URL= node scripts/with-isolated-integration.mjs --integration
DATABASE_URL= node scripts/with-isolated-integration.mjs --browser
```

Inspect the isolation harness before running. It snapshots tracked source; new untracked test files must be included deliberately or imports can fail. Use its reported URL, not an assumed port. On exit verify its owned database/user cleanup receipt. Never delete unrelated resources. The isolated browser/provider fixtures are not proof of current market execution.

Previous results, not rerun today: 2,637 unit passed / 18 skipped; 295 integration passed / 2 skipped; typecheck/build passed. Integration construction was stubbed. Local browser covered empty state and $100 recovery into Mission only.

## Market-open UAT plan

Target the regular-session opening window (normally 9:30 AM Eastern); verify actual broker clock/session and fresh market data rather than assuming the calendar or a countdown proves eligibility. No automatic scheduled test has been created.

1. Verify deployed SHA and signed-in authorized test identity. Previously designated investor test user: `malefic.treble@gmail.com`; do not assume the current session matches. Verify named **practice** account and broker destination. Never route real money.
2. Hard refresh, open Quick Plays explicitly. Record actual desktop/mobile viewport sizes, selected budget and account. Test keyboard, visible focus, enlarged text and reduced motion. Do not infer usability from screenshots alone.
3. Use a qualifying sourced intraday long-share candidate, or record exactly why none qualifies. Do not fabricate news, quotes, timestamps or evidence, or change portfolio limits to manufacture a pass.
4. Select **Check prices and risk**. Verify exact account/run/candidate/decision/revision IDs, quote freshness, entry condition, integer quantity, notional <= selected budget and saved allocation, planned loss <= effective constraint. Stop/target values are modeled, not installed broker protection.
5. Prepare only after the explicit practice acknowledgement. Verify an exact order-review destination, same identity and unchanged terms. Preparation must not approve or submit. A request timeout requires reconciliation, not blind retry.
6. Exercise explicit approval separately; verify it does not submit. For bounded practice-only submission, follow user authorization and tool policy, review exact quantity/limit/account, run fresh preflight and submit explicitly. If authorization or destination is unclear, stop for the operator. Never turn a prior sandbox authorization into real-money authority.
7. Verify dispatch → broker accepted → partial/full fill using authoritative receipts. Accepted is not filled; uncertain dispatch is not rejection or permission to resubmit. Record actual state even if a limit never fills.
8. Test leaving an unsent draft separately from canceling a working practice order. Only cancel an identified disposable UAT order with authorization; reconcile broker result. Canceling remaining quantity must not imply filled shares were closed. Do not invent an exit capability.
9. Return to Today and Play Desk. Confirm consistent state, no duplicate orders, no false all-clear, no unrelated findings resolved and no claim of automatic monitoring. Report timestamps and actual check mechanism.
10. Capture desktop/mobile screenshots and exact receipts; mark each step PASS, FAIL, BLOCKED or NOT TESTED. A clean empty/no-trade result is not a positive order-path pass.

Use isolated deterministic fixtures for stale/missing data, changed terms, wrong owner/account/revision, duplicate concurrent requests and provider failure. Do not induce these by modifying production records. Verify absence of unintended mutations, not just warning copy.

## Evidence and fixes

For every failure: route, actual release SHA, account mode, reproducible steps, exact visible copy, expected/actual state, request/order identity without credentials, screenshot and whether any mutation occurred. Fix one cause, add a regression, rerun relevant tests and the journey. Keep approval/submission boundaries intact.

User wants simple, fast, plain-language decisions. Preserve industry terms (long call, short, swing, limit order); explain them in context. Never hide risk, destination, stale data or action blockers behind a tooltip. Do not say all gaps closed until the actual new flow is tested.

## Deploy/tracking handoff

No deploy is needed simply to test the current release. For later fixes, use tracked frozen source (`scripts/prepare-aperture-release-source.mjs`), `cloudbuild.capital-aperture.yaml`, preserve runtime settings, stage without traffic, smoke the exact SHA, then promote only with appropriate authority. Do not copy credentials into handoff files. Inspect existing deployment tooling before use; the previous temporary helper is not a permanent supported release API.

Read-only release check:
```sh
node scripts/verify-capital-release.mjs https://third-signal-capital-aperture.web.app d8d176486d0935f1017838276428785b1b4b7845
```

If a new release fails, do not promote it. If rollback of this release is necessary and authorized, the prior revision is `capital-aperture-00220-sun`; verify concurrent deployments first and disclose that rollback restores the older Quick Play server behavior.

Tracking target: THI-266. Linear required reauthentication on the preceding implementation run; these docs are ready-to-sync, not a claim that an issue comment was posted. Log commit, build, revision, URL, validation and residual risk after any ship.

## Suggested first response to the operator

“I have the published Quick Play handoff. I’ll verify the actual Quick Plays tab, finish isolated failure-path checks, and run the bounded practice-order journey when the broker reports a regular session. I’ll keep draft, approval, submission and fill distinct and report any blocked step explicitly.”

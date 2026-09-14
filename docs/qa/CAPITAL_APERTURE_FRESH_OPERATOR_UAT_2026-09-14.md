# Fresh Capital Operator UAT — September 14, 2026

## Verdict

**Not ready for full demo sign-off.** The initial pre-market walkthrough below exposed an input-preservation defect and onboarding gaps. The follow-up repairs and market-open retest are appended chronologically; they do not erase the original evidence or establish full broker execution acceptance.

Surface: Capital Aperture / Research OS. Tracking: THI-266.

## Initial pre-market scope and identity

- Production: `https://third-signal-capital-aperture.web.app`.
- Operator menu verified `malefic.treble@gmail.com` / elbert clairmont before mutation.
- First Capital workspace visibly had no active thesis or paper account.
- Used the approved diesel research scenario, $2,000 declared test capital and $200 planned-loss ceiling. Shares only; no profit target.
- Diesel price shock explicitly labeled an **unverified research hypothesis**, not a current market fact. VLO, MPC and PSX were investigation candidates, not recommendations.
- Created a manual paper record for research only, not an Alpaca connection. No broker credentials were entered or reused.
- App showed pre-market throughout this walkthrough. Underwriting analysis timestamp: September 14, 2026, 08:10:18 ET.
- No deployment or application source changes in this UAT turn. Served release was not independently re-read; previous release receipts are not new verification.

## Persisted identities observed through the UI

| Object | Identity |
| --- | --- |
| Canonical thesis | 870001 |
| Capital projection | 540001 |
| Thesis name | UAT — Diesel Price Shock · First thesis · 2026-09-14 |
| Manual paper account | 60001 |
| Account label | UAT Manual Paper — $2,000 declared · No broker |
| Decision | 870001 |
| Decision revision | 1200001 (version 1) |
| Exact result | `/aperture/decision/870001/revision/1200001/underwrite` |

## Observed journey

1. **Identity / empty landing — pass, with presentation gap.** Correct test identity; no active thesis/account. Today presented Mission needed rather than another user's plays. An unmeasured constraint still displayed a 0% / 100% bar, which can imply measured capacity when none exists.
2. **New thesis — pass.** New thesis opened an empty composer with Capital selected. Entered the bounded diesel hypothesis and explicit detail fields. Saved once using Save and use in Capital Mission. The full name was preserved and the destination carried canonical 870001 / projection 540001.
3. **Account onboarding — gap.** Mission had an empty account selector and a disabled Underwrite action. It explained the missing account, but provided no nearby Create account route. Account & risk could say COMPLETE despite no selected account.
4. **Draft persistence — pass.** Entered capital 2000 and loss 200, confirmed Shares inherited from the thesis, and waited for Saved. Navigated to Portfolio. Created one clearly labeled Manual entry / Paper account with $2,000 illustrative starting cash. Portfolio explicitly stated research only, no broker orders and no verified broker holdings. Returned using Mission navigation: the draft resumed at Account & risk with the input values intact. Selected the new account explicitly.
5. **Effective risk explanation — partial pass.** Preview showed $15 normal-play risk and explained 0.75% × $2,000 = $15 alongside the requested $200. Account snapshot remained Not measured. Constraint detail nevertheless told this manual account to use Refresh balances, which it cannot do; Portfolio offers CSV instead.
6. **Review and underwriting — fail on assumption preservation.** Review showed $2,000 / shares / no target / $15 effective risk. Authorized underwriting exactly once. Immediately afterward the UI displayed a spurious before/after change: Planned-loss limit $15 → $200. It then labeled the completed result Previous mission result / Mission assumptions changed even though no assumption had been edited after authorization.
7. **No-trade outcome — safe refusal observed.** Result: market snapshot stale or incomplete; current triggers and entries withheld. Reopen condition: refresh provider-backed SPY, QQQ and IWM observations. Evidence drawer marked the reference prices STALE and regime Unknown. No exact current entry or executable candidate was offered.
8. **Reload — result persisted, declared limit wrong.** Reloaded `/aperture/mission` without starting new analysis. It opened Mission result with the same 08:10:18 timestamp. Saved summary now said Planned-loss limit $15 / $15 effective at analysis, not the entered $200. Evidence also said Your planned-loss limit $15. The generic Mission URL had not changed into an exact decision URL during the original account-detour path.
9. **Today → exact checkpoint — pass.** Today retained the no-trade reopening condition and explicitly said checks run on demand. Open checkpoint reached `/aperture/decision/870001/revision/1200001/underwrite`, with the same saved result.
10. **Research / Play Desk — bounded negative verification.** Research showed No research journeys yet. Play Desk showed CHOOSE 0, APPROVE / SEND 0, MONITOR 0, 0 orders, 0 open and 0 awaiting a fill. No approval or submission was invoked. This is UI evidence, not a database-wide no-mutation proof.

## Prioritized gaps

### FRESH-01 — High: declared planned-loss ceiling replaced by effective cap

- **Expected:** retain $200 as the operator input and $15 as the separately calculated effective limit, before and after saving/reloading. No false revision prompt.
- **Observed:** initial preview distinguishes them, but persisted result and reload call $15 the user's planned-loss limit. The unchanged $200 UI value becomes a supposed revision.
- **Source evidence:** `server/apertureRouter.ts` computes `Math.min(input.maxPlannedLossCents, systemLossCeiling)` in the Decision Runway mutation and persists the reduced value in both mission hash and revision values. `DecisionRunway.tsx` then compares the result objective against the still-entered value and hydrates from the reduced receipt on reload.
- **Implementation direction:** preserve the declared input independently from enforced risk; retain enforcement in authoritative risk calculations and gate snapshots. Audit all consumers before changing this contract. Do not rewrite historical approvals/orders or loosen the effective cap.
- **Regression needed:** actual router + client journey with requested $200 / effective $15, first authorization, no-change result rendering, reload, and deliberate revision; verify effective risk never exceeds $15 and no unintended duplicate job/order.

### FRESH-02 — Medium: missing account setup recovery in Mission

- Empty selector tells a new operator to select an account that does not exist. Add a contextual setup route with persisted draft/section return. Do not mark Account & risk complete without its required account.

### FRESH-03 — Medium: manual-account recovery text promises unavailable sync

- Manual account creation and constraint/Play Desk copy refer to Alpaca sync or Refresh balances even though manual account details say CSV only.
- Use broker-specific recovery instructions and consistently label declared values. Do not connect a shared broker destination simply to clear this test.

### FRESH-04 — Medium: resumed generic route lacks immediate exact receipt URL

- After the account detour, underwriting completed at `/aperture/mission`. Today checkpoint correctly recovered the exact result later. Acceptance requires exact identity after successful authorization regardless of entry route.

### FRESH-05 — UX follow-up: dense thesis and horizon translation

- The full statement plus all appended detail fields render as one long mission heading. Richer input increases first-screen density rather than revealing supporting detail progressively.
- A 2–6-week textual horizon maps to the available Multi-week / position choice and then Long term / recurring review. No explicit 2–6-week control was available. This is a labeling/range clarity gap, not a claim that the engine selected a different exact expiry.
- Fresh Today and Play Desk still surface several empty broker metrics; unmeasured capacity must not look like 100% verified headroom.

## Actions deliberately not taken in the initial pre-market walkthrough

- No Google/password/role changes this turn.
- No Alpaca connection, sync, scheduled sync, credential reuse, CSV holdings import or portfolio-risk policy edit.
- No fabricated diesel confirmation, price, market catalyst, candidate, fill, P&L or verified cash claim.
- No second underwriting authorization, evidence answer, proposal, approval, submission, cancel, replace or review resolution.
- No production SQL mutation, test run against production DB, migration or deployment.

## Remaining acceptance

- Fix and retest FRESH-01 before demo sign-off.
- Complete broker-destination onboarding with an explicitly authorized, separate paper broker context; a manual research record does not satisfy that gate.
- With fresh market data: qualified play → exact evidence → paper ticket → separate operator approval and submission. Market opening alone does not establish provider readiness.
- Deterministic regression suite, database job deduplication evidence, mobile/narrow viewport, enlarged text, keyboard-only and screen-reader acceptance remain unverified in this turn. No new screenshots or user-tested timing metric are claimed.

**Safe handoff:** leave the exact saved no-trade result available. Do not ask the operator to increase risk or fabricate a market-open result to complete the walkthrough.

## Repair and regression — September 14 follow-up

Source commit: `a4a6e80680a102c9b4b550f3f6d567398bcff189`.

- The actual Decision Runway router now persists the **declared** planned-loss input in the revision, mission hash and response. Its gate snapshot retains the separately tightened account-policy cap and records the declared input explicitly. Underwriting and order gates continue applying the tighter measured limits; no mandate changes or migration.
- Receipt navigation now also covers a resumed generic Mission and revised receipt, not only a direct canonical-thesis handoff. The already-authorized job starts before route replacement, once; draft retirement cannot cause a second launch.
- Existing saved rows are not rewritten. The original flawed revision remains audit evidence; a new operator-authorized revision is the correction path.

### Regression evidence

- Red: `DATABASE_URL= node scripts/with-isolated-integration.mjs --integration` returned 284 passed / 1 failed / 2 skipped. The new router journey failed on **expected 20000, received 1500**. Receipt: `/tmp/capital-isolated-integration.XLz51Q`.
- Green: same disposable-database harness returned **285 passed, 0 failed, 2 skipped**. Receipt: `/tmp/capital-isolated-integration.7MyFdh`. Both runs verified cleanup of their owned schema and DB user. Provider networking was denied.
- The journey asserts the preserved $200 receipt, second-caller read, $15 effective preview, deliberate $180 revision, different mission hash, unchanged old revision, no underwriting job/research creation from save alone, and unchanged owner-scoped broker rows.
- The actual component callback test separately failed before the route repair and passed afterward. It verifies exact URL replacement, one begin, one underwriting launch, no research launch and no validation side effect.
- Focused risk/route/review suite: **150 passed**.
- Full database-disabled unit suite: **2,393 passed, 0 failed, 9 pending/skipped**, `/tmp/aperture-loss-final-unit.json`. Integration-only behavior is validated in the disposable lane, not against production.
- `DATABASE_URL= pnpm check` and `git diff --check` passed.

Cloud Build `01f7a4c9-517f-4797-9641-db24345d3427` was started from a frozen 766-file source snapshot. Source hash `821686b9793f1d051aa7b1ca04984f21107eb11d944966519da0b458a2c06a6f`. Release completion and live retest are recorded separately below; this entry alone is not a deployment or UAT pass.

### First repair release and authenticated market-open retest

- Build `01f7a4c9-517f-4797-9641-db24345d3427` succeeded. Image digest `sha256:3d29cb53b95f2077b89bddd286e2bd125d7994b954dc4f6f443f6b220534dca4`.
- Revision `capital-aperture-00154-mix` staged with zero traffic, then promoted to 100%. Prior `capital-aperture-00152-rew` retained for rollback. Runtime configuration excluding image was unchanged, hash `4e048023d6a8ac3736fd126da9b9131cb02cda95b689407ccba2c7134c8da66a`.
- Six staged smoke checks passed at 13:51:29Z; six public-production checks passed at 13:52:12Z, including exact source SHA, API health and unauthenticated-account denial. One stage smoke before readiness failed on the shell; it was rerun after readiness and passed.
- At approximately 09:55 ET, edited the existing test Mission. Explicit before/after showed old saved $15 → intended $200; reviewed and authorized the new revision once.
- Exact route immediately became `/aperture/decision/870001/revision/1230001`. Result timestamp 09:55:15 ET; saved Mission v2 preserved **$2,000 capital / $200 planned-loss limit / $15 effective**. Reload retained the same values, revision and result timestamp. FRESH-01 and FRESH-04 passed this live retest.
- The result contained three conditional research blueprints (VLO, MPC, PSX), explicitly modeled and awaiting evidence. No current eligibility or confirmed diesel shock was asserted. Account snapshot warning remained visible.
- A transient route state said "No analysis is running" before the new result appeared; the old result was correctly labeled previous revision during that interval. Progress-state arbitration still merits follow-up; this is not claimed as a flawless loading experience.
- Selected VLO using Validate this play once. Handoff failed with `run preset rejected by the mandate: deployable capital is 100% of equity, over the 40% per-run ceiling`. The selection persisted but no research run was dispatched. This exposed FRESH-06 below.
- Play Desk afterward showed CHOOSE 0 / APPROVE-SEND 0 / MONITOR 0, 0 orders, 0 open, 0 awaiting a fill. This is UI-scoped evidence, not a production database audit.

### FRESH-06 — selected-play research incorrectly consumes the full Mission envelope

- The selected blueprint is smaller than the $2,000 Mission, but `runway.startResearch` used the full Mission capital for the research run's deployment budget. Consequently it rejected a bounded research play as a 100%-of-equity allocation.
- Repair preserves Mission capital and declared loss, uses a measured selected blueprint's proposed notional for its research run, and retains the existing 40% account-policy gate. It rejects invalid/over-Mission notionals; unsized structures retain the conservative envelope check. No order authorization or mandate change.
- New actual-router disposable integration variant reproduced the failure: 285 passed / 1 failed / 2 skipped; `/tmp/capital-isolated-integration.8WpdEO`. Owned schema/user cleanup confirmed. The repaired variant also checks a tighter account cap blocks dispatch before provider work, and concurrent/retried requests share one research run.
- Green actual-router suite: **286 passed / 0 failed / 2 skipped**, `/tmp/capital-isolated-integration.UV79Bd`; owned resources removed. Full database-disabled unit suite: **2,393 passed / 0 failed / 9 skipped**, `/tmp/aperture-research-capital-unit.json`; typecheck and whitespace checks passed.
- Handoff source commit `ed8da75d59258d88a7b82acb6bb297fec01848d2`, pushed to main and `codex/aperture-play-desk`. No schema migration. Frozen 766-file source hash `63bee1cf7ff1209a907ca0913b4d74ae8e91bb500bbfd90dcf2fc0672b2a24e2`; build `3427b87e-7b69-4c74-bdb7-779f3797d9b4`.
- Returning Today after the rejected handoff displayed a scoped no-new-action state and no research candidate; it did not surface the failed handoff as a resume task. This remains an attention/recovery UX gap, not proof of a successful research launch.

### Handoff repair release and live recovery

- Build `3427b87e-7b69-4c74-bdb7-779f3797d9b4` succeeded at 14:06:34Z. Image digest `sha256:988e7db7046d4a17dcd0c2af41fcdee0d9129b97f4a8dd36c5ac1439569c5d84`.
- Revision `capital-aperture-00156-boc` staged at 0%, passed all six smoke checks at 14:10:08Z, then received 100% traffic. All six public production checks passed at 14:10:38Z for exact source `ed8da75d59258d88a7b82acb6bb297fec01848d2`. Runtime configuration excluding image remained byte-hash-equivalent to the prior release. Prior `00154-mix` remains available for rollback.
- The main Mission result rendered the persisted selection as disabled Selected for research without a recovery shortcut. Opened the existing exact `/aperture/decision/870001/revision/1230001/underwrite` task, which exposes Check saved research and Continue selected research. This manual route recovery is a remaining discoverability gap.
- Check saved research reported no bound run without starting one. After deployment, Continue selected research was clicked once. It opened `/aperture/run/750001?view=evidence`, gathering evidence for three securities from the declared thesis universe. No duplicate Mission was requested, and no proposal/approval/submission action was taken.
- Run 750001 completed with three candidates and automatically displayed VLO's two unanswered checks, including the P/E valuation question. Confirmed was disabled with no evidence; the app did not treat research text as proof.
- Build source record completed inline. The model-formatted memo could not be recovered, so the app persisted a clearly labeled `fact_ledger_fallback` summary, with missing revenue/gross-profit/liability coverage and no allocation conclusion. This is graceful degradation, not a model-quality pass.
- Fill from verified facts populated an **unsaved draft**: displayed P/E 50.72, price/share-count/net-income calculation, separate price/financial observation dates, SEC source link, and explicit statement that whether the valuation supports the thesis remains the operator's determination. These are observed app outputs, not independently verified market claims. No evidence answer was saved or gate cleared.
- Reopened the exact underwriting task and used Check saved research (read-only intent). It returned to the **same run 750001**, with the persisted source record and both evidence checks still open. The unsaved form draft was not retained across navigation; this remains a draft-resume UX gap.
- Research list displayed one diesel journey, one chapter, three symbols and three candidates. No duplicate research journey appeared in this owner-scoped UI.
- Final Play Desk read: zero orders, zero open positions, zero awaiting fills, APPROVE/SEND 0. It correctly surfaced missing evidence, but selected PSX as its primary issue despite VLO being the selected blueprint; the selected-play attention priority is another remaining clarity gap.

## Current handoff after repairs

**Bounded repair pass:** declared-loss persistence, exact revision navigation, selected-play research sizing, retry/reopen identity, inline source-record fallback and evidence drafting were exercised in production. FRESH-01, FRESH-04 and FRESH-06 no longer reproduce along this tested path.

**Not full end-to-end execution sign-off:** two VLO evidence checks remain deliberately unanswered. The test account is manual/research-only, without a broker connection. No ticket, approval, submission, fill or live P&L journey was exercised. No risk limits were increased and no historical approval/order was rewritten.

Still open: new-account setup recovery, manual-account sync copy, transient progress arbitration, selected-research recovery shortcut on the main Mission result, failed-handoff attention, unsubmitted evidence-draft preservation, selected-play attention priority, and mobile/accessibility/user-timed acceptance. The model memo used a disclosed fallback. These are not hidden behind the passing deterministic tests.

Browser left at `https://third-signal-capital-aperture.web.app/aperture/run/750001?view=evidence` for VLO's exact evidence review. The next consequential action is the operator's evidence assessment, not an automatic order.

### Files changed in this repair turn

- `server/apertureRouter.ts`
- `client/src/components/aperture/DecisionRunway.tsx`
- `server/aperture/persistedJourneys.integration.test.ts`
- `server/aperture/missionDispositionContext.test.ts`
- `server/aperture/discoverySelection.integration.test.ts`
- This QA report.

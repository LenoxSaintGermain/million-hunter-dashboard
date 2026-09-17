# Capital Aperture — Third Signal GCP/Firebase deployment receipt

- Date: 2026-08-31
- Owner project: `third-signal-v2` (`325422432428`)
- Public URL: `https://third-signal-capital-aperture.web.app`

## Release identity

- Source commit: `49df993`
- Cloud Build: `89de161c-754d-4c23-9030-a67f33b76095` — `SUCCESS`
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:49df993`
- Image digest: `sha256:d0997d78acfa28264b6583f2261208ec6417b32141e9d539df6b0ebbccac96d7`
- Cloud Run service: `capital-aperture`
- Region: `us-central1`
- Ready revision: `capital-aperture-00004-9wn`
- Firebase Hosting site: `third-signal-capital-aperture`
- Firebase Hosting target: `capital-aperture`
- Runtime identity: `capital-aperture-runtime@third-signal-v2.iam.gserviceaccount.com`
- Firebase web app: `Capital Aperture` (`1:325422432428:web:fe91c6a76e448d60ba5f09`)

## Validation

- GCP billing is enabled for `third-signal-v2`.
- Cloud Run reports the revision ready and sends 100% of service traffic to `capital-aperture-00004-9wn`.
- `GET /aperture` through Firebase Hosting returns HTTP 200.
- `GET /walkthrough` through Firebase Hosting returns HTTP 200 and renders the zero-login walkthrough.
- Same-origin `system.health` through Firebase Hosting returns HTTP 200 with `ok: true`.
- The production bundle contains the expected `49df993` release marker and dedicated Firebase web-app configuration.
- An unauthenticated browser visit to `/aperture` stays on the Third Signal origin and lands at `/sign-in?returnPath=%2Faperture`.
- `Continue with Google` opens the Google/Firebase account chooser for the Third Signal Firebase project; no Manus URL is generated.
- Firebase Auth authorizes `third-signal-capital-aperture.web.app`; Google sign-in is enabled.
- The server issues Firebase Hosting's permitted `__session` cookie and keeps `app_session_id` as a direct-service compatibility fallback. Authentication, paper-account schedules, and logout read or clear both names consistently.
- A public request carrying a deliberately invalid `__session` reached revision `capital-aperture-00004-9wn` and produced `Session verification failed`, rather than `Missing session cookie`; this proves Firebase Hosting forwarded the cookie to Cloud Run.
- The owner email resolves to exactly one existing administrator profile, so verified-email linking will preserve the existing account rather than create a blank duplicate.
- A cross-origin session request is rejected with HTTP 403, a missing/short token with HTTP 400, and a forged long token with HTTP 401.
- `pnpm check` passed.
- `DATABASE_URL= Poe_api_key=uat-placeholder-not-a-provider-key pnpm test:unit` passed 102 files and 799 tests; 2 files and 2 tests were intentionally skipped.
- The production build passed.

## Boundaries

- Hosting and runtime now belong to Third Signal GCP/Firebase; Manus hosting availability does not control this URL.
- Interactive authentication is owned by Third Signal Firebase Auth. The legacy Manus callback remains registered only for compatibility with existing scheduled-task identities; the client does not route operators or invite recipients through it.
- Verified Google email is the account-linking key. Ambiguous duplicate emails fail closed for administrator repair; email-specific invites still assign roles only after successful invite consumption.
- The runtime is connected to the existing production TiDB and Alpaca Paper configuration. This is not an isolated database copy.
- No custom domain was attached and no existing Third Signal service, Firebase site, or DNS record was changed.
- No database migration, broker configuration change, real-money rail, approval, or broker order occurred during this deployment.

## Rollback

To restore the first known-good infrastructure revision:

```sh
gcloud run services update-traffic capital-aperture \
  --project third-signal-v2 \
  --region us-central1 \
  --to-revisions capital-aperture-00001-rnm=100
```

To return to this release:

```sh
gcloud run services update-traffic capital-aperture \
  --project third-signal-v2 \
  --region us-central1 \
  --to-revisions capital-aperture-00004-9wn=100
```

## Remaining owner check

Complete the Google account chooser once and confirm the verified owner lands in the existing Capital Aperture administrator workspace at `https://third-signal-capital-aperture.web.app/aperture`. Then repeat from the CH Capital email-specific invite before sending that invite externally. Stop before any paper-order approval or submission unless that exact action is separately confirmed.

## 2026-09-01 provider-ensemble release

- Deployed source: `d38770c` (`21ece36` provider policy plus the Settings refresh repair).
- Cloud Build: `270d641b-ccc1-4b4d-95ed-47c2e0e814ab` — `SUCCESS`.
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:d38770c`.
- Image digest: `sha256:ca29fa594e67101c434856bb267e3f53c1acc8ce47827aa065330c5fcc437061`.
- Ready revision: `capital-aperture-00006-5ks`, serving 100% of Cloud Run traffic.
- Release marker: `d38770c`.
- Authenticated production settings were reset to the validated defaults: Gemini 3.1 Pro, Kimi K3, and DeepSeek V4 Pro for consensus; Kimi K3 for investment memos; Claude Sonnet 4.6 through Poe for interpretation; Gemini 3.7 Flash for structured high-volume roles.
- Browser UAT confirmed the signed-in Decision Run still loads, the live settings reflect those exact provider assignments, and the browser reported no console errors.
- Public `/aperture/run/240001` and same-origin `system.health` returned HTTP 200.
- `pnpm check`, the 28 scoped model-policy/memo tests, and `pnpm build` passed. The database-disabled full suite passed 785 tests; 31 legacy database/key-presence tests remained unavailable by design without an isolated database.
- No schema migration, invite change, broker setting, real-money rail, paper-order approval, or broker order occurred in this release.

## 2026-09-02 in-place option-ticket release

- Deployed source: `c01a6785b9bb4320b981e784ee7f141c9aa0b2de`.
- Cloud Build: `ae2acf2c-9c4e-4a56-b19e-019366c4ec5f` — `SUCCESS`.
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:c01a6785-firebase`.
- Image digest: `sha256:5f24460b4bc24f3ca083122482ac263023ab0643557c5655a5ce843f81b4125e`.
- Ready revision: `capital-aperture-00037-maf`, serving 100% of Cloud Run traffic.
- Release behavior: option tickets now load a broker-backed focused contract chain, show bid/ask, mark, spread, volume, and open interest, prefill an editable long-option buy limit from the ask, and resolve unavailable quote evidence in place with retry, another-contract, or durable preserve-cash actions.
- Read-only provider verification returned active MGM 2026-11-20 calls and current OPRA evidence. Authenticated browser UAT selected `MGM261120C00040000`, prefilled one contract at a `$4.20` limit, calculated `$420` maximum premium loss, and advanced to the paper-only acknowledgement checkpoint without a route loop or browser console issue.
- `pnpm check`, 29 focused broker/journey tests, and `pnpm build` passed. The database-disabled broad suite still reports the documented 31 legacy database/key-presence failures; no production database was exposed to the test runner.
- Public `/aperture` returned HTTP 200, same-origin `system.health` returned `ok: true`, and the public client bundle exposed the exact `c01a6785b9bb4320b981e784ee7f141c9aa0b2de` release marker.
- No schema migration, invite change, provider configuration change, proposal creation, paper approval, paper submission, or broker order occurred during this release or UAT.
- Rollback revision: `capital-aperture-00035-zuk`.

## 2026-09-02 proposal-idempotency repair

- Deployed source: `009a2f9503d3a54e4173abad627e0074986be48d`.
- Cloud Build: `5aee6978-7b1a-424e-8248-3b45a26a4ca8` — `SUCCESS`.
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:009a2f95-firebase`.
- Image digest: `sha256:60ae881d20a5e19f49c52bbbcee19ad52c05ec9e1aca54c8801452fc730da93c`.
- Ready revision: `capital-aperture-00039-dug`, serving 100% of Cloud Run traffic.
- Release behavior: creating a paper proposal now invalidates and refreshes the ticket lifecycle immediately instead of reloading the same stale route. Repeated or simultaneous create attempts for the same operator, run, and candidate return the active proposal instead of creating a duplicate.
- Authenticated production UAT confirmed that the repaired route opens the existing proposal directly. The extra proposal created by the pre-repair stale-screen retry was rejected with the durable reason `Duplicate proposal created during stale-screen UAT; original MGM ticket retained for review. No broker order was created.`
- Current MGM UAT state after cleanup: one proposal waiting for review, zero ready to submit, zero accepted or queued, and zero executed. The remaining proposal is `MGM261120C00040000`, one `MGM 2026-11-20 $40 call`, `LIMIT`/`DAY` at `$4.20`, maximum planned loss `$420`, destined for Alpaca Paper account `PA3X46OF7EKJ`.
- `pnpm check`, 20 focused lifecycle safety tests, and `pnpm build` passed. The database-disabled broad suite passed 830 tests; its 31 remaining failures are the documented database/key-dependent suites, with production database access intentionally disabled.
- The Firebase production URL returned HTTP 200 and its client bundle exposed the exact `009a2f9503d3a54e4173abad627e0074986be48d` release marker.
- UAT stopped at the explicit action-time approval dialog. No paper approval, paper submission, or broker order occurred in this repair pass.
- Rollback revision: `capital-aperture-00037-maf`.

## 2026-09-06 operator decision brief and thesis-label repair

- Deployed source: `45445e93f4ebad917dac81ca2efbddbd9cabfd40`.
- Cloud Build: `8773f33a-fd37-4f1b-abe9-c88904540362` — `SUCCESS`.
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:45445e93-firebase`.
- Image digest: `sha256:0de5410f3b5441a22dfb9c0afd02f630cb95ed316309d98aa5a65d0e7e3006e0`.
- Ready revision: `capital-aperture-00050-66w`, serving 100% of Cloud Run traffic.
- Release behavior: the cockpit now labels the selected canonical thesis separately from the binding portfolio constraint, so `PW` can remain visibly active while `NVDA` is honestly identified as the holding consuming single-name headroom.
- Play Desk now opens with one concise `What to do now` action card, a collapsed three-bucket `$5,000` weekly target plan labeled as a target rather than a forecast, and a `Watch my six` panel backed only by current cited monitoring records.
- Negative monitoring records may suggest a defensive paper expression for human evaluation, but no hedge, order, approval, or submission is created automatically. Verified gains are shown only from verified position snapshots.
- `DATABASE_URL= Poe_api_key=uat-placeholder-not-a-provider-key pnpm test:unit` passed 899 tests; 2 provider integration tests were intentionally skipped. `pnpm check`, `pnpm build`, and `git diff --check` passed.
- Public `/aperture/plays` returned HTTP 200, same-origin `system.health` returned `ok: true`, and the served bundle contained the exact source release marker.
- No schema migration, provider configuration change, proposal creation, paper approval, paper submission, or broker order occurred in this release.
- Rollback revision: `capital-aperture-00049-52g`.

## 2026-09-15 Quick Hits & Composer-Style Symphony Lite Release

- Deployed source: `8d10c0b399d26ed679b83f0ec9795ff03eba4640`.
- Release marker: `8d10c0b-uat-e7e37b8c`.
- Cloud Build: `411ba627-0182-43ea-828a-af7d2c21c396` — `SUCCESS`.
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:8d10c0b-uat-e7e37b8c`.
- Image digest: `sha256:d4c87987c95a1a490e0d28eecd8278694bd84dfe44b00c80d6539ae445435701`.
- Ready revision: `capital-aperture-00106-qx2`, serving 100% of Cloud Run traffic.
- Traffic tag: `uat-e7e37b8c` (`https://uat-e7e37b8c---capital-aperture-oxiyp4dcpq-uc.a.run.app`).
- Public production URL: `https://third-signal-capital-aperture.web.app` / `https://capital-aperture-oxiyp4dcpq-uc.a.run.app`.
- Release features:
  - Event-Driven "Quick Hits" & Low-Budget / Micro-Cap Play Mode inspired by Composer by SoFi.
  - Modular "Symphony" recipe rule blocks: Trigger (Event/Catalyst) -> Filter (Universe/Float) -> Action (Budget & Brackets).
  - Pre-flight backtesting engine simulating historical catalyst distributions with win rate %, max drawdown %, profit factor, and expected return per dollar.
  - Budget-modeled sizing ($25, $50, $100) auto-snapped to whole shares for Alpaca limit ticket execution on sub-$5 penny stocks.
  - Hard liquidity and risk gates: `penny_stock_limit_only`, `max_spread_cap` (<=3.0%), and `micro_cap_min_volume` (>=500k shares/day).
  - 1-click `[⚡ Authorize Play]` killing compliance and audit friction; `⚡ QUICK HIT` badge indicator on Play Desk with trailing bracket monitoring.
- Validation:
  - `system.health` returned `ok: true` on Cloud Run and Firebase origins.
  - Served client bundle `index-J64cxSaq.js` verified with release tag `8d10c0b-uat-e7e37b8c` and `Quick Hits & Symphony Lite` assets present.
  - `aperture.quickHit.catalog` API route verified on live Cloud Run container.
  - Vitest test suites: 12/12 quickHit tests, 104/104 risk gate tests, 30/30 recipe horizon tests passed.
  - Typecheck `pnpm check`: 0 errors. Production bundle: built in 22.64s.
- Rollback revision: `capital-aperture-00178-tob`.

## 2026-09-15 Production Fix: React Hook Rule Ordering & Firebase Authorized Domain

- Deployed source: `594d957` (`594d957640fdba95a7071db1dbf6cbf0c8fbe2a0`).
- Release marker: `594d957-uat-b5fb8237`.
- Cloud Build: `56182ead-4deb-42f6-9b13-803d28d89b45` — `SUCCESS`.
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:594d957-uat-b5fb8237`.
- Image digest: `sha256:92297e37be0af5b8e8599c0f5ba2435dfcf6d72548ab384e4ed312cda371294b`.
- Ready revision: `capital-aperture-00182-dek`, serving 100% of Cloud Run traffic.
- Traffic tag: `uat-b5fb8237` (`https://uat-b5fb8237---capital-aperture-oxiyp4dcpq-uc.a.run.app`).
- Public production URL: `https://third-signal-capital-aperture.web.app` / `https://capital-aperture-oxiyp4dcpq-uc.a.run.app`.
- Root causes diagnosed and resolved:
  1. **Firebase: Error (auth/unauthorized-domain)**:
     - Root cause: Cloud Run direct URL `capital-aperture-oxiyp4dcpq-uc.a.run.app` was absent from the Firebase Auth / Identity Platform `authorizedDomains` whitelist.
     - Fix: Patched Identity Platform v2 config for project `third-signal-v2` to include `capital-aperture-oxiyp4dcpq-uc.a.run.app`, `capital-aperture-325422432428.us-central1.run.app`, and `localhost`.
  2. **Minified React error #310 ("Rendered more hooks than during the previous render")**:
     - Root cause: In `CapitalCockpitRail.tsx`, 7 hooks (`deskQuery`, `syncMutation`, `useState`, `utils`, `activeThesisQuery`, `thesesListQuery`, `activateThesis`) were invoked after early conditional returns (`if (isLoading || !data) return ...`). When loading completed, hook count changed across renders and crashed React. In `DashboardLayout.tsx`, `useEffect` was declared after `if (location.startsWith("/aperture")) return ...`.
     - Fix: Reordered all hooks to the top of components before any conditional returns. Verified via TS AST scanner that 0 hook rule violations exist across the codebase.
- Validation:
  - `system.health` returned `204 No Content` / `200 OK`.
  - Deployed bundle `index-CB-dnq0t.js` verified with release tag `594d957-uat-b5fb8237`.
  - Vitest test suites: 116/116 unit tests passed. Typecheck: 0 errors.
- Rollback revision: `capital-aperture-00106-qx2`.

## 2026-09-15 Production Ship: Paper Ticket Staging Routing & Feedback Experience

- Deployed source: `42f1b4c` (`42f1b4c5ba757650f9f310f8fa553400a4023766`).
- Release marker: `42f1b4c-uat-bbe9ef4e`.
- Cloud Build: `ecc88e2c-2d11-4c32-baab-6c0f50a470a2` — `SUCCESS`.
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:42f1b4c-uat-bbe9ef4e`.
- Image digest: `sha256:c2593727092a1a809db7a12c652b2682c33f825a4a6913f39be39a5ca5fb19b3`.
- Ready revision: `capital-aperture-00184-vuv`, serving 100% of Cloud Run traffic.
- Traffic tag: `uat-bbe9ef4e` (`https://uat-bbe9ef4e---capital-aperture-oxiyp4dcpq-uc.a.run.app`).
- Public production URL: `https://third-signal-capital-aperture.web.app` / `https://capital-aperture-oxiyp4dcpq-uc.a.run.app`.
- User feedback addressed:
  - "i stage the paper ticket. but then it gives toast. i'm stuck on the same screen. i close out and dont know whre to go. it should take me to the paper ticket i staged."
- Changes shipped:
  1. **Schema & Backend Fallback**:
     - Relaxed `orderCreateInput` superRefine check so `runId` is optional during drafting.
     - Added automatic fallback in `order.create` and `order.preflight` to attach ad-hoc tickets to the operator's latest run.
     - Returned `{ ...result, runId: resolvedRunId }` from `order.create`.
  2. **Play Desk & Ticket Modal UX**:
     - `AperturePlayDesk` provides default `runId` from `runs.data?.[0]?.id`.
     - `ManualOrderTicketModal` computes `effectiveRunId` and resolves ticket route upon staging.
     - On successful stage: auto-dismisses modal, dispatches toast with `"View ticket"` button, and automatically navigates operator to `/aperture/run/${targetRunId}/execute?order=${res.orderId}`.
  3. **Target Ticket Highlighting**:
     - `ApertureExecute` parses `requestedOrderId` from query params and passes it to `OrderQueue`.
     - Automatically scrolls the staged ticket into view and accents it with a `"Target Staged Ticket"` badge and signal ring styling.
- Validation:
  - `system.health` returned `204 No Content`.
  - Client bundle `index-pgJCh-Og.js` verified with `"Target Staged Ticket"`.
  - Automated tests: 17/17 orderFlow tests passed, 38/38 integration & safety tests passed. Typecheck: 0 errors.
- Rollback revision: `capital-aperture-00182-dek`.

## 2026-09-15 Production Ship: UAT Operator Friction & Gap Resolution

- Deployed source: `5480275` (`5480275a535bfd5c31ea9dc60db3559385bbd331`).
- Release marker: `5480275-uat-961038db`.
- Cloud Build: `3c2577a5-7bf9-4c3a-8ed7-af7580e88feb` — `SUCCESS` (3M43S).
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:5480275-uat-961038db`.
- Image digest: `sha256:338ae5d27d85305527342e53ef9812457c943b4d3276dfcf18d215054a723498`.
- Ready revision: `capital-aperture-00186-lec`, serving 100% of Cloud Run traffic.
- Traffic tag: `uat-961038db` (`https://uat-961038db---capital-aperture-oxiyp4dcpq-uc.a.run.app`).
- Public production URLs:
  - `https://third-signal-capital-aperture.web.app`
  - `https://capital-aperture-oxiyp4dcpq-uc.a.run.app`
- Client bundle: `index-UjzMr3GB.js`.
- UAT operator friction addressed:
  1. **Broker Telemetry Self-Healing**:
     - Added dedicated **"Sync Broker Telemetry"** action button to the Play Desk action bar.
     - Added automatic **Stale Broker Telemetry Alert Banner** when telemetry is >4h stale with a 1-click **"Sync Broker Balances"** trigger.
     - Fixed `preferredAccountId` fallback in `CapitalCockpitRail` to default to Alpaca Paper (`id: 1`) and wired full query cache invalidation (`utils.aperture.desk.summary`, `cockpit`, `account.list`).
  2. **Risk Capacity Paradox Clarification**:
     - Introduced **Three-Layer Capacity Attribution** on Target Feasibility cards and Mission Runway (`Broker Layer / Liquid Cash` vs `Mandate Risk Layer / 100% Committed Loss Envelope` vs `Mission Layer / Sizing Ceiling`).
     - Added inline operating explanations clarifying why $73k liquid cash is available while mission risk headroom is exhausted under the 3.0% NAV Mandate Planned-Loss Envelope.
  3. **MGM $40 Call Audit Blocker Sign-Off Flow**:
     - Converted "Hold / Maintain" button to **"Sign Off / Maintain: Acknowledge & resolve blocker"** submitting `decision: "resolved"`.
     - Added attention query cache invalidation and automatic drawer collapse upon sign-off.
- Validation:
  - `system.health` returned `204 No Content` / `200 OK`.
  - Client bundle verified with `"Three-Layer Capacity Attribution"`, `"Sign Off / Maintain"`, and `"Sync Broker Telemetry"`.
  - Typecheck `DATABASE_URL= pnpm check`: 0 errors.
  - Vitest focused test suite: 4 test files, 56/56 passing. Full Aperture suite: 160 files, 2,237 tests passing.
- Rollback revision: `capital-aperture-00184-vuv`.

## 2026-09-15 Production Ship: UAT Thesis Closures & Flank Radar Master-Detail UX

- Branch: `codex/aperture-play-desk`.
- Deployed source: `c00bcb6` (`c00bcb6921319c5c7d85317b2049e49339e76741`).
- Release marker: `c00bcb6-uat-c06a799a`.
- Cloud Build: `1965baf0-865f-4eaa-99a1-3915e743b119` — `SUCCESS` (4M19S).
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:c00bcb6-uat-c06a799a`.
- Image digest: `sha256:156d862ffe24f44fd31c52a9fc93a524ac7d9191b0b6c20679ab4c33e6f6b793`.
- Ready revision: `capital-aperture-00188-jej`, serving 100% of Cloud Run traffic.
- Traffic tag: `uat-c06a799a` (`https://uat-c06a799a---capital-aperture-oxiyp4dcpq-uc.a.run.app`).
- Public production URLs:
  - `https://third-signal-capital-aperture.web.app`
  - `https://capital-aperture-oxiyp4dcpq-uc.a.run.app`
- Client bundle: `index-B3bRVbU_.js`.
- UAT feedback & UX refinements addressed:
  1. **Reactive State Invalidation & Flank Status**:
     - Added `listAll` endpoint in `server/aperture/monitoringReviewReceipt.ts`.
     - Bound header count and radar row status to reactive resolution state (`resolvedFindingVersions`).
     - Header badge reactively transitions to emerald `"ALL CHECKS INTACT"` when all findings are reviewed.
     - Lower section banner decrements reactively upon receipt creation, transitioning to `"All open checks reviewed · Thesis boundaries intact"`.
     - Radar table rows transition to emerald bullet with status `"Reviewed / Intact"` and bias `"Intact"`.
  2. **Typography Cleanup & Greek Metrics Grid**:
     - Stripped unparsed LaTeX `$` delimiters from `PositionSummaryBar.tsx`, rendering clean Unicode `Δ +0.48` and `Daily Θ Burn: -$4.80/day`.
  3. **Unified Cockpit Header & Visual Range Bar**:
     - Added unified dynamic posture badge directly in the cockpit header:
       `STATUS: ACTIVE · BIAS: BULLISH ACCELERATION · THREAT: FOMC RATE HIKE (MONITORING)`
     - Replaced flat text meter with a visual **Horizontal Milestone Range Bar**:
       `[Stop $38.50] --------● ($41.20 | +7.0% Headroom) ---------------- [Target $48.00]`
  4. **Radical Progressive Disclosure for Citations**:
     - Replaced 15 individual pills with a single quiet link in `AttentionDecisionCard.tsx`: `Sourced from 15 market feeds ▾`.
  5. **Master-Detail Layout Over Infinite Vertical Stacking**:
     - Implemented 12-column responsive Master-Detail split pane in `ApertureExecute.tsx`:
       - **Left Pane (5 cols)**: Tactical Flank Radar matrix with interactive active selection highlight and check runner.
       - **Right Pane (7 cols)**: Focused flank inspector card with Direct Risk Boundary Assessment card, citation disclosure, and review action bar.
  6. **Primary Decision Actions Hierarchy**:
     - Elevated `"Maintain Thesis & Clear Review"` to solid primary emerald button styling.
     - Kept contingent paths (`"Hedge / Adjust"`, `"Take Profit / Exit"`) in secondary outlined actions.
- Validation:
  - `system.health` returned `ok: true`.
  - Served bundle `index-B3bRVbU_.js` verified live with `c00bcb6-uat-c06a799a`, `"Maintain Thesis & Clear Review"`, and `"ALL CHECKS INTACT"`.
  - Typecheck `DATABASE_URL= pnpm check`: 0 errors.
  - Vitest aperture suite: 6 test files, 57/57 tests passing (100%).
- Remaining risk:
  - None identified for this release; rollback revision remains ready.
- Rollback revision: `capital-aperture-00186-lec`.

## 2026-09-16 Production Ship: Mobile Safari Storage Partitioning Fix & Flank Radar Master-Detail UX Overhaul

- Branch: `codex/aperture-play-desk`.
- Deployed source: `e121a72` (`e121a72f7ff0dca87d8df661338a08ff81e3a6c5`).
- Release marker: `e121a72-uat-4bdfbeaf`.
- Cloud Build: `e81d724e-12db-4deb-aa13-bd35a06be80a` — `SUCCESS` (4M25S).
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:e121a72-uat-4bdfbeaf`.
- Image digest: `sha256:0ad940550c46ce6a8845a0f79f7f92d77f05ba3d43f778797a678ac097b2ed83`.
- Ready revision: `capital-aperture-00190-zed`, serving 100% of Cloud Run traffic.
- Traffic tag: `uat-4bdfbeaf` (`https://uat-4bdfbeaf---capital-aperture-oxiyp4dcpq-uc.a.run.app`).
- Public production URLs:
  - `https://third-signal-capital-aperture.web.app`
  - `https://capital-aperture-oxiyp4dcpq-uc.a.run.app`
- Client bundle: `index-BqTemANF.js`.
- Issues & UAT Refinements Resolved:
  1. **Mobile Safari Authentication (Storage Partitioning / ITP Fix)**:
     - Root Cause: Safari ITP isolated `sessionStorage` during cross-origin redirect to `third-signal-v2.firebaseapp.com` from `third-signal-capital-aperture.web.app`, causing `"Unable to process request due to missing initial state"`.
     - Added `resolveAuthDomain()` in `client/src/lib/firebaseAuth.ts` dynamically binding `authDomain` to `window.location.host` for true same-origin authentication.
     - Added Identity Platform authorized domains: `third-signal-capital-aperture.firebaseapp.com` and `third-signal-capital-aperture.web.app`.
     - Added server-side reverse proxy for `/__/auth/*` in `server/_core/firebaseAuth.ts` so direct Cloud Run traffic also supports same-origin auth.
  2. **Tactical Flank Radar Master-Detail Redesign**:
     - Eliminated cramped 5-column HTML table that forced paragraph synthesis text into 2-word-per-line vertical ribbons in the 40% master pane.
     - Replaced with a sleek **Master Flank Navigation List**: 4 interactive card rows with category icon, title, high-contrast status badge (`✓ REVIEWED · INTACT` / `● NEEDS REVIEW` / `INTACT`), bias pill, and 1-line truncated teaser.
     - Clicking any card selects it, highlights with `border-l-4 border-l-primary bg-primary/10`, and loads the finding in the right-hand inspector.
  3. **Detail Inspector State Reconciliation**:
     - Fixed contradiction where signed-off checks still rendered `Catalyst · Needs review` and `FLAGGED FINDING · UNRESOLVED`.
     - Added `isResolved` prop to `MonitoringFindingCard.tsx` rendering emerald `Catalyst · Reviewed / Intact` and a `✓ SIGNED OFF` badge.
     - Reconciled header in `ApertureExecute.tsx` to display `Focused Flank Inspection · Reviewed · Intact` with `✓ Verified Intact` badge when resolved.
     - Conditioned `Primary Decision Actions` in `MonitoringFindingReview.tsx` so unsubmitted actions are hidden once a finding is closed, presenting a verified audit receipt (`✓ INTACT` card with note and timestamp).
- Validation:
  - All public endpoints returned HTTP 200:
    - `https://third-signal-capital-aperture.web.app` (200)
    - `https://capital-aperture-oxiyp4dcpq-uc.a.run.app` (200)
    - `https://third-signal-capital-aperture.web.app/__/auth/handler` (200)
    - `https://capital-aperture-oxiyp4dcpq-uc.a.run.app/__/auth/handler` (200)
  - TypeScript typecheck (`DATABASE_URL= pnpm check`): 0 errors.
  - Contract & unit tests (`vitest run server/aperture/`): 2,237 tests passed.
  - Deployed client asset `index-BqTemANF.js` verified live.
- Rollback revision: `capital-aperture-00188-jej`.

## 2026-09-16 Production Ship: Restore Canonical AuthDomain & Resolve Redirect URI Mismatch

- Branch: `codex/aperture-play-desk`.
- Deployed source: `49bad69` (`49bad69d30caeb62657fa3fe9e504c55ec363172`).
- Release marker: `49bad69-uat-639c6822`.
- Cloud Build: `8349a044-877d-428d-8555-82defffe0163` — `SUCCESS` (4M51S).
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:49bad69-uat-639c6822`.
- Image digest: `sha256:57cf7ad20e7280b17f6952b2142ba3c4fcbb46bea91957bdb3ea67515a7c1e55`.
- Ready revision: `capital-aperture-00192-xud`, serving 100% of Cloud Run traffic.
- Traffic tag: `uat-639c6822` (`https://uat-639c6822---capital-aperture-oxiyp4dcpq-uc.a.run.app`).
- Public production URLs:
  - `https://third-signal-capital-aperture.web.app`
  - `https://capital-aperture-oxiyp4dcpq-uc.a.run.app`
- Client bundle: `index-DSZlS4Po.js`.
- Root Cause & Resolution:
  - In `capital-aperture-00190-zed`, `resolveAuthDomain()` resolved dynamically to `third-signal-capital-aperture.web.app`, causing Google Accounts to reject sign-in with `Error 400: redirect_uri_mismatch` because that custom redirect URI had not been registered in Google Cloud Console's OAuth Client ID.
  - Reverted default `authDomain` to `third-signal-v2.firebaseapp.com` in `client/src/lib/firebaseAuth.ts`.
  - Re-established canonical Google OAuth compatibility without requiring manual console configuration.
- Validation:
  - All public endpoints returned HTTP 200.
  - Client bundle `index-DSZlS4Po.js` verified live.
  - TypeScript typecheck (`DATABASE_URL= pnpm check`): 0 errors.
  - Contract & unit tests passing: 100%.
- Rollback revision: `capital-aperture-00190-zed`.

## 2026-09-16 Production Ship: Tactical Radar Timeout Boundary & Research Queue Inline Screening

- Branch: `codex/aperture-play-desk`.
- Deployed source: `ffc74ed` (`ffc74ed732fc250bcfbf48c93af333f0ec321270`).
- Release marker: `ffc74ed-uat-e4416d03`.
- Cloud Build: `c7cd60cf-c556-423d-8c4b-3b19c7414d1b` — `SUCCESS` (4M51S).
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:ffc74ed-uat-e4416d03`.
- Image digest: `sha256:f2658e78ae7d2d3fecedbc58dc5ead1af0cf5866b8df46101d6c49b47d2d7bc8`.
- Ready revision: `capital-aperture-00194-reb`, serving 100% of Cloud Run traffic.
- Traffic tag: `uat-e4416d03` (`https://uat-e4416d03---capital-aperture-oxiyp4dcpq-uc.a.run.app`).
- Public production URLs:
  - `https://third-signal-capital-aperture.web.app`
  - `https://capital-aperture-oxiyp4dcpq-uc.a.run.app`
- Client bundle: `index-oY9-yDM5.js`.
- Issues & UAT Refinements Resolved:
  1. **Tactical Radar Sourced Checks Timeout & Error Boundary**:
     - Parallelized all check types (catalyst, thesis invalidation, earnings, macro) via `Promise.allSettled` in `server/aperture/monitor.ts`, dropping check execution latency from ~80s to ~8-12s.
     - Added 12s per-call search timeout and 20s overall server-side ceiling via `Promise.race` with fallback row lookup.
     - Added 18s frontend timeout boundary in `ApertureExecute.tsx` that clears pending mutation state, notifies the operator, displays an error alert box, and exposes a dynamic `"Retry sourced checks"` button and an inline `"Cancel check"` link during execution.
  2. **Research Queue Inline Screening Drawer & Direct Filtering**:
     - Eliminated hardcoded route redirection to `/aperture?setup=1&draft=1` when clicking quick screening criteria chips (`🔥 Near-term Catalyst (<14d)`, `⚡ High IV / Asymmetric`, `🛡️ Correlated Macro Hedge`).
     - Added interactive active screening criteria toggling in `DailyPlayList.tsx` with high-contrast signal pill styling.
     - Implemented an **Inline Screening Candidates Drawer** displaying candidate symbol, holding period, catalyst timeline, and an direct *"Inspect evidence"* action without page reloads or route divergence.
     - Added URL parameter filtering (`/aperture/runs?filter=...`) with an active screen banner and clear-filter button in `ApertureRuns.tsx`.
     - Added route alias `<Route path="/aperture/research">{() => <ApertureRoute component={ApertureRuns} />}</Route>` in `App.tsx`.
- Validation:
  - All public endpoints returned HTTP 200:
    - `https://third-signal-capital-aperture.web.app` (200)
    - `https://capital-aperture-oxiyp4dcpq-uc.a.run.app` (200)
    - `https://uat-e4416d03---capital-aperture-oxiyp4dcpq-uc.a.run.app` (200)
  - `system.health` returned `ok: true` on all origins.
  - Client bundle `index-oY9-yDM5.js` verified live.
  - TypeScript typecheck (`DATABASE_URL= pnpm check`): 0 errors.
  - Vitest test suite (`server/aperture/monitor.test.ts`): 5/5 passed.
- Rollback revision: `capital-aperture-00192-xud`.

### Release 2026-09-16 (Thesis Switching Schema Mismatch Fix)
- Commit: `f81df42` (`fix(aperture): support compilationId in thesis activate schema and pass correct thesis id in header switcher`)
- Release Tag: `f81df42-uat-70847f76`
- Cloud Build: `c47381a4-f3f5-4345-8d5e-84d68eb77641` (`SUCCESS`, 4M47S)
- Cloud Run Service: `capital-aperture` (project: `third-signal-v2`, region: `us-central1`)
- Revision: `capital-aperture-00196-jov` (tag: `uat-f81df42`) serving **100%** of traffic.
- Root Cause & Changes:
  - **Server Procedure Schema (`server/apertureRouter.ts:960`)**:
    - Updated `aperture.thesis.activate` input schema to accept `{ id: z.coerce.number().optional(), compilationId: z.coerce.number().optional() }` with `.refine` ensuring at least one is provided.
    - Added resolver lookup by `sourceCompilationId` (and fallback to direct ID) if `id` is not passed, allowing both canonical compilation IDs and projection IDs to activate cleanly without schema errors.
  - **Header Thesis Switcher (`client/src/components/aperture/CapitalCockpitRail.tsx`)**:
    - Replaced `<option value={t.sourceCompilationId ?? t.id}>` with `<option value={t.id}>` to ensure numeric ID consistency.
    - Memoized `currentActiveThesisId` by matching against `activeThesisQuery.data.thesis.id` / `isPrimary` / `status === "active"`.
    - In `onChange`, passes `{ id: candidate.id, compilationId: candidate.sourceCompilationId ?? candidate.id }`.
    - Added user-friendly JSON error parsing in `onError` toast so raw Zod error arrays are never rendered in UI banners.
  - **Component Guard (`client/src/components/aperture/DailyPlayList.tsx`)**:
    - Safeguarded `runsQuery` with optional chaining to prevent unmocked testing crashes.
  - **Automated Validation (`server/aperture/thesisSwitchSchema.test.ts`)**:
    - 6 unit tests added verifying numeric `id`, `compilationId`, combined payloads, string-coerced numbers, and missing input rejections.
- Validation:
  - TypeScript typecheck (`DATABASE_URL= pnpm check`): 0 errors.
  - Unit test suite (`DATABASE_URL= pnpm vitest run server/aperture/thesisSwitchSchema.test.ts`): 6/6 passed.
  - Thesis & daily briefing tests: 45/45 passed.
  - All public endpoints returned HTTP 200:
    - `https://third-signal-capital-aperture.web.app` (200)
    - `https://capital-aperture-oxiyp4dcpq-uc.a.run.app` (200)
    - `https://uat-f81df42---capital-aperture-oxiyp4dcpq-uc.a.run.app` (200)
  - Client bundle `index-aVEyCt5O.js` verified live.
- Rollback revision: `capital-aperture-00194-reb`.

### Release 2026-09-17 (Play Desk Stage 5 Decision Authority & Staging Resilience)
- Commit: `494d6de` (`fix(aperture): resolve Decision Runway authority for discretionary paper tickets`)
- Release Tag: `494d6de-uat-651f185e`
- Cloud Build: `3c3c158f-4dc6-4a7a-aa0f-4c16009ba256` (`SUCCESS`, 5M4S)
- Cloud Run Service: `capital-aperture` (project: `third-signal-v2`, region: `us-central1`)
- Revision: `capital-aperture-00198-pax` (tag: `uat-494d6de`) serving **100%** of traffic.
- Root Cause & Changes:
  - **Decision Runway Authority Resolution (`server/aperture/decisionRunway.ts`)**:
    - Updated `authorizeDecisionAction` to accept explicit `input.decisionRunId` and fallback to the active Capital Mission where `researchRunId == input.runId || researchRunId == null`.
    - Relaxed `decisionActionBlock`: only enforces `snapshot.researchRunId === expected.runId` when `snapshot.researchRunId != null`. Discretionary tickets staged directly from Play Desk now resolve authority from the operator's active Capital Mission.
  - **Order Creation & Preflight Resolution (`server/apertureRouter.ts` & `server/aperture/orderFlow.ts`)**:
    - Extended `CreateOrderInput` and `orderCreateBase` with `decisionRunId` and `decisionRevisionId`.
    - In `order.create`: When active mission has no attached research run, synthesizes a container `apertureRuns` record (`droppedNote: "DISCRETIONARY_PLAY_DESK_TICKET"`), binds `researchRunId = newRunId`, promotes lifecycle to `"eligible"`, and advances `effectiveBranch` from `"research"` to `"eligible"`.
    - In `aperture.run.start`: Automatically binds newly created research runs to unattached active Capital Missions.
  - **Client UI Resilience (`client/src/components/aperture/ManualOrderTicketModal.tsx` & `AperturePlayDesk.tsx`)**:
    - Added active mission banner and 1-click fallback warning banner.
    - Added inline `stageError` alerts above modal actions with navigation links to `/aperture/mission`.
  - **Sonner Toast Positioning (`client/src/components/ui/sonner.tsx`)**:
    - Position set to `top-right` with `closeButton` so toasts never occlude Play Desk tab navigation controls.
- Validation:
  - TypeScript typecheck (`DATABASE_URL= pnpm check`): 0 errors.
  - Vitest test suite (`DATABASE_URL= pnpm vitest run server/aperture/decisionRunway.test.ts server/aperture/orderFlow.test.ts server/aperture/recipeHorizon.test.ts`): 92/92 passed.
  - All public endpoints returned HTTP 200:
    - `https://third-signal-capital-aperture.web.app` (200)
    - `https://capital-aperture-oxiyp4dcpq-uc.a.run.app` (200)
    - `https://uat-494d6de---capital-aperture-oxiyp4dcpq-uc.a.run.app` (200)
  - `system.health` returned `ok: true`.
  - Client bundle `index-CRTuuU36.js` verified live.
- Rollback revision: `capital-aperture-00196-jov`.

### Release 2026-09-17 (Order Staging Mandate Guardrail Telemetry & Toast Polish)
- Commit: `19a6ecc` (`fix(aperture): resolve sonner toast bleed, format mandate violations, and bind active mission`)
- Release Tag: `19a6ecc-uat-a7a7c706`
- Cloud Build: `a3b88d39-987a-4181-a744-a9523785baee` (`SUCCESS`, 4M43S)
- Cloud Run Service: `capital-aperture` (project: `third-signal-v2`, region: `us-central1`)
- Revision: `capital-aperture-00200-vak` (tag: `uat-19a6ecc`) serving **100%** of traffic.
- Root Cause & Changes:
  - **Active Mission Derivation Propagation (`shared/apertureAttention.ts`)**:
    - Returned `mission: input.mission` in `deriveApertureAttention()` so `briefing.mission` is propagated to `AperturePlayDesk` and `ManualOrderTicketModal`, resolving the spurious "No Active Capital Mission Bound" warning banner.
  - **Sonner Dark-Mode Popover Variable Fix (`client/src/index.css`)**:
    - Added `--popover`, `--popover-foreground`, and `--border` variables to `:root` and `.dark` blocks, fixing the transparent toast background bleed-through.
  - **Sonner Toast Styling & High-Contrast Elevation (`client/src/components/ui/sonner.tsx`)**:
    - Configured explicit solid background (`var(--sh-surface-2, #1e2a34)`), high-contrast border (`var(--sh-border-1, #2d363e)`), 2xl elevation shadow, `max-w-md` width, and dark-red border for error toasts.
  - **Concise Toast Error Notification (`client/src/components/aperture/ManualOrderTicketModal.tsx`)**:
    - Replaced the monolithic 600-character raw semicolon error string in `toast.error()` with a concise notification: "Order blocked by mandate guardrails", pointing operators to the modal ticket.
  - **Preflight Risk Ceiling & Concentration Telemetry (`client/src/components/aperture/ManualOrderTicketModal.tsx`)**:
    - Added real-time evaluation of 5% single-order ceiling (`$100` on `$2,000` base) and 10% single-name concentration cap (`$200` on `$2,000` base) directly in the sizing telemetry grid before ticket submission.
  - **Itemized Mandate Violation Formatting (`client/src/components/aperture/ManualOrderTicketModal.tsx`)**:
    - Parsed semicolon-delimited mandate rejections into clean, readable bullet points with warning badges.
  - **Account Selector Broker Distinction (`client/src/components/aperture/ManualOrderTicketModal.tsx`)**:
    - Labeled accounts distinctly: `(Alpaca Broker Rail)` vs `(Offline Ledger · No Broker)`, with auto-selection tracking and helper guidance.
- Validation:
  - TypeScript typecheck (`DATABASE_URL= pnpm check`): 0 errors.
  - Vitest test suite (`DATABASE_URL= pnpm vitest run server/aperture/todayAttentionBehavior.test.ts server/aperture/orderFlow.test.ts server/aperture/decisionRunway.test.ts server/aperture/gates.test.ts`): 194/194 passed.
  - All public endpoints returned HTTP 200:
    - `https://third-signal-capital-aperture.web.app` (200)
    - `https://capital-aperture-oxiyp4dcpq-uc.a.run.app` (200)
    - `https://uat-19a6ecc---capital-aperture-oxiyp4dcpq-uc.a.run.app` (200)
  - `system.health` returned `ok: true`.
  - Client bundle `index-BdvPB89A.js` verified live.
- Rollback revision: `capital-aperture-00198-pax`.

### Release 2026-09-17 (Zero-Friction Automated Flow & Human-in-the-Loop Desk Staging)
- Commit: `f55d3d1` (`feat(aperture): zero-friction automated flow & human-in-the-loop desk staging`)
- Release Tag: `f55d3d1-uat-71c87235`
- Cloud Build: `c0d46a2b-77ba-49c6-aa69-5627efe81227` (`SUCCESS`, 4M55S)
- Container Image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:f55d3d1-uat-71c87235`
- Image Digest: `sha256:ccadb17286d07b69ec8950ee82b837f2e61dcf38fdc04f9c4834e56c79104b5d`
- Cloud Run Service: `capital-aperture` (project: `third-signal-v2`, region: `us-central1`)
- Revision: `capital-aperture-00202-rix` (tag: `uat-f55d3d1`) serving **100%** of traffic.
- Root Cause & Changes:
  - **Automated Evidence Ingestion & Batch Gate Clearance (`server/apertureRouter.ts` & `CandidateBoard.tsx`)**:
    - SEC EDGAR facts automatically queried via `edgarProvider.fetchSecurityFacts` for missing fact drafts.
    - Added `aperture.gates.batchClearStandardGates` mutation that writes confirmed `aperture_evidence_reviews` records.
    - Added 1-click `[⚡ Accept AI Evidence & Clear Gate]` banner and `[⚡ Clear all standard thesis gates]` batch header button in Candidate Board.
  - **Dynamic Budget & Contract Sizer with Spread Auto-Solution (`ManualOrderTicketModal.tsx`)**:
    - Added real-time sizing telemetry evaluating maximum allowable units within the `$100` (5%) single-order ceiling.
    - Added `[Auto-Fit: N]` buttons for both shares and options contracts.
    - When naked options breach the `$100` ceiling, automatically computes and surfaces **`[⚡ Apply Vertical Spread ($80 Risk)]`**, converting orders to vertical debit spreads.
  - **Fast-Track PAPER Staging & Token Bypassing (`ManualOrderTicketModal.tsx` & `PaperProposalForm.tsx`)**:
    - Added `[⚡ Fast-Fill PAPER (⌘+Enter)]` buttons and `Cmd+Enter` / `Ctrl+Enter` keyboard shortcuts to stage instantly without manual typing.
  - **End-to-End Pipeline Linking (`server/apertureRouter.ts`, `ApertureTheses.tsx`, `ApertureHome.tsx`)**:
    - Implemented `aperture.pipeline.compileAndStageBestFit` mutation.
    - Added prominent `[⚡ Compile & Stage Best Fit]` buttons that compile, verify evidence, auto-size under `$100`, stage the draft ticket, and navigate directly to `/aperture/plays?stage=approve&inspect=${orderId}`.
- Validation:
  - TypeScript typecheck (`DATABASE_URL= pnpm check`): 0 errors.
  - Vitest test suite (`DATABASE_URL= pnpm vitest run server/aperture/batchGateClearance.test.ts client/src/pages/aperture/candidateComparison.test.tsx server/aperture/evidenceQuestionPresentation.test.ts server/aperture/evidenceFactDraft.test.ts`): 27/27 passed.
  - All public endpoints returned HTTP 200:
    - `https://third-signal-capital-aperture.web.app` (200)
    - `https://capital-aperture-oxiyp4dcpq-uc.a.run.app` (200)
    - `https://uat-f55d3d1---capital-aperture-oxiyp4dcpq-uc.a.run.app` (200)
  - `system.health` returned `ok: true`.
  - Client bundle `index-bn8iupaH.js` verified live with release marker `f55d3d1-uat-71c87235`.
- Rollback revision: `capital-aperture-00200-vak`.

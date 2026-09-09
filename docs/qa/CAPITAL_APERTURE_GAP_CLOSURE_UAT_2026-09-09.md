# Capital Aperture — gap-closure UAT receipt

Date: September 9, 2026. Branch: `codex/aperture-play-desk`.

## Delivery boundary

Implemented and tested locally. No production database migration, Cloud Run deployment, traffic promotion, real broker request, approval, submission, cancellation, or position change was performed. Production readiness is not inferred from this receipt.

The isolated app is `http://localhost:3110/aperture?uat_identity=lenox`. It uses a clearly labeled illustrative user, thesis, and manual paper account. Provider credentials are blank. The database is the existing `sh-ch-capital-uat-db` container, bound to `127.0.0.1:3307/capital_aperture_uat_9c18799`. Container-local root credentials intentionally do not satisfy the application's `uat_app` executable-play fixture gate.

## Architecture and persistence

1. **Drafts:** `aperture.runway.draft` stores raw incomplete inputs and selected section by user. Versioned compare-and-swap writes the head and append-only revision in one transaction. Owner/thesis/paper-account bindings are checked. Conflicts preserve the competing device's saved draft.
2. **Underwriting:** a durable job precedes provider analysis. One active claim per Mission is serialized on the Mission row. Request fingerprints deduplicate; an explicit retry reuses job ID with a new attempt token. Publication rechecks current Mission and measured open risk and is atomic with the immutable result revision. An expired lease needs explicit recovery; this is not a new background worker or guaranteed continuous execution service.
3. **Attention:** Today and Play Desk consume the shared deterministic priority/disclosure result. Only visibility-observed versions are submitted as Seen; per-item merging preserves other devices' history. Seen does not acknowledge or resolve anything.
4. **Evidence/risk:** optional source failures retain unaffected records; no failed read becomes empty success. Missing source facts withhold entries/triggers. Unknown, invalid, or unsafe aggregate risk blocks underwriting. Original execution gates are unchanged.
5. **Read compatibility:** JSON is decoded at the storage boundary and validated, including legacy nested horizon JSON. This fixes serialization without changing the original recorded assumption.

New additive migrations:

- `0063_aperture_mission_drafts.sql`: owner draft heads and append-only revisions.
- `0064_aperture_underwriting_jobs.sql`: durable analysis job identities, lease, attempt, milestone, and result link.

Applied only to the isolated local DB. The older local fixture also needed existing migrations 0060–0062. The missing 0060 instrument-preference column caused a genuine failed-source UAT case; it was repaired locally. Verify deployed schema and apply the new additive migrations before deploying this server. No `db:push` was used.

## Annotated walkthrough: setup and resume

1. Open Mission with the named illustrative account. No default account value is assigned as mission capital.
2. Enter $25,000 capital, optional $6,000 weekly target, and $249 planned-loss input. Choose a horizon and allowed instruments.
3. Leave and return in a second authenticated tab: raw fields and the active section persist. Typing the final input does not move the operator to a new section.
4. Review shows `24% per week required · extreme`. Effective normal-play risk is $187.50, with the policy source beside it: `0.75% × $25,000`. The $750 account ceiling is explicitly not permission to exceed that effective limit.
5. Authorize underwriting once. Real job milestones progress to a persisted result. Missing provider observations yield Sit Out and a sourced-data reopening requirement; no quote or option chain was invented.
6. Reload the saved result: no new job or revision is created by opening it. A disabled duplicate action has a completion receipt and explicit result navigation.
7. An earlier fixture had primary horizon `swing` but underwriting horizons `intraday`. The UI now shows both, explains the mismatch, and offers a draft-only repair. The operator reviews `Today / by close → This week` before authorizing the revised analysis.
8. The new revision records `swing`; the old revision remains `intraday`. Existing broker records remain unchanged.

## Annotated walkthrough: returning check-in

1. Today loads the named paper account without interpreting its unresolved query as an unselected account. Cold-loading behavior also has deterministic rendering/query-guard tests.
2. In a verified quiet fixture, the briefing says no new action was identified **in recorded status**, with a timestamp. It does not imply continuous monitoring.
3. A no-trade result supplies a real reopening condition and an exact result link. With no recorded condition or active work, the system does not invent a monitoring checkpoint.
4. Failed research loading did not produce a false all-clear. The observed raw SQL disclosure was fixed; rendering tests assert that a private SQL sentinel never appears in Today, trigger, or Desk failure messages.
5. Critical dispatch/invalidation issues remain available outside instrument/thesis filters. This is deterministically tested with multiple issues and partial-fill quantities; it was not exercised against a real broker in this run.

## Visual and interaction evidence

Representative screenshots are attached in the Codex execution trace, not presented as user-test results:

- Mobile Today at 390 × 844 CSS pixels: named account, paper mode, scoped quiet state, refresh action, and reopening checkpoint; no page-wide horizontal overflow.
- Mobile completed Mission result: no-trade conclusion and no-ticket receipt; long explanations remain below the primary summary.
- Desktop Mission/review and returning Today: same records and calculations, not a separate workflow.

Keyboard activation of Mission navigation, horizon repair, and the primary underwriting action was exercised. Explicit result navigation was checked, and sticky-header clearance added. Full keyboard-only completion, screen-reader behavior, enlarged text, soft-keyboard occlusion, and OS reduced-motion interaction still require observed UAT. Reduced-motion code paths are present; they are not proof of that UAT.

## Test evidence

- Aperture suite: **911 passed, 2 skipped**, 87 passed test files, 2 skipped. `DATABASE_URL=`; schema/live-DB tests and the separate persistence suite excluded deliberately.
- Real isolated MariaDB journey suite: **4 passed**. Covers concurrent draft saves, owner isolation, one analysis claim, explicit interrupted retry, attempt fencing, per-item Seen merging, completed browser receipt readback, two immutable horizon revisions, and absence of new broker orders during ordinary reads.
- TypeScript check: passed.
- Client Vite and server esbuild production builds: passed. Existing large-bundle warning remains (~4.4 MB main client chunk before gzip); no performance pass is claimed.
- Working diff whitespace check: passed.

Local broker-order baseline: **4 before / 4 after**. Disposable integration-test owners and their exact associated test records were cleaned up. The labeled browser fixture is preserved for further UAT.

Commands (Node 26):

```sh
DATABASE_URL= ./node_modules/.bin/vitest run server/aperture --exclude '**/*Schema.test.ts' --exclude '**/persistedJourneys.integration.test.ts'
DATABASE_URL= ./node_modules/.bin/tsc --noEmit
DATABASE_URL= ./node_modules/.bin/vite build
DATABASE_URL= ./node_modules/.bin/esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
node scripts/with-isolated-capital-uat.mjs --test
```

The last command refuses any database except the exact isolated local target. Its completed-browser-receipt lane requires the labeled two-revision browser walkthrough above; it is not a generic production test runner.

## Files changed

Client:

- `client/src/components/aperture/ApertureShell.tsx`
- `client/src/components/aperture/CapitalCockpitRail.tsx`
- `client/src/components/aperture/DailyPlayList.tsx`
- `client/src/components/aperture/DecisionRunway.tsx`
- `client/src/components/aperture/TodayAttentionBriefing.tsx`
- `client/src/pages/aperture/AperturePlayDesk.tsx`
- `client/src/pages/aperture/ApertureUnderwriting.tsx`

Shared/server/storage:

- `shared/apertureAttention.ts`, `shared/apertureMissionDraft.ts`
- `shared/measuredOpenRisk.ts`, `shared/persistedJson.ts`
- `shared/underwritingJob.ts`, `shared/underwritingPersistence.ts`
- `server/apertureRouter.ts`
- `server/aperture/missionDraftRouter.ts`, `server/aperture/underwritingJobs.ts`, `server/aperture/optionalStatusSource.ts`
- `drizzle/schema.ts`, `drizzle/apertureMissionDraftSchema.ts`, `drizzle/apertureUnderwritingJobSchema.ts`
- the two new SQL migrations listed above

Tests/tooling/docs:

- `server/aperture/apertureAttention.test.ts`, `attentionDisclosure.test.ts`, `attentionPersistenceContract.test.ts`
- `server/aperture/capitalMissionUxContract.test.ts`, `cockpitHydration.test.ts`, `measuredOpenRisk.test.ts`
- `server/aperture/missionDraft.test.ts`, `missionReviewBehavior.test.ts`, `optionalStatusSource.test.ts`
- `server/aperture/persistedJourneys.integration.test.ts`, `paperTicketJourneyClientContract.test.ts`
- `server/aperture/playDeskBehavior.test.ts`, `playDeskClientContract.test.ts`, `todayAttentionBehavior.test.ts`
- `server/aperture/underwritingJob.test.ts`, `underwritingPersistence.test.ts`
- `scripts/with-isolated-capital-uat.mjs`, `scripts/seed-guided-capital-uat.ts`
- `docs/CAPITAL_APERTURE_GUIDED_UX_WALKTHROUGH_2026-09-08.md`, this receipt

Unrelated pre-existing untracked files were not staged or changed.

## Remaining acceptance / release gates

Production/cross-machine authentication and cold network loading need a tagged UAT run after approved migration/deployment. The current provider-free browser fixture proves the no-trade path, not a new positive-quote-to-evidence journey or broker execution. Full touch/keyboard/accessibility and an operator-observed timing study are still unverified. Do not claim the ten-second usability target achieved.

The broader Capital Strategist intent UI, capital-event allocation ledger, and provider-backed discovery expansion remain outside this bounded gap-closure checkpoint, as already recorded in the design document. This patch does not pretend they are implemented.

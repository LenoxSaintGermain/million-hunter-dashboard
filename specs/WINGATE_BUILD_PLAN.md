# Wingate Historic Adaptive Reuse — Build Plan

**Goal:** one reachable, single-page Wingate command experience where the user picks a thesis, runs it, and sees historic assets scored + ranked by the real Historic Adaptive Reuse protocol — with bulk-clear and no app-hopping. Scoring reference: `specs/Historic Adaptive Reuse — ... (Unified Spec).md` (7 dimensions A–G, gates, penalties, bonuses, confidence, rank score, R-codes, SLAs). This plan is the "how we wire it into this codebase."

**State after cleanup (2026-07):** prod fully reset — `deals`, `commercial_assets`, `memos` = 0; 5 `thesis_compilations` preserved. The 3 disconnected "Wingates" (Thesis Engine template, `/wingate` static page, investor DNA) will be unified.

---

## Root causes being fixed
1. No asset↔thesis link → **can't search by thesis.** Fixed by `thesis_compilation_id` on `commercial_assets` + a server search that applies `compiled_filters`.
2. No bulk delete anywhere → **can't clear stale data.** Fixed by `scout.bulkDelete`/`bulkArchive` + `deals.purgeSynthetic`, surfaced in-page.
3. Compiled thesis is a dead-end artifact; "Run" routes RE theses into the SMB scraper → **Thesis Engine not intuitive.** Fixed by an "active thesis" + RE-run path that scores `commercial_assets`.
4. `/wingate` is an orphan (only self-links) with a toy client-side score → **fragmented, shallow.** Fixed by reachable nav + server-side A–G scorer + consolidated page.
5. Synthetic Market Scan rows indistinguishable from real → add `is_synthetic` on `deals`, set in `runScanPipeline`.

---

## Phase A — Schema (migration 0020)
`commercial_assets` additions (all nullable / defaulted — backward compatible):
- `thesis_compilation_id` int — links asset to the thesis it matched/was sourced under.
- `dim_a`..`dim_g` int — A–G sub-scores (0–20/0–15/0–10/0–5 per spec).
- `composite_score` int, `penalties` int, `bonuses` int, `confidence_score` decimal(4,3), `rank_score` decimal(6,3).
- `asset_tier` varchar — tier1 | tier2 | tier3 | archive | fasttrack.
- `market_tier` varchar — A | B | C.
- `disposition_code` varchar — R1..R10 (nullable).
- `verify_fields` json — list of unverified mandatory-critical fields (§11 of spec).
- `historic_inputs` json — qualitative spec inputs not in columns (registerStatus, integrityGrade, significanceHook, shpoStatus, priorHtc, farUtilization, lotCoverage, floorPlateDepth, basisRatio, triplingHeadroom, incentiveCoverage, etc.).
- `scorecard` json — full computed breakdown (narrative, strengths/risks, per-factor detail, source log).
- `is_archived` boolean default false, `archived_at` timestamp — soft-delete for bulk-clear.

`deals` addition:
- `is_synthetic` boolean default false — flags LLM-generated Market Scan rows.

Apply via drizzle-kit generate → migrate (nullable columns safe on the live DB).

## Phase B — Scorer (pure, unit-tested)
- `server/scoring/historicScore.ts` — deterministic A–G scorer: per-dimension factors from asset columns + `historic_inputs`; hard gates (A≥12 ∧ B≥12 for Tier 1); penalties; alpha bonuses (+8 cap); weighted confidence = % of the 5 mandatory critical fields verified; `rankScore = composite × (0.5 + 0.5 × confidence)`; tier assignment (Tier 1/2/3/Archive + Fast-Track SLA); VERIFY tagging; tie-break order; suggested R-code on archive. Missing inputs score conservatively (not midpoint) and add a VERIFY flag. Returns a full scorecard object.
- `server/scoring/marketGates.ts` — seeded gate table for priority markets (Columbus, Indianapolis, Louisville, Nashville, Birmingham, Chattanooga, Greenville, Savannah, Memphis, Kansas City) → market tier A/B; others C. **Metrics are seeded placeholders, labeled as such** until real data is wired (honest-labels directive).
- Vitest coverage against the North-Star archetype (should hit ~90+) and against gate-failing / penalty cases.

## Phase C — Server wiring
- `getCommercialAssets(opts)` — honor `status`, add filters: thesisCompilationId, historic flags, state IN, year/stories/occupancy/capRate/noi ranges, isArchived. (Fixes the currently-ignored status param.)
- `scout.search({ compilationId })` — load thesis `compiled_filters`, build WHERE, score each with historicScore, return ranked.
- `scout.scoreHistoric({ id | all, compilationId })` — run scorer, persist sub-scores/composite/confidence/rank/tier/disposition/verify + scorecard to the row.
- `scout.bulkDelete({ ids | all })` + `scout.bulkArchive` — bulk-clear (confirm token required).
- `deals.purgeSynthetic` / `deals.bulkDelete` — deals cleanup.
- `thesis.setActive` / `thesis.getActive` — persist per-user active thesis (add `is_active` to thesis_compilations). Re-point Thesis Engine "Approve & Run" for RE theses to `scout.scoreHistoric(all, compilationId)` + navigate to `/wingate`, not the SMB scan.
- `runScanPipeline` sets `is_synthetic=true`.

## Phase D — Consolidated `/wingate` command page
Rebuild to the "Thesis Command" shape, all live-data, no bouncing:
- Active-thesis selector + **Run** action (calls scout.search / scoreHistoric).
- Ranked pipeline: Rank Score, Composite, Confidence, A/B gate badges, tier, flag chips, VERIFY tags, disposition, next action + SLA.
- KPI/funnel strip (real counts, aggregate GSF/units/incentive from scorecards).
- Market gate board (seeded, honestly labeled).
- Action queue / escalations (Tier 1 review SLA + Fast-Track).
- Inline detail drawer (full A–G breakdown + source log), inline intake (reuse WingateQuickAdd), **bulk-clear control**.
- Replace fabricated hardcoded disqualifier/evidence panels with the spec's real Hard Stops (§5) + Mandatory Critical Fields (§11).
- **Reachability:** add Wingate to `EditorialTopNav` nav; consider making it the post-login home for a Wingate/investor role.

## Phase E — Thesis Engine ↔ Wingate continuity
- Compiled output editable before run (header already promises it).
- "Active thesis" surfaced; selecting/compiling the Wingate thesis drives the /wingate results grid. One continuous flow: log in → pick thesis → run → results.

## Verification per phase
`pnpm check` (0 TS errors) + `DATABASE_URL= pnpm test` (guard against prod writes) each phase; scorer unit tests in Phase B; end-to-end in preview at the end (add a historic asset → run thesis → see it scored/ranked/gated → bulk-clear).

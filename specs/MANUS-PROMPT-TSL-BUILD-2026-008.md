# Manus implementation prompt — TSL-BUILD-2026-008 / 008A

Implement the next bounded Capital Aperture package from the latest `origin/main`.

## Read first

1. `AGENTS.md`
2. `specs/TSL-BUILD-2026-008_Capital_Aperture_Disclosure_Intelligence_Rail_Spec.md`
3. `specs/TSL-BUILD-2026-008_ACCELERATED_PAPER_PILOT_TEST_PLAN.md`
4. `specs/TSL-BUILD-2026-008A_CAPITAL_OPERATOR_UX_RESEARCH_AND_RECOVERY_ADDENDUM.md`
5. `CAPITAL_APERTURE_PUBLIC_AGENTS_PATTERN_REPORT_2026-08-25.md`
6. `research/public_agents_primary_findings.md`
7. `RESTORED_DATABASE_CAPITAL_UAT_REPORT_2026-08-25.md`

The latest spec and 008A addendum supersede conflicting user-role or UI assumptions in older briefs. Jim and his wife are the same `Capital Operator` user type but must use separate identities.

## Outcome

Deliver two sequential stages:

1. Recover Capital thesis continuity and streamline the current operator journey.
2. Implement WP-DIR1, the Disclosure Intelligence Rail grammar/provenance foundation.

Do not begin Stage 2 until Stage 1 validation passes.

## Stage 1 — continuity and purpose-built operator UX

### Data continuity first

Run a read-only inventory before any database write for these known test theses:

- `Jim Reference — Catalyst Reaction (Paper Trial)` from `scripts/run-jim-catalyst-reference-trial.mjs`.
- `GLP-1 Demand Shock: Food & Health Day-Trading Opportunities` from the versioned immutable walkthrough captures.

Inventory canonical thesis, compilation, sharing, active-thesis, projection, run, evidence, memo, and outcome links. Produce a pre-write manifest with stable ids, owners, visibility, related ids, hashes where available, and row counts.

You are authorized to perform only the scoped recovery described below if the dry run resolves the records and owners unambiguously:

- reconnect surviving records instead of duplicating them;
- recreate only genuinely absent records from the named provenance-backed sources;
- preserve original ownership and authorized sharing;
- record recovery source and timestamp;
- make the operation idempotent and dry-run by default;
- do not backfill performance, outcomes, measurements, or invented timestamps;
- do not modify unrelated users or theses.

If ownership, identity, source fidelity, or a destructive write is ambiguous, stop and report the exact blocker. Do not reset or broadly reseed the database.

Add a post-rebuild validator proving both theses remain visible to their authorized users, do not duplicate, and retain coherent active-thesis/projection/run links.

### Operator journey

This is not a request for a chat UI. Build a structured Capital Operator workspace around:

`Orient → Choose one decision → Verify what matters → Stage on paper or decline → Record the outcome`

Refine the existing components and routes; do not create a parallel app or duplicate server truth.

#### Today / Decision Center

- First viewport shows active thesis, paper account, freshness, one primary decision, status, consequence, and one next action.
- Collapse the cockpit rail by default unless a constraint blocks the current action.
- Rewrite the NVDA concentration warning to say what is blocked and what to do. Acknowledgement records review; it never clears or changes the constraint.
- Show at most three ranked ready/needs-review alternatives plus visible cash/no-trade.
- Keep one primary CTA in the decision band.

#### Candidate decision

- Do not use all 57 candidates as primary horizontal navigation.
- Show the lead, up to two meaningful alternatives, grouped remainder counts, then search/filter for all candidates.
- First fold contains only status, one-sentence thesis fit, trigger/state, planned loss dollars + percent + ceiling, invalidation/time stop, highest-priority blocker, and one next action.
- Keep full recipe math, evidence, memo, alternatives, and exposure details progressively disclosed.

#### Evidence resolution

- Present one unresolved decision-critical question at a time.
- Keep plain-language question, why it matters, source/provenance, answer, note, and readiness consequence together.
- Use `Confirmed`, `Not confirmed`, `Not applicable`, and `Need more evidence`.
- Do not force a separate source-record journey before answering.
- Trailing P/E and price-to-sales must not block an intraday play unless the thesis explicitly makes valuation decision-critical.

#### Thesis Workspace

- Separate `Saved theses` from `New thesis`.
- Restore the two known test theses to the proper authorized saved views.
- Do not reserve a large empty strategist panel before input exists.
- Keep Acquisition, Property, and Capital / Trade scopes, explained as destinations.
- Remove the Operator-tier upsell from the core creation journey.

### UX research and proof

Before visual polish, create low-fidelity wireframes for Today, Candidate decision, Evidence resolution, and Saved/New Thesis. Test them with two separate `Capital Operator` identities. Record task completion, hesitation, wrong turns, backtracks, and explanation requests. Incorporate findings before final UI.

Use existing `--sh-*` tokens and the current editorial identity. Apply compact hierarchy, tabular financial numerics, scarce accent, surface levels, progressive disclosure, and one primary action per decision band. Do not copy external brand tokens or add a new dependency.

Validate at 375, 768, 1024, and 1440 pixels with no horizontal overflow, visible keyboard focus, reduced-motion support, screen-reader labels, and at least 44px touch targets.

## Stage 2 — WP-DIR1 only

Implement the grammar and provenance foundation from the 008 spec:

- `DisclosurePlanV1` compile/normalize/revision lifecycle;
- `DISCLOSURE_MANDATE_V1` with 45-day max lag, $15,001 minimum disclosed-range floor, 25 observations per plan/day with visible overflow, exact automatic resolution, equities/ETFs only, and tighten-never-loosen behavior;
- House Clerk plus frozen official-source fixture adapters;
- immutable content-addressed raw-document storage outside TiDB with hashes, sizes, parser versions, and retrieval history;
- separate transaction, filing/publication, first-observed, retrieval, and `eligibleFrom` timestamps;
- amendment, duplicate, amount-range, entity-resolution, alias, collision, and hold gates;
- migration prefix assigned at implementation time using max existing + 1.

Before adding the disclosure migration, reconcile the remaining duplicate prefix `0024` and add a repository test that fails on duplicate numeric migration prefixes. The old `0044` order-intent collision is already resolved as `0050_order_intent.sql`; do not undo that repair.

WP-DIR1 ends at a reviewable compiled plan and one provenance-complete official House fixture normalized through the gates. Do not implement autonomous monitoring-to-order behavior, WP-DIR2 promotion UI, WP-DIR3 paper studies, Senate ingestion, options, multi-leg strategies, scoring uplift, committee weighting, or public performance claims in this package.

Any future Disclosure Rail UI must inherit the Stage 1 operator hierarchy. Do not create a chat transcript, agent marketplace, or ticker-to-buy feed.

## Non-negotiable safety

- Paper-only remains structural: keep `assertPaperOnly()`, the Alpaca Paper endpoint, and `liveTrading: false`.
- Plan approval is research approval, never trade approval.
- Compile, approve-plan, refresh, pause, review, resolve, reject, track, and promote must create zero broker orders.
- Unknown or missing primary-source facts fail closed with visible reasons.
- Do not read, print, modify, stage, or commit `.env` or secrets.
- Never run bare tests. Use Node 22+ and `DATABASE_URL= pnpm test`.
- Preserve unrelated local/worktree changes.

## Required validation

1. `pnpm check`.
2. Focused tests for recovery idempotence, owner scope, active-context coherence, migration-prefix uniqueness, plan compilation, mandate tightening, provenance, lag/look-ahead, entity ambiguity, amendments, duplicates, overflow, and zero broker writes.
3. Full suite with `DATABASE_URL= pnpm test`.
4. Authenticated browser UAT for both Capital Operators across the Stage 1 journey.
5. Network-blocked deterministic Disclosure fixture replay.
6. Explicit database and broker-order audit proving no unrelated user data changed and no order was created, approved, submitted, canceled, filled, or closed.

## Delivery

Commit and push focused changes to `origin/main` only after validation. Publish only to the existing owner/UAT Manus environment after the commit is pushed and revalidate the live routes; this is not authorization for a public marketing release.

Report back with:

- branch and commit;
- pre-write and post-write recovery manifests;
- exact recovered thesis ids and provenance sources;
- files and migrations changed;
- before/after screenshots of the four target screens;
- two-operator task-observation notes;
- typecheck, focused-test, full-test, responsive, accessibility, and zero-network results;
- build/revision/URL if published to owner UAT;
- explicit database-change and broker-order statement;
- remaining risks and the next unimplemented work package.

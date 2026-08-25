# TSL-BUILD-2026-008 — Accelerated Pre-30 Paper Pilot Test Plan

**Status:** PROPOSED — test design only; build and pilot activation are not authorized

**Date:** 2026-08-25

**Decision owner:** Lenox

**Test users:** Jim and his wife, both `Capital Operator`, separate identities

**Environment:** restored-data continuity audit, deterministic local fixtures, and Alpaca Paper only

> The fastest valid test is not 30 forced trades. It is deterministic system qualification followed by gated paper use as eligible setups appear. No live brokerage endpoint, autonomous order, public claim, or inferred performance edge is permitted.

## 1. Test decision

Start testing before 30 closed trades. Preserve the existing scorecard meanings:

- fewer than 30 closed disclosure-sourced paper trades: **process-only** evidence;
- 30–99: **indicative**, not proof of edge;
- 100 or more: potentially edge-capable only under a separately approved evaluation protocol.

The pre-30 question is whether the rail is safe, understandable, provenance-complete, and useful enough to widen research without weakening Capital Aperture's paper controls. It is not whether congressional disclosures outperform.

## 2. Fast path

### Phase 0 — thesis continuity and journey baseline (target: 1–2 working days)

Follow `TSL-BUILD-2026-008A_CAPITAL_OPERATOR_UX_RESEARCH_AND_RECOVERY_ADDENDUM.md` before building the disclosure UI.

1. Inventory the canonical thesis, compilation, share, active-thesis, projection, run, evidence, memo, and outcome links for `Jim Reference — Catalyst Reaction (Paper Trial)` and `GLP-1 Demand Shock: Food & Health Day-Trading Opportunities` using read-only queries.
2. Produce a pre-write recovery manifest and review it before any mutation.
3. Reconnect surviving records or recover only genuinely absent records from the named source artifacts through an idempotent, dry-run-first path.
4. Verify saved-thesis visibility and active context under the intended owners without widening access.
5. Observe both Capital Operators completing the current journey and record wrong turns, backtracks, hesitation, and explanation requests.

**Exit:** both test theses are visible and nonduplicated, active context is coherent, recovery is repeatable, no measurements/outcomes are backfilled, and a baseline task-observation record exists.

### Phase A — deterministic qualification (target: 2–3 working days after implementation)

Run with network and broker writes blocked.

1. Build a frozen corpus of provenance-complete official House PTR documents covering normal filings, amendments, duplicates, unsupported assets, ambiguous entities, late disclosures, and exact entity matches.
2. Replay each document through retrieval manifest → immutable storage → parser → normalization → eligibility gates → evidence queue.
3. Prove that `eligibleFrom` never precedes authoritative publication or conservative `firstObservedAt`.
4. Prove compile, approve-plan, refresh, pause, review, resolve, set-aside, and promote actions create zero broker-order rows and zero broker calls.
5. Prove every held, rejected, and overflow observation remains visible with a reason.

**Exit:** all critical automated tests pass; no gate bypass, silent drop, look-ahead, mutable source overwrite, or broker write is observed.

### Phase B — two-operator UAT (target: 1–2 working days)

Jim and his wife run the same scripts under separate `Capital Operator` identities.

Each operator must complete:

1. Describe and compile one plan.
2. Detect and correct one compiler assumption before approval.
3. Review one provenance-complete observation.
4. Hold one ambiguous mapping and resolve one exact mapping.
5. Promote one observation into an existing thesis without creating an order.
6. Set aside one candidate and record the reason.
7. Prepare one Alpaca Paper proposal, pass the existing preflight, type `PAPER`, approve, submit, and close it.
8. Hand one in-progress item to the other operator and verify the audit history identifies both actors.
9. Switch between the two recovered test theses and verify thesis name, account context, risk rail, candidate queue, and brief defaults update together.
10. Complete one decision-critical question from a single surface containing the question, reason, source, answer, and readiness consequence.

**Exit:** both operators complete the journey without assistance on the second run; no shared account is used; every material action is attributable; neither operator must explain the screen to the other.

### Phase C — accelerated paper cohort (start immediately after A and B pass)

- Admit only setups that independently satisfy the existing `MANDATE_V2` and paper preflight. A disclosure may add cited evidence; it may not be the sole trade trigger or increase sizing.
- Target up to three qualifying closures per market day for planning purposes, never as a quota. Record `cash/no-trade` when nothing qualifies.
- Use short, predefined test horizons only when they already fit the approved play recipe. Do not shorten a thesis merely to produce a closure.
- Review the cohort at 5, 10, 20, and 30 closed disclosure-sourced paper trades.
- Continue logging all held, set-aside, deferred, overflow, and cash decisions so the denominator is visible.

At two to three eligible closures per market day, 30 may be reached in roughly 10–15 market days after qualification. This is a planning range, not a promise; safety gates take precedence over speed.

## 3. Checkpoints and decisions

| Checkpoint | What can be concluded | Go criteria | Required response if failed |
| --- | --- | --- | --- |
| 0 closed | System and fixture qualification only | Critical suite passes; zero broker writes; provenance and lag gates hold | Stop pilot activation and repair |
| 5 closed | Operational path works under real paper lifecycle | Both operators complete; audit complete; no gate bypass | Pause new proposals and triage |
| 10 closed | Workflow is repeatable and handoffs are usable | No unresolved critical defect; reasons and no-trades visible | Revise UX/gates; replay fixtures |
| 20 closed | Reliability is stable enough to approach indicative sample | No source overwrite, silent loss, or identity ambiguity | Freeze cohort; investigate data integrity |
| 30 closed | First indicative process baseline | Complete outcomes and denominators; windows keyed to `eligibleFrom` | Report process-only if cohort integrity is incomplete |

No disclosure-versus-nondisclosure performance comparison is allowed until each cohort has at least 30 closed paper trades. Even then, label the result indicative.

## 4. Test coverage

### Unit and property tests

- `DisclosurePlanV1` compilation, ambiguity, versioning, and pause/edit behavior.
- `DISCLOSURE_MANDATE_V1` defaults and tighten-never-loosen rules.
- Lag, publication time, `eligibleFrom`, amount-range preservation, overflow, deduplication, amendment lineage, and hold reasons.
- Observation-specific mapping, separately confirmed alias creation, revocation, and collision handling.
- Content hashes, immutable object paths, parser versions, and changed-byte versioning.
- Duplicate migration-prefix detection before any disclosure migration.
- Thesis-recovery idempotence, owner scope, active-context coherence, and post-rebuild continuity.

Target 100% branch coverage for deterministic eligibility and safety gates. Broader repository coverage is secondary.

### Integration and contract tests

- Official House fixture → raw object → normalized transaction → gate snapshot → review queue → promoted evidence.
- Same `Capital Operator` authorization contract for both users, with distinct actor ids in every audit record.
- Promoted evidence enters the existing thesis/run contract and cannot write an order.
- Paper proposal continues through the existing `preflightOrder()` and Alpaca Paper-only adapter.
- Test commands run with `DATABASE_URL=` so the production TiDB database cannot receive test data.

### End-to-end and exploratory tests

- Describe → Normalize → Review → Monitor → Promote → Paper preflight → typed `PAPER` → approve → submit → close → scorecard.
- Network-disabled deterministic walkthrough.
- Concurrent review, stale revision, duplicate click, session expiry, resume, and operator handoff.
- Mobile/desktop review of source provenance, hold reason, next action, and irreversible-action copy.
- Purpose-built journey checks at 375, 768, 1024, and 1440 pixels: one primary decision/action in the first viewport, compact risk summary, progressive evidence disclosure, and no chat-primary interaction.

### Language review

Automated text scans look for prohibited copy-trading, insider, conflict, guaranteed-return, recommendation, and alpha claims. Recommendation: Lenox performs the human product-language sign-off for the internal pilot. A future public launch should add separately scoped legal/compliance review; automated matching is never the final sign-off.

## 5. Required telemetry

For every observation and paper proposal, capture:

- source id, content hash, parser version, retrieval time, publication time, transaction time, `firstObservedAt`, and `eligibleFrom`;
- plan id/revision, mandate version, gate result, hold/set-aside/overflow reason, and entity-resolution basis;
- actor id and timestamp for compile, approval, review, resolution, promotion, preflight, paper approval, submit, cancel, and close;
- preflight snapshot, paper order lifecycle, predefined horizon, close reason, and scorecard classification;
- fixture, deterministic, or paper source label.

## 6. Hard stop conditions

Stop the pilot immediately if any of these occur:

1. A live broker endpoint or credential is selected.
2. An order is created without the existing human preflight, typed `PAPER` acknowledgement, approval, and submission steps.
3. A result window uses information before `eligibleFrom`.
4. A source object is overwritten, loses its hash, or cannot be reproduced from its manifest.
5. An unresolved entity, unsupported asset, missing primary source, or unknown required date reaches promotion.
6. An observation or error disappears without a visible disposition.
7. An audit action cannot be attributed to Jim or his wife separately.
8. Any test writes to the production TiDB database.
9. A recovery step deletes, overwrites, duplicates, reassigns, or broadens access to an existing thesis or backfills historical outcomes/measurements.
10. The UI presents a risk constraint without its active thesis/account context or makes acknowledgement appear to clear the constraint.

## 7. Minimum report at each checkpoint

- eligible, held, set-aside, deferred, overflow, promoted, cash/no-trade, open, and closed counts;
- critical defects, gate-bypass attempts, source changes, and operator confusion;
- median time from observation eligibility to review and from review to disposition;
- paper lifecycle exceptions and preflight failures;
- explicit statement of allowed inference: process-only before 30, indicative at 30–99, and no edge claim.

## 8. Authorization sequence

1. Confirm Lenox as internal prohibited-language reviewer.
2. Run the read-only Phase 0 inventory and review its recovery manifest.
3. Authorize only the scoped Phase 0 reconciliation/recovery writes.
4. Authorize WP-DIR1 implementation after continuity, fixture-provenance, and migration-registry safeguards are ready.
5. Run Phase A and publish its evidence packet.
6. Authorize Phase B only if Phase A passes.
7. Authorize Phase C only if both operators pass Phase B and paper-only configuration is reverified.

Nothing in this plan authorizes live trading, production activation, public release, or performance marketing.

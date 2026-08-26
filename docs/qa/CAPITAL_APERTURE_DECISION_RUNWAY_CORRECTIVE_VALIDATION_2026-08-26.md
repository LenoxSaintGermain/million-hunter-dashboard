# Capital Aperture — Decision Runway Corrective Validation

**Date:** 2026-08-26
**Starting checkpoint:** `e31bf3f3`
**Corrective branch:** `codex/decision-runway-hardening`
**Release posture:** Code complete for review. Migration not applied. Not merged or deployed.

## Why this correction exists

Owner review found that the first production checkpoint did not match its evidence report:

- the UI created a latest mission record, started a research run separately, and attached the two asynchronously;
- cash records with no run could not activate run-scoped proposal guards;
- mission records could be deduplicated by wording and later rebound or mutated;
- cash was checked in the router only at preflight and proposal creation, not approval and submission;
- the Mission Library was static and assigned theses did not populate the Capital Mission;
- conditional, cash, and outcome workflows were largely presentation states.

The earlier validation report is marked superseded. Existing `aperture_runway_states` records remain labeled legacy evidence; no event history is fabricated for them.

## Corrective contract delivered

| Area | Corrective behavior |
|---|---|
| Exact binding | A Decision Run binds owner, canonical thesis, Capital projection, paper account, immutable revision, and research run. Research run creation and binding occur in one transaction. |
| Immutable history | Mission edits and later cash/conditional decisions append revisions. Arbitrary `attachRun` and mutable `setBranch` procedures are retired. |
| Order safety | The authoritative order service checks Decision Run state at preflight, proposal creation, approval, and submission. Proposal and lifecycle writes lock the same Decision Run head used by cash/conditional revisions. A revision cannot overtake a submitted broker dispatch until its response is persisted. Ambiguous transport failures retain the lease and reconcile through a stable client order ID rather than being mislabeled rejected. Unbound and legacy research runs are research-only and fail closed for opening exposure. Cash and unresolved conditions also block opening exposure. A proven close remains possible. |
| Contextual missions | Mission options are ranked from active thesis, capital, horizon, paper-account freshness, and concentration. Readiness remains separate from rank. Unverified catalyst context is labeled conditional. |
| Operator UI | Assigned thesis auto-populates the mission. Missing thesis can be built inline. Money is grouped and editable. Tune controls remain compact. The page preserves one primary mission question instead of a chat transcript or always-open form. |
| Play Slate | One lead plus two alternatives remain visible. The remainder is grouped. Every candidate reads the receipt for its own research run; cash, conditional, and unbound receipts disable that candidate's paper ticket without suppressing unrelated runs. |
| Outcomes | Submitted authoritative paper work queues a human outcome review at the declared horizon. Conditional gates queue their own review. Nothing exits automatically. |

## Database ledger

Migration `0055_aperture_decision_runway_authority.sql` is additive:

- `aperture_decision_runs` — exact mutable head and run binding;
- `aperture_decision_revisions` — append-only operator revisions;
- `aperture_pending_outcomes` — horizon and gate review queue;
- `broker_orders.decision_run_id` and `decision_revision_id` — exact proposal receipt;
- `broker_orders.client_order_id` and `dispatch_error` — idempotent ambiguous-dispatch reconciliation without unsafe resubmission.

The migration does not insert into or update `aperture_runway_states`. It was **not applied** during this corrective run because the configured `.env` targets production TiDB and no database-write authorization was given.

## Validation receipts

| Check | Result |
|---|---|
| `pnpm check` | Passed. |
| Focused Decision Runway, order-flow, and mandate tests | 121 passed. |
| New corrective tests | 13 passed across the Decision Runway and schema suites: lifecycle refusal, missing-authority fail-close, dispatch/revision serialization, binding mismatch, contextual ranking, horizon queue timing, schema and lifecycle seams. |
| `pnpm build` | Passed. Existing large-chunk warning remains. |
| `git diff --check` | Passed. |
| `DATABASE_URL= pnpm test` | 697 passed, 30 failed, 8 skipped. The failures are existing DB/API-dependent suites that require a database URL or provider key; they did not exercise the new Runway module. |

## Explicit no-order and no-production-write statement

No broker order was created, approved, submitted, modified, mirrored, cancelled, or closed. No production database migration or UAT mutation was performed. Dependency installation, compilation, build output, and local tests were the only runtime effects.

## Remaining release gates

1. Review and apply migration `0055` to an isolated or explicitly authorized environment.
2. Run authenticated owner-scoped UAT for Lenox and Jim across assigned-thesis, inline-thesis, cash, conditional, research, and queued-outcome paths.
3. Capture 375, 768, 1024, 1162, and 1440 width evidence after the migrated app is running.
4. Prove a cash revision recorded after proposal creation blocks approval and submission while a proven closing order remains available.
5. Confirm zero broker orders and inspect only test-created Decision Run/revision/outcome rows before merge or deployment.

## Concurrency boundary

The serialized authorization point for submission is the database transition to `submitted`, under the same Decision Run row lock used by a new revision. The implementation deliberately does not hold a database transaction open across the broker network call. A revision committed first blocks a stale submission. When submission commits first, the `submitted` row with no broker order ID acts as a durable dispatch lease: a locking/current read prevents a new disposition until the broker response is persisted. A transport failure keeps that lease and the monitoring path reconciles through the pre-persisted client order ID. This ordering must be exercised during isolated UAT, including recovery of a dispatch left unresolved by process interruption.

The close-only path is intentionally separate: a verified closing intent may reduce existing paper exposure even when the current branch is cash or conditional. It cannot be used to open or increase exposure.

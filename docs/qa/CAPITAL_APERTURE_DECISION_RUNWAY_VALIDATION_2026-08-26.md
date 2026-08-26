# Capital Aperture — Decision Runway Validation

> **Superseded by the corrective validation report dated 2026-08-26.** Review after checkpoint `e31bf3f3` found that asynchronous latest-state attachment, mutable branches, and router-only cash checks did not satisfy the stated safety contract. Do not use this earlier report as release evidence.

**Build window:** 2026-08-26 UTC  
**Scope:** Approved production Decision Runway contract.  
**Release posture:** Implementation complete; saved for owner review only. No independent deployment or merge action was performed.

## Contract Delivered

The production Decision Center now follows the bounded operator sequence:

> **Orient → Choose one decision → Verify what matters → Stage on paper or decline → Record the outcome.**

The implementation uses production `Capital Mission`, `Aperture Run`, play-slate, account, and mandate contracts. The fixture-only Decision Runway prototype path specified by the brief is absent from `origin/main`; no fixture state was promoted into production.

| Requirement | Evidence |
|---|---|
| One dominant mission | Durable owner-scoped `aperture_runway_states` table and `runway` procedures store source thesis, mission text, branch, rationale, selected run, and timestamps. |
| No-trade is explicit | A durable `cash` branch records a stated rationale. It has no candidate, proposal, or broker path. |
| Conditional is distinct | A separate `conditional` branch is visible and durable, with no false claim that a trigger is satisfied. |
| Play slate remains compressed | Existing Today queue is preserved as lead decision + alternatives, with cash/no-trade states and a deliberate route to broader research. |
| Active context is visible | Mission source and active thesis are shown without changing an owner’s active thesis, account, rules, or evidence gates. |
| Fail closed | Both `paperOrderProposal.create` and preflight block a run linked to a cash Decision Runway state. |

## Recovery and Ownership

The existing Stage 1 recovery was reconfirmed before this build. The recovery script remains dry-run by default and owner-scoped when explicitly applied.

| Operator | Canonical context | UAT result |
|---|---|---|
| Lenox Saint Germain (`user_id=1`) | Jim Reference — Catalyst Reaction (Paper Trial) | Context, paper account, single-decision mission, cash branch, and source library rendered. |
| Jim Butler (`user_id=7470015`) | GLP-1 Demand Shock: Food & Health Day-Trading Opportunities | Owner-scoped GLP-1 context rendered; no Lenox context or account was exposed. |

The temporary `LOCAL_PREVIEW_OPENID` seam was used only in isolated development servers on ports 3001 and 3002. It was removed before final validation: `grep -c LOCAL_PREVIEW_OPENID server/_core/context.ts` returned `0`; no isolated UAT listener remained.

## Responsive and Accessibility Evidence

The Decision Center was captured at all required widths. The shell moves from the wide workspace to two-panel composition and then a stacked mobile layout without horizontal overflow.

| Viewport | Observed result |
|---|---|
| 375 × 812 | Single-column stack; mission, cash branch, and mission library remain reachable. |
| 768 × 1024 | Stacked workspace; operating context remains visible before Today queue. |
| 900 × 1024 | Compact two-panel decision workspace. |
| 1024 × 1024 | Active context sits beside orient; controls remain visible. |
| 1162 × 1024 | Wide mission and library panels preserve a constrained, legible line length. |
| 1280 × 1024 | Two-column mission/library composition and compressed play slate render. |
| 1440 × 1024 | Full workspace renders without widening text into unreadable measure. |

Keyboard inspection found the mission textarea, mission-library button, cash rationale textarea, and cash-record control in the normal focusable control list. No horizontal keyboard trap or hidden overflow was observed.

## Validation

| Check | Result |
|---|---|
| `pnpm check` | Passed — clean TypeScript. |
| `DATABASE_URL= pnpm test` | **727 passed, 4 skipped** across 82 test files. |
| Broker orders | **0** rows before and after UAT. |
| Recorded play outcomes | **0** rows created by Decision Runway UAT. |
| Runway-state rows | **0** UAT-created rows; controls were inspected without writing a test decision into either owner’s history. |
| Related users | No runway state outside Lenox/Jim ownership scope. |

## Database Change Ledger

One additive migration was applied:

| Migration | Change | Existing data impact |
|---|---|---|
| `0054_aperture_decision_runway_state.sql` | Creates the owner-scoped durable Decision Runway mission/branch state table and supporting indexes. | None. No outcome, account, holding, existing run, or broker-order row was modified. |

## Explicit Broker-Order Statement

**No broker order was created, approved, submitted, modified, mirrored, or cancelled.** The build only added a stricter fail-closed check: a cash Decision Runway branch prevents linked-run paper-order preflight and proposal creation.

## Owner Review Boundary

This change is ready for owner review. It has not been independently deployed or merged. Any later release should preserve the stated paper-only, human-approval, evidence-gated, and fail-closed boundaries.

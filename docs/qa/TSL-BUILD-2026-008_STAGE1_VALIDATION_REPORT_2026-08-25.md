# TSL-BUILD-2026-008 — Stage 1 Validation Report

**Status:** Passed. This report is the explicit gate authorizing bounded WP-DIR1 work. All observations below were made on **2026-08-25** against the restored owner/UAT environment.

## Scope and Boundary Statement

Stage 1 recovered only two source-faithful Capital thesis pairs and refined the Capital Operator journey around **Orient → Choose → Verify → Stage or Decline → Record**. The recovery created no historical run, outcome, measurement, sharing, broker order, approval, or submission record. The Paper-only and human-approval constraints remained intact.

| Guardrail | Evidence | Result |
|---|---|---|
| Owner scope | Canonical compilation and Capital projection were joined by owner ID and exact source text hash. | Passed |
| Idempotency | The recovery script was run once in dry-run mode, once in apply mode, and once again in apply mode; no duplicate rows were created. | Passed |
| Active-context correctness | `users.active_capital_thesis_id` points to each owner’s **canonical compilation**, not the linked projection. | Passed |
| No outcome backfill | `aperture_play_slate_items` created during Stage 1: **0**. | Passed |
| No broker-order activity | `broker_orders` created during Stage 1: **0**. | Passed |
| No cross-owner visibility grant | `thesis_shares` rows for the recovered compilations: **0**. | Passed |
| Local UAT seam | `LOCAL_PREVIEW_OPENID` count: **0** in `server/_core/context.ts`, project `.claude/launch.json`, and home `.claude/launch.json` after UAT. | Passed |

## Thesis Recovery Manifest Result

The source inventory and no-write decision are preserved in [the Stage 1 pre-write recovery manifest](./TSL-BUILD-2026-008_STAGE1_PREWRITE_RECOVERY_MANIFEST_2026-08-25.md). The approved recovery created the following canonical/projection pairs.

| Owner | Canonical compilation | Capital projection | Thesis | Source fidelity |
|---|---:|---:|---|---|
| Lenox Saint Germain (`user_id=1`) | `360001` | `60001` | *Jim Reference — Catalyst Reaction (Paper Trial)* | SHA-256 `24b74c554e67c4e64de766072e11c9cd22a4444aa3ca0adae1ad0b4f6b242508`; source script explicitly bound `USER.id=1` |
| Jim Butler (`user_id=7470015`) | `360002` | `60002` | *GLP-1 Demand Shock: Food & Health Day-Trading Opportunities* | SHA-256 `f602b9eb4d61934a27c8941c7147d3a20d484336265a2e4630012b18fcf10c08`; verbatim text and owner mapping supplied by Lenox |

The recovery script sets a user’s active Capital context **only** when it is null or points at the just-recovered projection, and then stores the canonical compilation ID. It does not overwrite a distinct existing context.

## Capital Operator Journey Validation

The Stage 1 journey now presents the operator’s current decision before breadth-first research.

| Journey point | Implementation evidence |
|---|---|
| **Orient** | Today shows active thesis, Paper-account label/freshness, operating state, and the compact Cockpit Rail constraint consequence. |
| **Choose one decision** | Today renders the lead decision plus two alternatives; broader research is behind an explicit reveal. Cash is presented as a visible control outcome. |
| **Verify what matters** | Candidate review starts with one decision-critical question, source excerpt/provenance, an optional note, and explicit answer states: Confirmed, Not confirmed, Not applicable, or Need more evidence. |
| **Stage or decline** | A confirmed/not-applicable answer may clear a gate; a not-confirmed answer closes the question but declines the current paper stage; follow-up remains open. No answer creates an order. |
| **Record** | Review records remain scoped to operator/run/candidate/question and preserve legacy `reviewed` rows without rewriting them. |

## Two-Operator UAT Evidence

| Operator | Route | Observed result | Safety result |
|---|---|---|---|
| Lenox (`user_id=1`) | `/aperture`, `/aperture/theses` | Decision Center resolved *Jim Reference — Catalyst Reaction (Paper Trial)* as the active thesis. Paper account and tightest-concentration consequence remained visible. Saved Theses showed the recovered context and no historical backfill. | Paper-only state remained visible; no proposal or order was created. |
| Jim Butler (`user_id=7470015`) | Isolated `/aperture`, `/aperture/theses` preview using a temporary development-only identity seam | Decision Center resolved only *GLP-1 Demand Shock: Food & Health Day-Trading Opportunities*. With no Paper account, it correctly showed the cash/no-play outcome rather than manufacturing a trade. Saved Theses displayed only Jim’s recovered context. | Fail-closed on unknown equity/account; no order path invoked. Temporary seam removed immediately after capture. |

### Capture Set

| Capture | Local path | What it demonstrates |
|---|---|---|
| Before active-context correction | `/home/ubuntu/screenshots/webdev-preview-aperture-1787688120659718648-2258.png` | Decision Center banner showed no assigned Capital/Trade thesis before canonical handoff repair. |
| After Lenox recovery | `/home/ubuntu/screenshots/webdev-preview-aperture-1787688211005475268-8961.png` | Decision Center resolved the recovered active context; Saved Theses route was wired. |
| Jim Today | `/home/ubuntu/screenshots/3001-iye9nrxq3r2kjlj_2026-08-25_20-05-32_9615.webp` | Jim’s GLP-1 active context and fail-closed no-account cash outcome. |
| Jim Saved Theses | `/home/ubuntu/screenshots/3001-iye9nrxq3r2kjlj_2026-08-25_20-05-50_5704.webp` | Owner-scoped saved thesis list with the verbatim GLP-1 source and no cross-owner records. |

## Validation Commands

```text
pnpm check
DATABASE_URL= pnpm test
```

The final database-backed run passed **78 test files / 719 tests**, with **2 test files / 4 tests skipped** by their own existing conditions. The focused evidence-readiness suite passed **5/5**, including the new confirmed, not-applicable, not-confirmed, and follow-up consequences.

## Gate Decision

> **Stage 1 passed.** WP-DIR1 may begin only as the bounded disclosure grammar and provenance foundation described in the implementation contract. The next stage must not add copy trading, autonomous brokerage action, outcome backfill, or unverified disclosure-performance claims.

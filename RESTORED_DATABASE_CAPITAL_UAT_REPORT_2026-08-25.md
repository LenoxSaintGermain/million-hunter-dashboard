# Restored Database — Capital Aperture UAT Verification

**Verification date:** 2026-08-25  
**Scope:** Restored database reconciliation, scheduled Capital callbacks, Jim UAT fixture, Alpaca Paper read-only synchronization, and no-order UAT health checks.  
**Safety boundary:** No broker order was created, approved, or submitted during this work.

## Executive Status

| Area | Status | Evidence |
|---|---|---|
| Capital migration reconciliation | **Complete** | Required schema objects from the restored migration set are present; migration runner is repeatable. |
| Duplicate `0044` migration number | **Resolved** | `0044_order_intent.sql` renamed to `0050_order_intent.sql`; `0044_active_capital_thesis.sql` remains unchanged. |
| Jim Capital UAT fixture | **Complete** | Provisioner and fixture validator passed. |
| Alpaca Paper read-only connectivity | **Complete** | External account-endpoint Vitest passed after credential correction. |
| Alpaca Paper current account snapshot | **Complete** | Read-only validator synchronized seven positions and persisted a current snapshot. |
| Frozen walkthrough UAT | **Complete** | Both versioned captures rendered; authenticated replay completed Today → One play → Trigger. |
| Investor gate / scorecard regression | **Complete** | 41 focused tests passed; investor-shell source contains no Aperture navigation entry. |
| Scheduled callback success | **Partially complete** | Recovered account sync returned HTTP `200` and persisted its result. Daily outcome refresh remains pending its next post-publish run. |

---

## 1. Migration State

### Reconciliation result

The restored database was checked against the Capital migration set. The required objects from the `0032`–`0049` sequence are now present. The restoration also revealed fixture/provisioning prerequisites from `0029`–`0031`; these were applied only as nullable, additive prerequisites because the Jim fixture depends on canonical thesis sharing and a default workspace.

| Migration area | Result |
|---|---|
| `0029_canonical_thesis_bridge` | Nullable canonical-thesis bridge present. Its superseded transient index is intentionally not recreated. |
| `0030_thesis_workspace_sharing` | Shared thesis table and final canonical/source composite uniqueness present. |
| `0031_default_workspace` | Default workspace support present. |
| `0032`–`0043` | Risk gates, evidence reviews, intraday recipe, scorecard, cockpit, defer/resume, play-side, workspace, rail, and acknowledgement schema reconciled. |
| `0044_active_capital_thesis` | Present. |
| `0045_play_outcome_ledger` | Present. The later `0046` file is documented by the runner as superseded by the final `0045` definition and performs no duplicate DDL. |
| `0047_daily_outcome_refresh_schedule` | Schedule-binding columns present. |
| `0048_one_time_glp1_research_schedule` | One-time research binding/status columns present. |
| `0049_paper_account_sync_schedule` | Paper-account schedule binding/result columns present. |
| Former duplicate `0044_order_intent` | Renumbered to **`0050_order_intent.sql`** and reconciled. |

### Changes made

The repository now includes `scripts/apply-restored-capital-migrations.mjs`. It applies the restoration-safe migration chain in dependency order, skips already-present additive objects, leaves all nullable measurement fields null, and exits deterministically after closing its database connection. A repeat run completed without conflict.

> **No historical measurement values were backfilled.** The only fresh financial values written were from the requested live, read-only Alpaca Paper synchronization, so they are correctly timestamped as current measurements.

---

## 2. Scheduled Jobs

All three Heartbeat jobs remain registered with the platform and use the expected `/api/scheduled/*` callback paths.

| Job | Platform state | Latest observed result | Action taken |
|---|---|---|---|
| `capital-paper-account-sync-1-recovered-20260825` | Enabled; 15-minute callback | **HTTP `200`** at `2026-08-25T14:55:36Z` (1,595 ms) | Replaced the stale schedule, bound the new task to the Paper account, and confirmed it persisted a seven-position sync result. |
| `capital-daily-outcome-refresh-1` | Enabled; daily 22:15 UTC callback | `404` at `2026-08-24T22:18:07Z` | Restored the owner-level task binding and enabled flag. |
| `capital-one-time-glp1-research-*` | **Paused** after its one-time completion | `200` at `2026-08-21T14:08:14Z` | Paused intentionally to prevent an unintended annual rerun. |

### What remains unverified

The recovered account-sync callback is now healthy. Its persisted account record shows a fresh scheduled timestamp, no error, and `Synced 7 position(s) from alpaca_paper; paper account context only.` The daily outcome callback’s most recent result remains the pre-publish `404` at `2026-08-24T22:18:07Z`; its route now resolves to the expected cron-cookie `403` when probed without scheduler authorization, but the next real scheduled execution has not yet occurred.

**Required final observation:** confirm one post-publish daily outcome callback returns HTTP `200` after its next scheduled run. No order activity is involved.

---

## 3. Jim Fixture and Alpaca Paper Validation

| Check | Result |
|---|---|
| `scripts/provision-jim-capital-uat.mjs` | Passed after restoring canonical-thesis sharing prerequisites. |
| `scripts/validate-jim-capital-uat.mjs` | Passed. |
| `RUN_ALPACA_INTEGRATION=1 pnpm vitest run server/aperture/alpacaConnection.test.ts` | Passed: authenticated to the read-only Alpaca Paper account endpoint. |
| `npx tsx scripts/validate-alpaca-paper-sync.mjs` | Passed: synchronized **7** positions. |

### Current persisted Alpaca Paper snapshot

| Field | Value |
|---|---:|
| Account | `Alpaca Paper — AI Thesis` (`portfolio_accounts.id = 1`) |
| Equity | **$97,442.68** |
| Cash | **$59,998.06** |
| Buying power | **$345,507.49** |
| Persisted sync timestamp | **2026-08-25T14:55:34.929Z** |
| Sync source | `alpaca_paper` |
| Sync error | None |

The account snapshot came from the shared read-only `syncPaperAccount` path used by the scheduler. No order procedure was called.

---

## 4. UAT Health Checks

| Check | Result |
|---|---|
| `pnpm check` | Passed; zero TypeScript errors. |
| `DATABASE_URL= pnpm test` | **78 files passed, 2 skipped; 714 tests passed, 4 skipped; 0 failures.** This differs from the expected historical 34-failure baseline because the restored database schema is now compatible with the integration suites. |
| Two frozen walkthrough captures | Both versioned deep links rendered successfully. |
| Authenticated walkthrough | Isolated Jim fixture loaded `Today`, then `One play` (LLY recipe), then `Trigger` state (`unknown`, operator confirmation required). |
| Investor role gate | 41 focused role-gate / scorecard tests passed; no Aperture text is present in the investor-shell source. |
| Local auth seam cleanup | `grep -c LOCAL_PREVIEW_OPENID server/_core/context.ts` = `0`; `.claude/launch.json` is absent, therefore `0` references. |
| UAT order safety | No order path invoked. Database query found no broker orders created, approved, or submitted during the verification window. |

## Recommended UAT Sequence After Publish

1. Confirm the next `capital-daily-outcome-refresh-1` callback returns HTTP `200` rather than its pre-publish `404`.
2. Re-run `npx tsx scripts/validate-alpaca-paper-sync.mjs` only as a read-only freshness check if needed.

No order creation, approval, submission, or broker-side trading action is part of this sequence.

# Antigravity handoff — review, acceptance and deploy

Date: 2026-10-12. Implementation baseline: `22c1d97`. Current implementation is in this handoff's commit. **Not deployed; release approval depends on the gates below.**

## Assignment

Review the completed PD06 evidence integration, finish outstanding browser acceptance, repair any defects, then deploy only after all release gates pass. Preserve the cream/ink editorial harness and `--sh-*` tokens. Intelligence belongs inside the existing insight and decision flow; receipts are on-demand proof, not another scrolling dashboard. No fabricated data, silent failure, automatic approval or orders.

Read repo AGENTS.md, the required Third Signal playbooks, `docs/strategy/PD06_HARNESS_DESIGN_REVIEW_2026-10-11.md`, `docs/strategy/PD06_CAPITAL_EVIDENCE_BRIDGE_2026-10-12.md`, and `docs/qa/PD06_HARNESS_INTEGRATION_2026-10-12.md` first.

## Implemented

- DealDetail Challenge/Committee consumes compact v2 findings; next actions carry the exact finding into the existing document/financing chapter. Rationale, uncertainty, citations and historical runs reveal on demand.
- Strict citation/quote/action validation; latest failed or pending attempts never silently become older success. Legacy scores remain labeled separately.
- Receipt focus/return, idle expiry, pinned historical proof, cached-refresh warnings and exact-input retry identity across remounts.
- CandidateBoard evidence lane and explicit owner/deal/run/security/CIK/thesis/finding-to-criterion binding. Confirmation appends an immutable decision revision through the shared writer, clears eligibility/ranking/risk authority, and never changes old approvals or broker orders.
- Full-row locking validation prevents repeatable-read races. No new Capital migration; prior evidence foundation requires schema 0073.

## Evidence already obtained

- Whole unit suite: 365 files passed, 4 skipped; 4,132 tests passed, 18 skipped. Final Capital UI focused suite: 22 passed. Re-run after your review edits.
- Final implementation-freeze typecheck and production build passed. Build retains the large-chunk warning (main bundle about 5.49 MB uncompressed) and Node module.register deprecation warning; neither is a browser-performance acceptance result.
- Main independently reran real MariaDB two-connection REPEATABLE READ races: concurrent thesis change and deal archive rejected; head, history and pending outcomes unchanged.
- Durable evidence storage: owner isolation, concurrent claims, replay/conflict, v2 readback/projection, immutable failures and unchanged SEC receipts passed.
- Live provider contract/persistence passed against isolated SQL and an existing real Apple SEC metadata capture: Red Team `21cd7f6c-dcbf-4253-a61b-c56642a2ffb2`; committee `30307fd0-305d-409c-986b-b421100dea4f`. Earlier INVALID_OUTPUT failures remain preserved. This is not proof of financial accuracy or production authentication.
- Actual DealDetail desktop and 354px mobile: compact finding, 44px actions, no horizontal overflow, exact action handoff, receipt focus/return, missing/failed/stale/contradictory-history states exercised.
- Selected `/walkthrough/capital-desk` interactions generated zero additional API calls. This is not a claim that every demo route was retested.

## Outstanding review and acceptance — mandatory before deployment

1. Independent final code review of transaction extraction, owner isolation, idempotency, proof pinning, failure states and exact citation validation. The prior independent reviewer hit quota before reviewing the final fixes.
2. Finish **actual-browser Capital binding**: select owned deal, saved analysis, exact equity issuer and explicit criterion mapping; confirm; observe new authoritative revision; reload; inspect bound finding and receipt; verify keyboard focus and return. Repeat at 354px and desktop, with stale/mismatched/failed context. HTTP/SQL checks passed but do not substitute for this browser gate.
3. Test 200% zoom, mobile overflow, touch actions, reduced motion and keyboard use. 200% zoom was not verified in this session.
4. Re-run checks/build/tests and relevant isolated SQL scripts. Confirm no unexpected provider calls in synthetic harness/demo.
5. Inspect actual production Cloud Run/hosting revision and schema. Prior reported baseline was `484fe40` / `capital-aperture-sec-484fe40`, project `third-signal-v2`, region `us-central1`; this was **not reverified during handoff**.
6. Verify 0072/0073 metadata. `scripts/pd06-evidence-schema.mjs` deliberately reports `releaseReady: false`; a local schema pass is not permission to run a production migration. Review its guards and the migration before any additive production apply. Preserve populated receipts; do not execute destructive down migrations as rollback.
7. Stage/canary then verify authenticated owner and fresh-user isolation, evidence capture/analysis, receipt reveal, Capital binding/revision behavior and failures on deployed mobile/desktop routes. Confirm no order/approval changes. Roll back traffic/code on failure while preserving evidence tables.
8. Log exact commit, build, revision, URL, acceptance results and remaining risks in Linear Third Signal Lab / Third Signal Lab Agency. Linear was unavailable (unauthorized) in the originating session; these docs are ready-to-sync evidence, not a recorded ship log.

## Safe local commands

`.env` targets **production TiDB**. Never run an unguarded test or development mutation. Use Node >=22 (this session used Node 26):

```sh
export PATH="/opt/homebrew/opt/node@26/bin:/opt/homebrew/bin:$PATH"
DATABASE_URL= pnpm check
DATABASE_URL= pnpm exec vitest run --config vitest.unit.config.ts
DATABASE_URL= pnpm build
DATABASE_URL= NODE_ENV=development pnpm exec tsx scripts/pd06-evidence-storage-check.ts
DATABASE_URL= NODE_ENV=development pnpm exec tsx scripts/pd06-capital-concurrency-check.ts
DATABASE_URL= NODE_ENV=development pnpm exec tsx scripts/pd06-harness-uat.ts
```

The isolated local SQL container is `signal-evidence-uat-20261011`, port 13372, database `signal_evidence_uat`; inspect `scripts/sec-evidence-local-db.ts` for guards. Harness is loopback port 3150, synthetic, external fetch blocked. Obtain fresh fixture IDs/counters from `/__uat/state`; IDs change on restart. Last unbound browser fixture was `/aperture/run/216500502?candidate=216500502&inspect=0&scenario=success`. The account shell is intentionally unavailable in this fixture, not proof of broken production broker connectivity.

The live model probe costs provider calls; do not rerun unnecessarily. Never copy secrets into logs or handoffs. Public demos must remain deterministic and zero-API.

Two unrelated local files were excluded from this work: `docs/strategy/PORTFOLIO_MONETIZATION_AND_LAUNCH_PLAN_2026-10-09.md` and `docs/strategy/intraday-52wk-drawdown-strategy-spec.docx`.

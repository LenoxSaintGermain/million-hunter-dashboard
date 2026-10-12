# PD-06 evidence analysis — verification record

Status: local validation passed; production migration and deployed UAT remain open. Not deployed. Primary surface: Research OS.
Plan: [evidence-to-analysis contract](../strategy/PD06_EVIDENCE_ANALYSIS_PLAN_2026-10-11.md).

## Baseline

- Start commit: `5a05a6b`; production code baseline `484fe40`.
- Existing SEC regression checks: 175 passed across adapter, repository, service, and frontend tests. Command used explicitly empty `DATABASE_URL`.
- Local persistence target: existing disposable `signal-evidence-uat-20261011` MariaDB container, loopback port 13372. Existing SEC test receipts retained.
- Linear rechecked: UNAUTHORIZED / connection requires reauthentication. This document is the ready-to-sync verification record, not a claim that an issue exists.

## Required gates

| Area | Required evidence | Result |
| --- | --- | --- |
| Entity | Explicit CIK and supported relation; no fuzzy auto-match | Local tests and controlled browser pass |
| Authorization | Foreign deal/receipt/attachment/run denied | Unit and isolated SQL pass |
| Inputs | Exact receipt IDs, hashes, source URLs and captured deal inputs preserved | Unit, SQL and live provider read-back pass |
| Engine | Red Team and IC receive bounded selected source context | Live provider pass; synthetic deal context |
| Citations | Unknown IDs or mismatched quoted facts rejected | Strict validation tests pass |
| Failures | Provider/validation/storage failure visible; no false success | Tests and controlled browser failure pass |
| Retry | Duplicate request cannot trigger duplicate model execution | Concurrency/idempotency tests pass |
| Refresh | Prior input/output remains unchanged after newer capture | Immutable storage tests pass |
| Comparison | Content change distinct from identical-content recapture | Five comparison tests pass |
| Browser | Desktop, 354px mobile, keyboard, inline success/failure/recovery | Controlled component harness pass; no final browser errors |
| Demo | Existing public walkthrough makes zero API requests | Capital-desk load, refresh and inline thesis inspection: API counter stayed 0 |
| Release | Typecheck, build, tests, independent review | Final typecheck/build, 3,979 tests, independent scoped review passed |
| Production | Exact revision/traffic and signed-in source-to-result verification | Not attempted |

## Truth labels

Isolated UAT may use clearly labeled synthetic deal inputs and controlled model responses to verify behavior. These do not establish live model success. Live source probes, actual model runs, frozen fixtures, and deployment evidence must be recorded separately.

SEC submissions establish reported filing metadata only. They do not verify the acquisition target's finances, interpret filing content, or confer an investment approval.

## Failures observed during implementation

- First typecheck exposed ES5 iterator compatibility and an existing function-overload return type mismatch. These are implementation failures, not release passes.
- Initial live-engine probe stopped before any model call: the new citation validator rejected the real Apple receipt's legitimate nested primary-document path `xslF345X06/form4.xml`. The SEC adapter already accepts validated nested paths. Fix and regression coverage are required before rerunning.
- Initial new comparison/preview/service checks: 16 passing tests, not yet the complete acceptance suite.

## Verified implementation checkpoint

- Independent final read-only audit: no remaining blockers in attachment admission, ownership rechecks, shared SEC document-path validation, retries, or interrupted recovery. Reviewer ran 134 targeted tests with mocked providers.
- Attachment admission is database-backed: 30/owner/minute and 120/global/minute. Saved-request retries do not consume quota. Analysis admission remains separately bounded.
- Isolated SQL integration passed: ownership, concurrent/idempotent writes, Red Team and IC results, visible failures, and immutable history. Schema verifier: 18 tests passed. No production database access.
- Initial full unit suite: 3,970 passed, 18 skipped. A frozen final rerun follows the parser/quota/UI changes; this earlier count is not the final release result.
- Earlier typecheck and build passed; build retains the existing large-chunk warning.
- Final frozen unit suite: **3,979 passed, 18 skipped**, 358 passing files / 4 skipped files. `DATABASE_URL=` was explicitly empty.

### Actual provider calls, separate from controlled browser fixtures

Used real locally saved SEC Apple receipt `64e637d2-5fa1-4a26-a7ae-1a4c12d3df55` and explicitly synthetic local deal context. This verifies provider plumbing, not a real acquisition or financial diligence conclusion.

- Red Team saved/read-back success: `ed3ee86a-7b17-4b1f-8a6b-9400fc803bff`, `gemini-3.1-pro-preview`.
- IC saved/read-back success: `ee9071f4-ae89-48b9-9e5c-4c91194dd4fd`, `gemini-3.1-pro-preview`, `kimi-k3`, `deepseek-v4-pro`.
- Two prior IC attempts failed and remained recorded failures. Root cause: legacy Poe JSON extraction unwrapped the citations array and discarded the surrounding score/rationale object. The evidence path now requests explicit object preservation; regression coverage retains legacy behavior elsewhere. No model substitution or weakened citation validation.
- The nested SEC document-path failure above is fixed by sharing the adapter's validator; the successful live runs exercised the real nested path.

### Browser observations

Local harness uses actual router/service/storage and the product component with explicitly labeled synthetic inputs and controlled model responses, not live models. Explicit attachment, Red Team and IC success, reload persistence, injected provider failure, historical-success labeling, and inline rationale/citations were observed. At 354px viewport, document width matched client width (350px), with visible keyboard focus and no horizontal overflow.

Final recovery after restoring the controlled provider saved IC run `48d3b423` (short displayed ID), with the failed run still in history. A stale browser tab initially refused localhost after restart despite HTTP 200; a fresh tab recovered without security changes. Final UI uses established persona review-seat labels, square controls, existing cream/ink tokens, and score bars labeled as scores rather than probabilities.

## Remaining release gates / scope

- Final frozen unit/check/build passed. Public `/walkthrough/capital-desk` load, Refresh status and Inspect the thesis gap kept the isolated server's API request counter at zero; no login wall. This is a scoped regression check, not exhaustive re-UAT of every demo interaction.
- Production migration 0073 review/application and tagged-revision signed-in UAT. The supplied migration CLI is deliberately local-UAT-only (`releaseReady: false`); do not bypass that guard.
- Full deployed DealDetail integration is not proven by the isolated component harness.
- Research-brief bindings, comparator relationships, USAspending awards, and document uploads are subsequent extensions. Only explicit same-legal-entity SEC metadata binding is implemented here.
- No production deployment, broker action, order, outreach, or approval occurred.

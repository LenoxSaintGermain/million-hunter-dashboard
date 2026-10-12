# Harness integration — release verification

Date: 2026-10-12 (America/New_York). Baseline `22c1d97`.
Team: Third Signal Lab · Project: Third Signal Lab Agency · Primary surface: Research OS.
Status: implementation frozen for Antigravity final review; **production hold**. See [review/deploy handoff](../handoffs/ANTIGRAVITY_PD06_REVIEW_DEPLOY_2026-10-12.md).

## Approved outcome

Intelligence is consumed in existing insight, challenge, committee, research, thesis and attention contexts. Receipts are secondary proof. This implements the [design review](../strategy/PD06_HARNESS_DESIGN_REVIEW_2026-10-11.md), not a standalone evidence dashboard.

## Verification boundaries

- All tests use explicitly empty `DATABASE_URL`; local SQL is isolated from production.
- Full-page UAT uses the actual DealDetail component and evidence service/storage with conspicuously synthetic inputs and controlled model responses. It does not establish live model inference quality or production authentication.
- No trading, outreach, automatic thesis edits or approvals are in scope.
- Production migration, deployed identity checks and live-route UAT remain separate gates.

## Checkpoints

| Gate | Status |
| --- | --- |
| Source chapter does not append a full workbench | Initial presentation regression passed |
| Rail acknowledges latest failed/pending/complete attempt | Initial presentation regression passed |
| No silent substitution of historical success | Initial presentation regression passed |
| Synthetic deals disable connected evidence queries | Initial presentation regression passed |
| Finding-level citation and action validation | Validated live v2 Red Team and IC pass after provider-contract correction; main independently read both stored runs and projected them ready |
| Explicit Capital subject/context binding | Implemented; isolated HTTP/SQL binding, new revision and replay passed. Final actual-browser confirmation/reload acceptance remains open |
| Receipt reveal, keyboard focus and return | Connected DealDetail: heading focus, receipt return to exact citation trigger, inspector return to basis trigger verified |
| 354px mobile and desktop full-page journeys | Deal success path verified; 354px insight 339.5px tall, visible actions 44px, no horizontal overflow after harness navigation fix. Capital path pending |
| Missing, failed, stale and contradictory-history states | Missing receipt explicitly fails and blocks run; failed attempt survives reload; stale-at-run and expired-now both visible. Contradictory history keeps 0.95 screening, 0.10 legacy panel and 0.50 evidence panel separately labeled. Capital path pending |
| Demo zero-API regression | `/walkthrough/capital-desk` local browser: thesis-gap and Refresh status interactions leave server API counter unchanged at 5; no connected calls introduced by those actions |
| Full tests, typecheck, build, independent final review | Latest full unit run: 4132 passed / 18 skipped (365 files passed / 4 skipped); final Capital UI focused suite 22 passed. Final independent review remains open after reviewer quota interruption |
| Production deployment | Not attempted |

Initial focused result: seven tests passed across `dealHarnessPresentation.test.tsx` and `acquisitionFinancingPresentation.test.tsx`; this is not final acceptance.

## Browser and storage evidence

- Desktop equal-score committee tracks: all three 816.8047px wide, 0.5 fills all 408.3984px. No independent label-column scaling.
- 354px mobile default finding: 339.5px height; visible primary/secondary actions 44px. Full rationale/uncertainty are on-demand, not discarded.
- Finding action carries the exact question into the existing document/financing chapter, with a return path.
- Receipt focus: selected receipt heading → return to exact citation trigger → close inspector returns to originating basis trigger.
- Isolated SQL storage check passes: concurrent claims, replay/conflict, both v2 outputs and projections, prompt version, persisted failures, immutable history, unchanged earlier SEC receipts. Synthetic fixtures retained; no provider calls in that check.
- Local proof screenshots: `/tmp/pd06-harness-mobile.png`, `/tmp/pd06-harness-desktop.png` (synthetic interface proof, not live inference proof).

## Live provider checkpoint

The v2 public-SEC probe ran against the isolated database, with an existing real Apple SEC capture. Both attempts persisted explicit `INVALID_OUTPUT` failures; no scores/decisions were substituted:

- Red Team `72ef5aa6-1c95-487d-a487-593d4d3d561a`
- Committee `9fa91770-204c-4ec9-98d3-8a7261faa4da` (Gemini reviewer invalid)

These were failures, not verification passes. Subsequent remediation and passing probes are recorded below; the failures remain retained.

### Subsequent remediation and sanitized live pass

The initial failures above remain immutable failure receipts. A diagnostic retry reproduced Google IC `OUTPUT_TRUNCATED` at the 2,048-token output cap. A subsequent Red Team rejection identified missing `citationId` fields and unrecognized citation-object keys; diagnostics recorded field paths/codes only, not raw provider payloads or credentials. Further failed attempts also remain saved:

- Red Team `db45e9b2-452e-4faa-aac3-7ee514b80de1`
- Committee `c7d03c96-c5d0-45d6-b8b1-d2ba8595f818`

Remediation added required provider response schemas derived from the shared contract, a request for one concise prioritized finding per reviewer, and a bounded 8,192-token allowance for v2 outputs. The 60-second provider timeouts remain. Exact citation ID/quote matching, finding-to-reviewer citation membership, field bounds, model provenance and human-action allowlists were not relaxed; no citation aliases or automatic repairs were introduced. Invalid results still fail closed and persist without substituted scores.

The final bounded probe used `DATABASE_URL=` and `NODE_ENV=development`, the fixed isolated local database, an existing real Apple SEC capture, and explicitly synthetic acquisition context. Both modes completed and passed durable readback plus the shared projection validator:

| Mode | Saved run ID | Runtime model(s) | Sanitized result |
| --- | --- | --- | --- |
| Red Team | `21cd7f6c-dcbf-4253-a61b-c56642a2ffb2` | `gemini-3.1-pro-preview` | `complete`; `outputVersion: 2`; projection `ready`; 1 finding; saved output equals returned output |
| Committee | `30307fd0-305d-409c-986b-b421100dea4f` | `gemini-3.1-pro-preview`, `kimi-k3`, `deepseek-v4-pro` | `complete`; `outputVersion: 2`; projection `ready`; 3 findings; saved output equals returned output |

The committee used three actual configured reviewer calls in parallel, not controlled fixture responses or model substitutions; Red Team made its separate live model call. No fresh SEC fetch was needed. This establishes live v2 provider-contract and local persistence compatibility, not inference accuracy: SEC submissions are public metadata only, not reviewed filing contents or verified financials. The owner-confirmed entity relation is not independent identity verification. Findings remain interpretations/hypotheses for human diligence, not acquisition approval, Capital clearance or investment advice. Saved failures and prior decisions were not overwritten; production data and deployment were untouched.

Post-fix verification: **99 tests passed** across `dealEvidenceEngine.test.ts`, `dealEvidenceRepository.test.ts`, `dealEvidenceService.test.ts`, `dealEvidenceProjection.test.ts`, `dealEvidenceChanges.test.ts` and `poeEvidenceJSON.test.ts`, using Node 26 with `DATABASE_URL=`. `git diff --check` passed. The intermediate `operatorChoice` type error was fixed; the subsequent whole-project typecheck passed.

## Handoff concurrency checkpoint

Main independently reran `pd06-capital-concurrency-check.ts` after implementation freeze. Two real MariaDB connections at REPEATABLE READ established a snapshot before a concurrent thesis update or deal archive. Both attempts rejected the changed context; persisted decision head, revision history and pending outcomes stayed unchanged. No production connection or provider calls were used. This completes durable concurrency verification, not the outstanding actual-browser Capital binding gate.

Engine changes are frozen at this checkpoint pending main's independent no-weakening validation review. This local live pass does not clear the other production-hold gates above.

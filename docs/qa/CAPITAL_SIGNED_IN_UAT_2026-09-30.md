# Signed-in Capital acceptance — September 30 evening

Status: scoped fixes deployed and signed-in read/navigation/safety UAT repeated; not an all-clear or a promise of market readiness.

Scope: production signed-in operator session; Execution Rail practice account and Rate Shock V1. No broker order submission/cancellation or fabricated evidence resolution is authorized by this report. Separate live acceptance from local fixes and Acquisition V2 acceptance.

## Observed flow checks

| Flow | Evidence | Status |
| --- | --- | --- |
| Today | Account portrait, measured holdings, constraint and pending/unfilled PSX correctly distinguished | Read verified; remaining actions pending |
| Mission | Account context loads, but saved-plan alert persists; server latest endpoint returns 412 | Blocking investigation |
| Play Desk | Shares remain unfilled, return unmeasured, modeled risk separate from buying power | Read verified |
| Outcome review | RWM due-review action opens Practice order instead of Outcome & notes | Handoff fix in progress |
| Research | Two journeys; evidence dialog opens and lead handoff reaches required-evidence review | Read/navigation verified; no gate answered |
| Portfolio | Broker and manual account balances separate; ten measured holdings; empty manual holdings not shown as refreshed | Read verified; refresh/import/exit not exercised |
| Theses | Search narrows to Rate Shock V1; context loads canonical source | Filter/handoff verified |
| Thesis loading | Briefly renders editable blank Legacy form before canonical record loads | Loading guard fix in progress |
| Canonical workspace | Missing global navigation on handoff | Shell fix in progress |
| Use in Mission | Existing Rate Shock V1 rejected for missing invalidation; editor reveals missing structure, no empty research run | Fail-closed behavior verified; projection path was invoked |
| Custom ticket | No Mission bound, prefilled PAPER and unsupported spread auto-solution visible; stage appeared enabled | Safety fix in progress; nothing staged |
| Fresh Mission | Entered explicitly labeled unsaved UAT question, selected Execution Rail, $50 capital/$5 loss; review and server risk preview worked | Analysis correctly disabled at $0 remaining risk headroom; no save/research/order |

Narrow Play Desk: observed inner width 322px and document width 318px, with mobile navigation and no document overflow. This is not full mobile acceptance. Temporary viewport override restored. Operator identity was confirmed via the account menu; private email is intentionally not copied here.

Local fixes in progress also remove fabricated UAT-equity fallback, default selection by hardcoded UAT account ID, arbitrary latest-run binding, and one-leg substitution for multi-leg tickets. No limit was increased and no existing order was altered to make UAT pass.

Keyboard activation works. Initial pointer attempts showed no observable effect; do not interpret those as a passed click test. No account identity or credentials were exported from the browser.

## Pending acceptance

- Legacy Mission receipt is incomplete and remains blocked; a replacement requires a separately reviewed new plan, not a reconstructed receipt.
- Full mobile interaction matrix and production mutation acceptance are not established by the responsive checks below.
- Rate Shock V1 lacks a declared invalidation condition; the operator must define it before a usable paper-research handoff.
- Approval, provider-backed research, broker submission/cancellation and file imports need explicit bounded test cases and authority; untouched real records must remain unchanged.
- Acquisition V2 remains local and has separate real-source/scenario acceptance gaps. Document uploads remain deferred.

Pre-fix local baseline: 2,940 unit tests passed; 18 skipped. This does not establish production acceptance.

## Scoped remediation candidate

- Commit `22ade7e0628494dc2f359ab1ecbc028c629ec30e`, pushed to main. Acquisition V2, document intake, unrelated auth/database/sourcing changes excluded.
- Mixed development tree: 2,999 tests passed, 18 skipped. Clean committed source: 2,858 tests passed, 18 skipped; TypeScript and production build passed. Different totals reflect excluded unfinished work, not skipped failures. Existing large-bundle warning remains.
- Build `cc56d9c5-1acd-4b71-bc9f-fd1ccaa749ec` succeeded. Digest `sha256:61f1fc3d104e264abc98c7ada9d858ae61669cd9718e226ecc9657234f03fb10`.
- Mission run 930001 / revision 1290001 has null context and gate snapshots. The 412 is correct. Candidate explains recovery and retains the old receipt; no evidence is reconstructed or database row repaired. Separate fresh-Mission flow passed through risk preview.
- Outcome review 330001 matches owner, decision, revision, research run, paper-account and fill joins in a read-only production check. Candidate adds explicit note/confirmation, transactional evidence-version validation, immutable saved evidence and reminder-only resolution. No production reminder was resolved during testing.
- Custom ticket now requires bound Mission/run/account, measured equity, supported single-leg expression, size limits and typed PAPER. Confirmation clears on ticket changes/reopening. Server rejects legacy multi-leg expression markers before order writes and during stored-order approval/submission.
- Unsaved UAT objective was left without saving; browser returned to Today. Existing PSX order and account limits were not changed.

## Production receipt and repeated signed-in UAT

- Revision `capital-aperture-00270-koz` promoted to 100%; previous `capital-aperture-00268-goz` retained. Runtime configuration fingerprint unchanged. No schema migration.
- Candidate `https://uat-22ade7e0---capital-aperture-oxiyp4dcpq-uc.a.run.app`: all 15 read-only release checks passed at 23:51:28Z.
- Production `https://third-signal-capital-aperture.web.app`: same 15 checks passed at 23:52:25Z, exact commit matched and unauthenticated account access denied.
- Existing signed-in session survived reload. Today rendered the same account/thesis and PSX accepted/no-fill state.
- Due RWM action now reaches `lifecycle=alpha`, with review 330001, two saved order records, note and explicit confirmation. Save stayed disabled with a nonempty unsaved test note but no confirmation. Text cleared; no reminder resolved.
- Mission shows the specific recovery explanation and Start from a sentence; incomplete receipt remains inaccessible for analysis.
- Manual ticket: Execution Rail default, blank PAPER, four unsupported spreads disabled, no auto-spread price, Stage disabled for missing Mission/run. Cancel worked. No proposal created.
- Thesis loading state observed before canonical record, with no editable legacy flash; loaded source fields disabled. Canonical manager retains global navigation and Saved theses return link.
- Mobile observed viewport 354px: manual dialog width 354.55px with document 354px; canonical workspace, loaded Research library and Portfolio document width 351px. Research disclosure opened and closed by keyboard. Viewport override reset after checks.
- Research still shows two saved journeys and opens Rate Shock V1 evidence; Portfolio retains separate broker/manual ledgers and finishes holdings loading. No refresh/import/exit invoked.
- Current account preview has $0 risk headroom; that is a legitimate safety block. No limit or existing order was modified to manufacture a pass.
- Provider-backed test run requested asynchronously from operator, not authorized/started as of this receipt. Broker submit/cancel and final immutable review save remain unexecuted production cases. Unit/storage-contract coverage is not a substitute for those cases.

The testing-strategy skill shaped the split between regression checks, production read UAT, and gated mutations. Approval and evidence boundaries remain intact. Acquisition V2 and document uploads did not ship in this release.

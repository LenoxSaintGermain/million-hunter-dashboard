# Market-open UAT repair — September 9, 2026

## Release

Initial repair: `f0e413194afc3f49764144e298153c907c4dce66`, deployed as
`capital-aperture-00082-row` with 100% production traffic. Build:
`075bc9b1-5b54-4eb6-8a73-46cfceb202d9`.
Live repeat corrections: `4994a647d71013507f81bb6717456edb8a2a376b`
(current/history separation, compact contract labels, correct stale-check recovery)
and `1c76cb75db77400752c646ad53f3796739605105` (honest share-stop risk).
The latter passed six public/API checks and was promoted to 100% traffic as
`capital-aperture-00084-ben` (build `ba90dbb8-386b-4f34-80eb-f3cc3e039469`).
Final ordering correction: `ffc6d9d2207d3d227663d779d0bd068a0063d870`, pushed
to `origin/main`; build `e5867840-fe8f-49e9-99a8-694553edb653`.
Final production: `capital-aperture-00086-jot`, 100% traffic confirmed by Cloud Run
readback. Image digest:
`sha256:f2bc36f17eacd843cffa6de1f577ea99099c3c8f875aa5296bc09188eaa63d77`.
Six zero-traffic smoke checks passed at 15:00:53 UTC; six production checks passed
at 15:02:15 UTC, including exact served SHA, JSON API health, and denied unauthenticated
account access. Rollback is `capital-aperture-00084-ben`. No Google sign-in
hostname was added or removed during this repair.
No schema migration, risk-policy change, or broker-integration change.

This is a repair/retest of the eight authenticated gaps in
`CAPITAL_APERTURE_AUTHENTICATED_UAT_2026-09-09.md`, not a claim that all future
Strategist/discovery functionality or human usability goals are complete.

## Implemented interaction changes

| Gap | New behavior |
| --- | --- |
| PWR ticket/evidence loop | Completed answers remain complete. Missing market inputs offer in-place Refresh market checks and alternatives; a waiting trigger is not called a queued order. |
| Mobile attention density | Shared concise instrument-aware decision card; primary action precedes optional full evidence. |
| DKNG put context | Selected contract and recorded rationale travel with the finding. A stock outlook does not automatically validate a put/hedge. No flag-to-trade recommendation. |
| Partial-state recovery | Named source gaps, last-success basis, exact affected-play route; saved-status refresh is distinct from new sourced checks. |
| Today/Desk disagreement | Both use the same shared arbitration and decision card. Critical issues remain outside instrument filters. |
| Constraint inspection | Both Mission sections disclose actual named-account limits, effective calculation, provenance, and guarded read refresh. |
| Review timing | Order-identity-matched human review dates; separate modeled time stop and automation language. Readable OCC headers. |
| Navigation ambiguity | Named mobile menu/dialog, 44px controls, run numbers on same-title research cards. |
| Historical checks counted as new tasks | Latest result per check type drives the current review count. Older successes, failures, and flags remain in expandable history. |
| Share ticket loss label | Planned loss at modeled stop, with adjacent execution-slippage warning; bounded premium language is reserved for long options. |

Unfilled accepted orders are not required to complete post-fill monitoring.
The server adapter and monitoring UI independently preserve that distinction.
Opening evidence does not acknowledge/resolve a finding. A dedicated persisted
monitoring acknowledgement/resolution action is not implemented in this release.

## Automated verification

| Lane | Result |
| --- | --- |
| Unit/local, final commit | 1,213 passed, 0 failed, 6 skipped; 138 files |
| Disposable local integration | 66 passed, 0 failed, 2 skipped; 10 files; scoped DB/user cleaned |
| Persisted interrupted/returning journeys | 4 passed with fixed shuffle seed 630001; owner-scoped order invariance and zero provider calls asserted |
| Credential presence | 4 passed in a network-denied harness; no provider authentication claim |
| Harness isolation guards | 21 passed |
| TypeScript / client / server builds | Passed |

The PWR readiness regression first failed three cases (pre-open, no SIP bars,
provider error), then passed without clearing evidence or allowing a proposal.
Existing unit fixtures cover target/risk invariance, capital lineage, duplicate
claims, economic-mechanism rejection, source-origin deduplication, no-trade,
historical lookahead prevention, and human lifecycle boundaries.

External Alpaca/FRED and external URL-import automated tests were not substituted
with fake successful provider results. Optional skips are not counted as passes.
The separately authorized production browser run did make one explicit MGM
monitoring request; its observed result is described below.
Local build warnings remain for optional analytics placeholders and large
bundles; they did not prevent the build. No performance/accessibility certification.

## Isolated browser walkthrough

1. Chrome opens an existing persisted draft on Today, not a new mission.
2. At 390×844 CSS pixels, Resume mission setup begins around y=513; document
   width is 386. Primary touch control is approximately 44px high.
3. Resume opens Account & risk with the previously saved inputs.
4. Inspect effective constraint opens adjacent real calculations and provenance.
   Fixture capital $25,000 and requested loss $249 remain unchanged; normal-play
   limit is $187.50. Stale account basis is visible.
5. Mobile Navigation has an accessible name/title; opening/closing it preserves
   the mission. Keyboard Enter on Refresh status preserves focus and scroll.

These numbers are illustrative local fixture values, not production account facts.
Browser zoom was accounted for: a 351×760 viewport override yielded verified
390×844 CSS dimensions. Screenshots are actual browser captures.

## Authenticated production repeat

Authenticated Chrome, normal production Firebase domain, market open:

1. Cold reload retained named Alpaca Paper account and active PW thesis. The
   separately labeled NVDA portfolio constraint remained visible. No login
   redirect or settled false account-selection blocker was observed.
2. Today and Play Desk both prioritized the exact DKNG $20 put's catalyst finding.
   Switching Desk to Shares retained the put alert plus the two overdue tasks,
   and explicitly reported three critical issues outside the filter. Shares
   showed one accepted/unfilled order, not an open position.
3. Two PW research rows carried distinct run IDs (690001 and 660001).
   Review PWR opened run 690001 / candidate 540001. Its completed evidence
   advanced to the exact ticket; fresh session data produced a modeled share
   plan rather than the old weekend SIP/evidence loop. Proposal, approval, and
   submission were still separate. No paper acknowledgement was entered.
4. Mission retained capital $8,000 and requested loss $500. Both Account & risk
   and Review disclosed effective normal-play risk $0, bound by aggregate risk:
   $240 limit less $1,620 recorded open risk, floored at zero. Normal-play policy
   separately showed 0.75% × $8,000 = $60. These are observed account snapshots,
   not financial recommendations or verified current broker buying power.
   Inspection did not change inputs or orders.
5. MGM's exact recovery route opened run 360001 / candidate 240002, existing
   order 90001. One deliberate Run sourced checks request completed around
   10:39 ET, recording four new results (observed market-context check 150004). Market context
   remained flagged; the other three recorded no flagged change. Evidence showed
   the selected-call rationale, timestamp and provider citations. Those citations
   were exposed, not independently fact-checked in this UI acceptance pass.
6. The initial repeat exposed historical-check count inflation (MGM eight stale
   findings, then nine after its refresh; DKNG nine review items across twelve
   records). The follow-up retains every record but renders only the newest four
   check types as current. Live DKNG repeat confirmed four current checks,
   one review task, and eight preserved historical results, which remained
   accessible without inflating the count. A final ordering regression was
   repaired: flagged findings and uncertainty precede newer routine results.
   The final production repeat confirmed check 120001 (flagged catalyst) first,
   followed by the three routine checks, with Previous checks · 8 still collapsed.
7. At 390×844 CSS pixels, the production primary Review what changed control
   begins at y=608.5, is 44px high, and ends at y=652.5. Document width is 386;
   no horizontal document overflow. Mobile navigation opened with Enter;
   Escape closed its named dialog and restored focus to Open navigation menu.
   The current account/mode, active PW thesis, and separate NVDA constraint
   were visible in the first viewport. Device/screen-reader testing is not claimed.
8. The corrected PWR shares ticket visibly says Planned loss at modeled stop
   with the adjacent warning that actual loss can be greater. Switching its
   expression to Long call fetched and displayed eight quoted contracts with
   bid/ask, mark, volume, open interest, spread, loss and over-budget amounts.
   No quoted contract fit that historical run's displayed account ceiling;
   no contract was selected and the expression was returned to Shares. This
   historical run is not the current Mission's underwriting revision; its
   ticket preview is not proof of proposal eligibility under the current plan.
   No PAPER acknowledgement, proposal creation, or submission was attempted.

No proposal, approval, broker submission, cancellation, hedge or exit was performed.
Permitted writes were normal scoped draft/seen state and the single explicit MGM
monitoring request. Opening evidence was not treated as acknowledgement/resolution.
No concentration or aggregate limit was relaxed to manufacture a UAT trade.

Pre-repeat read-only broker baseline: seven rows; SHA-256
`94170ffca5732dc8dbd1fd7fe8448449e583df557145444a5fcf826566151fee`.
Post-MGM-refresh read-only verification matched all seven records and the same
checksum. Browser console inspection returned no warnings/errors during the
observed authenticated path. This is not an exhaustive error-budget audit.

## Evidence

Artifacts: task visualization directory `market-open-uat-2026-09-09/`.
Files include `isolated-mobile-resume.png`, `production-mobile-today.png`,
`production-desktop-risk-inspection.png`, `unit-results.json`, and
`integration-results.json`. Final observed captures include
`production-mobile-today-final.png`, `production-desktop-today-final.png`,
`production-mobile-mission-final.png`, `production-desktop-dkng-monitoring-final.png`,
`production-desktop-pwr-ticket.png`, and `production-desktop-pwr-live-chain.png`.
Chrome was restored to its original 2027×1251 viewport and left on production Today.
Screenshots and tests are not proof of user-tested ten-second
comprehension or full WCAG conformance.

## Acceptance boundary

This verifies the repaired authenticated review/recovery paths and isolated
deterministic journeys. It is not a complete real-broker order lifecycle UAT:
no new proposal/approval/submission/fill was exercised, and existing accepted
orders were not reconciled with the broker during this pass. No-trade remains a
valid result while the current Mission has no aggregate risk capacity.
Dedicated persisted monitoring acknowledgement/resolution and a complete
Capital Strategist discovery UI remain outside this repair. Model-generated
source quality and future-date leakage require evidence-level review, not a
claim of correctness from a successful request or a list of URLs.

## Change manifest

No migration or risk-sizing/ranking formula was introduced. Existing authorities
remain in place. Changed/new tracked source and tests in this repair:

```text
client/src/components/EditorialTopNav.tsx
client/src/components/aperture/AttentionDecisionCard.tsx
client/src/components/aperture/AttentionSourceRecovery.tsx
client/src/components/aperture/DecisionRunway.tsx
client/src/components/aperture/MonitoringFindingCard.tsx
client/src/components/aperture/PaperProposalForm.tsx
client/src/components/aperture/TodayAttentionBriefing.tsx
client/src/pages/aperture/ApertureExecute.tsx
client/src/pages/aperture/AperturePlayDesk.tsx
client/src/pages/aperture/CandidateBoard.tsx
server/aperture/apertureAttention.test.ts
server/aperture/attentionUatPresentation.test.ts
server/aperture/capitalMissionUxContract.test.ts
server/aperture/deskAttentionPresentation.test.ts
server/aperture/deskAttentionPresentation.ts
server/aperture/lifecycleSafetyContract.test.ts
server/aperture/missionConstraintInspection.test.ts
server/aperture/mobileMenuAccessibility.test.ts
server/aperture/monitoringHistory.test.ts
server/aperture/operatorHonestyClientContract.test.ts
server/aperture/paperTicketJourneyClientContract.test.ts
server/aperture/proposalReadiness.test.ts
server/apertureRouter.ts
shared/apertureAttention.ts
shared/monitoringState.ts
shared/proposalReadiness.ts
docs/CAPITAL_APERTURE_GUIDED_UX_WALKTHROUGH_2026-09-08.md
docs/qa/CAPITAL_APERTURE_MARKET_OPEN_UAT_2026-09-09.md
```

Method: diagnosing-bugs guided red-before-green regressions; two bounded agents
handled attention/disclosure and Mission inspection/navigation, with main-agent
integration and release ownership. The design:ux-copy skill guided concise
decision summaries while preserving source, uncertainty and execution boundaries.

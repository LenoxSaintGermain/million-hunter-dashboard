# Capital Aperture guided UX walkthrough

**Production checkpoint:** 2026-09-09 release `070d04c`, revision `capital-aperture-00092-yil`, 100% traffic; public JSON health and exact release marker verified. The preceding `fba1b41` has signed-in production evidence; the latest UI follow-up has local desktop/mobile interaction checks, but its signed-in post-deployment repeat is pending because the Mac is locked. Separate Strategist commit `9657373` is pushed, not deployed.

**Scope:** Mission underwriting and returning Today check-in

**Boundary:** The four annotated presentation gaps have an authenticated production repeat in the [stakeholder refinement receipt](qa/CAPITAL_APERTURE_STAKEHOLDER_REFINEMENT_2026-09-09.md). Overall acceptance remains open; this is not a human usability study or completed market-open execution UAT. The [completion matrix](qa/CAPITAL_APERTURE_COMPLETION_MATRIX_2026-09-09.md) distinguishes original requirements, verified increments, and missing end-to-end capabilities. Earlier dated observations below remain historical.

## September 9 gap-closure checkpoint

### Authenticated production follow-up

The operator completed Chrome sign-in. A bounded production desktop/mobile pass
verified named-account hydration, persisted Mission resume, cross-tab saved
section restoration, no-trade continuity, exact monitoring navigation, and
critical issues remaining visible outside instrument filters. **UX acceptance
remains open:** PWR still loops between completed evidence and a pre-session
blocked ticket, and the populated mobile attention card pushes its primary action
below the first viewport. Generic partial-state recovery, put-specific evidence
implication, constraint inspection, and review-label inconsistencies were also
reproduced. See [authenticated production UAT](qa/CAPITAL_APERTURE_AUTHENTICATED_UAT_2026-09-09.md)
for exact routes, screenshots, limits and prioritized fixes. This supersedes only
the prior sign-in blocker, not the remaining end-to-end acceptance requirements.

### Production handoff: mobile information density

The operator authorized production traffic after the isolated UAT. Today now uses a compact `At a glance` heading, a 44px mobile refresh control with an explicit accessible name, and one quiet-state conclusion with its recorded timestamp. `Revisit when` shows the full recorded condition without repeating an automation disclaimer. Monitoring mode and refresh semantics stay visible; the separate status/check timestamps remain in `Status details`. Critical warnings and actions are not collapsed. This is copy/disclosure refinement, not a change to eligibility, order states, or monitoring behavior. Release and live-UAT receipts are recorded separately; approval to deploy is not itself proof of a successful deployment.

### Follow-up: Today loading / partial-state arbitration

`arbitrateTodayRead` is a read-presentation layer over the existing shared attention result, not another lifecycle or priority engine. It establishes one status notice:

| Transport / saved record | Today presentation | Records and actions |
| --- | --- | --- |
| Initial status request | Loading recorded briefing; account loading is not account missing | No absence-based setup or all-clear |
| Status refresh underway | One refreshing notice; earlier errors do not create a second retry task | Retain known critical decisions; refresh is already in progress |
| Failed status refresh | One failed notice and one retry control | Last records retained, no all-clear or cached missing-mission prompt |
| Partial or stale snapshot | One scoped availability notice | Unaffected decisions remain usable; uncertainty is visible |
| Only optional research loading | Briefing is not globally busy | Research queue has its own loading state |
| Optional source failed | Scoped partial notice, with the unavailable source | No global all-clear; useful recorded status remains |
| Complete, no pending task | Timestamped quiet check-in | No new mission pressure or implied monitoring run |

Availability messages are not additional workflow cards or Seen findings. A failed/in-flight core read cannot advance Seen state. A substantive dispatch problem remains visible during any read state, and the stable primary-task key still prevents refresh-driven button reordering. Refresh uses a focus-preserving `aria-disabled` control with a guarded click handler; a keyboard user retains focus while the request runs. No auto-scroll is introduced. The checkpoint explanation now uses body-sized text.

Verification includes failing-before/fixed-after component regressions, a deterministic transport/snapshot combination matrix, a zero-API renderer harness using the real `DailyPlayList` and `TodayAttentionBriefing`, and a repeat of the same isolated persisted desktop/mobile journey. The harness is a separate localhost-only Vite entry, absent from the production build. It does not claim to exercise a broker or the backend.

Detailed follow-up evidence and the Capital Strategist acceptance boundary are in [Today arbitration and Strategist acceptance](qa/CAPITAL_APERTURE_TODAY_ARBITRATION_2026-09-09.md).

The shared attention/disclosure model remains the single next-action authority for Today and Play Desk. The guided workspace uses the same persisted Mission/revision and underwriting state; it is not a second homepage.

- Incomplete draft fields and active section now persist per user, with version-conflict detection and append-only draft revisions. A second authenticated tab resumes the saved section. Account capital remains explicitly declared, not copied from total equity.
- Completing a field no longer automatically moves to another section. Review includes target feasibility, primary and underwriting horizons, and the effective normal-play risk. A pending risk calculation says it is checking, never substitutes the larger account ceiling.
- Existing inconsistent horizons are exposed with an explicit draft-only repair and before/after confirmation. Old receipts are never normalized into a different financial assumption.
- Underwriting has a durable owner/request/revision identity, lease, real milestones, attempt fencing, and explicit retry. Status reads cannot start a job. A stale attempt cannot publish over a recovered attempt.
- MySQL native JSON and MariaDB JSON-text values are decoded and validated at receipt boundaries. Invalid storage does not become an empty successful result.
- Today waits for named-account hydration. Status failures identify the unavailable source without showing raw SQL; failed, stale, and partial states cannot become an all-clear. Unknown open risk blocks underwriting instead of contributing zero.
- Seen state is recorded only for actually displayed item versions. Concurrent-device updates merge by item timestamp without acknowledging or resolving findings. Collapsed items are not marked seen.
- Play Desk filters preserve location and keep critical out-of-filter work visible. An exact `?play=` link surfaces that record. Submitted without a broker ID always requires reconciliation, even without a dispatch error string.
- A no-trade check-in points to its recorded reopening condition, not a nonexistent monitoring task. Status refresh explicitly reads records; it does not claim to run new monitoring checks.
- Navigation now explicitly separates Today, Mission, and Play Desk. Mobile account/thesis text no longer crowds out the account, and explicit result navigation has sticky-header clearance.

Observed local journey: $25,000 declared capital, $6,000/week aspiration, $249 input loss ceiling -> 24% required weekly return, extreme target, $187.50 effective normal-play risk. Missing provider evidence produced NO_TRADE, not invented quotes. A deliberate horizon revision produced a second immutable underwriting revision while the original remained intact. Reloads/status reads did not create further analysis. Four pre-existing isolated broker-order rows remained four.

Verification and remaining gates: [September 9 UAT receipt](qa/CAPITAL_APERTURE_GAP_CLOSURE_UAT_2026-09-09.md). The approximately ten-second usability target remains unmeasured; browser screenshots and automated assertions are not human acceptance.

## Setup / resume walkthrough

1. **Mission opens at the first incomplete persisted section.**
   - The section rail contains `Thesis & horizon`, `Account & risk`, and `Review & underwrite`.
   - Saved thesis and paper-account values identify their provenance.
   - Mission capital is explicitly described as an allocation, not total account value.
2. **The operator sees target pressure before authorizing analysis.**
   - Required return and feasibility classification appear beside the effective risk preview.
   - A profit target exists only when both an amount and period were explicitly recorded. A legacy desired-ending value is not revived as a weekly target.
   - Copy states that the target is excluded from risk sizing.
   - The tighter mission, mandate, or measured portfolio headroom limit is shown as the effective value using the authoritative account snapshot rather than a client-side zero-risk assumption.
   - Exhausted portfolio headroom is named as the blocker even when the operator has already entered a valid planned-loss limit.
3. **The review section summarizes the decision.**
   - Thesis, horizon, capital, instruments, target, and effective risk are visible together.
   - Secondary outcomes remain available: hold for a condition or preserve cash.
4. **`Underwrite my mission` is the one research action.**
   - The Mission is persisted first.
   - The already-authorized underwriting request runs directly to a usable result in the same workspace.
   - Failure after persistence is reported as `Mission saved; underwriting stopped safely`, not as a failed Mission save.
   - A completed result becomes the current persisted state. The action cannot silently create a duplicate underwriting run unless a material assumption changes.
   - While the saved underwriting result is unresolved, the effective-risk claim is withheld, the action reads `Checking saved underwriting…`, and the commit handler fails closed. A result is authoritative only when its decision-revision identity matches the active Mission revision.
5. **The result leads with the decision.**
   - A concise synthesis is followed by zero to three conditional play cards or Sit Out.
   - Regime and feasibility detail live in `Evidence and calculations behind this result`.
   - Share scenarios use `Planned loss at the modeled stop`; unavailable contract scenarios are withheld rather than presented with fake precision.
6. **`Validate this play` enters the existing evidence lifecycle.**
   - The selected underwriting and play identities are persisted before research starts.
   - The receipt says no paper ticket exists and that approval and submission remain separate.

## Returning check-in walkthrough

1. **Today opens as a briefing when persisted work exists.**
   - The first viewport identifies `Today · Paper`, the account snapshot, whether attention is required, and the highest-priority permitted action.
   - Reviewing the current Mission remains secondary; the UI does not pretend that opening the existing Mission creates a new one.
   - A completed underwriting result is reachable from Today with an explicit receipt, including a no-trade result and the statement that no paper ticket was created.
2. **One shared deterministic model chooses attention.**
   - Status failure, unresolved dispatch, invalidation evidence, other material change, approved-not-submitted, pending paper review, due review, and missing evidence are ordered explicitly.
   - Play Desk consumes the same primary item above its filters; a filter cannot silently hide critical work.
3. **Order states stay distinct.**
   - Submitted without broker id is `Submitted; broker status pending`.
   - Broker id without fill is `Paper broker accepted; no fill yet`.
   - Partial fills show filled and remaining quantities.
   - Only a filled opening exposure is labeled an open position.
4. **Changes use a persisted Seen baseline.**
   - The query first compares the current authoritative records with the prior baseline.
   - Only rendered items are then recorded as Seen through a separate mutation.
   - This mutation does not acknowledge, resolve, approve, submit, cancel, or close anything.
   - A first baseline says `Current status`; later material differences say `Changed since your last review`.
5. **Quiet and failed states remain honest.**
   - An on-demand check says so; it does not imply continuous surveillance.
   - A failed read cannot become an empty array or an all-clear.
   - A quiet check-in does not promote a new Mission or manufacture urgency.

## Deterministic behavioral evidence

- Start, Resume, and Check in entry-state derivation.
- Unresolved dispatch priority and broker-acceptance distinction.
- Partial fill quantity split.
- Invalidation visibility independent of filtering.
- Timestamp-only change deduplication.
- Failed and partially available reads do not produce an all-clear.
- Today status read does not launch underwriting or mutate lifecycle state.
- Seen persistence is isolated to the owner-scoped attention baseline.
- Mission authorization runs directly to its result.
- A completed underwriting result is not offered as a duplicate primary action.
- Optional target semantics and measured risk headroom remain identical between the saved Mission, preview, and executed underwriting result.
- Revision changes require a before/after review.

## Capital Strategist decision core — not an end-to-end product

This checkpoint adds the decision core upstream of the existing Underwriter without introducing another homepage, risk authority, or execution lifecycle.

- The type system carries intent: deploy excess capital, redeploy realized gains, explore an opportunity, or review a material change. There is not yet a user-facing persisted entry for this intent.
- Capital lineage distinguishes operator-declared excess funds, reconciled available funds, returned principal, realized gains, and hypothetical future proceeds.
- Supplied fixture gains are computed from net proceeds and attributed basis. Returned principal and the selected reserve are excluded. The present broker schema does not supply the required authoritative closing-lot, fee, reconciliation and availability proofs; production gains are not thereby verified.
- The pure helper rejects supplied duplicate capital events and conflicting allocation claims. This is not a transactional production reservation ledger and does not prove concurrent proposal safety end to end.
- The comparison contains no more than two already-underwritten investment alternatives and always retains cash as a valid alternative.
- Causal economic paths are limited to three consequential hops, preserve sources by originating record, and require an expectations change, counterargument, invalidation, and verified security mapping.
- A fixed-fee supplier relationship cannot be promoted as usage-driven revenue, and an odds feed without observed volume cannot substantiate handle, customer, revenue, or profitability claims.
- The Strategist is pure decision support in this increment: it reserves no capital, creates no proposal or order, and invokes no broker.

The user-facing intent entry, persisted capital-allocation event ledger, and provider-backed discovery orchestration are unfinished original acceptance requirements, not optional scope removed from this goal. Their absence must not be relabeled as a completed end-to-end Strategist workflow. Qualified review required by the original spec must precede public release of personalized allocation recommendations.

## Historical September 8 tagged UAT and original gap list

Authenticated browser UAT was completed on the zero-traffic tagged revision `capital-aperture-00078-bim` (`6e665848543bf577b17893d2f7e6cac5136e5889`). Representative desktop (`2027 × 1251`) and mobile (`390 × 844` CSS pixels) screenshots were captured in the Codex UAT trace. Production remained pinned to `capital-aperture-00075-fig` throughout.

Observed pass:

- the persisted PW Mission opened with the named Alpaca Paper account and NVDA binding constraint;
- the completed no-trade underwriting result showed `$0` effective risk, an explicit no-ticket receipt, and a disabled duplicate-underwriting action;
- desktop and mobile Today distinguished broker-accepted/no-fill orders from open positions and kept secondary urgent issues visible;
- the mobile Mission and Today flows retained single-column actions and the paper-only boundary;
- temporary Firebase authorization for the exact tagged hostname was removed after UAT and the authorized-domain count returned from 11 to 10.

Observed fail / unresolved at that release (local September 9 repairs listed above):

- Today briefly rendered `Account not selected` and `No execution account selected` while its independent queries were loading, before settling to the real paper account. Loading is therefore still capable of presenting a false zero-state.
- A deterministic cold-network capture of the new `Checking saved underwriting…` interim Mission state was not obtained; the settled post-load state and source/test guard were verified.
- Incomplete Mission drafts and the active section are not yet persisted across devices.
- Underwriting does not yet have a durable queued/running/failed job identity; the dedicated route can still initiate work on mount.
- Collapsed change items can be marked Seen, and the server baseline replacement can forget previously seen items outside the submitted subset.
- Empty, stale, partial, and failed check states are not all wired through the production router/UI path; an unreviewed completed playbook can still be demoted into a quiet briefing.
- `Run updated checks` refetches summaries rather than proving a new monitoring check, and active-play status links still land on the general Play Desk.

Original release-blocking checklist (do not treat the local follow-up as production validation):

- persist incomplete Mission drafts and underwriting job state with idempotent retry/reconciliation;
- make Seen updates visibility-accurate and merge-safe;
- fail closed across Today and Mission loading/failed/partial reads;
- route every active-play action to its exact task identity;
- capture deterministic Start, Resume, quiet, partial-fill, failed-source, revision, keyboard, screen-reader, and reduced-motion journeys at the required viewport set;
- run an observed operator walkthrough before claiming the roughly ten-second usability target.

## September 9 market-open UAT repair

The authenticated gap report in `docs/qa/CAPITAL_APERTURE_AUTHENTICATED_UAT_2026-09-09.md`
remains the before-state evidence. The following behavior supersedes its failing
interaction design, without superseding any risk or approval authority:

- A completed evidence review cannot be reopened merely because an entry recipe
  lacks current market inputs. The ticket offers an explicit in-place market-check
  refresh, preserves recorded answers, and says that a waiting trigger is not a
  queued order. Evidence headings count unanswered questions for the selected play.
- Today and Play Desk use the same read-state arbitration and decision card.
  The selected instrument, concise implication, and action lead; the complete
  recorded finding, rationale, citations, and timestamp stay in adjacent Evidence.
  No sentiment-to-trade recommendation is inferred from a flag or headline.
- Source gaps name the affected monitoring/position record and recovery action.
  Unfilled accepted orders are order-status tasks, not missing post-fill monitoring.
  Reading saved status is distinct from deliberately running new sourced checks.
- Human review checkpoints use the persisted order identity and are not described
  as automatic monitoring. Same-title research cards expose their run identity.
- Both Mission risk-inspection actions open the same adjacent calculation, named
  account, provenance, and headroom; they do not change the draft or risk policy.
- The mobile menu is named, keyboard accessible, and uses 44px touch controls.

At this earlier checkpoint the monitoring API had no dedicated finding review
receipt. The September 9 evening addendum below supersedes that limitation for
explicit unresolved review receipts only; it does not add automatic resolution.

Final unit regression result: 1,213 passed, zero failed, six intentionally
external/optional skips. The live repeat also established these disclosure rules:

- Current monitoring uses the newest result per check type, with flagged findings
  and unknown evidence before routine clear checks. All earlier records remain
  in Previous checks; opening them does not create or resolve review tasks.
- A stale-check notice distinguishes saved-status refresh from new sourced checks.
  Compact motion rows use human-readable option names instead of raw OCC strings.
- Share tickets say Planned loss at modeled stop with a slippage warning, not a
  guaranteed maximum loss. Long options retain maximum-premium-loss language.

Authenticated desktop/mobile observations, the scoped MGM check request, PWR
ticket/chain path, exact builds and remaining acceptance boundaries are recorded
in `docs/qa/CAPITAL_APERTURE_MARKET_OPEN_UAT_2026-09-09.md`. Tests and screenshots
are not a ten-second usability claim; a valid zero-risk block is not a failed
order-placement test. No new live proposal/approval/submission was exercised.

## September 9 evening — result-first Mission and exact finding review

The four operator annotations and the authenticated Chrome walkthrough are
tracked in THI-266. Interaction design is acceptance scope, not a cosmetic pass.

- **Completed Mission:** open the persisted result first. Named paper account,
  material stale/failed-context warning, analysis timestamp, one conclusion,
  reason, reopening condition, and what has not happened lead. A compact saved
  assumption summary and adjacent constraint inspection follow. Edit mission
  reveals the existing guided workspace; it does not itself revise the mission.
- **Setup:** keep the three sections. Other mission ideas and integrity context
  are collapsed below the active workspace, never between completion and result.
  Remove repeated no-target explanations. Entered loss, effective allowance and
  binding reason remain visible; detailed calculation/provenance stays adjacent.
- **Exact receipt hydration:** an immutable decision/revision URL restores that
  receipt, even when a different unfinished draft exists. It shows a loading state
  until those inputs are restored, not an actionable blank/default form. Cents are
  preserved. Viewing or editing a completed result does not create another job.
- **No-trade semantics:** a new-allocation decision says No new trade; it never
  implies existing positions are closed or total portfolio risk is zero.
- **Play Desk:** one primary decision, then compact critical rows with explicit
  state, reason, consequence and action. Critical records remain across filters.
  The existing shared deterministic attention model still owns priority.
- **Monitoring:** links carry run, candidate, order, finding and version. A stale
  sourced concern remains unresolved and prominent. A historical version cannot
  silently become a different check. Explicit navigation opens its evidence;
  provider refreshes do not steal focus after operator interaction.
- **Review receipt:** an explicit assessment/note persists in a separate ledger
  field of the existing owner-scoped attention snapshot. Owner locking prevents
  concurrent Seen writes from erasing receipts. A read never records a review.
  Review does not acknowledge/resolve the source finding, schedule a check, alter
  risk, create an order, approve, submit, or exit a position. Retries reuse identity.
- **Evidence question:** state the proposition, observed fact/date, criterion and
  source required for a human answer. Do not invent a valuation threshold or
  upgrade operator-entered evidence to independently verified provider evidence.
- **Thesis entry:** begin blank; explanatory prompts are not saved beliefs. Avoid
  remounting the composer on each keystroke. Preserve edits on query refresh and
  uncertain save, with a saved-record recovery action.

No new schema migration or provider is required. The broader Strategist intent
surface, allocation ledger and discovery orchestration remain deferred as stated
above. This bounded refinement is not a claim that those workflows are complete.

Local desktop/mobile walkthrough and test outcomes are recorded separately in
the September 9 stakeholder refinement receipt. Automated/rendered checks do not
establish user-tested usability, WCAG conformance or the ten-second target.

The signed-in mobile repeat also requires a compact read-only Play Desk header:
title and refresh share a wrapping row, with one timestamp/scope statement.
Do not repeat the introductory workflow or gate disclaimer above attention when
the named paper mode and the consequential workflow gates are already present.
Keep stale/partial warnings and every critical action outside disclosures. Verify
the resulting first-viewport action placement on the actual deployed page.

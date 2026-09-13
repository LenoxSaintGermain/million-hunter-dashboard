# New canonical thesis → Mission UAT — 2026-09-13

## Current verdict

**PASS: new thesis → exact Mission → bounded no-trade result → reload/return.**
Production `capital-aperture-00152-rew` serves source `64f5160` at 100% traffic.
Full qualified research and execution remain unexercised. The final connected
repeat and mutation audit are at the end of this report; earlier failures are
retained below as historical evidence.

## Initial verdict — before repairs

**FAIL at the new-thesis handoff.** This is a different entry path from the earlier objective-led diesel discovery recovery. Do not reuse that earlier pass as coverage for new canonical thesis creation.

Authenticated production browser, existing operator account. Test thesis: **UAT — Diesel Price Shock · Evidence First · 2026-09-13**. Declared paper capital $2,000, planned-loss ceiling $200, shares, 2–10 sessions. The diesel surge is explicitly an unverified hypothesis; no numerical price assertion was entered as fact.

## Observed journey

1. From Saved theses, **New canonical thesis** opened the current Semiconductor Foundry thesis in `/thesis`, not the empty composer. A second **Create new Capital thesis** action was necessary.
2. The empty form correctly disabled saving until a statement was supplied. Filled statement, complete version name, belief, evidence requirement, seeks/avoids, invalidation, risk boundary, descriptive research universe, swing horizon and shares-only preference.
3. **Save and use in Capital Mission** persisted canonical thesis **780001** and Capital projection **450001**. Full name, evidence, invalidation, `holdingPeriod=swing` and `instrumentPreference=shares` survived return navigation. The new thesis became active; the former canonical thesis was not deleted.
4. The save action navigated to **Today (`/aperture`)**, not Mission. No new Mission receipt appeared.
5. Clicking Mission opened the earlier selected discovery context: decision **780001**, revision **1110001**, linked to the old objective-led diesel research. This decision ID and the new canonical ID happen to match numerically but are different entity types. The displayed old horizon was Today/by close, not the new swing horizon.
6. Returned to `/thesis`: the new canonical thesis was intact. Retried **Use in Capital Mission** without creating another thesis. It again navigated to Today; Mission again showed the older discovery. No research was started through that wrong context.

## Defects and implementation direction

### High — handoff loses the requested canonical Mission

Expected: the explicit action opens a new/reviewable Mission bound to canonical **780001** / projection **450001**, carrying shares and swing assumptions. Existing drafts and historical decisions remain preserved. Ordinary Mission navigation may resume work, but an explicit new-thesis action must not silently resume an unrelated task.

Observed twice: Today destination then old selected discovery. Source inspection confirms `CapitalThesisWorkspace.useInMissionFor` ends with `navigate(route("/aperture"))`. Simply changing that URL to `/aperture/mission` is insufficient: `DecisionRunway` preferentially renders the saved discovery receipt when no unfinished draft is present. The explicit handoff must carry and validate the exact new thesis identity and draft intent, without overwriting the prior receipt or starting research on navigation.

### High — descriptive universe becomes invalid ticker declarations

Field label: **Symbols or research universe**. Entered: “Liquid U.S.-listed refiners and diesel-sensitive transport businesses; verify company-to-ticker mapping before inclusion.”

Read-only saved-data inspection found `researchSymbols` equal to `LIQUID`, `REFINERS`, `AND`, `TRANSPORT`, `BUSINESSES`, `VERIFY`, `MAPPING`, `BEFORE`, `INCLUSION.`. The UI accepted prose, while parsing promoted words into security identifiers. This is not verified company-to-ticker mapping and must not be used as a market-data request universe.

Expected: distinguish explicit ticker input from descriptive discovery scope; preserve prose as research intent. Validate security identity before promoting a discovered company into a ticker-based play. A syntactically ticker-like English word is not proof of a security.

### Medium — New action opens old thesis first

Expected: **New canonical thesis** opens an empty composer, preserving existing records. Observed: existing active thesis and a second create action. Route the explicit creation intent separately from ordinary saved-thesis review.

### Medium — repeated long-form thesis content

The saved thesis view repeats the entire detailed statement as both source and compiled receipt. Saved theses also expose a long serialized discovery context by default. Evidence remains necessary, but these duplicate/technical blocks obscure the next decision. Not measured as a user comprehension result.

## Safety / persistence receipt

SELECT-only inspection at **2026-09-13T21:41:19.397Z**: exactly one matching canonical row, one projection, **zero decision runs bound to canonical 780001**. Seven broker-order rows retained full-row SHA256 `94170ffca5732dc8dbd1fd7fe8448449e583df557145444a5fcf826566151fee`, matching the earlier baseline. No ticket, approval, submission, cancellation, replacement, portfolio-policy change or review resolution was performed.

This UAT created and activated the named test thesis and projection. No application code was changed or deployed in this pass. No automated tests were rerun; prior suite results are not new-thesis journey evidence. New-thesis → research remains blocked by the handoff, not by market closure or the later risk gate. Mobile/keyboard new-thesis journey and qualified execution are untested.

Screenshot: `/Users/lenoxparis/.codex/visualizations/2026/08/25/01a0392e-5a5e-73c2-9f5e-675f1dc136d9/diesel-uat-2026-09-13/new-thesis-wrong-mission-handoff.png`.

## Repair and deterministic verification

Code commit `085bf426725295670dd59c6be3312063e74841e4` fixes direct composer entry,
the exact canonical/projection Mission handoff, old-result arbitration, and
descriptive research scope versus ticker declarations. Malformed legacy lists
are withheld on read; unrecoverable scope explicitly requires a corrected new
version. The old canonical source is not rewritten. Descriptive scope reaches
cited universe discovery rather than becoming ticker-shaped words.

The diagnosing-bugs skill was used for executable red-to-green regression tests.
Source handler tests reproduced the wrong Today destination, missing direct
composer, mismatched projection acceptance and missing-scope acceptance after
provider compilation. Receiver tests cover the exact numeric-ID collision from
this live UAT, missing/view-only/mismatched sources, conflicting drafts, and
absence of render-time mutation. Backend tests reject prose before any insert,
retain descriptive scope, and keep legacy uncertainty across repeated reads.

Final unit run: **2,383 passed, 8 skipped**, 199 passing files and 3 skipped files.
Typecheck passed. Local client/server build passed (existing large-chunk warning).
Tests used `DATABASE_URL=`; no production fixture writes or schema migration.
JSON type declarations changed, not database columns. Two additional in-memory
adversarial checks preserved a 4,000-character source and withheld a mismatched
post-begin receipt. No physical-device or measured-usability claim.

Pre-retest SELECT-only broker snapshot at **22:28:26.876Z**: 7 rows, same hash
`94170ffca5732dc8dbd1fd7fe8448449e583df557145444a5fcf826566151fee`.
Prior objective draft remains completed (draft 1, version 7); it must not be
mistaken for an unfinished new canonical Mission.

Cloud build `f40e8237-1a4b-4c9c-a707-eb5a407be89e` uses the frozen 766-file
source snapshot `937e00dd3b18c09a9094c446da3740c41455e3369b38ed27c75cc173a6686c39`.
Deployment and connected retest results are recorded below only when observed.

## Connected retest — revision 00150-put

Production revision `capital-aperture-00150-put` received 100% traffic after six
tagged checks passed at 22:35:21Z. Six public checks passed at 22:35:54Z. Both
checks verified the exact source SHA, JSON API health and unauthenticated denial.
No schema, auth-domain, broker or risk configuration was changed.

Observed in the authenticated UI:

1. New canonical thesis opened the empty composer directly; save was disabled.
2. Legacy thesis 780001 was prevented from starting research with malformed
   symbols. The recovery opened an editable new version and retained its source.
3. Saved corrected version **810001**, projection **480001**, named
   **UAT — Diesel Price Shock · Evidence First · 2026-09-13 · Scope corrected**.
   Research scope is prose; explicit tickers are empty. Shares/swing survived.
4. Save/use opened the exact canonical/projection Mission. No old account,
   capital or loss values were silently copied. Entered the named Alpaca paper
   account, $2,000 capital and $200 loss ceiling; no profit target.
5. Reloading the unfinished draft restored the same inputs and second section.
   The effective constraint showed $0, with the aggregate-risk calculation
   available beside it. No constraint was increased to force a play.
6. One deliberate underwriting action created Decision **810001**, revision
   **1140001**. The result was **No new trade**: no measured risk capacity, with
   stale/incomplete market and account information explicitly disclosed. No
   research run or ticket was produced. This is not evidence that diesel's
   reported price move was verified.
7. **FAIL on completed-result reload:** the address retained `newMission=1`;
   refreshing reopened blank setup. No second underwriting action was clicked.
   Navigating to the exact saved decision/revision restored the existing result.
   This is a separate persistence/navigation defect requiring another repair.

Narrow-browser review used an observed 354×767 CSS viewport; document width 351,
with no page-level horizontal overflow. This is browser emulation, not a physical
device, keyboard, screen-reader or timed usability pass. Screenshots:
`new-thesis-review-mobile.png`, `new-thesis-result-mobile.png`, and
`new-thesis-result-desktop.png` in the evidence directory above.

SELECT-only verification at **22:46:33.761Z**: one Decision Run for canonical
810001; completed draft 1/version 12 carries exact Decision 810001/revision
1140001. Seven broker rows retain the baseline full-row hash. Reload testing
created no duplicate Mission or broker mutation. The original canonical version
remains preserved. Duplicate long-form thesis details remain a separate density
gap; qualified research, proposal, approval and submission are not claimed passed.

## Completed-result reload repair

The Mission now replaces the handoff address with the exact saved decision and
revision immediately after recording it. The authorized underwriting request is
dispatched once before route replacement. The old completed-draft handoff is
recovered only after canonical, projection, decision and revision identities
match authoritative reads. Missing/mismatched records cannot become new setup.

Reloaded job status refreshes the saved result once on completion, without
restarting analysis. The short initial worker-visibility window polls status
only; an unchanged recorded Mission cannot call begin again. Existing human
approval/submission and paper-only boundaries are unchanged.

Final isolated regression run: **2,392 passed, 8 skipped** across 199 passing and
3 skipped test files. Typecheck and diff check passed. Focused reload/entry suite:
95 passed. Behavioral fixtures assert request-before-navigation ordering, exactly
one begin/underwriting call, completed and running reload recovery, mismatched
identity rejection, running-to-complete result refresh, and zero page-read
mutations. Tests are database-isolated, not a production execution test.

The subsequent release and live reload repeat are recorded below when observed.

## Final connected repeat — PASS for new thesis through no-trade result

Source `64f5160454a0db29a247741aa882678cb9a56c54`, build
`46d74664-b346-4930-8405-b6d7140da460`, production revision
`capital-aperture-00152-rew`, **100% traffic**. Frozen 766-file source hash:
`f2c85bb0b45b25ce6349b16c4e2e0e2d6f04774b120b116c1cd904d452f4deee`.
Image digest `sha256:98f685ef37d129d28adfd00cb7a070ff56d3817f7bd0aed3219957b74e9e2f4e`.
Six tagged release checks passed at **23:00:57.875Z**; six production checks passed
at **23:01:29.789Z**. No schema, authorization-domain or broker-policy changes.

### Annotated operator walkthrough

1. **Recover existing work:** the previously broken canonical 810001/projection
   480001 handoff automatically opened `/aperture/decision/810001/revision/1140001`.
   Its completed no-trade result survived reload. No second action was clicked.
2. **Fresh entry:** opened `/thesis?new=1`. Blank composer and disabled save were
   verified. Entered the diesel surge as an explicitly unverified hypothesis,
   evidence requirements, invalidation, descriptive research scope, shares and
   2–10 sessions. Left ticker symbols blank.
3. **Save and use:** one click created canonical **840001**, projection **510001**,
   named **UAT — Diesel Price Shock · Reload verification · 2026-09-13**. Mission
   carried that exact source and its shares/swing scope. Account/capital/loss
   required explicit selection instead of inheriting unrelated amounts.
4. **Confirm inputs:** selected **Alpaca Paper — AI Thesis**, $2,000 capital,
   $200 loss ceiling, no profit target. Reload restored those saved inputs and
   the Account & risk section. Effective risk remained $0 with its reason beside it.
5. **Authorize once:** on the narrow viewport, reviewed the summary and clicked
   **Underwrite my mission** once. The actual route transition completed and the
   analysis finished after it: Decision **840001**, revision **1170001**, saved at
   **7:03:43 PM ET**. Address became the exact saved decision/revision, not setup.
6. **Understand outcome:** **No new trade** explained exhausted measured capacity,
   a reassessment condition, stale/incomplete evidence, and that no ticket or
   position change occurred. It did not manufacture a diesel price or candidate.
7. **Return:** full reload on mobile kept the same result. Restored desktop,
   visited Today, then Mission: the same completed result appeared. Reopened its
   exact durable address for the final handoff.

### Mutation and coverage receipt

SELECT-only audit at **23:05:59.358Z**: each of the two deliberate test missions
has exactly one completed underwriting job, attempt 1. Earlier Decision 810001
has job/result 60001; final Decision 840001 has job/result 90001. Neither has a
research run. Completed draft 1/version 16 points to 840001/1170001. These are two
deliberate, separately named test runs, not duplicate work caused by reload.
All seven broker rows retain baseline SHA256
`94170ffca5732dc8dbd1fd7fe8448449e583df557145444a5fcf826566151fee`.

Final screenshots in the evidence directory: `final-thesis-review-mobile.png`,
`final-thesis-result-mobile.png`, `final-thesis-result-desktop.png`. Observed narrow
viewport 354×767 CSS, document width 351; desktop 1099×1196 CSS, document width
1099. No page-level horizontal overflow measured. Screenshot export showed a
scale/canvas mismatch (extra blank canvas in full-page export); use DOM/interaction
evidence for viewport dimensions, not exported pixel geometry. A supplemental
native capture timed out; it did not change the application result.

**Limits:** live reload of an in-flight long-running job was not observed because
this bounded no-trade result completed quickly; running-to-complete resume is
covered by deterministic behavioral tests. No second authenticated physical
device, enlarged-text, screen-reader or measured-comprehension test is claimed.
Long repeated thesis detail remains a density follow-up. This pass closes the
reported creation, scope, handoff and completed-reload defects; it does not claim
qualified evidence-to-proposal or order execution, which remain unexercised.

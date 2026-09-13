# New canonical thesis → Mission UAT — 2026-09-13

## Verdict

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

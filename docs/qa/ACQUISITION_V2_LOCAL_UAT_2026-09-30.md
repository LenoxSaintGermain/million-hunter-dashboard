# Acquisition V2 local implementation and UAT

Status: local implementation, not deployed; not full V2 acceptance.

## Implemented

- Individual supported-host listing capture with bounded HTML reads, timestamps and hashes. Search snippets no longer supply financial values.
- Typed financial extraction with explicit missing, approximate, malformed and conflicting states.
- Operator-confirmed, editable versioned mandate; deterministic gates, source-bound risk questions, and unavailable-listing exclusion from new shortlists.
- Owner/run-scoped capture persistence and integrity-checked replay. Unsupported benchmarks remain visibly disabled.
- Explicit-cost cash waterfall and hypothetical game-theory comparison. Scenario output is local, not a saved valuation, forecast, order or approval.
- Mandate approval resets after edits. Scenario approval/results reset after cost edits. Confirmed geography governs discovery rather than a silent Southeast default.

This does not add permanent deletion of existing listings or redesign the capital thesis route.

## Verification

- `DATABASE_URL= pnpm check`: passed, including final integration edits.
- `DATABASE_URL= pnpm test:unit`: 2,752 tests passed before final integration changes.
- Final focused rerun: six files, 24 tests passed, including source capture, parsing/gates/scenarios, source-vs-snippet research, owner/hash replay, and receipt rendering.
- `DATABASE_URL= pnpm build`: passed before final geography/report-placement edits. Large bundle warning remains.
- `git diff --check`: passed.
- Broad `pnpm test` with empty DATABASE_URL encountered DB/credential-dependent failures; not represented as a passing full suite. No production database used for tests.

Browser UAT used `scripts/acquisition-v2-visual-uat.mjs`, synthetic fixtures only, at `http://127.0.0.1:3133/__v2-uat`. Verified initial mandate button disabled, approval enables it, editing price revokes approval. Verified missing costs disable scenario approval, explicit costs enable output, subsequent edits remove output and require renewed approval. Inspected desktop dialog and narrow report; DOM scroll width 351 versus inner width 354 (no horizontal overflow). No provider calls, real searches, broker actions or production mutations were made.

## Release gates still open

1. Original frozen real-listing golden snapshots, including exact asking price for source fixture 3. Synthetic arithmetic tests cannot replace the specified source-capture acceptance set.
2. Parser coverage against actual marketplace markup and all specified typed nonfinancial fields; blocked sources currently remain unresolved, with no mirror fallback.
3. Complete-waterfall and game-theory reporting remains operator-entered/local rather than a required persisted attachment to every PURSUE receipt. Screening verdict must not be represented as completed diligence.
4. Per-move scenario attribution and binding walk-away protections are not implemented. Hypothetical protection effects are not established facts.
5. Approved category benchmarks or an explicitly accepted disabled-detector release scope.
6. Cross-listing conflict reconciliation and seeded Monte Carlo (P1) remain unimplemented.
7. Clean scoped release, final build, deployed authorization/readback tests and full production UAT remain pending. Existing unrelated worktree changes were preserved; nothing was pushed or deployed.

Tracking: THI-266. Source/reconciliation: `specs/SIGNAL_HUNTER_SEARCH_V2_SOURCE_2026-09-29.txt` and `specs/SEARCH_V2_IMPLEMENTATION_DECISIONS.md`.

## V2 activation acceptance pass

- Durable receipt runtime acceptance passed seven checks on the existing, isolated MariaDB 11.8.9 fixture at loopback port 3307. Concurrent begin/save, actual row-lock waiting, owner denial, immutable captures, empty/failed outcomes and transaction rollback were exercised. Test-owned records were removed and pre-existing rows hash-verified unchanged. This is not TiDB production acceptance.
- A current Brevard broker listing was captured as raw HTML plus timestamped normalized text and SHA-256 hashes under `tests/fixtures/acquisition-v2/current-source-captures/`. Its $1,150,000 ask, $1,179,803 gross sales and $311,424 cash flow replay deterministically to G1/G2 failure. Source claims remain unverified finances. This current capture does not replace the ten original golden snapshots.
- The SWFL HVAC page can be read through web retrieval, but direct capture returned HTTP 403. Its cash flow is gated on the listing page. No search-result amount, access-control bypass or synthetic replacement was used.
- V2 capture-only research no longer makes an unnecessary second model extraction call after evidence persistence. Legacy metadata extraction remains unchanged. A regression test verifies the single discovery call and capture callback.
- Focused verification: six test files, 109 tests passed. Full-suite/build results are recorded separately when complete. No V2 production activation or document-upload rollout occurred in this pass.
- Parser semantic version is now `acquisition-v2.3`; regression coverage includes broker-label aliases, gated values, negation, contradictory nonfinancial claims and invalid dates. Remaining typed-field coverage and the original golden corpus are still release requirements.
- Completed V2 search receipts now show source records and screening candidates, rather than legacy catalog scores or the incorrect implication that no candidates exist when no global scores were changed. Legacy receipt behavior is preserved. Eleven presentation tests passed after updating the missing V2-state query mock.
- TypeScript and production build passed; the existing large-chunk warning remains. The first broad run had 2,939 passing tests, 18 skipped and one stale-mock failure, subsequently fixed and passing in the focused rerun. A final broad rerun follows.


## Editorial revision after operator feedback

Replaced the flat disclosure report and form grid with an acquisition-paper spread: verdict headline, selectable financial portrait with verbatim evidence margin, compact expandable rulebook, Senior reading notes, and an inline pencil-in annual cash ledger. Unknown costs remain italic placeholders; explicit amounts become stronger ink. The hypothetical result appears on a contrasting ink panel only after review.

This extends the existing paper/ink design system rather than introducing new brand colors. Styles are scoped in `client/src/styles/acquisition-v2-editorial.css`. Native buttons, labelled numeric inputs, focus outlines, reduced-motion support and narrow-container stacking are retained. Engine formulas and verdict rules are unchanged.

Browser checks: selecting SDE updates the evidence margin to `SDE: $702,537`; five explicit costs enable review; reviewing shows the scenario; clearing a cost removes the result and disables approval. At a 390px viewport, document scroll width was 386px (no horizontal overflow). Desktop and narrow ledger screenshots inspected. Synthetic test entries were cleared for the operator preview. Typecheck and build passed during this revision; the existing bundle-size warning remains. Production remains unchanged.
# Interaction refinement — approved editorial direction

Final validation: typecheck passed; 9 V2 engine/editorial tests passed; production build passed with the existing large-bundle warning. These are local validations, not deployment evidence.

- Added a selectable screening map with status marks and the exact selected gate explanation. Non-passing checks receive initial focus where present. Full rulebook and formula/source audit remain available.
- Added balanced headings, gentle keyed fades for selected explanations and scenario reveals, quiet hover transitions, and a blanket reduced-motion override.
- Worksheet now tracks entered annual costs and completion, keeps blanks unknown, offers field-specific verification prompts, and permits an explicit $0 exclusion only by operator action. Costs exceeding reported SDE after modeled debt service trigger a warning. The screen verdict is never changed by this worksheet.
- Browser verified: G4 selection exposes the financing condition; five illustrative entries totaling $152,000 enable approval; approval reveals $272,228 modeled distributable cash; changing owner replacement to $500,000 clears approval/results and flags the $127,772 shortfall. Test entries were then cleared. No provider, database, order or research action occurred.
- Narrow check: two-column gate map, document width 386 vs viewport 390. Temporary viewport reset after validation.
- Local only: no deployment or full authenticated UAT claimed.
# Analytical margin refinement

- Replaced the repeated hero source quote with selection-specific interpretation: price/SDE, claimed earnings cushion versus mandate, and SDE/revenue.
- Added a focused diligence question for each measure; source claim, formula, capture date and mandate remain in an expandable disclosure. Stale evidence warning remains outside disclosure.
- Missing figures stay unresolved; outside-price-boundary and below-earnings-floor cases are tested. No agent run, valuation, research or order is implied.
- Validation: 10 V2 tests passed; TypeScript check passed. Browser verified price, earnings and revenue selection plus source disclosure on port 3133. Desktop visual inspection passed. No production deploy; narrow-screen visual check not repeated in this pass.
# Rule-state polish alongside document-first work

- Cleared tiles use a sage fill; unknown tiles stay open/dashed; failures and watchlist caps retain distinct colors and labels. Selection is an independent ink outline.
- Counts and a segmented strip distinguish evaluated gates from unavailable detectors. No percentage quality score is shown, and an all-cleared case no longer opens a redundant detail by default.
- Desktop screenshot and narrow-screen inspection completed (observed 354px viewport, 351px document width; two-column 88px-tall tiles). Viewport override reset afterward.
- Eleven V2 tests passed and production build passed. Existing large-chunk warning remains. This is local validation, not deployment or full document-intake UAT.

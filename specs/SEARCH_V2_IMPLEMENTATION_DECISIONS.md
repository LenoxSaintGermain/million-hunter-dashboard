# Acquisition Search V2 — implementation decisions

Status: reconciliation draft, September 30, 2026. No engine implementation or release is represented by this document.

Source: [Signal Hunter Business Search Module Update Spec (v2)](https://docs.google.com/document/d/105x_0RCNWqlqkG8wEKTurmpFIX5c_2FofFCIroxxMpU/edit). Read-only source export: `SIGNAL_HUNTER_SEARCH_V2_SOURCE_2026-09-29.txt`. The requirements document is not independently verified listing evidence.

## Public boundaries proposed for test confirmation

1. Captured individual listing page → typed evidence record, with source URL, timestamp, verbatim spans and completeness states.
2. Evidence record + operator-confirmed, versioned mandate → deterministic gates, flags, formula trails and verdict.
3. Complete cash waterfall + versioned scenario assumptions → labeled game-theory report with inspectable probabilities and counterfactuals.

## Reconciliation

- G7 applies to the below-minimum earnings path: watchlist floor ≤ SDE < pursue floor, plus named moat. Higher-earnings listings may still be capped by G5/G10/G11 or three high flags. Do not discard those simply because they exceed the watchlist earnings band.
- Status exclusion precedes ranking. Otherwise FAIL > HOLD > WATCHLIST > PURSUE. Missing required evidence is unknown, never pass. A failed gate remains a failure even when another gate is unknown. PURSUE requires every applicable required gate to pass.
- Fixture 3 cannot establish WATCHLIST with an unverified asking price: HOLD unless another evidenced hard failure takes precedence. Do not substitute $2.5M.
- A cross-listing financial conflict cannot establish a current financial value. Retain both captures and request fiscal-year reconciliation; do not average them.
- No benchmark table is supplied. Disable benchmark-dependent checks with explicit reasons, rather than fabricate percentile values. Whether that permits a final release needs operator acceptance against the source spec's blocking criterion.
- Source-capture verification means the value appears in the captured listing, not that the business's finances are audited.
- Proposed mandate defaults are an example, not the operator's accepted criteria. Approval must bind the complete mandate version/content to the run; changed inputs invalidate downstream review.
- Unknown waterfall costs remain unknown. Do not silently set owner replacement, market rent, capital reserve, qualifier cost or preferred return to zero. A scenario requires explicit applicable costs or reviewed assumptions.
- Seller SDE divided by hours is a labeled heuristic, not wages or proof of seller motivation. Unknown/zero hours yield no hourly result.
- Platform control and concentration require evidence. A fixture's platform assumption is not proof of a real company's current contract.

## Explicit scenario interpretation

These are judgment-based priors, not statistical forecasts or causal proof of enforceability. A protected case means an assumed successful protection, not that a proposed agreement exists.

Four unprotected states: clean, haircut, hold-up, collapse. R3 adds to collapse, not a fifth state. OR-group shifts apply once per group. Increased adverse mass comes from clean. Reject invalid probability mass; do not quietly rescale negative probabilities.

Protected case:

1. Halve hold-up and collapse probabilities; return freed mass to clean.
2. Transfer half the haircut probability to a separate repriced state.
3. Repriced state retains the SDE haircut, reduces price by dollar haircut × original multiple, and recomputes debt service using the same financing assumptions. No double-counting price savings as operating income.
4. Keep the same explicit non-debt waterfall assumptions unless the operator changes them.

### Septic worked reconciliation (illustrative spec inputs)

SDE $702,537; asking price $1,850,000; baseline distributable $330,000 (before investor returns, as supplied by the example). R1 and R2 only.

| State | Unprotected probability | Protected probability |
|---|---:|---:|
| Clean | 47% | 63.5% |
| Haircut | 20% | 10% |
| Hold-up | 22% | 11% |
| Collapse | 11% | 5.5% |
| Repriced haircut | 0% | 10% |

Dollar haircut: $105,380.55. Price reduction: $277,500. With 90% debt at 10% over 120 monthly payments, annual debt-service savings are $39,605.58. Repriced cash is $264,225.03.

- Unprotected expected cash: **$233,984.36**.
- Protected expected cash: **$275,414.68**.
- Difference: **$41,430.33**.

Both match the source's rounded $234K/$276K within its $5K tolerance. This reconciles arithmetic, not the truth of the baseline cash or probabilities.

Attribution to an individual countermove still requires an explicit move-to-state mapping. Do not assign the aggregate benefit to every move or claim overlapping benefits are additive. Refusal of an operator-selected required protection can cap a previously eligible listing; it never erases a hard failure or unknown evidence.

## Pre-implementation integration findings

`server/acquisitionResearch.ts` currently extracts from search-provider snippets. It checks matching labels but does not fetch and preserve full listing-page evidence. This does not meet V1, even when amounts match the snippet. Its search discovery response must become URL discovery only.

`server/acquisitionSourceCheck.ts` currently checks HTTP status and cancels the response body. A 200 response is not page-content verification; blocked requests remain unresolved. The replacement needs bounded response reads, supported-host enforcement, no unchecked redirects, and explicit unavailable/blocked outcomes.

`server/routers.ts` applies saved financial bounds and legacy scoring. Keep acquisition V2 separate from Capital Aperture's order risk gates. Do not globally alter shared catalog scores based on one user's mandate.

`server/acquisitionThesisReview.ts` already persists owner/search-scoped comparison records. V2 needs independently versioned source/mandate/report records and read access checks; do not silently reinterpret old snapshots as V2.

## Build sequence

1. Confirm public test boundaries; implement source capture and typed parsing through those boundaries.
2. Add mandate validation, formula records, gates, flag templates and deterministic precedence.
3. Add complete-waterfall validation and explicit scenario state transitions; test the worked case independently.
4. Add owner-scoped run persistence and search integration. Preserve unsuccessful captures in the run receipt without promoting them.
5. Render the report's gates, assumptions, disabled detectors and research questions in the existing reading desk; no model-authored verdicts.
6. Test integration, authorization, stale-input invalidation and deterministic replay with `DATABASE_URL=`. Real listing snapshots remain a separate evidence gate.
7. Release only after reviewed acceptance; log exact source/build/revision and distinguish local tests from production UAT.

## Outstanding release inputs

- Approved category benchmarks, or explicit acceptance of visibly disabled dependent detectors.
- Original frozen listing snapshots for golden cases; the spec's summarized numbers alone do not satisfy the source-capture acceptance criterion.
- Fixture 3 exact asking price, if its full fixture is to be accepted rather than remain blocked.
- Confirmed costs/defaults and per-move scenario mappings before counterfactuals can be treated as ready for operator use.

## Local implementation update — September 30

Source capture, typed financial parsing, operator mandates, deterministic gates, source-bound questions, owner-scoped replay and local cost/scenario UI are now implemented. This supersedes the snippet-based implementation findings above, not the outstanding acceptance requirements. See `docs/qa/ACQUISITION_V2_LOCAL_UAT_2026-09-30.md` for exact checks and remaining implementation/release gaps. Production is unchanged.

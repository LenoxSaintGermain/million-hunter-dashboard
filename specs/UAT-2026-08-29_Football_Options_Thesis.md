# Capital Aperture UAT — Football Season Regulatory Options Thesis

Date: 2026-08-29 ET  
Surface: `https://wealth-signals.manus.space`  
Persona: first-time Capital Aperture user and options novice  
Boundary: paper research only; stopped before any proposal approval or broker action

## Verdict

**Not demo-ready end to end.** Thesis creation and Capital Mission setup are understandable, but the primary journey fails before play setup. The saved thesis was projected as an unresolved manual draft with no typed sectors, exposure paths, horizon, evidence requirements, or symbols. The resulting research run completed with zero candidates.

The system failed closed: `broker_orders` remained `0`. A manual advanced-research recovery seeded `DKNG` and returned one candidate, but that path is explicitly research-only and incorrectly converted the options/position intent into `long · buy shares` with a `Swing · 2–10 sessions` horizon.

## Demo thesis

**Name:** Demo — Football Season Regulatory Split

**Belief:** The 2026 football season is a positive demand catalyst for licensed sportsbooks, while the August 28 Ninth Circuit ruling is a negative regulatory catalyst for sports prediction markets. DraftKings has both exposures, so direction must be earned by evidence and price confirmation.

**Research expression:** Compare a single-leg long DKNG call with a single-leg long DKNG put. Allow neither unless the company/regulatory mechanism, options chain, bid/ask, liquidity, catalyst timing, and price confirmation are verified.

**Risk boundary:** Paper only; maximum premium at risk `$250`; no uncovered, short, or multi-leg options; preserve cash when evidence is missing or contradictory.

**Horizon:** 8–16 weeks; review after NFL Week 1 and after the first post-kickoff DraftKings earnings update. The exact earnings date and eligible expiration remain unresolved evidence, not facts to infer.

## Primary-source basis

- Ninth Circuit, *KalshiEX, LLC v. Assad*, filed 2026-08-28: the panel held that the Commodity Exchange Act likely does not preempt Nevada gaming regulation as applied to Kalshi sports-event contracts, affirmed dissolution of the injunction against Nevada enforcement, and remanded the election-contract issue.
- DraftKings 2025 Form 10-K, filed 2026-02-13: DraftKings says NFL/NBA overlap drives peak fourth-quarter engagement, identifies prediction markets as a new business, and warns that event-contract litigation and regulation could limit product availability.
- NFL official calendar: 2026 kickoff weekend begins September 9–10.

These sources establish a real, current tension. They do **not** establish a guaranteed directional stock outcome.

## Tested journey and receipts

1. Opened `/thesis` and selected `Capital`.
2. Entered the thesis statement plus belief, evidence, seeks, avoids, horizon, invalidation, and risk-boundary detail.
3. Saved and selected `Save and use in Capital Mission`.
4. Created canonical thesis `v540001`; projected Capital thesis `180001`.
5. Configured the Capital Mission:
   - Capital: `$5,000`
   - Target stretch: `$5,750` (aspiration, not forecast)
   - Max planned loss: `$250`
   - Intended horizon: named catalyst / position
   - Objective: best qualifying play / catalyst verification
   - Instrument: defined-risk options
6. Saved exact custom mission text: “Which defined-risk DKNG option best tests whether 2026 NFL-season sportsbook demand can outweigh the August 28 Ninth Circuit pressure on sports prediction-market exposure through the first post-kickoff earnings review?”
7. Compiled Play Slate:
   - Decision Run `150001`
   - Revision `270001`, version `1`
   - Research run `150001`
   - Result: completed, universe `0`, candidates `0`, no error surfaced
8. Inspected the saved projection. It contains the warning: “Manual thesis draft: the compiler was unavailable. No sectors, exposure paths, horizons, portfolio rules, or trade conclusions were inferred.”
9. Tested the advanced research-only recovery:
   - Seeded `DKNG` with a `$5,000` starting view
   - Research run `180001`
   - Candidate `60001`
   - Result: one DKNG candidate, but rendered as shares, opening-range breakout, swing horizon; no proposal path
10. Verified `broker_orders = 0` before and after the UAT.

## Gaps

### P0 — Compiler fallback creates a dead-end run

The thesis compiler was unavailable, but the UI still presented the thesis as active and allowed Play Slate compilation. Its projection graph was empty, `intended_trades` was empty, and the run returned zero candidates in about 270 ms.

**Required:** A manual draft must not masquerade as a compiled thesis. Show `Needs structure` before Capital Mission, explain exactly what is missing, and offer a guided typed fallback for symbol/universe, horizon, evidence, invalidation, and instrument. Block `Compile Play Slate` until the search universe is non-empty.

### P0 — Structured thesis detail is saved but ignored

The operator entered horizon, evidence basis, invalidation, and risk boundary. The compiled receipt nevertheless displayed all three as `Unknown`, with empty `compiled_filters`, `evidence_requirements`, and `auto_disqualifiers`.

**Required:** Persist these as first-class typed fields and render their provenance. Do not append them as prose and then claim they are unknown.

### P0 — Mission edits are not durable in the UI

Changing capital or horizon after editing the mission resets the custom question to a generated template. The database saved the custom mission, but returning to Decision Center displayed the generated template again.

**Required:** Preserve `missionDirty` across other field edits and hydrate the exact immutable revision text after reload.

### P0 — Options intent is dropped in the recovery path

The canonical thesis and Capital Mission explicitly requested defined-risk options and a position horizon. The fallback research path showed `long · buy shares`, an opening-range-breakout play, and `Swing · 2–10 sessions`.

**Required:** Vehicle and horizon are contract-level invariants across Runway, advanced research, candidate generation, comparison, and proposal preparation. If advanced research cannot honor options, label it incompatible and do not substitute shares.

### P1 — Zero-candidate explanation is not diagnostic

The run says only that no securities met evidence and guardrail thresholds. The receipt does not distinguish empty thesis graph, missing provider data, portfolio constraint, options entitlement, market-closed tape, or a legitimate zero-result universe.

**Required:** Show a typed cause stack and the one safe recovery action.

### P1 — Catalyst semantics conflict

The detailed thesis named the August 28 ruling and NFL kickoff, but the Mission said `Declared catalyst: Not declared in thesis`. `Long term · review every 30 days` rendered as `Catalyst window`, and the date-time look-back did not retain a value during this browser pass.

**Required:** Parse named catalysts into typed date/event records, distinguish `position` from `catalyst_window`, and persist the review date with an explicit save acknowledgement.

### P1 — Evidence gates are generic and miss the actual thesis

The decisive checks were P/E, P/S, average daily dollar volume, and realized volatility. They omitted the Ninth Circuit ruling, DraftKings prediction-market exposure, NFL-season demand mechanism, the next earnings date, options chain, expiration, strike, premium, spread, volume/open interest, IV, and contract multiplier.

**Required:** Build gates from the thesis mechanism and selected instrument. Generic valuation/liquidity checks may supplement them, not replace them.

### P1 — Mobile evidence view horizontally overflows

At a 375 × 812 viewport the document client width was `337 px` and scroll width was `404 px`; a horizontal scrollbar was visible across the decisive-check view.

**Required:** No document-level horizontal overflow at 375 px. Tabs may scroll inside their own container without widening the page.

### P2 — The options novice is not taught the decision

The current flow never explains call versus put, premium as maximum loss, 100-share multiplier, expiration/catalyst relationship, bid/ask spread, IV, open interest, early-exercise/assignment context, or why cash is valid.

**Required:** Progressive disclosure at the decision point:

- First glance: `Bullish call`, `Bearish put`, or `No option yet`; premium at risk; catalyst; expiration relationship; current gate.
- Second glance: strike zone, break-even formula, spread, IV, volume/open interest, scenario envelope, and invalidation.
- Audit layer: exact chain timestamp, provider, calculations, assumptions, and missing fields.

## Recommended demo sequence after repair

1. Start at Thesis Workspace with the saved football/regulation thought.
2. Show the system split it into two forces: football-season demand and prediction-market regulation.
3. Confirm the tradeable public expression is DKNG and explain why Kalshi itself is not the stock being traded.
4. Set `$5,000` mission capital, `$250` maximum premium loss, 8–16 week horizon, and defined-risk options.
5. Let Aperture rank three outcomes: conditional long call, conditional long put, preserve cash.
6. Open the top-level comparison first; reveal legal evidence, company exposure, and options-chain details only on demand.
7. Stop at a complete paper ticket or a durable cash receipt. Do not approve or submit during the demo.
8. Queue the outcome review for the named catalyst and show how the learning record returns later.

## Demo gate

Do not use this journey as the Jim/CH Capital end-to-end demo until all four P0 items pass in production. If a deterministic fixture is used for teaching the options module, label it `Illustrative fixture · no live provider claim` and keep it separate from the real-world thesis run.

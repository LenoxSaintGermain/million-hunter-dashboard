# Jim Catalyst-Reaction Playbook — Capital Aperture Fit Assessment

## Bottom Line

Jim’s playbook **fits the thesis layer as an intraday, event-driven Capital / Trade thesis**, and the current product correctly preserves several important safeguards: paper-only execution, human approval before broker submission, a hard single-name mandate, a liquidity floor, a dated catalyst deadline, and an intraday cut-off.

It does **not yet fit as a reliable catalyst-reaction execution workflow**. The current engine interprets the playbook as a thematic equity-research request. Jim’s actual decision method is a small, conditional event tree: confirm the release, inspect the opening response, test VWAP and volume, size off entry-to-stop risk, enforce branch exclusivity, then flatten by a stated time. Those controls are largely free text today, not durable data, gates, or monitored conditions.

> The issue is not that Capital Aperture lacks research. The issue is that it cannot yet prove that the conditions which make a catalyst setup tradable are true **at the time the operator prepares a proposal**.

## What Fits Today

| Playbook requirement | Current Capital Aperture behavior | Fit |
| --- | --- | --- |
| One reusable Capital / Trade thesis | Natural-language thesis compiles into beliefs, horizons, sectors, exclusions, portfolio rules, behavior, and exposure tree | **Strong** |
| Paper-only, human-controlled action | Proposals remain `pending_approval`; a human separately approves before submission; broker adapter is structurally paper-only | **Strong** |
| $2,000–$10,000 short-term bucket | A run can use an explicit deployable-capital envelope; the trial uses $5,000 | **Strong** |
| Minimum liquidity | A short-horizon run requires an ADV floor; the existing mandate floor is $20M ADV | **Strong** |
| No overnight / intraday cut-off | Intraday is an explicit holding period, orders have a deadline, and new intraday orders are blocked after the prescribed cut-off | **Strong** |
| Explicit thesis invalidation | Run and proposal require a non-boilerplate invalidation condition | **Strong** |
| Evidence review before a proposal | Recorded human evidence reviews are required before candidate-linked paper proposals can be created | **Strong** |
| Dated macro and company catalyst anchors | The trial source-verified August 18 Census, Federal Reserve, and Home Depot anchors | **Partial** |
| XHB/HD/TQQQ/SQQQ as a bounded event tree | Universe discovery expands thesis exposures into generic candidate symbols | **Weak** |

## Structural Gaps Exposed by the Trial

| Priority | Gap | Why it matters to Jim’s method | Current state | Smallest credible fix |
| --- | --- | --- | --- | --- |
| **P0** | No structured catalyst setup object | An event date, release time, instrument, branch, and condition are inseparable in this strategy | Catalyst is prose plus one generic deadline | Add `catalyst_setups` with event type/time, symbol, branch group, condition state, source, and expiry |
| **P0** | No live intraday confirmation evidence | VWAP alignment, 15/30-minute opening range, sustained volume, and post-release price state determine whether there is a setup | Technical research uses daily-style trend/support/resistance narrative | Add intraday bars + computed VWAP, opening range, relative volume, and timestamped trigger state; show source latency |
| **P0** | No entry-stop risk sizing gate | Jim sizes shares from risk dollars ÷ (entry − stop + slippage), not from an arbitrary notional | Proposal form takes notional or quantity; it does not require entry, stop, slippage, or planned loss | Require entry/stop/slippage and derive quantity, planned loss, R multiple, and notional before proposal creation |
| **P0** | No correlated-branch exclusivity | XHB and HD must be mutually exclusive; TQQQ and SQQQ are mutually exclusive; housing + Nasdaq loss is capped together | Single-name and sector caps exist, but no named branch or basket rule | Add branch groups and a cross-setup loss-budget gate, blocking incompatible open/pending proposals |
| **P1** | No release-result verifier | The strategy trades confirmed reactions after results, not anticipation | Catalyst pass searches broadly over 6–12 months | Add a release-result fact with scheduled/actual/revised values, timestamp, source, and surprise interpretation clearly labeled as modeled where applicable |
| **P1** | No time-stop management | The strategy needs XHB 3:30, HD close, and leveraged ETF 3:45 decision deadlines | Monitoring is narrative Sonar checks after entry | Add a visible time-stop countdown and a human-required close-review state; never auto-close without approval |
| **P1** | Candidate scoring is thematic, not state-based | A high thesis-fit symbol is not necessarily tradable now | Score uses thesis expression, evidence, valuation, and generic tradability | Add a separate `setup_readiness` score that cannot be substituted for thesis fit |
| **P2** | Reference trigger levels can go stale | Price levels and historical quote references decay immediately | Static levels would be copied from a note unless revalidated | Store levels only with provider, timestamp, adjustment basis, and automatic staleness flag |
| **P2** | Research-run progress can be slow for an eight-symbol event window | The operator wants a fast branch decision shortly after a release | Intraday run still discovers and researches a multi-symbol universe | Let an operator seed a fixed symbol/event list and bypass universe discovery for a bounded catalyst run |

## Current Workflow vs. Jim’s Intended Workflow

| Stage | Current workflow | Jim’s intended operator loop | Difference that matters |
| --- | --- | --- | --- |
| Thesis | Convert beliefs into theme/exposure graph | Define three mutually exclusive event branches | Branch logic gets lost during generic discovery |
| Research | Discover symbols, then run catalyst + technical narrative passes | Verify named event, outcome, VWAP, volume, opening range, and trigger level | Narrative research cannot prove a live setup |
| Decision | Review generic evidence and prepare a notional-based paper proposal | Confirm one branch, calculate shares from risk, apply group loss budget | Proposal lacks the risk arithmetic that governs the trade |
| Approval | Human approves a paper order | Human reviews a bounded setup card and confirms its current state | Strong approval control exists, but inputs are incomplete |
| Monitoring | News/catalyst/invalidation checks | Time stop, VWAP reclaim, event-response decay, and explicit close review | No intraday lifecycle management |

## Trial Controls and Boundaries

The run uses the connected **Alpaca Paper — AI Thesis** account, a $5,000 deployable research envelope, `intraday` holding period, $20M ADV floor, and a 5% single-name cap. It carries **no intended trade, paper proposal, approval, submission, or broker order**. The run is intended to test research, evidence, and workflow fit only.

The underlying event anchors are sourced from the U.S. Census Bureau, the Federal Reserve, and Home Depot Investor Relations. Reference prices, consensus figures, and triggers from Jim’s note remain reference-only until revalidated against a timestamped market-data source.

## Observed Trial Outcome

The completed paper-only run is **#300001**. It generated eight candidates and no broker order. The candidate set was **TT, IBP, MAS, OC, SOXL, WMS, BLDR, and NAIL**. It did not surface Jim’s named XHB, HD, TQQQ, or SQQQ setup branches. Every candidate received the same generic valuation-oriented review fields (`Price / earnings` and `Price / sales`) rather than event-response checks.

This is decisive evidence of the design gap: the existing engine successfully treats the thesis as a broad housing/technology exposure map, but not as a time-bound catalyst reaction plan. The outcome is valid for thematic discovery, but it is insufficient to determine whether any of Jim’s three defined intraday branches is actionable.

## Recommended Product Decision

Do **not** present a Jim-style setup as “paper-proposal ready” based only on the current generic evidence checks. The product should instead introduce a distinct **Catalyst Setup Card** with three mandatory states:

1. **Event verified** — the release/result and timestamp are sourced.
2. **Market response verified** — price/VWAP/volume/opening-range conditions are fresh and stated.
3. **Risk plan verified** — entry, stop, slippage, quantity, planned loss, time stop, and mutual-exclusivity budget pass.

Only then should the existing human approval and paper-broker submission controls activate.

## Recommended Delivery Sequence

| Release | Outcome | Must be real on day one | Explicit non-goal |
| --- | --- | --- | --- |
| **1. Catalyst Setup Primitive** | The product can store Jim’s exact event tree rather than treating it as a thematic universe | Fixed symbols, event timestamp/source, branch group, exclusion rules, expiry, and a “not yet verified” state | No generic auto-discovery and no claim that a setup is actionable |
| **2. Market-State Proof** | A setup becomes reviewable only when live evidence confirms the event response | Timestamped intraday bars, VWAP, opening range, relative volume, trigger/invalidating level, source/latency status | No inference from stale daily technical narrative |
| **3. Risk Plan Gate** | A paper proposal is sized from risk, not a freeform notional | Entry, stop, slippage, derived quantity, planned loss, R target, branch/basket loss budget, and mutual-exclusivity blocking | No bypass to the current proposal form for catalyst setups |
| **4. Intraday Management** | The human receives the right close/review prompt at the right time | Time-stop countdown, VWAP/invalidation state, fill-to-close thread, and human-required close review | No autonomous exits or live brokerage actions |

This sequence preserves the current product’s strongest asset—**human-controlled paper execution**—while making the upstream decision evidence worthy of that control. Building the proposal screen first would be the wrong order: it would create a polished way to approve an unproven setup.

## References

[1] [U.S. Census Bureau — Survey of Construction Release Schedule](https://www.census.gov/construction/soc/schedule.html)

[2] [Federal Reserve — August 2026 Calendar](https://www.federalreserve.gov/newsevents/2026-august.htm)

[3] [The Home Depot Investor Relations — Events & Presentations](https://ir.homedepot.com/events-and-presentations?page=1)

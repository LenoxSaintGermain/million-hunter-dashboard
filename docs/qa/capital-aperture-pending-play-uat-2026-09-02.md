# Capital Aperture pending-play UAT — 2026-09-02

- Tested: 2026-09-02 12:16–12:31 EDT
- Surface: `https://third-signal-capital-aperture.web.app/aperture/plays`
- Authenticated owner: existing Lenox operator session
- Deployed application release: `009a2f9503d3a54e4173abad627e0074986be48d`
- Scope: every visible decision card, every in-motion paper play, and every scheduled review shown by the live Play Desk
- Safety boundary: paper only; no new proposal, approval, submission, or broker order was created

## Final live inventory

- Choose: 5 cards
- Approve / send: 0 tickets
- Monitor: 5 plays
- Reviews due: 3 items
- Research backlog: 11 journeys

## Decision-card results

| Play Desk card | Live result | UAT verdict |
| --- | --- | --- |
| UAT — IWM Queue-at-Open Day Trade (`run 570001`) | Candidate `420001` already has one accepted/queued IWM share order at a `$290.57` LIMIT/DAY. The ticket page correctly prevents duplication. | Fail: the run remains under “Ready to choose” even though its only candidate is already at the broker. |
| UAT — IWM Intraday Confirmation (Submit Path) (`run 540001`) | Catalyst deadline has passed; the app correctly refuses a new proposal. “Review paper readiness” sends the operator to the general Portfolio page. | Fail: historical blocked run is labeled “Ready to choose,” and its next action routes away from the actual expired-catalyst decision. |
| CH Capital — AI Growth Watchlist Options (`run 510001`) | MRVL reaches a live contract chain, but the lowest displayed call premium still exceeds the current `$736` per-play loss ceiling. COHR and MU each remain blocked on primary-source catalyst evidence. NU candidate `360004` already has an accepted/queued `$14` call at `$1.54`. | Fail: one generic card hides four materially different states and does not name the risk-ceiling blocker after an MRVL contract is selected. |
| UAT — Post-Benchmark Small-Cap Confirmation (Reject Path) (`run 480001`) | Catalyst deadline has passed; the app correctly refuses a new proposal. | Fail: historical blocked run is still labeled “Ready to choose.” |
| AI Infrastructure Cycle (`run 1`) | CRDO lead is 22 days old and still has three open decisive checks. “Resolve here” correctly opens the questions in place. | Partial: inline resolution works, but this old unresolved run belongs in backlog rather than the immediate-decision lane. |

## In-motion results

| Instrument | Run / candidate | Refreshed state |
| --- | --- | --- |
| `MGM261120C00040000` | `360001 / 240002` | Broker refresh mirrored one fill. Executed at `$4.20` premium; lifecycle now shows one executed paper trade. The intentionally rejected duplicate remains visibly identified as not approved. |
| `DKNG261120P00020000` | `360001 / 240003` | Executed at `$0.96` premium. The monitoring tab opens manually, but the prominent “Monitor paper play” button does not switch to it. |
| `IWM` | `570001 / 420001` | Still accepted/queued at `$290.57`; broker refresh reported `0 fill(s) mirrored`. |
| `DKNG261120C00025000` | `330001 / 210003` | Still accepted/queued at `$2.10`; broker refresh produced no new fill. |
| `NU261120C00014000` | `510001 / 360004` | Still accepted/queued at `$1.54`; broker refresh reported `0 fill(s) mirrored`. |

## Scheduled-review results

| Review | Live result | UAT verdict |
| --- | --- | --- |
| TLT cash look-back (`decision 120001 / revision 240001`) | Opens the correct immutable cash receipt. Outcome recording remains disabled until an evidence note is supplied. No unsupported outcome was recorded. | Pass. |
| Football-season outcome due 2026-10-01 16:48 EDT | Opens `decision 330001 / revision 510001`, the generic Capital Mission editor. | P0 fail: it does not open the specific order monitoring/outcome surface. |
| Football-season outcome due 2026-10-01 20:48 EDT | Opens the same `decision 330001 / revision 510001` mission editor and is indistinguishable from the first review. | P0 fail: two order-specific reviews collapse to one generic decision route. |

## Release blockers

1. **P0 — Scheduled order outcomes route to the wrong object.** `AperturePlayDesk.tsx` always sends a pending outcome to `/aperture/decision/:decisionRunId/revision/:revisionId`. The pending-outcome response omits `orderId`, `runId`, and `candidateId`, so the client cannot route an order outcome to its paper lifecycle.
2. **P0 — Immediate-decision lane ignores terminal and blocked state.** `decisionReady` is derived only from research-journey state. It does not exclude a run whose candidate already has an active order, whose catalyst deadline has expired, or whose decisive checks remain open.
3. **P0 — One run-level card hides mixed candidate states.** The CH Capital card says “Ready to choose” while NU is already queued, MRVL exceeds the loss ceiling, and COHR/MU lack catalyst evidence. The card must expose the best available next action and the number/state of alternatives.
4. **P1 — Primary monitoring CTA is inert.** “Monitor paper play” does not activate the “Check whether thesis still holds” tab; the operator must discover and click the tab manually.
5. **P1 — MRVL risk failure is not stated at the action.** After selecting the `$210` call, maximum loss is `$2,205` against a `$736` ceiling, but the disabled button only says “Review the plan.” The blocking sentence should name the ceiling breach and offer another contract, reduce risk, or preserve cash.

## Required acceptance pass

- “Choose” contains only actionable research decisions; active-order and expired-catalyst runs are removed or relabeled with their true next action.
- A mixed-candidate run summarizes each state and opens the best actionable candidate without hiding queued or blocked alternatives.
- Each order-specific outcome card includes instrument, order state, and due time, and opens that order’s lifecycle directly.
- “Monitor paper play” activates the thesis-holds tab in one click.
- Risk-preflight failure states show the measured premium, ceiling, shortfall, and one in-place resolution action.
- Re-run this same owner-scoped inventory and verify that no route offers duplicate order creation for an active candidate.

## Broker safety receipt

- New proposals created during this UAT: 0
- Approvals performed during this UAT: 0
- Submissions performed during this UAT: 0
- New broker orders created during this UAT: 0
- Existing fills mirrored: 1 (`MGM261120C00040000` at `$4.20` premium)
- Remaining accepted/queued orders: IWM, `DKNG261120C00025000`, and `NU261120C00014000`

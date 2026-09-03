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

## Repair and production re-UAT — 2026-09-02 12:37–13:16 EDT

- Repair commits: `566fe0be0ee17118bb342554e57697e0f9215cc3` and follow-up `1c17f26ca8b00646f0064fcfd11ece9d4b82d404`.
- Cloud Build: `9a03cd42-f383-4290-910f-7ad407e90f33` — `SUCCESS`.
- Image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:1c17f26c-firebase`.
- Image digest: `sha256:cea14db2476342db1d1d42c4687473ad41a9f5022898f4f68b029f2b32fc136a`.
- Ready revision: `capital-aperture-00036-ls8`, serving 100% of Cloud Run traffic.
- Public validation: `/aperture/plays` returned HTTP 200, same-origin `system.health` returned `ok: true`, and the served bundle contained the exact `1c17f26ca8b00646f0064fcfd11ece9d4b82d404` marker.

### Final live inventory

- Choose: 4 run cards representing 5 ready candidates.
- Approve / send: 0 tickets.
- Monitor: 5 plays — 2 filled and 3 accepted/queued.
- Reviews due: 3 items.
- Research backlog: 11 journeys.
- Browser console errors during the final sweep: 0.

### Acceptance results

| Acceptance check | Production result |
| --- | --- |
| Candidate-level decision state | Pass. Active, expired, declined, blocked, and failed candidates no longer masquerade as fresh choices. Mixed CH Capital state reads `1 ready · 1 in motion · 2 need evidence`. |
| Ready decisions | Pass. MRVL opened `run 510001 / candidate 360001`; MGM opened `300001 / 180002`; CZR opened `270001 / 150001` and `240001 / 120001`. The second ready candidate in run `300001`, CZR `180001`, also opened its own exact ticket. |
| MRVL risk recovery | Pass. The live `$210` call showed bid `$21.80`, ask `$22.05`, one-contract maximum loss `$2,205`, and the current `$735` per-play ceiling. The ticket exposed `Choose a lower-premium contract` and `Preserve cash · $0 risk` in place. Neither action was committed during this read-only UAT. |
| Filled-play monitoring | Pass after the follow-up route repair. MGM `240002` and DKNG put `240003` opened their exact execution routes with `lifecycle=monitoring`, the thesis-holds tab selected, and `Run reviewed checks` visible. |
| Queued-order receipts | Pass. IWM `570001 / 420001`, DKNG call `330001 / 210003`, and NU call `510001 / 360004` opened their exact Paper Ticket receipt and remained accepted/queued. |
| Scheduled reviews | Pass. TLT opened immutable cash receipt `decision 120001 / revision 240001`; MGM and DKNG play outcomes opened their distinct order monitoring routes instead of the generic mission editor. |
| Duplicate prevention | Pass. Existing active candidates open their current order lifecycle and do not expose a fresh proposal path. |

### Final broker safety receipt

- New proposals created during repair UAT: 0.
- Approvals performed during repair UAT: 0.
- Submissions performed during repair UAT: 0.
- New broker orders created during repair UAT: 0.
- Existing broker-order count before / after: 5 / 5.
- No provider configuration, invitation, database migration, or real-money rail changed.

## Remaining-play completion UAT — 2026-09-02 19:58–20:16 EDT

- Final source commit: `f122c891e9f3cac22bb95810e11e049903d8274b`.
- Final Cloud Build: `b838a313-ac1f-44fc-bce2-3f0d8d26d96f` — `SUCCESS`.
- Final image digest: `sha256:a463b55ded8216b7ef320c5cf13997e2c7dc9cc8081c5d5e284398ae53408826`.
- Final Cloud Run revision: `capital-aperture-00040-ccf`, explicitly routed to 100% of traffic.
- Paper destination: `Alpaca Paper — AI Thesis`, external account `PA3X46OF7EKJ`.
- Account snapshot refreshed at 2026-09-02 20:05:38 EDT: equity `$98,068`, cash `$59,482`, buying power `$344,839`. The product confirmed that the sync created or changed no order.

### Completed decisions

| Thesis | Run / candidate | Live evidence and refusal | Final disposition |
| --- | --- | --- | --- |
| CH Capital — AI Growth Watchlist Options | `510001 / 360001` · MRVL | Selected quoted `MRVL261120C00210000`: Nov. 20, 2026 `$210` call, bid `$21.60`, ask `$22.15`, 2.5% spread, volume 135, OI 839. Maximum premium loss `$2,215` exceeded the `$735` per-play ceiling; 30-day ADV remained unknown. The repaired refusal names underlying `MRVL`, not the OCC symbol. | Preserved as cash at `$0` risk. No proposal or order created. |
| UAT — Football Season Regulatory Split (Defined-Risk Options) | `300001 / 180002` · MGM | Selected quoted `MGM261120C00040000`: Nov. 20, 2026 `$40` call, bid `$3.30`, ask `$4.30`, 26.3% spread, volume 38, OI 3, maximum premium loss `$430`. Preflight failed closed because 30-day ADV was unknown. The repaired hard-block card exposed both `Choose another play` and `Preserve cash · $0 risk` in place. | Preserved as cash at `$0` risk. No proposal or order created. |
| UAT — Football Season Regulatory Split (Defined-Risk Options) | `300001 / 180001` · CZR | No contract was selectable. The nearest `$30` call showed bid `$0.01`, ask `$2.53`, 198.4% spread, volume 82, OI 121. The ticket exposed retry, another-contract, and cash choices on the same screen. | Preserved as cash at `$0` risk. No proposal or order created. |
| UAT — Football Season Regulatory Split (Defined-Risk Options) | `270001 / 150001` · CZR | No contract was selectable; the same nearest contract showed a 198.4% spread. The ticket failed closed and kept the resolution on the ticket. | Preserved as cash at `$0` risk. No proposal or order created. |
| UAT — Football Season Regulatory Split (Defined-Risk Options) | `240001 / 120001` · CZR | No contract was selectable; the live chain remained unusable rather than being inferred or manually overridden. | Preserved as cash at `$0` risk. No proposal or order created. |

### Repairs proven in production

1. Commit `3981c543be8566968f3ef0107b37409bb1d0fa48` changed option-liquidity refusal copy to identify the underlying and added an inline `$0`-risk resolution for generic hard option blocks.
2. Commit `f122c891e9f3cac22bb95810e11e049903d8274b` made recorded skipped/cash decisions retire from the Play Desk choice lane.
3. MRVL exposed the corrected underlying label and its measured risk-ceiling choice. MGM exposed the new inline hard-block actions. Both CZR paths retained the quote-unavailable recovery actions.
4. Each completed cash decision produced a visible success receipt. The choice queue moved from 4 run cards / 5 ready candidates to 0. Cash state is visible in the expanded research backlog.

### Final safety and queue receipt

- Choice queue before / after: 4 run cards representing 5 candidates / 0.
- Approve-or-send queue before / after: 0 / 0.
- Existing broker-order and in-motion count before / after: 5 / 5.
- New proposals: 0.
- Approvals: 0.
- Submissions: 0.
- New broker orders: 0.
- Existing in-motion instruments remained `MGM261120C00040000`, `DKNG261120P00020000`, IWM, `DKNG261120C00025000`, and `NU261120C00014000`.
- No approve or submit action was reached. A fresh action-time confirmation remains required before any future approval or paper-broker submission.

### Validation

- First repair suite: 136 focused tests passed; TypeScript check and production build passed.
- Retirement repair suite: 28 focused tests passed; TypeScript check and production build passed.
- Browser UAT used the authenticated owner session against the public Firebase URL after each final revision was promoted.

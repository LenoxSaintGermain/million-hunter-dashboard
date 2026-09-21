# Capital Aperture — language, voice, and product vocabulary

Status: language system with initial implementation, 2026-09-21. Not deployed in this pass; no authorization for real-money trading.

## The voice

A calm, capable trading companion. Understands the trade, respects your judgment, and tells you what matters next. Neither a risk-committee memo nor a social trading hype feed.

Audience: people comfortable with consumer investing apps, including people exploring publicly disclosed trades. Familiarity with an app does not imply options expertise. Do not assume that a disclosed trade is current, replicable, or evidence of future returns.

**Voice promise:** Understand the idea. See the trade-offs. Know your next step.

- Lead with the result or decision, then the reason.
- Address the person as “you,” not “operator.” Use “we” only for a service action the product actually performs.
- Keep real trading terms. Explain them at the moment they become useful.
- Be decisive about facts and candid about uncertainty.
- Write short sentences, not compressed strings of jargon.
- Never turn a target into an obligation to trade. Waiting is a valid decision.
- No hype, confetti, insider insinuations, guilt, or “safe trade” language.
- Never imply an advisor relationship, continuous supervision, or autonomous execution the product does not provide.

Personality in one line: **“Here’s what we know. Here’s what remains uncertain. Here are your options.”**

### Tone changes with the moment

| Moment | Voice | Example |
| --- | --- | --- |
| Exploring | Curious, grounded | “What makes this idea worth exploring?” |
| Comparing | Balanced | “Higher demand supports the case. Higher costs could weaken it.” |
| Waiting | Unhurried | “Waiting for the entry condition. Last checked at {time}.” |
| Blocked | Specific, useful | “This order exceeds your position limit. Reduce its size or inspect the limit.” |
| Uncertain | Candid | “We couldn’t confirm the order status. Check before trying again.” |
| Completed | Factual, restrained | “Review saved.” Not “Great move!” |
| Loss | Direct, nonjudgmental | “The position is down {value} since entry.” Only from verified calculation. |

For disclosed public-official trades, show transaction date and disclosure date separately. A disclosure is not proof of a current holding, an endorsement, or a recommendation to copy it.

## Three vocabulary layers

1. **Everyday interface:** your plan, trade ideas, account limits, review order, check again.
2. **Trading vocabulary:** long call, short position, swing trade, limit order, buying power, bid/ask, unrealized P&L. Retain the term, add a short explanation where useful.
3. **Internal vocabulary:** canonical, projection, receipt, dispatch, underwriting revision, rail, preflight. Keep in code and optional technical records, not the primary task language.

These are contextual mappings, not a global find-and-replace. A short position is not a short time horizon. A thesis is not yet a trade. A filled closing order is not a new position.

## Account mode is a fact, not a brand voice

| Verified state | Visible label | Consequential action |
| --- | --- | --- |
| Simulated brokerage account | Practice account · {broker} | Send practice order |
| Supported, verified real-money account (future capability) | Real-money account · {broker} | Send order to {broker} |
| Mode or destination unknown | Account not verified | Verify account; submission stays blocked |
| Research without a trading connection | Research only | Review trade idea |

“Paper trading” can appear in help: “Practice trading uses simulated money. It does not trade real funds.” Keep official broker names intact, including “Alpaca Paper.” A production backend or real quote API does not establish real-money execution. Market session, data freshness, and account mode are separate facts. Never use a bare “Live” badge to conflate them.

## Contextual terminology library

| Current/internal phrase | Default user wording | Meaning to preserve |
| --- | --- | --- |
| Paper-only operator instrument | Practice account · {broker} | Only when simulation is verified |
| Capital Mission | Trading plan | Proposed navigation change; apply consistently, not piecemeal |
| Canonical thesis | Saved thesis | The saved belief, distinct from a specific trade idea |
| Create a thesis | Start with an idea | Helper: “What do you think could change, and why?” |
| Thesis | Thesis | Helper: “Your view of what could happen and why.” |
| Underwrite my mission | Analyze my plan | “Finds trade ideas within your limits. Does not send an order.” |
| Underwriting result | Analysis result | Not a current eligibility check unless it actually is one |
| Play slate / conditional playbook | Trade ideas | Ideas are not orders |
| Candidate | Trade idea | A security being researched is not yet a position |
| Validate this play | Check this idea | Explain which research checks start |
| Mandate / governance | Account risk limits | A plan cannot override a tighter account limit |
| Headroom | Remaining risk allowance | Name dollars, scope, timestamp, and binding limit |
| Binding constraint | Limit affecting this trade | Explain the actual restriction beside the value |
| Gate | Required check | Name the check: “Refresh the option quote” |
| Invalidation | What would change this view | Keep the recorded condition inspectable |
| Catalyst | Catalyst | Helper: “An event that could affect the price.” |
| Kill condition | When this idea no longer applies | Does not imply automatic selling |
| Receipt | Saved decision / confirmation | Choose based on the actual object |
| Revision | Version / changes | Preserve the exact historical identity |
| Preflight | Final order checks | Does not approve or send by itself |
| Dispatch unresolved | Order status unconfirmed | “Check broker status before trying again.” |
| Rails / Ledger | Account details | Only if the disclosure contains account details; use “Activity” for an event ledger |
| NAV | Account value | Current field is account equity; not allocated plan capital |
| BP | Buying power | Do not silently label a fallback cash value buying power |
| Util | Do not rename without validating the metric | See metric audit below |
| Preserve optionality / cash disposition | No new trade | Existing holdings and orders remain unchanged |
| Record outcome | Update result | Use broker/market facts where available; ask only for human judgment |

## Message patterns and example copy

All example numbers here are illustrative copy fixtures, not current account facts.

**Loading failure**

> We couldn’t load your saved plan.
> Try again before making changes. No new analysis has started.
> **Try again**

Use that final sentence only when request/job state establishes it. If completion is unknown: “We couldn’t confirm whether analysis finished. Check its status before starting again.” Never say a draft is safe or saved unless persistence is confirmed.

**A tighter limit**

> This trade can use up to $15 of planned risk.
> You entered $200. Your account’s risk limits set a lower amount.
> **See the calculation**

**No qualifying idea**

> No trade idea is ready yet.
> We need current sources supporting this thesis.
> **Add a source**

Only show that button if that action exists. Otherwise provide the actual supported route. No new trade does not mean no portfolio risk.

**Stale finding**

> This finding needs a fresh check.
> The last check flagged {specific issue} for {trade}. Its evidence is now out of date.
> **Update checks**

**Approval and submission**

> Approved—not sent.
> Review the final checks, then send to {broker}.

Approval CTA: **Approve order**. Submission CTA: **Send practice order** for verified simulation. Confirmation must show account, side, quantity, instrument, order type, price where applicable, and effect. No ambiguous “Done” or “Continue.”

**Broker accepted**

> Order accepted. No shares filled yet.
> **View order**

For contracts, say contracts. For partial fills: “1 of 3 contracts filled. 2 remaining.” Do not call an accepted unfilled order a position.

**Saved assessment**

> Review saved. This finding is closed. Your order is unchanged.

Only use “closed” for an explicit finding resolution. Opening a finding does not acknowledge or resolve it. A note preset fills an editable draft; it never saves or supplies fabricated evidence.

**Quiet check-in**

> No new action found in checks completed at {time}.
> Checks run when you request them.

The second sentence must reflect actual monitoring configuration. A failed or partial query must never produce this all-clear.

## Keep trading terms; add context

Use a visible short helper on first relevant use, with a keyboard- and touch-accessible “What is this?” disclosure. Never require hover. Do not put action-blocking information exclusively inside a tooltip.

| Term to retain | Short contextual explanation |
| --- | --- |
| Long call | Buying a call gives you the right to buy at the strike price under the contract’s exercise terms. It can expire worthless. |
| Long put | Buying a put gives you the right to sell at the strike price under the contract’s exercise terms. It can expire worthless. |
| Short position | A position that generally benefits from a price decline. Short-selling shares can produce losses greater than the initial proceeds. |
| Swing trade | A trade intended to capture a move over days or weeks. |
| Limit order | An order to buy at your limit price or lower, or sell at your limit price or higher. It may not fill. |
| Bid / ask | The quoted prices buyers offer and sellers ask. |
| Spread | In quotes: the gap between bid and ask. In options strategies: a combination of option positions. Label the context. |
| Buying power | The amount the broker reports as available to trade. It is not the amount allocated to this plan. |
| Unrealized P&L | Estimated gain or loss on holdings not yet closed, using the displayed price and time. |
| Delta | How much an option’s price is estimated to change for a $1 move in its underlying, other factors unchanged. |
| Theta | Estimated option-price change from one day passing, other factors unchanged. |

Cancellation example: “Cancellation requested. The order may still fill until cancellation is confirmed.” Never replace it with “Canceled” before confirmation. A filled close can say “Closing order filled”; only reconciled holdings establish “Position closed.”

Detailed strategy education and jurisdiction/contract-specific behavior require a separately reviewed help resource. These short explanations are not substitutes for risk disclosures. Never invent Greeks, IV, or prices to populate help examples in an actual ticket.

## Accuracy before friendliness: current metric audit

Source inspection: `client/src/components/aperture/CapitalCockpitRail.tsx`.

- `NAV` reads `equityValueCents`: propose “Account value,” preserve snapshot time.
- `BP` reads `buyingPowerCents ?? cashCents`: label cash explicitly when it is the fallback, or show buying power unavailable. A friendly label must not erase provenance.
- `Util` computes `(equity - cash) / equity`, clamps to 0–100%, and defaults to `0.0` when inputs are absent. This is not enough to assert margin utilization, risk usage, or portfolio allocation for all account structures. Keep it out of the primary proposed vocabulary until its intended meaning and unknown state are corrected.
- “Paper-only operator instrument” repeats internal implementation terms. Replace its presentation only after the account-mode source is verified; retain the broker destination.

Risk labels also depend on structure: for shares use **“Planned loss at the stop”** with visible warning that execution can differ. Do not turn a modeled stop into a guaranteed maximum loss. Bounded option-loss labels require the actual structure and calculation to support them.

## Implementation contract

This document governs presentation only. Do not rename persisted enum values, migrate record identities, change limits, or alter approval/submission behavior to match nicer copy.

Create one shared semantic copy library in the implementation pass, extending an existing helper if available. Entries should carry: stable key, visible label, helper text, applicable state, interpolation requirements, accuracy caveats, and accessibility text. Keep generated narrative subordinate to deterministic state labels.

Examples of semantic keys: `account.mode.practice`, `mission.load.failed`, `order.approved.unsent`, `order.dispatch.unknown`, `finding.evidence.stale`. Do not use a universal synonym map for “gate,” “closed,” “risk,” or “live.”

Rollout order:

1. Account bar and loading errors (the supplied screenshots).
2. Plan setup, analysis result, and research transitions.
3. Today, findings, and review presets.
4. Order review, approval, submission, and positions.
5. Secondary records and technical detail.

Keep Today / Mission / Play Desk navigation stable until the plan/trade-idea vocabulary can be applied across navigation, page headings, links, and help in one coherent pass. No new homepage or renamed industry instruments.

Acceptance uses deterministic state fixtures: simulated/unknown account mode; stale/failed/partial data; requested vs effective risk; approved vs submitted vs filled; opening vs closing fills; finding read vs saved vs resolved; no-trade with existing exposure. Assert accurate labels and no unintended mutations. Then test mobile, keyboard, and whether a person can explain what happened and what happens next. A shorter word count is not proof of comprehension.

## Ready-to-sync implementation issue

Title: Apply plain-language account and plan copy without changing trading states

Primary surface: Research OS. Related work: THI-266.

Why: Internal terms obscure account mode, limits, and next actions for consumer investing audiences.

Scope: Implement the reviewed vocabulary with shared state-aware copy; start with account header and failed-plan recovery. Fix ambiguous metric presentation before relabeling it.

Acceptance: Trading terms remain accurate; account mode and broker stay visible; errors have a real recovery action; no changes to orders or gates; mobile/touch/keyboard help works; unknown values never become reassuring zeroes.

Evidence: User screenshots and current source inspection. Voice proposal reviewed with a dedicated subagent. No runtime deployment in this documentation pass. Linear connector requires reauthentication; this issue has not been posted.

## Initial implementation

Account header uses verified practice/unknown mode, full account value and buying-power labels, explicit cash fallback, and Account details. Removed the ambiguous computed Util figure. Plan-loading errors use plain language without claiming an uncertain job did not start. Mission and Today share Analyze my plan. Research uses Check this idea, Analysis result, Trade ideas, and When this idea no longer applies. Long-call/put help uses native expandable details for touch and keyboard.

Official broker names, trading terms, persisted states, limits, approval/submission guards, and navigation destinations are unchanged. This is the first presentation pass, not a global replacement: secondary diagnostics and execution-specific paper confirmation text remain for a separately verified pass. No backend capability was added or relabeled as real-money trading.

### Remaining presentation passes — September 21

Applied the library to Today, review forms, order preparation/approval/sending, account-limit explanations, and secondary research summaries. Practice order replaces paper ticket; final order checks and check order status replace preflight/dispatch wording in actionable messages. Technical API values, official broker names, stored historical text, and industry terms are intentionally retained. Existing stored analysis is not rewritten to match new copy. Navigation names remain stable.

Removed the risk-detail assertion that broker cash is liquid/unconstrained: this component does not assess broker cash. It now states that limitation. The account/risk authority and all approval/submission checks remain unchanged. Release validation is recorded separately.

The final browser inventory also exposed Quick Hits. Its catalog and sample simulation lacked verifiable source records but were presented as current opportunities and historical backtests. Those surfaces now explicitly say illustrative/unverified, use example-strategy language, and disable preparing orders from example cards with an adjacent route to researched trades. This does not validate the underlying experimental quickHit API; that legacy endpoint needs a separate server safety audit before any executable Quick Hits capability is promoted. No Quick Hits order was created during this review.

Validation: `DATABASE_URL= pnpm exec vitest run --config vitest.unit.config.ts --maxWorkers=2 --minWorkers=1`: 2,603 passed, 10 skipped. `DATABASE_URL= pnpm check` and `DATABASE_URL= pnpm build` passed. Build retains bundle-size warnings. Rendered trade-card tests cover the new action/help copy; controlled workspace tests retain explicit-click/no-mount-mutation checks. No deployed-browser or human comprehension test was performed for this pass.

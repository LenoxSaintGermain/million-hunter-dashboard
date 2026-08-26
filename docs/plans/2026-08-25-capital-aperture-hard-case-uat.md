# Capital Aperture hard-case UAT — concentration collision

**Date:** 2026-08-25

**Surface:** local fixture-only prototype

**Variant:** B — Review Desk

**Scenario:** `portfolio-concentration-collision`

**Disposition:** PASS after refinement

## Why this case

This case combines a large capital mission, an assigned long-horizon thesis, two plausible but overlapping expressions, a nearly exhausted semiconductor-cluster ceiling, zero candidates clearing hard gates, and an operator preference for approval-ready choices only. It tests whether polished candidates can improperly outrank the actual mandate constraint.

## Journey tested

1. Open the concentration-collision fixture with the assigned `AI Infrastructure Compounding` thesis.
2. Confirm the Capital Thesis screen has one dominant mission question and compact stage orientation.
3. Replace the desired ending value and confirm grouped currency display.
4. Open **Tune this run** and set **Show in library** to **Approval-ready only**.
5. Confirm the ranked Mission Library selects **Cash until the setup qualifies** and prefills the mission.
6. Compile the capital thesis.
7. Confirm the Play Slate compresses 96 researched candidates to one capital decision, with CASH dominant and NVDA/XLK blocked beneath it.
8. Review the cash decision.
9. Record no-trade and confirm the flow skips Plan, Approval, and Monitor.
10. Confirm the final record preserves the concentration blocker, reopening condition, `$0 at risk`, provenance, and acceptance assertion.

## Defects found before refinement

| Severity | Gap | Consequence |
| --- | --- | --- |
| Critical | Selecting the cash mission changed the question but the downstream flow still followed the fixture's conditional NVDA branch. | The UI contradicted the operator's selected mission and could promote a held candidate after cash was selected. |
| High | Variant B showed a generic stage question above the actual Capital Mission. | Two mismatched large questions competed for attention. |
| Medium | Currency inputs rendered raw values such as `250000`. | Large capital and loss values were slower to scan and compare. |
| Medium | Fast replacement of a newly formatted value could append to the previous raw value. | Editing `300,000` could produce an invalid concatenated amount. |
| Low | The top-play sentence could say a mission would not turn a value into the identical value after a cash prefill. | The safety copy became nonsensical. |

## Refinements applied

- Added an effective `deploy | cash` mission disposition and made it drive stage availability, workset focus, play ordering, arithmetic, inspector copy, action labels, and outcome.
- Replaced the competing stage question with the compact stage label; the Capital Mission remains the only dominant question.
- Added grouped, deterministic currency text inputs with numeric input mode and replacement-safe parsing.
- Added neutral preservation copy for a zero-return cash mission.
- Rewrote the top-play target sentence so it does not imply a promised outcome or compare identical amounts.

## Passing evidence

- Start screen: `Capital Thesis` is the compact H1; the actual mission is the only large question.
- Currency values render as `250,000`, `300,000`, and `12,500`; replacing `300,000` with `275000` renders `275,000`.
- Approval-ready filtering ranks `1. Cash until the setup qualifies` and changes the mission to `What will breach the cluster ceiling?`.
- Play Slate states `96 candidates became one capital decision`, shows CASH as the active workset item, and labels both candidate expressions blocked.
- Primary actions are `Review the cash decision` then `Record no-trade`.
- Lifecycle is Thesis → Plays → Top play → Outcome. Plan, Approval, and Monitor are absent, not shown as completed.
- Final record states `Cash preserved. The workflow still produced a decision`, preserves the cluster blocker, and shows `$0 at risk`.
- `DATABASE_URL= pnpm check`, `DATABASE_URL= pnpm build`, `git diff --check`, and local HTTP 200 pass.
- No API, database, brokerage, or order path was invoked.

## Remaining scope

This proves the interaction contract in a deterministic local POC. It does not prove production data bindings, persistence, thesis recovery, authentication, responsive behavior across every target width, or an Alpaca Paper proposal path. Those remain production implementation and UAT gates.

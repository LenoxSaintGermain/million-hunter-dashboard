# Manus brief — the demo walkthrough, and the three defects still open

Two parts. **Part one is three defects from the previous brief that have not
landed** — I verified against `main` before writing this. Part two is the
onboarding/demo walkthrough, which is the priority for today.

The walkthrough can be built in parallel with the defects: it replays a captured
session and does not depend on them. But the capture must be taken **after** the
defects land, or the demo will show an intraday play gated on Price/Sales.

---

## Non-negotiables

- Paper-only is structural. No live-execution path, ever.
- A human approves every order and types the literal `PAPER`.
- Honesty contract: a field the source does not state renders as an explicit
  "not measured" with a reason.
- **Demos are deterministic and zero-API** (CLAUDE.md prime directive 2). The
  walkthrough must run on a frozen capture with no provider call, no broker
  call, and no database read at render time. It cannot fail or cost tokens in
  front of a client.
- `DATABASE_URL= pnpm test`, never bare.
- Existing `--sh-*` tokens. No new dependency.

---

# Part one — still open

Verified on `main` at the time of writing. All three were briefed previously
and remain unimplemented.

**1. Nothing syncs the paper account.** `lastSyncedAt` is written only by the
manual `account.sync` mutation; `server/scheduler.ts` has no account job.
Equity is the denominator of all six ceilings and the planned-loss budget, so
every ceiling is measured against equity from whenever a human last clicked.

**2. `server/aperture/score.ts` has no `holdingPeriod` awareness** — still zero
references. `pe_ratio` and `price_to_sales` carry `verifyWhenMissing`, so an
intraday play is gated on a trailing sales multiple and `evidenceReviewBlock`
refuses the proposal until a human records a review of it.

**3. `gates.ts` treats every sell as exposure-reducing** — `isBuy` at line 247
skips the concentration, per-run and daily-new ceilings for `side: "sell"`.
That is correct for closing a long and **wrong for opening a short**.
`playConstructor` already accepts `side: "short"`, so the first short entry
would bypass three ceilings. The model needs `intent: open | close` alongside
`side`, because "sell" currently means both. Treat this as a safety defect.

---

# Part two — the Capital Aperture walkthrough

## What it is

A guided replay of one **real, captured** session, for onboarding a new operator
and for demoing to a client. Same shape as `/walkthrough` (the Wingate solo
walkthrough) and built to the same rules — but the content is a real Alpaca
Paper session rather than a composite.

The phrase to hold onto: **stale but real, and labelled as such.** Every figure
was true at capture. Nothing is invented, and nothing claims to be live.

## Architecture: live-run-then-bake

Two halves, and the separation is the whole point.

**The capture script** (`scripts/capture-aperture-walkthrough.ts`, runnable from
the repo root) reads a real completed run and writes ONE fixture file:

- the run and its preset, the ranked play list, and the set-aside rows with reasons
- the cockpit payload at capture time — session, account, mandate, headroom
- the constructed recipe from `constructPlay` with every level, `basis`,
  `assumptions[]` and `unavailableReasons[]` intact
- the trigger state from `checkVwapHold` including its feed and measured lag
- a real `order.preflight` evaluation — **capture both a passing one and a
  blocked one**
- the outcome-ledger rows, including `not_triggered` and `unavailable`
- `capturedAt`, the account label, the feed, and the app version

Every field is copied verbatim. The script must not compute, round, or tidy a
single figure — if it does, the walkthrough stops being evidence.

**The replay surface** renders from that file and nothing else. No tRPC query,
no provider, no DB. It must render identically on every load, logged out or in,
with the network disabled.

## Honesty rules — these are the point of the exercise

1. A **persistent banner** on every step: *"Recorded session — 21 Aug 2026,
   10:24 ET. Every figure was true at capture. Nothing here is live and no order
   can be created from this page."*
2. Tape figures keep the lag they had **at capture**, and say so. Do not
   recompute lag against the current clock — a recorded 15-minute lag stays 15
   minutes, forever.
3. Modeled levels stay labelled modeled, with their basis, exactly as the live
   surface renders them. `CONSTRUCTED_PLAY_DISCLOSURE` appears with the figures.
4. Nothing on this surface may mutate anything. No order path, no preference
   write, no acknowledgement. Every action control is inert and visibly so.
5. If the capture is older than a stated freshness window, say that on the
   banner rather than hiding it.

## The path — seven steps

1. **Today.** The ranked play list, with cash as an explicit outcome and the
   expired-catalyst count. Establishes that the system's most common answer is
   "no".
2. **The rail.** Market clock, paper account with its staleness, the mandate,
   and the tightest constraint. Explains that ceilings are measured, not typed.
3. **One play, opened in place.** The constructed recipe: entry, stop, slippage,
   size, planned loss in dollars and as a percentage of equity, targets, time
   stop, no-trade conditions. This is the screen that answers "what would I
   actually do?"
4. **The trigger.** Show the `unknown` state and explain it as a task, not a
   failure: the tape is delayed, so the operator confirms the VWAP hold on their
   own terminal before entering. **Do not hide this step** — it is the most
   credible thing on the tour.
5. **Evidence and set-aside.** What was checked, and every name the run dropped
   with its reason. This is what separates the product from a screener.
6. **The refusal.** Walk a proposal that the gates **block**, and name the
   ceiling that stopped it. A demo that only shows the happy path teaches the
   wrong lesson; the refusal is the feature.
7. **Record.** The outcome ledger with the real result, and the sample-
   sufficiency sentence verbatim — *"N closed trades: this validates the
   decision process, not an edge."* Never soften it.

## Retroactive review

- Every step deep-links (`/aperture/walkthrough?step=4`), so a specific screen
  can be sent to someone.
- Captures are **versioned and kept**, not overwritten. `?capture=2026-08-21`
  opens that day's recording. A demo given in October must still open exactly
  what was shown.
- The capture index lists what exists, with dates.

## Access

Gate it behind the existing `/aperture/*` admin guard for now — the capture
contains a real account's equity. A public, de-identified variant is a separate
decision; **do not make this route public without asking.**

## Explicitly out of scope for this module

No simulated fills, no invented outcomes, no "what if" slider, no projected
returns. If a step needs a number the capture does not contain, the step shows
the gap instead of the number.

---

## Validation

1. `pnpm check` clean; `DATABASE_URL= pnpm test` at the current baseline, no new
   failures.
2. Load the walkthrough **with the network disabled** and confirm every step
   renders. That is the acceptance test for zero-API.
3. Confirm no control on the route can create, approve or submit anything.
4. Confirm the banner, the capture timestamp, and the preserved capture-time lag
   appear on every step.
5. Re-run the capture script and confirm it produces a new dated capture without
   destroying the previous one.
6. 375px, no horizontal overflow.
7. Report anything you could not validate and why.

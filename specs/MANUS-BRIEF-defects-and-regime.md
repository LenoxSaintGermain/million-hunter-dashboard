# Manus brief — three defects, then the enhancements they unblock

Written after reviewing two rounds of external UX feedback against the shipped
code. Most of that feedback described UI problems; three of them turned out to
be defects underneath the UI. **Fix those first.** Everything in part two is
built on numbers that the defects currently make unreliable.

Ordering is deliberate: 1 → 2 → 3 → enhancements. Do not start part two before
part one lands.

---

## Non-negotiables (unchanged)

- Paper-only is structural: `assertPaperOnly()`, hardcoded `paper-api` base URL,
  `liveTrading: false`. No live-execution path may be added, ever.
- A human approves every order and types the literal `PAPER`. Never prefill it.
- A time stop or invalidation is a **documented review plan**, never an
  automatic close. Nothing here may close or open a position on its own.
- Honesty contract: a field the source does not state renders as an explicit
  "not measured" with a reason — never `0`, never a bare dash, never a
  plausible-looking placeholder.
- `DATABASE_URL= pnpm test`, never bare. Current baseline: **32 failures**, all
  DB-integration; FRED and Alpaca connectivity are opt-in integration suites.
- Existing `--sh-*` tokens only. No new dependency, no chart library.

---

# Part one — the three defects

## Defect 1 — nothing syncs the paper account (highest severity)

`lastSyncedAt` is written in exactly **one** place: the manual `account.sync`
mutation in `server/apertureRouter.ts`. Nothing schedules it. That is why the
rail read "synced 15h ago", then "61h ago" — the figure only updates when a
human clicks it.

This matters more than it looks. Account equity is the denominator of **all six
mandate ceilings** and of the planned-loss budget that sizes every play. Right
now every ceiling on the rail, and every share count `constructPlay` produces,
is measured against equity captured at an arbitrary moment in the past.

**Fix:**

- Reuse `server/scheduler.ts` — it already runs a 5-minute in-process tick, is
  disabled by default, and records every run. Do not add a second scheduler.
- Add a paper-account sync job on that tick. Read-only: it mirrors account and
  position state and writes nothing to the broker. Record every run, including
  failures, the way sourcing runs are recorded.
- Sensible cadence is every 15 minutes during the regular session and once after
  the close. Do not poll overnight — a stale number outside the session is
  honest and cheap.
- Add the operator-facing **[Refresh]** control the feedback asked for, beside
  the staleness label in the rail. It calls the same existing mutation.
- Keep the staleness warning. A scheduled sync can still fail, and the amber
  "ceilings are measured against N-hour-old equity" line is what tells the
  operator when it has.

**Do not** make the rail claim "Live Sync" with a green dot. That was in the
external feedback and it is wrong: it would show green over 61-hour-old equity.
The current text is true; a dot would not be.

## Defect 2 — the evidence gate asks fundamental questions about intraday plays

`server/aperture/score.ts` contains **zero references to `holdingPeriod`**. Its
dimension config marks `pe_ratio` and `price_to_sales` with
`verifyWhenMissing: true`, so a *missing* fundamental becomes a
decision-critical check. That is why LEN — an intraday play meant to be flat by
15:30 — shows "2 things to clear before paper review: Price / earnings,
Price / sales", and why `evidenceReviewBlock` then refuses the paper proposal
until a human records a review of a trailing sales multiple.

This is not a labelling problem. The gate is asking the wrong question, and then
blocking on the answer.

**Fix:** make the generated check set depend on the run's holding period.

- `intraday` / `overnight` — checks must be about the tape and the exit:
  catalyst freshness and its source, liquidity and spread, distance to the
  stated invalidation level, and the modeled reward-to-risk from
  `constructPlay`. Fundamentals must not appear.
- `swing` / `catalyst_window` — current behaviour is correct; leave it.

**The constraint that matters:** only generate a check the operator can actually
answer from evidence this run can produce. If the data behind a check does not
exist, the check must render as **unmeasurable with a reason** — not as a task,
and not silently dropped. A gate that asks an unanswerable question is the same
defect in a new costume.

Where a needed input genuinely is not available on the current feed (relative
volume, spread), say so on the check and leave it unmeasurable. That list is
also the evidence for the real-time data upgrade.

## Defect 3 — two decision state machines render on the same screen

`PlayRecipeCard` renders from `buildPlayRecipe().readiness`. `DecisionFocusCard`
renders from `brief.nextDecision`. Neither knows the other exists, so one can
say "PROPOSAL CAN BE PREPARED" beside a primary black button reading "Prepare
paper proposal", while the other says "LEN is a research lead, not yet a
paper-allocation decision" and the header says "Keep LEN in research — do not
change the paper portfolio yet."

Four signals, two directions, on one screen, at the moment of decision.

**Fix:** one authority. Derive the CTA, the badge, the header sentence and the
machine-POV line from a single computed decision state — the readiness model is
the natural home, since it already accounts for evidence and risk plan. The
other surfaces render *from* it rather than computing their own view.

Then apply the CTA rule the feedback proposed:

- state is hold / insufficient evidence → primary is **"Keep in Research &
  Monitor"** (ghost); secondary is **"Override & Draft Proposal"**
- state is ready → primary is **"Proceed to Pre-Flight Verification"** (solid)

**On the override — it may only draft.** Drafting is safe. `evidenceReviewBlock`
and every gate in `gates.ts` must still refuse *creation* server-side, exactly
as they do now. An override that reaches `order.create` is a guardrail you can
click past, which is not a guardrail. Record that the operator used it.

---

# Part two — enhancements

## Regime detection — I am building this, do not implement it

I will add a pure module (`ATR`, `ADX`, and VWAP standard-deviation bands off
the existing `sessionVwap`) and tell you the exact shape when it lands. It is
~100 lines of arithmetic on bars `fetchIntradayBars` already returns.

Your half is rendering one line on the rail:

```
Regime · ADX 14 · range-bound — breakouts are failing today   [SIP, 15 min delayed]
```

It changes how every play on the list should be read, so it belongs in the rail
next to the market clock, not buried on a play. Carry the tape basis and lag on
it like every other intraday figure.

## Daily Stance

The strongest idea in the external feedback. The rail summarises *state*; nothing
summarises *decisions*. Add a badge row:

```
100% Cash Preserved · 0 Triggers Fired · 14 Expired Catalysts Filtered
```

Every number must come from a real count — `aperture_play_decisions`, the
expired-play count `play.list` already returns, and account cash. If one cannot
be counted, omit the badge rather than showing a zero.

## Text density → badges

Convert the multi-sentence explanations into compact elements, keeping the fact:

| Now | Becomes |
|---|---|
| "No completed intraday or catalyst-window research play with a future catalyst deadline is available. 14 past-catalyst plays were excluded…" | `0 Plays Cleared` · `14 Expired Catalysts Filtered` |
| "…ceilings are measured against synced 61h ago equity — play ceilings may be stale" | ⚠ `Sync Stale (61h)` + `[Refresh]` |
| "LEN is not held in the current paper context, so it would add a new research exposure rather than increase an existing position." | tag: `New Exposure` |

Compression must not drop a caveat. Where a sentence carries a basis or a
limitation, the badge needs a tooltip *and* an inline reading on mobile — the
`FieldLabel` pattern already does this correctly.

## Rename "Chapters"

Literary label on a financial surface. Name them for what they group — the
theme, sector or batch — e.g. `Housing / Rates (9)`, `Tech Catalysts (0)`.

## Intraday primitives on the evidence screen

`constructPlay` already returns entry, stop, targets, planned loss and the tape
basis. Render them alongside the evidence pills, plus last price and intraday
change. This is rendering, not computing — do not recompute a level in the
client.

---

## Validation

1. `pnpm check` clean; `DATABASE_URL= pnpm test` at 32 failures, no 33rd.
2. Authenticated UAT with the auth seam removed afterwards
   (`grep -c LOCAL_PREVIEW_OPENID` = 0 in both files):
   - account staleness falls on its own without a human clicking, and the run
     log shows the scheduled sync
   - an intraday play's checks contain no P/E or P/S, and any check that cannot
     be answered on the current feed says so
   - the decision screen shows **one** recommendation — CTA, badge, header and
     machine POV agree
   - "Override & Draft Proposal" cannot create an order while evidence is
     unrecorded; confirm the server still refuses
   - the regime line renders with its tape basis once I hand you the module
3. **No order created, approved or submitted** without saying so explicitly.
4. Report what you could not validate, and why. A named gap is the expected
   outcome; a papered-over one is the single failure mode this codebase does not
   tolerate.

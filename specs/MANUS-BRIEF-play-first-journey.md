# Manus brief — the play-first journey, two audiences, one system

Follows the cockpit brief (shipped `522b657`). This one is about **flow and
screens**, not new server capability. Almost everything it asks for is a
rearrangement of data that already exists.

## The decision that shapes everything below

There are **two users, and they are not the same person.**

**Jim's wife is the primary user of the play surface.** She runs the day-to-day
trading. She is a portfolio manager, not the author of the thesis. She should be
able to open the app, see today's plays, decide, and never once be asked to
compile a thesis, pick a model, or read a run status. Provenance is available to
her on demand — one click, never in the way.

**Jim reviews the thesis side.** He authors the thesis, reviews evidence, and
sets the mandate. He rarely needs the ticket.

Today the app is built for Jim only. Everything is thesis-first: `/aperture`
opens a run-setup form, and a play is something you reach after four navigations
through runs, candidates, evidence and memos. That is the friction Jim named in
his own feedback — "present plays first to lower adoption friction for the PM."

**So: two front doors, one system.** Not two apps, not a role toggle that hides
features. The same data, entered from the end the user actually works from.

---

## Non-negotiables (unchanged)

- Paper-only is structural: `assertPaperOnly()`, hardcoded `paper-api` base URL,
  `liveTrading: false`. No live path may be added.
- Every order is human-approved with a typed literal `PAPER`. Never prefill it.
- A time stop or invalidation is a **documented review plan**, never an
  automatic close. Nothing in this brief may start closing positions.
- Honesty contract: a field the source does not state renders as an explicit
  "not measured" with a reason. Never `0`, never a bare dash, never a plausible
  placeholder. This applies with *more* force on the trader surface, because a
  simplified screen is exactly where a missing caveat does the most damage.
- `DATABASE_URL= pnpm test`, never bare. Baseline 34 failures.
- Design system: existing `--sh-*` tokens only. No new dependency.
- Reuse what exists — `CapitalCockpitRail`, `PlayRecipeCard`, `CapitalBrief`,
  `PaperProposalForm`, `SetAsideHistory`, `DecisionFocusCard`, `ResearchLedger`.
  This brief rearranges and connects them. If you find yourself writing a second
  component that renders the same data, stop and reuse the first.

---

## Screen 1 — `/aperture` becomes the trader's day, not a setup form

**Who it is for:** the wife. This is the front door.

Today `/aperture` leads with a New Run form used once a day, and the run list is
a side column. Invert it. The setup form moves behind a "New research brief"
action; a trader who never opens it should still have a complete day.

The screen is a **ranked list of today's plays**, and nothing else above the
fold. Each row is a `PlayRecipeCard` in the format Jim's own example used:

```
1  XHB   Housing-data breakout          intraday   confidence: medium
   Long above $108.65 after a 15-min hold above VWAP · stop $107.90
   Plan to lose $37.50 (0.38% of equity)     41 sh ≈ $4,455
   Catalyst: housing starts 08:30 ET (Census)    time stop 15:30
   Skip if: opens >1% beyond the trigger · no sustained volume
   ⚠ VWAP hold: cannot be confirmed — tape is 15 min delayed
```

Requirements:

- **Ranked, with the no-trade option ranked too.** Jim's example ends "cash is
  correct if the releases gap without orderly pullbacks." Cash must be a visible
  row in the ranking, not the absence of rows. A day with no good plays should
  say so in words.
- **Correlation is shown at the list level, not per card.** If two plays share a
  theme, say it where the choice is made: "XHB and HD share housing/consumer
  risk — taking both would use 1.5% of the 1.25% correlated planned-loss
  ceiling." The server already computes this; surface it here.
- Each row states its **readiness** from `buildPlayRecipe` and, when not ready,
  the single most important blocker — not the whole list. The rest on the card.
- **Confidence and its reason travel together.** "Medium-low: strong catalyst,
  but gap and guidance risk are substantial." A bare confidence word is a number
  with nothing behind it.

**What she does here:** reads the ranking, opens one, or closes the tab. Three
outcomes only: prepare a paper proposal, skip with a recorded reason, or defer.
A recorded skip is data for the scorecard — an unrecorded one is lost.

---

## Screen 2 — the play detail is a decision, not a document

Opening a row expands **in place** — no navigation. The trader must never lose
the ranking to look at one play.

Order of content, top to bottom, is the order she decides in:

1. **The plan** — entry, stop, target, size, planned loss in dollars AND as a
   percentage of equity next to the 0.75% ceiling. This is the number Jim's
   model is built on; it is the most legible figure on the screen.
2. **The trigger state** — from `checkVwapHold` in `server/aperture/intraday.ts`:
   `confirmed` / `rejected` / **`unknown`**. Today `unknown` is the common answer
   and it must read as a *task*, not an error: "Confirm on your terminal that
   XHB has held above VWAP ($106.92, SIP tape, 15 min delayed) for 15 minutes."
   When the real-time SIP key lands this resolves itself with no UI change.
3. **Why this play exists** — one sentence, plus the catalyst with its source and
   time. Links to the thesis it came from.
4. **What would make it wrong** — the invalidation condition and the no-trade
   conditions.
5. **Everything else** — evidence checks, memo, exposure — collapsed by default.

The paper proposal (`PaperProposalForm`) opens from here with the play's values
already in the ticket, and live preflight as already built. She should never
retype a number that is on the card.

---

## Screen 3 — the thesis side stays Jim's, and gets a return path

**Who it is for:** Jim.

Keep `/aperture/thesis/*`, the evidence queue and the memo library as they are.
Two additions:

- **A thesis shows the plays it produced.** Right now provenance runs one way:
  a play knows its thesis, a thesis does not know its plays. Jim's review
  question is "is my thesis producing good plays?" and the app cannot answer it.
  List them with outcome and the recorded skip reasons.
- **Set-aside is part of the review, not a footnote.** `SetAsideHistory` exists;
  put it where Jim reviews the thesis. "These 14 names were dropped and why" is
  the strongest evidence that the system is being selective rather than lucky.

---

## Screen 4 — the weekly scorecard is the artifact Jim asked for

The 10-play UAT needs a report: wins / breakeven / losses with examples. Every
field is already in `aperture_alpha` after migration 0036.

Build the weekly view on the existing scorecard panel. It must lead with
`sampleNote` — *"4 closed trades over 5 days: this validates the decision
process, not an edge."* Ten plays cannot show an edge and the report must not
imply otherwise, however good the numbers look. That honesty is what makes the
report usable in front of a family member with money at stake.

Include the recorded skips. A play correctly skipped is a decision the process
got right, and a scorecard that only counts trades taken measures the wrong thing.

---

## Cross-cutting

- **Never show a run status to the trader.** "Run #300001 · researching" is
  Jim's vocabulary. Hers is "3 plays ready, 2 still gathering evidence."
- **One nav depth.** From the play list, every decision is reachable in one
  click and returns to the list. No four-page chains.
- **The rail stays on every screen**, as built. On the trader surface, lead the
  headroom group with the planned-loss ceilings — that is the budget she spends.
  The notional ceilings sit second.
- **Mobile-legible.** She may check this on a phone between other things. The
  play list and the trigger state must work at 375px. The ticket may stay
  desktop-first.

---

## Validation

1. `pnpm check` clean; `DATABASE_URL= pnpm test` at 34 failures, no 35th.
2. Authenticated browser UAT, temporary auth seam removed after
   (`grep -c LOCAL_PREVIEW_OPENID` = 0 in both files):
   - `/aperture` opens on plays, not a form.
   - A play with an unconfirmable VWAP hold reads as a task, not an error.
   - Two same-theme plays surface the correlated-ceiling warning **in the list**.
   - A skip is recorded with its reason and appears in the scorecard.
   - A thesis page lists the plays it produced.
   - The play list is usable at 375px.
3. **No order created, approved or submitted** without saying so explicitly.
4. Report what you could not validate and why. A named gap is the expected
   outcome; a papered-over one is the single failure mode this codebase does not
   tolerate.

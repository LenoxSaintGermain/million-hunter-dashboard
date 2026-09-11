# TSL-BUILD-2026-009 — Three-tap PLAY / RETURN north star

Locked 2026-09-10. Supersedes the primary-journey assumptions in
`TSL-BUILD-2026-008A` where they conflict. The Addendum's honesty, lifecycle and
accessibility rules still bind — this changes what sits in front of the operator,
not what the product is allowed to claim.

## The question the product answers

> "I have $X. What's the play, and what could it return?"

Three taps, maximum:

1. Enter or confirm the deployable amount.
2. Request the best current play.
3. Review the recommendation.

A user asking that question must not be routed through thesis creation, Mission
configuration, research inventory or Play Desk before seeing an answer.

## The two surfaces

The first result presents exactly two primary surfaces. Desktop splits one card;
mobile makes them tabs. Nothing else competes at this level.

| PLAY — what do I do? | RETURN — what could happen? |
| --- | --- |
| instrument | capital deployed |
| amount | planned downside at the modeled stop |
| entry condition | profit at each modeled target |
| invalidation / stop | ROI at each modeled target |
| target | R multiple, when the arithmetic is valid |
| horizon | contribution to the operator's stated target |

Everything else — market regime, tactical thesis, evidence, scoring, provenance,
portfolio analytics, option contract detail, alternatives — is progressive
disclosure beneath the decision. Default to one recommendation; at most two
alternatives behind "See alternatives".

Tap 3 opens the execution-ready detail. Its primary actions stay three:
**Prepare paper trade · Wait for trigger · Pass.**

## What RETURN may and may not say

This is the part that can destroy the product's credibility, so it is specified
rather than left to taste.

**Permitted, because it is arithmetic over recorded modeled terms:**

- capital deployed, from the constructed quantity and entry;
- planned downside, from quantity x (entry - stop);
- profit at a modeled target, from quantity x (target - entry);
- ROI, from that profit over capital deployed;
- R multiple, where entry, stop and target are all measured.

Each figure names the modeled level it depends on, for example
"if it reaches the 1.5R target". Scenario labelling is by target level, never by
implied likelihood.

**Not permitted without a defensible producer:**

- a probability, a probability-weighted expectation, or an expected value;
- "base case" / "strong case" phrasing that implies one outcome is more likely
  than another, unless a recorded probability supports it;
- a confidence badge positioned so it reads as confidence in the return.
  Research confidence is a score about evidence quality, not about profit, and
  must be labelled as such or omitted;
- any return figure at all when entry, stop or quantity is not measured. The
  existing "Not measured" treatment stands; a missing number is never rendered
  as zero or as an average.

One required disclosure sits with the figures:

> Modeled price targets, not a forecast. No probability is assigned.

The operator asked for this guard explicitly: if probability is not defensible,
do not fake one.

## Returning users and open plays

The same two-sided model serves an open position. PLAY states the holding
decision; RETURN states invested, current, gain, modeled remaining upside. The
next actions are Hold / Trim / Exit / Redeploy gains. "Redeploy gains" enters the
same three-tap journey with the realised amount pre-filled — subject to the
existing rule that a gain is only spendable once independently reconciled, which
is not yet implemented and must not be implied.

## Entry point

One persistent action on Today: **Put capital to work**. It requires no thesis,
no Mission and no prior run. Defaults come from saved preferences so a returning
operator usually enters only an amount.

## Acceptance

- The journey reaches a recommendation in three taps from Today, measured.
- The recommendation renders PLAY and RETURN and nothing else above the fold.
- Every RETURN figure traces to a recorded modeled term; a missing term yields
  "Not measured" rather than a number.
- No probability language appears without a recorded probability.
- Deterministic tests cover the arithmetic, the not-measured paths and the
  absence of probability language. Screenshots are implementation evidence, not
  proof of comprehension.

Sophistication belongs in the engine. Simplicity belongs in the interaction.

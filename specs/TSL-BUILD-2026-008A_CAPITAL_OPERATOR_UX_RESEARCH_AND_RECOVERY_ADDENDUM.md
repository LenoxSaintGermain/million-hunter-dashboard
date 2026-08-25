# TSL-BUILD-2026-008A — Capital Operator UX Research and Thesis-Recovery Addendum

**Status:** PROPOSED — implementation brief; no live-trading authorization

**Date:** 2026-08-25

**Primary surface:** Research OS / Capital Aperture

**Decision owner:** Lenox

**Users:** Jim and his wife share the `Capital Operator` user type and use separate identities

> This addendum supersedes the split-user assumption in `MANUS-BRIEF-play-first-journey.md`. Both operators now receive the same product capabilities; separate identities remain required for auditability.

## 0. Product decision

Capital Aperture must be a purpose-built operator workspace for deciding, verifying, staging, and learning from paper-only market theses. It must not be redesigned as a generic chat interface.

The working model is:

**Orient → Choose one decision → Verify what matters → Stage on paper or decline → Record the outcome**

The interface should reduce reading and navigation while preserving source provenance, uncertainty, risk gates, and audit history. Progressive disclosure is the primary simplification technique: concise decision first, source and technical detail one deliberate action away.

## 1. Research basis and limitations

### Method

This synthesis uses:

- three owner-annotated browser observations from the live Capital Aperture surface on 2026-08-25;
- the current `/aperture`, `/aperture/run/:id?view=evidence`, and Thesis Workspace screenshots;
- the current implementation in `ApertureHome.tsx`, `CandidateBoard.tsx`, and `ThesisEngine.tsx`;
- `RESTORED_DATABASE_CAPITAL_UAT_REPORT_2026-08-25.md`;
- the existing play-first and Capital Aperture workflow briefs.

This is one owner/operator review, not a statistically representative usability study. The first implementation must therefore end with observed UAT by both Capital Operators using the same permissions under separate identities.

## 2. Observations, interpretations, and product implications

| Observed evidence | Interpretation | Required product response |
| --- | --- | --- |
| The Decision Center shows `No Capital / Trade thesis assigned`, while the risk rail displays a large NVDA concentration warning and the saved Thesis Workspace no longer contains the recent Capital test theses. | Context continuity is broken. The operator cannot tell which thesis, account, and run the warning belongs to, and a rebuild appears to have removed recent test work. | Restore and verify the known test theses before redesign. Always show active thesis + account + as-of time together. Never present an orphaned risk warning. |
| The expanded NVDA rail occupies most of the first viewport and asks the operator to acknowledge it “to reclaim this space.” | The system is prioritizing its diagnostic detail over the operator's next decision. “Reclaim this space” explains layout behavior, not the financial consequence or next action. | Default to a compact decision-impact summary. Expand details on request. State what is blocked, why it matters, and the one next action. |
| The CRDO evidence screen presents four cryptic checks such as `C: Price / earnings`, each with a separate `Record my review` action, while the source record is elsewhere. | The operator is asked to certify labels without context. The workflow separates the question, reason, source, and answer. | Present one plain-language blocking question at a time with “why this matters,” source excerpt/provenance, and explicit answer choices in one surface. |
| The run exposes `1 of 57` candidates as a long horizontal strip and states that 224 supporting items can continue. | The interface exposes system volume rather than decision priority. Navigation burden grows with research breadth. | Lead with the recommended decision and top alternatives. Put the remaining candidate universe behind search/filter and grouped counts. |
| The modeled CRDO recipe displays a large multi-cell document before the operator has resolved the critical evidence. | The screen asks the operator to read the full analysis before telling them whether the play is actionable or what is blocking it. | First fold must show status, trigger, planned loss, invalidation, current blocker, and one next action. Details remain available below or in an expandable panel. |
| The Thesis Workspace mixes starting-point selection, a long template, an empty strategist panel, saved theses, and an upsell in one tall page. | Creation, preview, retrieval, and commercial messaging compete for attention. The empty output panel consumes space before it has a job. | Separate “New thesis” from “Saved theses.” Use a short guided form and show compiled output only after input exists. Keep unrelated upsell out of the core creation journey. |

## 3. Data-continuity prerequisite

Do not treat an empty Thesis Workspace or missing active thesis as a valid rebuild outcome.

### Known records to recover or reconcile

1. **Jim test thesis:** `Jim Reference — Catalyst Reaction (Paper Trial)`

   Source of truth: `scripts/run-jim-catalyst-reference-trial.mjs` and its recorded trial artifacts.
2. **Owner test thesis:** `GLP-1 Demand Shock: Food & Health Day-Trading Opportunities`

   Source of truth: the versioned immutable captures in `client/src/fixtures/captures/` and the registered walkthrough fixture.

### Recovery rules

1. Begin with a read-only inventory of canonical thesis, compilation, sharing, active-thesis, projection, run, evidence, memo, and outcome records for the two known test theses.
2. Export a recovery manifest before any write: table, stable id, owner, visibility, title, content hash where available, related ids, and row count.
3. Reconnect surviving records instead of creating duplicates.
4. If a record is genuinely absent, recreate it only from the named provenance-backed source and mark the recovery source and timestamp. Do not invent content, ownership, outcomes, or historical timestamps.
5. Recovery must be idempotent and dry-run by default. A second run produces no duplicate thesis, projection, run, share, or active-selection row.
6. Preserve separate ownership and sharing. Do not broaden access to unrelated private theses.
7. Do not backfill performance, decision, or measurement values.
8. Add a post-rebuild validator that fails if either known thesis disappears from its authorized saved-thesis view or if its active-thesis association becomes orphaned.

### Recovery acceptance

- Both named test theses appear in the correct authorized Saved Theses views.
- Each opens to its existing provenance, projection, run, and outcome links when those records survive.
- The Decision Center never says no thesis is assigned when a valid active Capital thesis exists.
- Switching the active thesis updates thesis name, account context, risk rail, candidate queue, and new brief defaults together.
- No unrelated user record changes and no order path is invoked.

## 4. Purpose-built Capital Operator journey

### Screen A — Today / Decision Center

The first viewport answers four questions only:

1. Which thesis and paper account are active?
2. What decision needs attention now?
3. Is a paper study ready, blocked, or correctly cash/no-trade?
4. What is the one next action?

Required structure:

- compact context bar: active thesis, paper account, as-of/freshness, paper-only state;
- one primary decision card;
- at most three ranked ready/needs-review alternatives;
- visible cash/no-trade control outcome;
- compact risk-impact summary, collapsed by default unless it blocks the current action;
- one primary CTA in the first viewport.

Rewrite the NVDA state as an operator consequence, for example:

> **NVDA concentration is using 96% of the single-name allowance.** New NVDA exposure is blocked until headroom changes. Existing paper positions are unchanged.
>
> **Action:** Review exposure details.

Do not use “acknowledge to reclaim this space.” Acknowledgement records review; it must not imply the constraint changed or was cleared.

### Screen B — Candidate decision

Replace the 57-item horizontal strip as the primary navigation. Show:

- the lead candidate and why it leads;
- up to two meaningful alternatives;
- grouped counts for the remainder;
- search/filter for “View all candidates.”

The first fold of the lead decision card contains:

- status: `Ready for paper review`, `Needs evidence`, `Refused`, `Expired`, or `Cash / no-trade`;
- one-sentence thesis fit;
- trigger and current trigger state;
- planned loss in dollars and percent beside its ceiling;
- invalidation/time stop;
- single highest-priority blocker;
- one next action.

All modeled fields retain their modeled labels. Evidence, full recipe math, alternatives, memo, and exposure detail are collapsed by default.

### Screen C — Evidence resolution

Show one unresolved decision-critical question at a time. Each question includes:

- a plain-language question;
- why it could change the decision;
- the relevant source record or inline excerpt with provenance;
- answer choices: `Confirmed`, `Not confirmed`, `Not applicable`, and `Need more evidence`;
- optional note;
- the effect of each answer on readiness.

Do not make the operator open or build a source record in a separate workflow before answering. Source creation, when needed, occurs inline and returns to the same question.

Horizon relevance is mandatory. Trailing valuation multiples such as P/E and price-to-sales must not block an intraday play unless the thesis explicitly makes valuation decision-critical. Otherwise move them to supporting context or omit them.

### Screen D — Thesis Workspace

Use two clear destinations:

- **Saved theses:** recent, active, shared, archived, and recovery status.
- **New thesis:** choose purpose, enter bounded intent, inspect the compiled structure, then save.

Do not reserve half the screen for an empty strategist output. Do not mix the Operator-tier upsell into the thesis creation path. Preserve the existing scope distinctions—Acquisition, Property, Capital / Trade—but explain them as destinations, not internal taxonomy.

## 5. Interaction and visual hierarchy rules

1. Use the existing `--sh-*` tokens and current editorial identity. This is not a rebrand.
2. Borrow only proven operator-interface principles from the Linear and Stripe references: compact hierarchy, surface levels instead of decorative shadows, tabular numerics for financial values, scarce accent color, and one primary action per decision band.
3. Do not copy external brand tokens, introduce a second visual language, or add a dependency.
4. No chatbot transcript, chat bubbles, free-floating composer, or “AI assistant” side panel as the primary interaction.
5. Use structured controls for structured decisions: status, source, question, answer, consequence, next action.
6. Keep provenance one deliberate action away, never hidden and never allowed to dominate the default view.
7. Collapse explanatory copy after first use where safe; retain it through help text or details.
8. Financial values use tabular figures. Constraints show used, ceiling, percent, and consequence together.
9. Desktop first viewport should contain the active context and primary decision without scrolling. At 375px, the same decision and next action appear before secondary detail.
10. Reduced motion, keyboard flow, visible focus, 44px touch targets, no horizontal overflow, and screen-reader labels are required.

## 6. Research and implementation sequence

### R0 — continuity and task audit

- Perform the read-only thesis inventory and produce the recovery manifest.
- Observe both Capital Operators attempting Today → evidence review → paper preparation.
- Record task completion, hesitation, wrong turn, backtrack, and explanation requests.
- Verify the current route/component/data ownership before changing UI.

### R1 — low-fidelity journey proof

- Produce wireframes for Today, Candidate decision, Evidence resolution, and Saved/New Thesis.
- Test the wireframes with both Capital Operators using the same role.
- Revise terminology and hierarchy before visual polish.

### R2 — implementation

- Recover/reconcile the known test theses first.
- Refactor the existing components and routes; reuse `CapitalCockpitRail`, `DecisionFocusCard`, `PlayRecipeCard`, `ResearchLedger`, `PaperProposalForm`, and `SetAsideHistory` where their contracts remain correct.
- Add the compact and expanded states without duplicating server truth.
- Preserve every existing paper-only and human-approval gate.

### R3 — observed UAT

Both operators independently complete:

1. identify the active thesis and account;
2. explain the current decision in one sentence;
3. resolve one evidence question from the same surface;
4. find why a candidate is blocked;
5. record a skip/cash decision;
6. prepare a paper ticket without submitting it;
7. switch between the two recovered test theses and confirm context changes coherently.

## 7. Acceptance criteria

1. Both named test theses are present, attributable, nonduplicated, and linked to surviving records.
2. No destructive rebuild, reset, broad seed, or unscoped database mutation is used for recovery.
3. The first viewport communicates active thesis, account, freshness, primary decision, status, and one next action.
4. The NVDA concentration state states consequence and action in two concise lines; full math is expandable.
5. Candidate review does not render all 57 candidates as the primary navigation.
6. The lead candidate's first fold contains no more than the decision, thesis fit, trigger, risk, invalidation, blocker, and one action.
7. Evidence resolution joins question, reason, source, answer, and consequence in one place.
8. Intraday decisions are not blocked by irrelevant trailing valuation multiples.
9. No screen uses chat as the primary interaction model.
10. Both Capital Operators complete the R3 script without operator coaching on the second attempt.
11. Browser checks pass at 375, 768, 1024, and 1440 pixels with no horizontal overflow.
12. `pnpm check` passes and tests run with `DATABASE_URL=`. No order is created, approved, submitted, canceled, or closed during UAT unless a separately authorized Alpaca Paper test explicitly requires it.

## 8. Report back with

- pre-write and post-write recovery manifests;
- exact recovered ids and provenance source for each test thesis;
- before/after screenshots for the four target screens;
- task-observation notes for both Capital Operators;
- route/component reuse map;
- typecheck and test results;
- responsive and accessibility evidence;
- explicit order-activity statement;
- remaining usability, provenance, and data-continuity risks.

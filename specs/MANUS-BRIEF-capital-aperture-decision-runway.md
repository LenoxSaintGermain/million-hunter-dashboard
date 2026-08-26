# Manus build instruction — Capital Aperture Decision Runway

**Status:** Approved for production implementation planning and code work; not authorization for live trading or deployment

**Build target:** existing Capital Aperture production routes and components

**Reference POC:** `client/src/prototypes/aperture-runway/`
**Primary spec:** `TSL-BUILD-2026-008A_CAPITAL_OPERATOR_UX_RESEARCH_AND_RECOVERY_ADDENDUM.md`

## Command

Implement the validated Capital Aperture **Decision Runway** interaction contract in the production app. Reimplement the behavior against production data and existing components; do not expose, route to, or mechanically promote the fixture-only prototype.

The experience is a purpose-built operator workflow—neither chat nor a large form:

**Capital Thesis → Play Slate → Top Play or Leading Condition → Paper Plan when eligible → Human Approval when eligible → Monitor → Outcome**

Conditional and no-trade branches are first-class:

- **Conditional:** Thesis → Plays → Leading condition → Held plan → Pending gate review. No approval or monitoring.
- **No trade / cash:** Thesis → Plays → Cash decision → No-trade record. No plan, approval, or monitoring.

## First: preserve and recover data

Before UI mutation, complete the read-only inventory and recovery-manifest work in 008A for:

- `Jim Reference — Catalyst Reaction (Paper Trial)`
- `GLP-1 Demand Shock: Food & Health Day-Trading Opportunities`

Reconnect surviving records; recreate only from the named provenance-backed sources when genuinely absent. Recovery is dry-run by default, idempotent, scoped, and non-destructive. Do not invent ownership, history, outcomes, timestamps, or market facts.

## Production behavior to implement

### 1. One dominant capital mission

- If an active thesis exists, load it with paper account, freshness, mandate, and editable run-specific mission defaults.
- If no thesis exists, let the operator build one in place without leaving the capital mission.
- Render a completed mission as one readable question with **Edit mission**. Do not show a competing generic page question.
- Preserve the framing helpers: `Where can I…`, `How can I…`, and `What must…`.
- Format financial inputs with grouped digits while preserving accurate replacement/edit behavior and accessible numeric input mode.
- Label desired ending value as an aspiration, never a forecast or promised return.

### 2. Contextual Mission Library

- Place the ranked Mission Library beside the assigned-thesis block.
- Rank from current account state, active thesis, mandate, horizon, operator objective/instrument preferences, verified research patterns, and actual prior behavior when available.
- Put the most contextually useful/common qualifying mission first and explain why it ranks there.
- **Tune this run** may change objective, instrument preference, and whether held research is included.
- Operators set ranking inputs only. Entitlement, freshness, liquidity, concentration, disclosure lag, collision, evidence completeness, and other gates remain system-computed and cannot be overridden.
- Congressional/disclosure missions may rank as a match only when primary-source, entity-confidence, lag, collision, and evidence gates qualify them.

### 3. Mission selection is durable run state

Selecting a library mission must update the entire run, not only the prompt. Persist a run-scoped mission/disposition version and recompute:

- effective branch (`eligible`, `conditional`, or `no_trade`);
- stage rail and next action;
- Play Slate ranking and cash placement;
- workset focus;
- modeled sizing/arithmetic;
- inspector/audit explanation;
- final outcome destination.

If the selected mission is **Cash until the setup qualifies**, cash becomes the dominant decision, candidate expressions remain visibly blocked with reasons, planned risk is `$0`, and Plan/Approval/Monitor disappear. Never allow a stale fixture/server result to continue promoting a candidate after cash is selected.

### 4. Compress candidates into a Play Slate

- Do not expose all candidates as the default journey.
- Show one primary decision, at most two decision-distinct alternatives, and a visible cash control.
- Group the remainder by explicit parked/refused/watch reasons with counts, search, and filters behind **View all**.
- Rank and eligibility are separate. A highly ranked held candidate must never look approval-ready.
- Preserve one next action per stage and optional depth through a context inspector/drawer.

### 5. Paper-only approval and outcomes

- Preserve existing paper-only enforcement and exact typed `PAPER` acknowledgement for eligible paper tracking.
- Never prefill acknowledgement and never add a live order path.
- Conditional decisions queue their named gate and retain reopening conditions.
- Cash/no-trade decisions create a durable decision record with blocker, reason, `$0 at risk`, provenance, and what would reopen research.
- Eligible studies enter Pending Outcomes until their declared horizon. Day studies return at close; longer studies remain in the queue until the named review point.

## Reuse before adding

Reconcile the production component/data map first. Reuse existing contracts where correct, including `CapitalCockpitRail`, `DecisionFocusCard`, `PlayRecipeCard`, `ResearchLedger`, `PaperProposalForm`, `SetAsideHistory`, thesis/run records, scoring, mandate, exposure, and outcome services. Do not create a second source of truth or duplicate the fixture data in production.

Use existing `--sh-*` tokens and editorial identity. No chat transcript, giant form, new visual language, or new dependency.

### 6. Scale by available workspace, not only viewport

- Keep the three-pane Review Desk only while the workset, decision canvas, and inspector each retain a readable minimum width.
- At intermediate widths, preserve the workset + decision canvas and move the inspector into a compact evidence band below. Do not squeeze the Capital Mission into a narrow newspaper column.
- At tablet widths, turn the workset into a horizontal selector above the decision and let the canvas use the full width.
- At mobile widths, use one column and progressive disclosure; the active decision and next action appear before inspector detail.
- Reflow the assigned-thesis block and Mission Library from two columns to one based on the decision canvas width, not just `window.innerWidth`.
- Scale the Capital Mission headline from its container and allow long thesis names, mission reasons, and horizon labels to wrap without clipping, overlap, or single-word vertical stacks.
- Financial inputs move 4 → 2 → 1 columns as space contracts. Preserve tabular figures and grouped currency values.
- The action dock must never cover editable fields or the final decision. Prototype-only controls must remain visually separate from production navigation.

## Required UAT

Run observed UAT with Jim and Lenox as the same `Capital Operator` type under separate identities. At minimum cover:

1. assigned thesis + eligible play;
2. no assigned thesis built in place;
3. many-candidate universe compressed to a Play Slate;
4. stale or missing evidence producing a held condition;
5. missing options entitlement producing no fabricated substitute;
6. large-capital concentration collision where approval-ready filtering selects cash and the journey ends in a no-trade record;
7. disclosure/congressional pattern with source, entity, lag, and collision gates;
8. day trade queued for end-of-day outcome and a longer-horizon study left pending.

For the concentration-collision case, assert exactly:

- the actual Capital Mission is the only dominant question;
- currency values use grouped display and replacement input remains correct;
- selecting cash makes CASH active and compresses the slate to one capital decision;
- candidate expressions remain blocked beneath cash;
- Plan, Approval, and Monitor are absent;
- the final record preserves the blocker and shows `$0 at risk`.

## Verification and report-back

- Run `DATABASE_URL= pnpm check`, targeted tests, and the appropriate production build. Never run bare tests against the production-bound `.env`.
- Prove no prototype route, fixture, API call, or visual-only state became production truth.
- Browser-test 375, 768, 1024, and 1440 widths; keyboard flow, reduced motion, focus, labels, and no horizontal overflow.
- Add intermediate-width checks at 900, 1162, and 1280 pixels. At 1162px the assigned-thesis block, Mission Library, full Capital Mission, financial inputs, and next action must remain readable without overlap or a single-word vertical stack.
- Report the recovery manifests, exact routes/components reused, migrations if any, tests/build results, UAT evidence, screenshots, explicit order-activity statement, and every unverified gap.
- Do not deploy or merge solely because the code builds. Stop for owner review after implementation evidence is assembled.

# Capital Aperture Pressure-Test Harness

**Status:** Prototype contract
**Surface:** Research OS / Capital Aperture
**Question:** Does the Decision Runway stay clear when the operator, thesis, horizon, candidate count, instrument, capital scale, and gate result change?

## Decision

Keep scenario selection inside the dark local-prototype chrome, clearly labelled as a test-case control. It must never appear inside the operator runway or read as a customer preset feature. A scenario changes the full fixture, not only the mission fields. It controls the assigned-thesis state, capital mission, data freshness, warning, universe size, candidate plays, evidence state, binding gate, branch, and acceptance assertion.

Separately, place a user-facing **Mission Library** beside the active thesis. This preserves the useful preset interaction without exposing test fixtures. Selecting a mission starter may prefill the question, capital, target, horizon, and paper-loss ceiling, but it must not replace account context, mutate the saved thesis, or create an order.

Mission ranking must be contextual and explainable, not a static list. Rank a verified research-pattern match first when it aligns with the active thesis and clears its evidence gates. Otherwise rank actual user-history frequency, then account and mandate fit, then generic playbooks. Every ranked option must show why it appears where it does. Fixture-only prototypes may model common-playbook and account-fit signals, but must not claim real user history. Congressional or disclosure patterns appear only when primary-source, entity-confidence, lag, and collision gates qualify them.

The operator sets ranking inputs, never gate outcomes. A compact **Tune this run** control may set objective, instrument preference, and whether held research should remain visible. Capital, desired ending value, horizon, and loss ceiling remain editable in the mission. Hard gates—entitlement, freshness, liquidity, concentration, disclosure lag, collision, and evidence completeness—remain system-computed and cannot be overridden through the library.

Without the pressure-test harness, ranking refreshes when any of these events occur:

- Capital Aperture opens with an assigned thesis and current paper-account state;
- the operator changes a mission or Tune-this-run input;
- an account or mandate sync changes cash, exposure, entitlement, or ceilings;
- a source-qualified research pattern clears or fails its evidence gates;
- the assigned thesis or market-session state changes.

Each refresh follows one visible loop: **operator inputs → rerank library → prefill selected mission → compute gates → eligible, held, or cash outcome**. The ranking receipt names which operator and system inputs moved the result.

The capital mission is presentation-first. A populated mission renders as a readable question with an explicit **Edit mission** action. Editing opens a compact, normal-sized composer; it must not turn the question into an always-on oversized textarea.

The framing pills remain visible beneath the readable question. They teach the operator to ask “Where can I…”, “How can I…”, or “What must…”, then open the compact editor with the selected frame prefilled.

The harness remains local, deterministic, paper-only, and zero-API. Every fixture is illustrative or modelled. No fixture represents a current market claim, quote, recommendation, or promised return.

## Branches

The runway supports three outcomes:

1. **Eligible:** Thesis → Plays → Top play → Plan → Approval → Monitor → Outcome.
2. **Conditional:** Thesis → Plays → Leading condition → Held plan → Pending gate review. Approval and monitoring stay unavailable.
3. **No trade:** Thesis → Plays → Cash decision → No-trade record. Plan, approval, and monitoring disappear.

The branch must preserve one next action. It must not show skipped stages as completed.

## Scenario contract

Each fixture defines:

- persona group and operator skill;
- assigned thesis or an explicit no-thesis state;
- editable capital, target, loss ceiling, and horizon;
- three natural-language prompt starters;
- researched, cleared, and parked counts;
- one to three modelled plays with entry, invalidation, time boundary, planned loss, evidence state, and sizing units;
- result state: eligible, conditional, or no trade;
- binding gate and explicit no-trade condition;
- information required in the summary;
- optional evidence depth;
- UI risks and one acceptance assertion.

The fixture file is [aperturePressureTestScenarios.ts](../../client/src/prototypes/aperture-runway/aperturePressureTestScenarios.ts).

## Coverage

The initial harness contains ten fixtures across six operator groups:

- intraday: unrealistic return aspiration and stale opening evidence;
- swing: one eligible catalyst leader and one pre-event wait state;
- options: missing entitlement and contract facts;
- portfolio: an eligible defensive sleeve and a concentration collision;
- disclosure: a lagged catalyst bridge and an independent cluster;
- novice: no thesis, a 100% same-day aspiration, and low loss tolerance.

The set includes three eligible, four conditional, and three no-trade outcomes. Two fixtures begin without an assigned thesis.

## UI rules learned from pressure testing

- A blocked candidate must never look actionable because it has a polished card.
- In a no-trade result, cash dominates; blocked candidates collapse beneath it.
- A conditional result queues the missing gate. It never flows through approval.
- Candidate rank and candidate eligibility are separate concepts.
- The target remains an aspiration. The UI shows the gap between that aspiration and the modelled risk range.
- Large capital values must not overpower the binding constraint.
- Disclosure record count must not hide deduplicated actor count.
- Options research must not invent contracts or substitute shares when entitlement is missing.
- A no-thesis path preserves capital, horizon, and loss inputs while the operator builds the thesis in place.
- The selected mission is durable run state, not display copy. If the operator selects cash, the Play Slate, workset focus, arithmetic, primary action, stage rail, and outcome must all switch to the no-trade branch.
- A generic stage question must never compete with the operator's actual capital mission. Use the compact stage label as orientation and reserve the large question treatment for the mission itself.
- Currency inputs remain editable but render grouped values such as `$250,000`, `$300,000`, and `$12,500`; replacement input must not append to the prior formatted value.
- The Mission Library may rank an outcome the fixture did not initially lead with. The downstream flow must use the effective operator-selected disposition while preserving all system-computed gates.

## Validation

The prototype must pass:

- TypeScript check and production build;
- ten fixtures across all six groups;
- at least one fixture for every result branch;
- at least one no-assigned-thesis fixture;
- non-empty plays, gate, no-trade condition, prompt starters, and acceptance assertion for every fixture;
- zero API, database, or brokerage calls;
- browser UAT for one eligible, one conditional, one no-trade, one no-thesis, and one large-capital scenario.

Browser UAT remains a human validation gate for the prototype. Passing a fixture assertion does not authorize production implementation, broker execution, or live release.

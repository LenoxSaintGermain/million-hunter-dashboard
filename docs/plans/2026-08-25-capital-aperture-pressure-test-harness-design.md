# Capital Aperture Pressure-Test Harness

**Status:** Prototype contract
**Surface:** Research OS / Capital Aperture
**Question:** Does the Decision Runway stay clear when the operator, thesis, horizon, candidate count, instrument, capital scale, and gate result change?

## Decision

Use one compact scenario selector above the existing runway. A scenario changes the full fixture, not only the mission fields. It controls the assigned-thesis state, capital mission, data freshness, warning, universe size, candidate plays, evidence state, binding gate, branch, and acceptance assertion.

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

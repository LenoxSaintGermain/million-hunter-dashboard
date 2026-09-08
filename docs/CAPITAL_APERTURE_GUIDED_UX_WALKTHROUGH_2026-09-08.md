# Capital Aperture guided UX walkthrough

**Implementation checkpoint:** 2026-09-08

**Scope:** Mission underwriting and returning Today check-in

**Boundary:** Code and deterministic contract evidence only. No deployment or browser-based user test is claimed by this document.

## Setup / resume walkthrough

1. **Mission opens at the first incomplete persisted section.**
   - The section rail contains `Thesis & horizon`, `Account & risk`, and `Review & underwrite`.
   - Saved thesis and paper-account values identify their provenance.
   - Mission capital is explicitly described as an allocation, not total account value.
2. **The operator sees target pressure before authorizing analysis.**
   - Required return and feasibility classification appear beside the effective risk preview.
   - A profit target exists only when both an amount and period were explicitly recorded. A legacy desired-ending value is not revived as a weekly target.
   - Copy states that the target is excluded from risk sizing.
   - The tighter mission, mandate, or measured portfolio headroom limit is shown as the effective value using the authoritative account snapshot rather than a client-side zero-risk assumption.
   - Exhausted portfolio headroom is named as the blocker even when the operator has already entered a valid planned-loss limit.
3. **The review section summarizes the decision.**
   - Thesis, horizon, capital, instruments, target, and effective risk are visible together.
   - Secondary outcomes remain available: hold for a condition or preserve cash.
4. **`Underwrite my mission` is the one research action.**
   - The Mission is persisted first.
   - The already-authorized underwriting request runs directly to a usable result in the same workspace.
   - Failure after persistence is reported as `Mission saved; underwriting stopped safely`, not as a failed Mission save.
   - A completed result becomes the current persisted state. The action cannot silently create a duplicate underwriting run unless a material assumption changes.
5. **The result leads with the decision.**
   - A concise synthesis is followed by zero to three conditional play cards or Sit Out.
   - Regime and feasibility detail live in `Evidence and calculations behind this result`.
   - Share scenarios use `Planned loss at the modeled stop`; unavailable contract scenarios are withheld rather than presented with fake precision.
6. **`Validate this play` enters the existing evidence lifecycle.**
   - The selected underwriting and play identities are persisted before research starts.
   - The receipt says no paper ticket exists and that approval and submission remain separate.

## Returning check-in walkthrough

1. **Today opens as a briefing when persisted work exists.**
   - The first viewport identifies `Today · Paper`, the account snapshot, whether attention is required, and the highest-priority permitted action.
   - Reviewing the current Mission remains secondary; the UI does not pretend that opening the existing Mission creates a new one.
   - A completed underwriting result is reachable from Today with an explicit receipt, including a no-trade result and the statement that no paper ticket was created.
2. **One shared deterministic model chooses attention.**
   - Status failure, unresolved dispatch, invalidation evidence, other material change, approved-not-submitted, pending paper review, due review, and missing evidence are ordered explicitly.
   - Play Desk consumes the same primary item above its filters; a filter cannot silently hide critical work.
3. **Order states stay distinct.**
   - Submitted without broker id is `Submitted; broker status pending`.
   - Broker id without fill is `Paper broker accepted; no fill yet`.
   - Partial fills show filled and remaining quantities.
   - Only a filled opening exposure is labeled an open position.
4. **Changes use a persisted Seen baseline.**
   - The query first compares the current authoritative records with the prior baseline.
   - Only rendered items are then recorded as Seen through a separate mutation.
   - This mutation does not acknowledge, resolve, approve, submit, cancel, or close anything.
   - A first baseline says `Current status`; later material differences say `Changed since your last review`.
5. **Quiet and failed states remain honest.**
   - An on-demand check says so; it does not imply continuous surveillance.
   - A failed read cannot become an empty array or an all-clear.
   - A quiet check-in does not promote a new Mission or manufacture urgency.

## Deterministic behavioral evidence

- Start, Resume, and Check in entry-state derivation.
- Unresolved dispatch priority and broker-acceptance distinction.
- Partial fill quantity split.
- Invalidation visibility independent of filtering.
- Timestamp-only change deduplication.
- Failed and partially available reads do not produce an all-clear.
- Today status read does not launch underwriting or mutate lifecycle state.
- Seen persistence is isolated to the owner-scoped attention baseline.
- Mission authorization runs directly to its result.
- A completed underwriting result is not offered as a duplicate primary action.
- Optional target semantics and measured risk headroom remain identical between the saved Mission, preview, and executed underwriting result.
- Revision changes require a before/after review.

## Capital Strategist bounded increment

This checkpoint adds the decision core upstream of the existing Underwriter without introducing another homepage, risk authority, or execution lifecycle.

- The operator intent is explicit: deploy excess capital, redeploy realized gains, explore an opportunity, or review a material change.
- Capital lineage distinguishes operator-declared excess funds, reconciled available funds, returned principal, realized gains, and hypothetical future proceeds.
- Realized gains are computed from recorded net sale proceeds and attributed cost basis. Returned principal and the selected reserve remain unavailable for redeployment.
- Duplicate capital events, active allocation claims, unrealized gains, unreconciled gains, and unavailable funds fail closed.
- The comparison contains no more than two already-underwritten investment alternatives and always retains cash as a valid alternative.
- Causal economic paths are limited to three consequential hops, preserve sources by originating record, and require an expectations change, counterargument, invalidation, and verified security mapping.
- A fixed-fee supplier relationship cannot be promoted as usage-driven revenue, and an odds feed without observed volume cannot substantiate handle, customer, revenue, or profitability claims.
- The Strategist is pure decision support in this increment: it reserves no capital, creates no proposal or order, and invokes no broker.

The user-facing intent entry, persisted capital-allocation event ledger, and broad provider-backed discovery orchestration remain subsequent increments. Their absence must not be relabeled as a completed end-to-end Strategist workflow.

## Visual and observed-UAT gate

Representative desktop and mobile screenshots of this checkpoint were **not captured** because the isolated UAT database/runtime was not available locally, and production was not deployed or mutated for this implementation pass. The supplied browser screenshots document the prior production experience, not this checkpoint, so they are not relabeled as after-state evidence.

Still required before calling the UX complete:

- apply migration `0062_aperture_attention_baseline.sql` in an isolated or authorized target;
- run the app against deterministic UAT records;
- capture Mission setup/resume at 375, 768, 1024, and 1440 CSS pixels;
- capture Today check-in with an urgent item, a quiet state, a partial fill, and a failed/partial source;
- keyboard and screen-reader verification, including asynchronous status announcements;
- observed operator walkthrough measuring whether status and next action are found in roughly ten seconds.

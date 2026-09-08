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
   - While the saved underwriting result is unresolved, the effective-risk claim is withheld, the action reads `Checking saved underwriting…`, and the commit handler fails closed. A result is authoritative only when its decision-revision identity matches the active Mission revision.
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

Authenticated browser UAT was completed on the zero-traffic tagged revision `capital-aperture-00078-bim` (`6e665848543bf577b17893d2f7e6cac5136e5889`). Representative desktop (`2027 × 1251`) and mobile (`390 × 844` CSS pixels) screenshots were captured in the Codex UAT trace. Production remained pinned to `capital-aperture-00075-fig` throughout.

Observed pass:

- the persisted PW Mission opened with the named Alpaca Paper account and NVDA binding constraint;
- the completed no-trade underwriting result showed `$0` effective risk, an explicit no-ticket receipt, and a disabled duplicate-underwriting action;
- desktop and mobile Today distinguished broker-accepted/no-fill orders from open positions and kept secondary urgent issues visible;
- the mobile Mission and Today flows retained single-column actions and the paper-only boundary;
- temporary Firebase authorization for the exact tagged hostname was removed after UAT and the authorized-domain count returned from 11 to 10.

Observed fail / unresolved:

- Today briefly rendered `Account not selected` and `No execution account selected` while its independent queries were loading, before settling to the real paper account. Loading is therefore still capable of presenting a false zero-state.
- A deterministic cold-network capture of the new `Checking saved underwriting…` interim Mission state was not obtained; the settled post-load state and source/test guard were verified.
- Incomplete Mission drafts and the active section are not yet persisted across devices.
- Underwriting does not yet have a durable queued/running/failed job identity; the dedicated route can still initiate work on mount.
- Collapsed change items can be marked Seen, and the server baseline replacement can forget previously seen items outside the submitted subset.
- Empty, stale, partial, and failed check states are not all wired through the production router/UI path; an unreviewed completed playbook can still be demoted into a quiet briefing.
- `Run updated checks` refetches summaries rather than proving a new monitoring check, and active-play status links still land on the general Play Desk.

Still required before calling the UX complete:

- persist incomplete Mission drafts and underwriting job state with idempotent retry/reconciliation;
- make Seen updates visibility-accurate and merge-safe;
- fail closed across Today and Mission loading/failed/partial reads;
- route every active-play action to its exact task identity;
- capture deterministic Start, Resume, quiet, partial-fill, failed-source, revision, keyboard, screen-reader, and reduced-motion journeys at the required viewport set;
- run an observed operator walkthrough before claiming the roughly ten-second usability target.

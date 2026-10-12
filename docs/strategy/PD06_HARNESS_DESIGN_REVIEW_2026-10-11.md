# Evidence belongs inside the decision harness

Team: Third Signal Lab · Project: Third Signal Lab Agency · Primary label: Research OS.
Review baseline: `22c1d97`. Status: **production hold — integration design gate**.
Linear connection requires reauthentication; this is a ready-to-sync operating document, not a created Linear issue.

## Decision

The receipt is proof, not the primary experience. The operator consumes a contextual insight, its implication for the current decision, and one next action. Exact evidence, versions and model provenance remain available through deliberate inspection.

This review uses source inspection and saved local-UAT screenshots. It is not a fresh browser usability study or a deployment verification. No product code or production state was changed during review.

## Findings requiring correction

1. **P1 — Competing analysis paths.** `DealDetail.tsx:293` inserts the evidence desk in Sources, while the Senior at line 236 and committee query at line 133 still consume legacy records. A successful new run can coexist with an unrelated old verdict or “not reported” message. Use one explicit current-result selection shared by the relevant surfaces; preserve, but clearly distinguish, historical alternatives.
2. **P1 — No finding-level consumption contract.** `shared/dealEvidence.ts:22` stores summaries, flags, scores and run/reviewer citations. It does not bind each recommendation to an affected criterion and specific supporting facts. Add a validated, versioned projection rather than parsing prose into authoritative actions.
3. **P1 — Cross-context authority is absent.** Current inputs bind acquisition `dealId` and same-legal-entity CIK only. Capital has distinct candidate/thesis/account/revision bindings (`server/aperture/decisionReceiptBinding.ts`). No name/ticker shortcut may turn acquisition findings into a Capital play or execution clearance.
4. **P2 — Administration precedes meaning.** `DealEvidenceDesk.tsx` leads with attachment selection, run controls and history; result provenance precedes interpretation. Move this workbench behind proof/input inspection. Do not merely collapse its full length under every insight.
5. **P2 — Reading is a dead end.** A finding has no contextual resolve path into financing, document reconciliation or thesis review. Route only to supported actions with context retained; viewing is not resolution or approval.
6. **P2 — Inspect can appear to do nothing.** `DealEvidenceDesk.tsx:516` updates receipt state while the preview at line 688 can remain inside a closed disclosure. Opening inspection must reveal and focus the selected receipt, then return focus to its trigger on close.
7. **P2 — Score comparison tracks can differ.** `DealEvidenceDesk.tsx:288` independently sizes label/track/value columns per reviewer. Use shared columns or equal-width mobile tracks; equal scores must have equal visual lengths.

## Default interaction contract

**Read → Inspect → Resolve.**

- **Read:** one prioritized implication, concise rationale, relevant freshness/uncertainty, one primary next action. If there is no supported implication, say what remains unknown; do not invent one.
- **Inspect:** reveal the selected finding's facts, assumptions and exact receipt in place. Full hashes, model IDs and run history are a further technical disclosure. Preserve focus and the originating context on return.
- **Resolve:** open the relevant existing task with subject/finding context. Refresh, paid analysis, accepting a thesis revision and approving a play remain separate explicit actions.

## Consumer design

| Surface | Default presentation | Secondary proof |
| --- | --- | --- |
| Deal insight / Senior / committee | A qualified diligence hypothesis and next question, using the same selected run | Finding-specific citation and historical alternatives |
| Research recommendation | Evidence that supports, challenges or leaves a named criterion unresolved | Exact basis and unresolved assumptions |
| Thesis | Proposed challenge/support against a specific belief; review before revision | Source and analysis versions used by that proposal |
| Today / Play Desk | Only relevant, deduplicated attention items with an inline resolution path | Why it was raised, evidence state and history |
| Source inspector | Explicit receipt and input management | Complete immutable audit record |

The Capital rows are proposed extensions, not current functionality. Implement explicit subject/context binding first. An acquisition score is never a Capital rank, probability, risk clearance or order authorization.

## Release acceptance

- A returning operator at 354px mobile sees the issue and next action before attachment rows, UUIDs, model controls or history selectors.
- One finding has one primary action. Receipt inspection takes one deliberate interaction and returns keyboard focus to the originating finding.
- The Senior, challenge and committee agree on the selected run/version; failed or pending latest attempts remain visible and cannot silently fall back to success.
- Every surfaced implication links to its own facts and limitations. A valid citation proves the quoted fact exists, not that the inference is true.
- Current expiry and freshness-at-run are separate. A new capture marks the basis for reassessment; it never rewrites an old decision or automatically strengthens a thesis.
- SEC submissions remain metadata, not reviewed filing contents or verified finances. Unsupported private-company, parent or competitor matches fail closed with a useful explanation.
- Only meaningful measured relationships earn a chart. No chart for unknown values; no source-count gauge masquerading as diligence quality or risk confidence.
- Existing cream/ink `--sh-*` tokens, editorial hierarchy, hairlines and restrained state colors remain authoritative. No new dashboard visual language.
- At 354px, the collapsed evidence basis occupies at most 160px excluding exceptional warnings. Default view has no raw IDs/hashes, expanded history or unchanged-comparison panel. Reduce routine content rather than shrinking text or targets.
- At 354px and 200% zoom, no horizontal document overflow or clipped controls; primary targets remain at least 44px. Equal reviewer scores produce equal bar lengths within 1px; missing scores have no bar.
- Reading, opening proof and navigating do not start providers, change an approval or create orders. Public demos remain frozen and zero-API.

## Concrete implementation sequence

1. **Unify deal analysis into the existing reading harness.** Add result selection and finding-level projection; replace the default full desk with compact contextual intelligence and a focused receipt inspector.
2. **Bind evidence to Capital research and thesis context.** Test owner, issuer, candidate, thesis and revision mismatches before exposing derived recommendations.
3. **Route relevant gaps into inline attention.** Deduplicate review tasks, preserve explicit resolution and human-approval boundaries, then test Today/Play Desk continuity.
4. **Re-run journey UAT before release.** Validate mobile default density, keyboard return, missing/stale/failed evidence, contradictory history and zero-API demos. Existing engine/unit passes do not clear this UX gate.

Review contributors: Beauvoir (UX architecture), Lovelace (harness integration), Sartre (editorial UI and interaction). All recommend holding the user-facing release pending harness integration. Sartre authored the initial UI; this is a critical self-review complemented by the other two reviews, not three independent implementations.

Screenshot limitation: the saved mobile capture precedes the final persona-label update. It establishes the earlier density/layout, not the exact final mobile copy. Fresh browser acceptance is required after redesign.

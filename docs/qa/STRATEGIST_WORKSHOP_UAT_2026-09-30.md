# Editable Strategist workshop

Surface: Orbital / Signal Hunter. Tracking: THI-266.

## Scope

Acquisition and property thesis entry now follows: describe → refine/pre-evaluate → edit/challenge → decide angles → approve/save criteria → separately launch research. Canonical liquid-capital entry is unchanged. Mission, Play Desk and decision-receipt redesigns are not part of this release.

- The workshop reuses the reading-desk tokens and progressive disclosure, guided by the design-system skill. Brief, Pre-evaluation and Angles are separate compact views, with a mobile writing/review switch.
- Editing either brief field updates the other immediately. Editing text, scope or feedback invalidates evaluation and clears approval/dispositions. Provider reasoning refreshes explicitly, not on every keystroke. Changed drafts reject late review responses; compilation responses are bound to text and scope.
- Refinement uses the existing `GEMINI_FAST` registry role. No model IDs changed or new model availability/pricing claims made. Server output is schema-validated; errors fail closed without saving or launching anything.
- The provider receives no tools, listing search or broker authority. Preliminary analysis separates capital/operations/failure modes/evidence, assumptions, questions and alternative hypotheses.
- Each angle supplies mechanism, conditions, downside, evidence and a next step. The operator chooses investigate, park or reject. Different-scope alternatives require a separate thesis; no automatic projection occurs. Tax/legal/financing hypotheses require professional review and cannot establish eligibility or savings.
- Compilation stores original intent, evaluation and angle dispositions as review notes in existing confidence-note storage, without a schema migration. They are not added to executable filters. No separate angle tasks or linked theses are created by this approval.
- Saved library is scoped, searchable and incrementally revealed six entries at a time. Requirement bullets are hollow/unverified rather than green checks. Planning estimates are behind disclosure. Generic cross-asset action removed from acquisition/property output.

## Validation

- TypeScript and production build passed in a clean detached checkout; unrelated dirty files excluded.
- 2,743 unit tests passed, 18 skipped (246 test files passed, four skipped).
- New tests: authenticated no-write refinement, invalid provider output, unauthenticated rejection, stale approval rejection before DB access, per-angle disposition completeness, text/scope/feedback invalidation.
- One bounded real-provider smoke review passed local output validation (360-character brief, three questions, two angles). No compilation, DB write, research search or broker action.
- Offline visual fixture exercised actual components with all real mutations blocked. Approval enabled only after angle disposition and explicit acknowledgement. Editing the draft reset the disposition and checkbox and disabled approval. Three review lenses and desktop contrast inspected.
- Mobile view inspected at requested 390×844; rendered document width and scroll width both 386 pixels. No horizontal document overflow. Viewport reset afterward.

## Release

- Runtime source: `519891ca7c6c62e88e40834ec5811fb68c7def70` (main).
- Frozen source checksum: `fbf82a976bd8d27e6caf939e93c0f58db544feb7a89fe9218500432afbfae8ed`.
- Cloud Build: `defdf500-95e1-47dc-ad14-cdd3cb6e3cde`.
- Superseded build `2515cefa-fdfe-4e0b-8b0e-dddf1a31a0ec` cancelled before staging, after a final scope-race correction.
- Status: promoted at 2026-09-30T15:30:42.164Z. Revision `capital-aperture-00264-wiv` serves 100% of production traffic; `capital-aperture-00262-bap` remains the rollback revision.
- Image digest: `sha256:d93f229dfae55909dd5895c26de6e7fbaea0f811673223271d5da1f2f04e729e`.
- Runtime configuration fingerprint unchanged: `261f7bfbe6b97cef6c7c3896e2ec01190fdb4c7f1b5bc79ae233d858cfd155c9` (excluding image and release SHA).
- Staged verification: 12/12 passed, zero mutations, at 2026-09-30T15:30:09.495Z.
- Production verification: 12/12 passed, zero mutations, at 2026-09-30T15:31:08.657Z.
- Signed-in production refinement succeeded in a fresh tab using a car-wash draft. It returned a 348-character editable proposal, preliminary evaluation and two unverified angles (OpCo/PropCo separation and legacy-tunnel conversion). Both dispositions remained pending and compilation approval remained disabled. No thesis save, search, order or approval was executed. Agent language included a proposed development route beyond the initial ownership wording; original intent remains available and the proposal requires operator review, not automatic acceptance.
- Live URL: https://third-signal-capital-aperture.web.app/thesis?scope=acquisition . Workshop left open for operator UAT.

## Operator UAT

1. Enter your idea and select Refine my thesis. Nothing should be saved yet.
2. Edit the working brief or use the challenge disclosure. Evaluation becomes stale; Refresh evaluation restores a current review.
3. Inspect Pre-evaluation, then decide each proposed angle. Investigation approval is not investment approval.
4. Acknowledge the brief and save criteria. Confirm review notes preserve original intent, assumptions and dispositions. Launching research remains a separate action.
5. Reload a saved thesis and inspect its review notes. There is no implied verified evidence, tax qualification or new linked thesis.

## Remaining risk

Generated reasoning may be wrong despite schema validation; operator and professional review remain necessary. Full compile/save and search execution are separate operator UAT actions. Existing large-bundle warning remains. No claim of redesigning every Capital route.

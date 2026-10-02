# Mission reading brief — local UAT

Surface: Capital Aperture / mission / Thesis & horizon. Production unchanged.

## Change

The complete mission was previously rendered in a large `h3`. It now uses the assigned thesis name as a bounded editorial title and renders the entire mission as body passages. Explicit section cues create reading headings for evidence, eligibility, loss boundaries, stand-aside, invalidation, exit and aspiration. Unknown prose remains verbatim; no model call or financial reinterpretation is involved. The passage tests verify preservation of wording, decimals and times.

The saved-thesis selector is a quiet ruled row; duplicate visible title is removed. The margin carries the selected horizon, paper-only boundary, date-refresh caveat and next account/risk step. Editing retains the original mission string and existing dirty-state/underwriting invalidation handlers. Existing mission state, account, gates, saved records and execution behavior are unchanged.

Design-system extension: shared paper, ink, rule, amber and font tokens; scoped `mission-reading-brief.css`; two-column reading spread collapses below 640px. No new brand palette or cards.

## Checks

- Typecheck passed.
- Production build passed; existing large-bundle warning remains.
- 39 focused tests passed: mission brief, mission UX/client contracts, review behavior and draft state.
- Isolated browser preview: `http://127.0.0.1:3134/__mission-reading` (synthetic wording; no RPC or production data).
- Desktop and narrow screenshot review passed; measured narrow scroll width 351 versus viewport width 354, with no horizontal overflow.
- Edit/Done toggles preserve the illustrative text in the local preview.
- Full authenticated route UAT and production deployment remain pending; isolated preview is not represented as deployed testing.

No research runs, broker actions, thesis saves or production mutations were performed. Existing unrelated worktree changes were preserved.

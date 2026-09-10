# Capital Aperture — stakeholder refinement receipt

Scope: THI-266, four annotated Mission/Play Desk findings, and the authenticated
Chrome walkthrough in Review Capital Aperture UAT. Evening continuation on
September 9, 2026; market-open execution is not certified by these checks.

## Implemented

- Result-first completed Mission, with exact saved receipt hydration, editable
  summaries and secondary suggestions. No blank/default form on an exact URL.
- One no-trade conclusion, concise entered/effective-risk explanation, preserved
  adjacent calculations, material uncertainty and named paper destination.
- Compact secondary critical Play Desk rows; no critical issue hidden by filters.
- Exact order/finding/version navigation and explicit unresolved review receipts.
- Actionable evidence questions using operator-entered observation/date/criterion/
  source, without invented thresholds or independent-verification claims.
- Blank new-thesis entry, stable composer typing, uncertain-save recovery.
- Optional analytics emits no unresolved placeholder URL.

No migration, model/provider change, risk-policy change, broker integration,
approval, submission or exit was added. Review receipts reuse the owner-scoped
attention snapshot, with owner locking and Seen merge preservation.

## Observed local walkthrough

1. Existing illustrative draft was preserved, not reset or reseeded.
2. Today checkpoint opened decision 13/revision 39. Before repair, its Mission
   link skipped receipt hydration and displayed blank allocation/default horizon.
3. After repair and a cold reload, that exact receipt opened the completed result:
   $25,000 declared allocation, $249 entered limit, $187.50 effective at analysis,
   $6,000 weekly target (24%, extreme), swing horizon and shares/options.
4. At 390×844, the result appears before the saved summary; no suggested missions
   interrupt it. Stale account/market evidence and no-order boundary stay visible.
5. Edit mission → Account & risk preserved the saved values; Back to result did
   not run analysis. Desktop cold reload at 1297×1196 repeated the same result.
6. New thesis began blank and disabled saving until input was valid. Character-by-
   character typing preserved focus and complete text. The test-only unsaved text
   was cleared; no thesis was saved during this check. One browser automation
   typing timeout interrupted the tool after 60 characters, not application focus;
   the remaining text was entered and verified.

Screenshots (local, illustrative data only) are in the task artifact directory
`stakeholder-uat-2026-09-09`: `mission-result-mobile.png` and
`mission-result-desktop.png`. They are inspection evidence, not usability metrics.

## Verification

- Focused Mission checks: 29 passed, including exact receipt hydration and the
  no-trade/portfolio-risk distinction.
- Full pure/local lane: final report recorded at release below. Database tests
  stay in the isolated lane, not silently counted as unit-test successes.
- Disposable integration lane: 72 passed, 0 failed, 2 external URL cases skipped;
  11 files passed. New review tests exercised real transactions and persisted
  readback, concurrent Seen preservation, retry deduplication, owner/version
  rejection and unchanged full order/check rows.
- Existing isolated persisted journeys: 4 passed. No production connection.
- TypeScript, Vite production build, server bundle, diff checks: passed. Existing
  ~4.47 MB main client bundle warning remains; no performance pass is claimed.
- Disposable integration database and user were removed and verified absent.
  The independent browser fixture was untouched by that harness.

## Remaining acceptance boundaries

Authenticated production repeat and release identity must be recorded below before
calling this shipped. Screen-reader operation, enlarged text, real soft-keyboard
occlusion, complete keyboard-only journey and user-observed time-to-decision are
not yet verified. This is not a WCAG conformance or ten-second usability claim.

The broader Capital Strategist intent UI, capital-event allocation ledger and
provider-backed discovery orchestration remain outside this bounded refinement.
The evidence attachment currently uses the existing review-note contract; it is
operator-entered evidence, not a new provider verification authority. No new live
proposal/approval/submission was exercised. Fresh market-open validation remains.

## Authenticated production repeat — 82dee65

Build `5da7a388-3d1c-4a32-9ff5-40977dcc5106` succeeded. Revision
`capital-aperture-00088-xus` was checked at zero traffic, then received 100% of
production traffic under the existing deployment authorization. The public
Firebase domain served JSON health and the exact release marker
`82dee659a9a4590e0c2f1e8d1f7955c0a9f318e4`.

- Signed-in Chrome Today kept PW distinct from the NVDA portfolio constraint.
  The DKNG concern remained an unresolved finding with stale evidence.
- Its review action opened run 360001, candidate 240003, order 2, finding 120001,
  version `v1-951cb173`, with that exact evidence expanded. The review form
  loaded; saving stayed disabled without assessment and explanation. No review
  was saved, no new provider check ran, and no broker action was taken.
- Mission opened the saved PW result, not setup: $8,000 allocated, $500 entered
  limit and $0 effective at the recorded analysis. No-trade reason and reopening
  condition appeared once. Desktop 1297×1196 and mobile 390×844 were captured.
- Play Desk exposed all three secondary critical rows. Selecting Puts preserved
  the MGM call concern and displayed three critical issues outside the filters.
  All was restored. Reading DKNG did not resolve it. Chrome error log was empty.
- Six records remained in motion: two filled and four accepted without a fill.
  No new order, approval, submission or exit was requested by this walkthrough.

Live mobile inspection found one remaining presentation defect: repetitive Desk
introductory/status copy pushed the primary review action below the first 844px
viewport. The follow-up removes the duplicate introduction and read-only safety
banner, pairs the title with a 44px refresh control, and states refresh scope once.
Account/mode, stale/partial warnings, exact actions and all critical rows remain.
Local 390×844 verification places its illustrative primary action at y=500.5–544.5,
with no horizontal page overflow. This is a geometry observation, not a usability
score. The production repeat for this follow-up is recorded separately below.

Follow-up verification: 1,305 unit tests passed, 0 failed, 6 skipped. TypeScript
and production Vite build passed; the existing large-client-chunk warning remains.

## Final production release and repeat

- Release: `fba1b41918dd8c0ccff5dccf3a68375a322f3ae0` (branch
  `codex/aperture-play-desk`, fast-forwarded to `origin/main`).
- Build: `3b6ccbba-db15-4282-bce7-d871defe2e55`, SUCCESS.
- Image digest: `sha256:a2bd16ee45e0f76fce1c6adf1391dcb9bf9b366d9c8232371727e0cc5b505c6a`.
- Revision: `capital-aperture-00090-hal`, 100% production traffic. Previous
  verified revision `capital-aperture-00088-xus` remains available for rollback.
- Runtime configuration compared equal, excluding the image. No auth settings
  changed. Staged and public routes returned HTTP 200 JSON health and the exact
  full release marker.
- Public entry: https://third-signal-capital-aperture.web.app/aperture

Signed-in Chrome repeat at approximately 9:46–9:49 PM EDT:

1. **Mobile Play Desk (390×844):** header height 44px; primary unresolved-finding
   button at y=677.5–721.5, height 44px, within the initial viewport. No page-width
   overflow. Paper mode, NVDA constraint consequence and stale-check warning
   remain ahead of the action. Screenshot: `production-playdesk-mobile-final.png`.
2. **Desktop Play Desk (1297×1196):** one prominent task, three visible compact
   secondary critical rows, no page-width overflow. Screenshot:
   `production-playdesk-desktop-final.png`.
3. **Mission:** saved PW result opens directly on both sizes. One no-trade reason,
   reopening condition and no-ticket/existing-position boundary, with editable
   saved assumptions below; no suggestions intervene. Screenshots:
   `production-mission-desktop-final.png`, `production-mission-mobile-final.png`.
4. **Today:** exact DKNG concern still unresolved; named account and PW/NVDA
   distinction preserved. No false all-clear on the settled stale state. Initial
   cold navigation showed the loading shell before records arrived; this sample
   is not an exhaustive network-timing test. Browser error log was empty.

Browser viewport overrides were reset, All filter restored, and Chrome was left
on Today. No proposal, review acknowledgment, approval, submission or exit was
performed. Screenshots live under the task artifact directory:
`/Users/lenoxparis/.codex/visualizations/2026/08/25/01a0392e-5a5e-73c2-9f5e-675f1dc136d9/stakeholder-uat-2026-09-09/`.

This closes the four annotated presentation defects and exact-review refinement,
not the remaining broader acceptance boundaries above. Next live UAT: use the
existing exact paper workflow during an open market; do not relax risk or evidence
gates to obtain a trade. No-trade remains a valid completed decision.

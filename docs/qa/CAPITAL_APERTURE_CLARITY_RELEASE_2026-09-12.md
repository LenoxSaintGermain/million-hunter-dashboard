# Candidate comparison and Portfolio: production review

## Release receipt

- Deployed source: `c1ce28fa4e46ff53a37a38678c4808ce82fed4e6`, including candidate comparison `439cfd8`.
- Cloud Build: `1b118fc3-d97c-4f3f-bd34-6f72ac907de3` — SUCCESS.
- Runtime source snapshot: `8cdc942ae072340710e6a9290aa39120b6708378e44e1b32560ca89c8c02c870`.
- Image digest: `sha256:e323f1b310910e01dc9abded6d66b7d5b80acf9ee8075d185ada7a471c90f73a`.
- Cloud Run: `capital-aperture-00144-gab`, 100% production traffic.
- Previous revision retained: `capital-aperture-00142-cik`.
- Public origin: https://third-signal-capital-aperture.web.app
- No schema migration or authentication configuration changes.

Both the zero-traffic tagged revision and public origin passed six read-only
checks: shell, same-origin bundle, exact source SHA in bundle, expected Today
copy, JSON API health and denial of unauthenticated account access. Public
verification completed September 12 at 22:49:52 UTC.

## Automated verification

- Offline unit lane: **2,301 passed, 8 existing skips** across 194 passing / 3 skipped files.
- TypeScript: passed.
- Production build: passed locally and in Cloud Build. Existing large-bundle warning remains.
- Six new Portfolio render tests distinguish loading, failed, cached and empty
  data; keep restrictions outside optional detail; assert no mutation on render.
- Tests ran with `DATABASE_URL=`. No production database tests were executed.

## Observed signed-in walkthrough

Chrome, normal desktop viewport 1085 × 1200 and explicit mobile viewport 390 ×
844; viewport override reset afterward. Captures were shown inline in the Codex
review. This was not a physical-device or user-comprehension test.

1. **Portfolio:** account balances, destination, refresh date and restrictions
   lead the page. The generic four-step process explanation no longer precedes
   the accounts. Main-content rendered text measured 496 words before release
   and 343 afterward, with the same account records and desktop viewport.
   This measures density only, not comprehension or task completion time.
2. **Mobile Portfolio:** document width 386 at viewport width 390; no horizontal
   page overflow. Account headings/actions wrap. Account-specific broker-data
   restrictions remain visible. Opened and closed "Connections and order
   safeguards" and verified separate approval/submission language.
3. **Candidate list:** run 360001 displayed all 12 candidates with saved evidence
   state and next check. Opened LNW (candidate 240012) directly, without stepping
   through the preceding candidates.
4. **Mobile drawer:** MGM (candidate 240002) opened at full 390 × 844 size.
   Market-closed/no-reference warning was visible with the next regular-session
   recovery time. Escape closed the drawer; after its close transition, focus
   returned to "Inspect MGM" and candidate identity remained in the URL.
5. **Exact evidence:** reopened LNW, visited Research, then Evidence. URL retained
   `candidate=240012`; evidence displayed "3 unanswered questions for LNW".
   Confirmation stayed disabled with missing evidence. No answer was recorded.
6. Returned to the comparison list for the operator. Captured browser error log
   contained no errors. No ticket, approval, submission, finding resolution,
   account sync or schedule change was requested during this walkthrough.

## Remaining scope — not a full UAT sign-off

- Market-open quotes, evidence-to-proposal, explicit approval/submission and
  fill reconciliation were not exercised. It was Saturday; entry remained locked.
- Physical mobile devices, enlarged text, a complete keyboard-only journey,
  reduced-motion interactions and the ten-second comprehension target remain
  unverified in this release review.
- Broader wording work remains: the evidence screen still uses "gate" and
  "posture"; the Research action opens the general macro ledger, while exact
  candidate questions are under Evidence. The global "Nothing here checks ...
  automatically" sentence needs qualification because opt-in balance updates
  exist. Do not change actual monitoring/order authority to make copy agree.
- Holdings chips still expose raw option symbols; readable contract formatting
  there is a follow-up, not an accomplished part of this release.
- A green build and these bounded checks do not establish complete product UAT
  or investment performance. Paper-only risk/evidence and human gates remain.

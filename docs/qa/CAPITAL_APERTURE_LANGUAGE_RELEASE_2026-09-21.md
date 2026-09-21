# Capital Aperture language release — September 21, 2026

Surface: Research OS. Related issue: THI-266 (Linear reauthentication required; not posted).

## Scope

- `ade3868`: shared vocabulary, account bar, plan recovery, analysis actions, trading-term help.
- `fb1b68e`: Today, findings, practice-order review/approval/sending, risk details, secondary research copy.
- `6f2b700`: illustrative strategy labeling and disabled sample-card order entry.

Trading terms, official broker names, API confirmation strings, persisted identifiers, risk limits, separate approval/submission checks, and navigation destinations are retained. Historical records are not rewritten. The app remains simulated-money trading; a production backend does not change that boundary.

## Checks

- Full unit suite: 2,604 passed, 10 skipped; 218 passing files / 3 skipped.
- Typecheck passed.
- Local build passed before the final example-label additions; Cloud Build succeeded for the final source.
- Isolated integration: 287 passed, 2 skipped, all 18 files passed. Owned disposable database/user removed. Receipt: `/tmp/capital-isolated-integration.XEILfy`.
- Unit tests keep checking explicit-click behavior, disabled actions, no mount mutations, unknown broker status, no-trade consequences, and exact order states. New rendered example-card test verifies disabled order preparation and no mutation during render.

## Important boundary found during inspection

The preexisting Quick Hits catalog and simulation use fixed samples without inspectable evidence for current catalysts/prices or claimed historical performance. The release labels them illustrative and prevents preparing orders from those example cards. It does not certify the underlying experimental `quickHit.authorize` API. Audit that API and its evidence/approval bindings before promoting executable Quick Hits. No example order was created in this review.

## Deployment

Source: `6f2b700f8c42853dbfc45f4b9253e7a61710a721`.
Cloud Build: `49229672-bdcf-4ec3-8394-1b75c3452876`.
Prior revision: `capital-aperture-00218-wes`.
Runtime configuration fingerprint retained by the staged-release helper: `7e9609ae08b773b1ea790c1d856076edf934d9f09f152f4cf9067f305eda3866`.

Production revision: `capital-aperture-00220-sun`, verified at 100% traffic.

- Staged exact-release smoke: 6/6 passed at `2026-09-21T18:25:13.081Z`.
- Public exact-release smoke: 6/6 passed at `2026-09-21T18:26:00.722Z`.
- Checks covered app shell, client bundle, exact source SHA, compact Today copy, JSON health, and rejection of unauthenticated account access. These checks were read-only.
- Signed-in production reload confirmed Practice account, Account value, Buying power, Account details, and the named Alpaca Paper destination.
- All three illustrative strategy cards displayed disabled order actions with nearby explanations. No example order was created.
- Today showed timestamped recorded status, stale snapshot labels, and an accepted order separately from a filled position.
- Narrow viewport inspection measured 354 × 767 CSS pixels (the requested override was 390 × 844; actual dimensions are reported here rather than assumed). Document width was 351 pixels, with no page-wide horizontal overflow. Account constraint and status copy remained visible. Temporary viewport override was reset; desktop was visually checked afterward.

No order was approved or submitted by this agent during this language release. No schema, authentication, broker-mode, or risk-policy change was deployed. This is bounded release verification, not user-tested usability, a complete accessibility audit, or an all-gaps-closed trading UAT. Existing generated/historical narratives and the experimental Quick Hits server API remain outside the completed presentation pass.

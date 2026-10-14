# Document extraction correction — October 14, 2026

Team: Third Signal Lab · Project: Third Signal Lab Agency · Primary surface: Research OS.

## Scope and cause

Production synthetic-document UAT exposed two issues: the expanded `Seller's Discretionary Earnings (SDE)` label was not recognized, and the UI offered confirmation for non-value extractions with a null-to-zero fallback. Explicit `EBITDA is not disclosed` also needed to retain its nondisclosure state. Regression tests failed before the fixes and pass afterward. Server-side exact-value approval safeguards remain in place.

No trading operations, account synchronization, real-deal fact confirmations or mandate changes are authorized by this release. The synthetic dossier remains labeled as such; do not transfer its figures into the real deal record.

## Local verification

- Runtime source: `06b65e879040d2f61da7c90a3691ad4868d20e7f`.
- Focused extraction, UI, acquisition and cloud-storage tests: 88 passed.
- Dedicated unit suite: 4,153 passed / 18 skipped, 368 files passed / 4 skipped.
- Typecheck and build passed. Three independent bundled-process startup checks passed.
- The broad default test command also included integration/database-dependent tests: 16 files failed, 32 tests failed, 4,175 passed, 29 skipped. It was run with an empty DATABASE_URL; no production database was used. Disposable-database integration acceptance is not claimed. One legacy test also uses a URL-encoded local file path incorrectly. These failures are not represented as passing tests.
- Existing bundle-size warnings remain.
- Mobile follow-up unit rerun: 4,153 passed, 18 skipped, one timing failure (100 gate evaluations took 73.3 ms against a 50 ms limit in the parallel suite). Isolated rerun of all seven tests in that file passed in 19 ms total. No threshold or gate logic was changed; the parallel-suite failure remains recorded rather than counted as a clean suite pass.

## Build / release record

- Cloud Build: `7dbf9b7d-f1ef-4d1d-85af-71a25420b816` succeeded.
- Tracked runtime-source manifest SHA-256: `9ab8f67dbe58e2d652cc79d205914ce74830ad813823f1e5f5c0a78ca4be8202`.
- Build input excludes environment files, unrelated strategy drafts and downloaded UAT original.
- Rollback target: `capital-aperture-startup-eb5aaf0-d2`; retains native private GCS document support.
- Revision `capital-aperture-extraction-06b65e8` promoted to 100% production traffic. Canary and both production origins passed all 28 release checks for the exact source SHA.
- Signed-in synthetic dossier revision 2: SDE $702,537 and its exact source span now display; explicitly undisclosed EBITDA remains unavailable for confirmation. No facts confirmed and no evaluation run.
- Mobile inspection found child-level currency clipping despite no page-level overflow. Follow-up source `322c30b9dec5313a797d989367bc9a1e63990dec` stacks actions under provenance on mobile, wraps metadata and preserves unshrunk amounts. Focused 31 tests, typecheck and build passed. Cloud Build `475736bc-19bd-4cd4-b013-d13e7bf5e106` pending.
- Follow-up tracked source manifest SHA-256: `400f9e8eb697bb7aa280c2d95b0e4eabac933f2cb6feb502858378b7bb928b5a`.
- Linear connector requires reauthentication; this is the ready-to-sync ship log.

## Final production acceptance — 11:06 UTC

- Follow-up Cloud Build `475736bc-19bd-4cd4-b013-d13e7bf5e106` succeeded. Image digest `sha256:4ae9b36d46c0026f2541181861d1d7b4ef49a1b36c22713a15041c116c5d5c34`.
- Revision `capital-aperture-document-mobile-322c30b` now serves 100% production traffic. Canary passed 28 checks at 11:05:38 UTC; Firebase origin passed at 11:06:17 UTC and direct Cloud Run origin at 11:06:16 UTC, all exact SHA `322c30b9dec5313a797d989367bc9a1e63990dec`.
- Initial candidate probe during asynchronous image import detected the previous SHA and failed closed. No traffic promotion occurred until readiness and exact-SHA checks passed.
- Signed-in account reconfirmed: Lenox Saint Germain / treble.design@gmail.com / ADMIN. Saved synthetic dossier remained revision 2 with one document, five value proposals, undisclosed EBITDA disabled, no confirmed facts or evaluation. No orders, account sync or mandate changes.
- Mobile 390 × 844: document width 386; every amount rendered unshrunk; provenance wraps; buttons are 44 px high and stack below source details. Desktop resets to horizontal rows. Both screenshots visually inspected; viewport override reset.
- Screenshots in `/Users/lenoxparis/.codex/visualizations/2026/10/13/capital-after-hours-uat/`: `document-extraction-mobile-322c30b.png`, `document-extraction-desktop-322c30b.png`. They show synthetic UAT data in production, not verified deal facts or a real customer endorsement.
- Browser connector disconnected once; a fresh tab in the same Chrome profile restored inspection without changing credentials or permissions.

**Stakeholder acceptance remains HOLD** for legitimate Capital evidence binding, document confirmation/evaluation and OCR coverage, other provider/mobile flows and the separately documented integration-test environment. This pass closes extraction/null-confirmation safety and mobile amount clipping, not the entire UAT program. No new production cold-start certification is claimed for this extraction release; the earlier startup release has its own evidence.

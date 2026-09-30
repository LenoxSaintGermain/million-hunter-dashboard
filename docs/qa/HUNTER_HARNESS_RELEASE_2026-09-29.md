# Signal Hunter harness production release

Operator requested production promotion for authenticated testing.

- Source: `89cebc6102622ac989bc8d9d42fd10aaa9b6f86b`, pushed to origin/main.
- Cloud Build: `baff43f0-2961-4b78-8ffe-d31f0e577d77` — SUCCESS.
- Frozen source SHA256: `a4ff9b198f75f835b34ab09368c7c7eac321fc6a4e46c5d4f5600fde93c13617`.
- Image digest: `sha256:f95e44f27e458263efb51c1660f58ad766ce2db47584a6d0a24860a5eb3323f1`.
- Revision: `capital-aperture-00258-civ`, 100% production traffic.
- URL: https://third-signal-capital-aperture.web.app/
- Previous revision retained for rollback: `capital-aperture-00256-zuw`.

Clean detached checkout used. Unrelated working-tree backend/Scan/investor edits were excluded; only the two reviewed financial snapshot capture changes in routers.ts were included. No schema migration or manual production-data mutation was run. Existing Firebase public identifiers were reused from the previous successful build. Runtime configuration fingerprints match after excluding image and RELEASE_SHA: `ec4f3f633e5af7c27bfb553e4a93dbb43115ddb40a6556623e96226f3f723ff3`.

TypeScript passes. Exact checkout full regression with two workers: 2,724 passed, 18 skipped; 242 files passed, 4 skipped. Unrestricted-concurrency run exceeded an unchanged 50ms performance threshold; isolated and complete two-worker reruns passed without weakening it.

Staged read-only smoke: 6/6 at 2026-09-30T00:47:41Z. Production read-only smoke: 6/6 at 2026-09-30T00:48:23Z. Exact client SHA, HTML shell, same-origin JS bundle, API health and unauthenticated account denial verified. Production sign-in route and bundle include the new sign-in copy, shared portrait and Firebase session exchange.

No real Google login or authenticated mutation was performed by the release checks. User acceptance testing is next. Remaining atlas destinations are not claimed migrated; this release ships the implemented shared/public/acquisition/planning/admin changes. Large client bundle remains a performance follow-up.

# Release Evidence: Full V2 Acquisition Engine & Production Document Intake

- **Date**: 2026-10-02
- **Tracked Commits**:
  - `478a3df97cae2551e5db9552cfc9cf146426e413` (*feat: integrate V2 acquisition engine and production document review desk*)
  - `70bf67793d5671c0df4e6c1df77953cb7ca86b8c` (*build: include isolated-integration-identity declarations in frozen release source*)
- **Pushed to Remote**: `origin/main` (`c2d7403..70bf677`)
- **Cloud Build ID**: `83eb368b-8198-415d-b629-5164d7c26636` (duration: 4m 58s)
- **Container Image**: `gcr.io/third-signal-v2/capital-aperture:uat-70bf6779`
- **Image Digest**: `sha256:f47b617158303116baea167fe1310ec44b32d8cbad20a8f4246d31ee35916c33`
- **Cloud Run Service**: `capital-aperture` (project: `third-signal-v2`, region: `us-central1`)
- **Deployed Revision**: `capital-aperture-00157-sf5`
- **Traffic Allocation**: 100% of production traffic
- **Production URL**: `https://third-signal-capital-aperture.web.app`
- **Direct Revision URL**: `https://uat-70bf6779---capital-aperture-oxiyp4dcpq-uc.a.run.app`
- **Linear Issue Tracking**: Comment posted on `THI-266` (`c8ef7cdd-bedb-44d4-9902-6c21bc91625a`)

---

## 1. What Was Deployed

### Workstream A: Full V2 Acquisition Engine
1. **Tenant Isolation & Authorization Consistency**:
   - `scan.getV2State`, `scan.getV2Report`, `scan.saveV2Scenario` now use standard authenticated `protectedProcedure` checks consistent with `scan.trigger`.
   - Multi-tenant isolation verified: unauthenticated calls return 401, cross-owner deal access returns 404/FORBIDDEN.
2. **Versioned Category Benchmarks**:
   - Implemented `shared/acquisitionBenchmarks.ts` with benchmark table `category-benchmarks-2026.1`.
   - Sourced metrics for HVAC, Plumbing, Commercial Cleaning, Property Management, etc. (margin, customer concentration, capex reserve, multiple ranges).
   - Dynamic R8 (Multiple vs Category) and R14 (Margin vs Industry) rules now bind against versioned benchmarks rather than static fallbacks.
3. **Comprehensive Typed Extraction**:
   - Beyond 6 monetary fields, extraction now captures lease terms, key employee count, customer concentration %, seller financing terms, licenses, and inclusion flags (`inventoryIncluded`, `realEstateIncluded`, `accountsReceivableIncluded`).
   - Every extracted field carries source provenance and basis (`source_claim` vs `document_assumption` vs `derived`).
4. **Marginal EV Game Theory & Seeded Monte Carlo**:
   - Game theory engine computes per-protection marginal expected value ranking (`expectedValueImpactCents`, `confidenceWeightedEvCents`).
   - Seller walk-away threshold enforcement: negotiations exceeding maximum discount trigger deal-breaking walk-away outcomes.
   - Deterministic Mulberry32 PRNG Monte Carlo (10,000 runs) guarantees repeatable cash flow distributions across runs.
5. **Durable Scenario Receipts**:
   - Operator-saved scenarios persist atomic receipts (`AcquisitionV2ScenarioReceipt`) in `acquisition_v2_runs`.
   - Any upstream change to deal facts or mandate flags automatically invalidates cached receipts.
6. **Capture Allowlist & Golden Listings**:
   - Expanded capture host allowlist to include `abbrokers.com` and `bizquest.com`.
   - Integration tested against saved real-world capture fixtures (`fixtures/abbrokers-cleaning-listing.html`).

### Workstream B: Production Deal Document Intake & Review Desk
1. **Durable Private Storage**:
   - S3/GCS cloud storage adapter (`DEAL_DOCUMENT_S3_BUCKET`) with SHA-256 integrity verification.
   - Container filesystem storage fallback with `.meta.json` sidecar verification.
   - Tenant-isolated object keys (`documents/{userId}/{dossierId}/{documentId}`).
2. **Retention Policy Management**:
   - Configurable retention: `"permanent"` vs `"90_day"` with automatic `purgeAfter` computation.
   - Exposed in the UI review desk via dropdown and visual badges.
3. **Gemini Multimodal Vision OCR**:
   - Scanned PDFs with $<10$ characters/page trigger automatic OCR fallback via `GEMINI_FAST` (`gemini-3.7-flash`).
   - Verbatim line-item transcription formatted with page dividers (`--- PAGE X ---`).
4. **Editorial Evidence Review Desk**:
   - Dedicated route at `/deal-documents` with top nav link.
   - Embedded tab in `DealDetail.tsx`.
   - Proposal review modal, reconciliation diffs, and fact confirmation workflow.
   - Engine analysis triggers only on confirmed facts; assumptions are clearly flagged and excluded from decision-critical outputs.

---

## 2. Release Verification

### Automated Release Smoke Verification
`node scripts/verify-capital-release.mjs https://third-signal-capital-aperture.web.app 70bf67793d5671c0df4e6c1df77953cb7ca86b8c`
- **Result**: 27/27 receipts passed.
- **Checks Verified**:
  - App shell availability (HTTP 200).
  - Exact bundle SHA match (`70bf67793d5671c0df4e6c1df77953cb7ca86b8c`).
  - Same-origin assets.
  - Public preview routes active.
  - Anonymous access denied across all legacy and new tRPC routes.

### Live API Route Probing
- `/api/trpc/scan.getV2State` -> 401 (*Sign in to access this workspace*)
- `/api/trpc/scan.getV2Report` -> 401 (*Sign in to access this workspace*)
- `/api/trpc/dealDocument.listDossiers` -> 401 (*Please login (10001)*)
- `/api/trpc/dealDocument.getDossier` -> 401 (*Please login (10001)*)

### Local Test Baseline
All 10 test suites passed (147/147 tests):
- `server/dealDocumentEngine.test.ts` (25 passed)
- `server/dealDocumentStorage.test.ts` (10 passed)
- `server/acquisitionV2.test.ts` (55 passed)
- `server/acquisitionGameTheory.test.ts` (5 passed)
- `server/acquisitionV2Runs.test.ts` (27 passed)
- `server/acquisitionCapture.test.ts` (5 passed)
- `server/acquisitionV2CapturedSource.test.ts` (1 passed)
- `server/acquisitionV2RouterContract.test.ts` (3 passed)
- `server/acquisitionV2Editorial.test.tsx` (4 passed)
- `server/acquisitionV2ReceiptPresentation.test.tsx` (12 passed)

---

## 3. Preservation of Unrelated Work

The following working-tree modifications were intentionally excluded from this release commit and preserved intact in the working tree:
1. `server/_core/trpc.ts`: Unrelated broadening of `operatorProcedure` via `!canOperateCapital(ctx.user.role)`.
2. `server/routers.ts`: Unrelated Sentinel schema repair fallback and `topSignals` citation mapping.
3. Untracked spec documents and marketing/research materials in `docs/` and `specs/`.

# Private document storage release — 2026-10-13

Team: Third Signal Lab · Project: Third Signal Lab Agency · Primary surface: Infra.
User explicitly approved private durable storage and narrowly scoped runtime access. No trading/order authority is part of this work.

## Why / scope

After-hours UAT found that production had no document bucket and could save originals to ephemeral Cloud Run storage. The previous mitigation disabled unsafe writes. This release adds native Google Cloud Storage via the existing runtime identity, with no new keys, public links or browser-to-bucket upload permissions.

## Configuration

- Project: `third-signal-v2`; region: `us-central1`.
- Bucket: `third-signal-v2-capital-documents-us-central1`.
- Uniform bucket-level access and public-access prevention enforced; no public bindings.
- Runtime: `capital-aperture-runtime@third-signal-v2.iam.gserviceaccount.com`.
- Custom role `capitalDocumentObjects`: object create/get/delete only. Bucket binding is conditional on `deal-documents/` prefix. No list, bucket administration or IAM permissions granted to runtime.
- Default project-viewer bucket/object reader bindings removed. Existing project-owner/editor administrative access remains; this is not a claim of isolation from project administrators.
- `DEAL_DOCUMENT_GCS_BUCKET` selects the native adapter. Simultaneous S3/GCS configuration rejects startup rather than choosing ambiguously.
- Conditional object creation, transport checksum and SHA-256 verification on read. Cloud errors never fall back to local storage.
- Production dossier reads/writes fail if the database is unavailable; no in-memory substitute.
- Legacy originals are not migrated or silently relabeled: a stored-backend mismatch yields explicit unavailability.

## Retention boundaries

`permanent` means no automatic expiry for the original; authorized deletion remains possible. `90_day` sets the original object's custom expiry time; lifecycle deletion is asynchronous. Application download refuses expired originals. Bucket soft deletion retains recovery copies for seven additional days. Extracted text, operator confirmations and evaluation records remain in the database; this is **not** a promise of whole-dossier erasure after 90 days. Full dossier retention/deletion hardening remains separate work.

## Verification

- Initial native-GCS tests: three failures, reproducing missing adapter, silent local fallback and production in-memory fallback.
- After fixes: 16 focused document tests passed; full isolated unit suite 4,151 passed / 18 skipped. No production DB used by tests.
- Typecheck/build/cold process and deployment evidence recorded below as completed; no deployment acceptance is implied by configuration alone.
- `server/documentStorageProbe.ts` is an explicitly invoked synthetic Cloud Run job, not an API route. It uses no DB or broker. Write and read executions use the same image/identity but separate containers.

## Remaining acceptance

Fresh-instance cloud readback; anonymous denial; canary and both production origins; logged-in document intake/download/reload; mobile UI fix; screenshot capture. Broader Capital evidence-binding UAT is still distinct from durable-file storage acceptance.

Linear requires reauthentication; this is the ready-to-sync ship log.

## Build record

- Runtime source: `eb5aaf0d3f9fb1312cc7b88a4d1fc5380ecce26f` (includes prior UAT fixes `e1ff241`).
- Cloud Build: `07297daf-47cc-420f-8305-69e3bdf6e996`.
- Tracked-source manifest SHA-256: `3b5e7c58425d83637740b78ffd19f90be857a6d9a34cb0e66e8c82699722e7ff`.
- No environment files, unrelated strategy drafts or repository history uploaded in the build context.
- Whole-project typecheck/build passed. Five isolated fresh bundled server starts served HTTP on their first accepted socket.
- Rollback traffic target, if required: `capital-aperture-startup-81b85b6-r3`. Do not represent rollback as document support: old code cannot read new native-GCS originals. Preserve bucket and database records if traffic rolls back.

## Cloud acceptance in progress

- Build succeeded; image digest `sha256:b4e5b56a6723a62679578a4915fea2b640234a8c5878b0133fde2b60c465e5f6`.
- Canary `capital-aperture-documents-eb5aaf0-canary`: all 28 release checks passed, including exact source SHA and unauthenticated access denial. No production traffic promoted by this check.
- Synthetic storage write execution `capital-document-storage-uat-ql8hc` passed under the runtime identity, with no database configuration and zero orders. SHA-256 `e4d6b26fbac42b9d8d1fed7fa799fac0f60036cd5499527ef637c5f5d8780003`.
- Anonymous request to the exact synthetic original returned HTTP 403.
- A separate read execution and production/browser acceptance are pending; these are not implied by the successful write execution.

## Production verification update — 23:42 UTC

- Separate read execution `capital-document-storage-uat-pp2nt` succeeded; identical SHA-256, no database, zero orders. Native cloud persistence across containers passed.
- Production now serves `capital-aperture-startup-eb5aaf0-d2` at 100% traffic. Both public origins passed all 28 release checks for exact runtime `eb5aaf0`.
- Fresh revision d1: marker `capital-aperture-startup-eb5aaf0-d1-1791934710863`; both URLs HTTP 200 without retry (2109/2026ms). Request logs matched d1; new instance at 23:38:21 UTC and HTTP startup success at 23:38:32 UTC.
- Fresh revision d2: marker `capital-aperture-startup-eb5aaf0-d2-1791934791551`; both URLs HTTP 200 without retry (221/127ms). Logs matched d2; new instance at 23:39:21 UTC and HTTP startup success at 23:39:31 UTC. These requests occurred after startup completed, so d2 proves another successful fresh-instance startup and route check, not an un-warmed request.
- Signed-in existing dossier loaded under the deployed UI; upload availability enabled, plain limits and explicitly illustrative mandate labels visible.
- Browser file upload remains blocked: after user replied about file-URL permission, the extension again explicitly refused `setFiles`. No file was uploaded through the browser. User asked to enable the permission in the signed-in Chrome profile or choose the synthetic file manually. Do not mark browser upload/extraction/download passed.
- Production Today at 390 × 844: document scroll width 386, viewport 390; overflow remediation passed. Saved account remains explicitly stale, not refreshed. Screenshot: `today-mobile-production-eb5aaf0.png` in the after-hours UAT evidence directory. Viewport reset.
- No trading actions, account refreshes, or thesis changes performed. Stakeholder UAT remains HOLD pending browser document acceptance and the remaining matrix in the after-hours report.

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

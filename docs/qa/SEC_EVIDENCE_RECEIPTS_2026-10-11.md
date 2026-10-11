# SEC evidence receipts — implementation and release gate

Date: 2026-10-11. Team: Third Signal Lab. Project: Third Signal Lab Agency.
Primary label: Research OS. Linear unavailable (reauthentication required); ready-to-sync record.

## Scope

PD-02/03 first slice: authenticated, owner-scoped SEC issuer receipts. Explicit issuer confirmation and capture; no inferred acquisition-deal match, filing-content analysis, engine enrichment, approval, or order. PD-06 remains unimplemented. Public demos do not call this feature.

- SEC source registry, configured identification, bounded response validation and request deadline.
- Immutable normalized snapshots with source URL, CIK, accession, form, filing/report dates, SHA-256 payload hash, retrieval/recording/expiry dates. Historical archive files are not fetched.
- Failed captures retain an unavailable receipt with null successful-retrieval/expiry dates, not a fabricated zero filing count.
- Owner/request idempotency, durable claims, interrupted-request recovery; no update/delete product endpoint.
- Database-shared SEC quota (1/second, 30/minute; capture owner 6/minute), durable SEC 429 cooldown. Company index and submissions share the quota. Separate capture admission (owner 10/minute, global 60/minute) bounds persistent failure/claim writes.
- All lookup procedures now share a durable 30/minute caller budget. Non-SEC providers each share a durable 60/minute application budget across instances. Fixed-window limits; cache hits do not consume provider quota. These are application caps, not official provider allowances.
- Read-only metadata history, selected receipt detail, exact filing-type counts with bounded reveal. Re-fetch adds a receipt; it does not rewrite old decisions or receipts.

## Configuration and migration

`SEC_EVIDENCE_ENABLED=true` enables new captures; default off. `SEC_USER_AGENT` must identify the application and a real monitored contact email. Both remain server-side. SEC index search also requires configured identity and shared quota storage. Existing receipts remain readable with capture disabled.

Apply `drizzle/0072_public_evidence_receipts.sql` only after reviewing the target database and existing schema. It creates receipts, capture claims and budgets. Application access fails visibly if storage is absent; no in-memory persistence substitute.

Rollback: first disable capture and retain/export receipts. The down migration destroys these three tables; it is suitable for an empty disposable validation database, **not** an automatic production rollback. Reverting code should preserve evidence tables. Administrative retention/deletion and account-erasure policy need a separate reviewed procedure; the application exposes no destructive receipt endpoint.

SEC primary references: [API documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces), [fair-access policy](https://www.sec.gov/about/developer-resources). Our shared budget is below SEC's published aggregate limit. Captured filings are source-reported records, not verification of their financial claims.

## Verification record

All local tests and harnesses explicitly disconnected the production `.env` database. Isolated MariaDB 11.4 at loopback 13372, database `signal_evidence_uat`; illustrative local identity. Production metadata/migration and release actions are separately recorded below. No broker action.

- Live adapter probe: Apple CIK 0000320193, 1,001 filings, retrieved 2026-10-11T22:47:31.061Z. Original accession/form/report-date links retained.
- Isolated migration/read-back found a real JSON-text decoding defect; fixed before continuing. Verified owner isolation, concurrent idempotency, single-winner claims, distinct revision retention, null failure timestamps, shared quota, monotonic cooldown, rollback and empty reapply.
- First browser capture: `ff4a6931-6c41-485b-b01a-790076466fd9`, successful retrieval 2026-10-11 19:02:48 America/New_York; Apple 1,001 filings. Payload hash `ae850fab2b50cf63d76e007bbe50c88ac0a8252caea316b1bc04a11831047b0e`. This is a local receipt, not production evidence.
- Browser observed 34 filing types; presentation changed to top six actual counts plus an inspectable remaining-type disclosure.
- Initial focused run: 265 passed. Typecheck and production build passed; bundle-size warning retained.
- Unrestricted `DATABASE_URL= pnpm test`: 3,874 passed, 36 failed, 29 skipped; 19 failed files including database-dependent/guarded integration suites, legacy path/owner assumptions and timing failures. This run is **not green** and did not access production to satisfy failures.
- An overlapping unit run saw 11 repository failures while the admission API/tests were being edited, plus two five-second timeouts. Discarded as a release verdict, retained here for honesty; frozen-source rerun pending below.

Browser failure injection is restricted to the loopback-only UAT script and explicitly labeled. It never fabricates a successful source record. `SEC_UAT_PROVIDER_FAILURE=true` simulates an unavailable timeout, saving a clearly labeled test failure with no external capture request.

## Reproduction

Use Node 22+ (local Node 26). The fixed isolated database must exist. Never point this harness at production.

```sh
DATABASE_URL= NODE_ENV=development pnpm exec tsx scripts/sec-evidence-storage-check.ts
DATABASE_URL= NODE_ENV=development SEC_EVIDENCE_ENABLED=true SEC_USER_AGENT='Application Name monitored-contact@example.org' pnpm exec tsx scripts/sec-evidence-uat.ts
DATABASE_URL= pnpm exec vitest run --config vitest.unit.config.ts --maxWorkers=2 --minWorkers=1 --testTimeout=20000
DATABASE_URL= pnpm check
DATABASE_URL= pnpm build
```

The storage check refuses existing feature tables; do not clear a populated UAT library just to rerun it. Use a fresh isolated database/container for destructive migration verification.

## Release status

Initial baseline: 100% traffic to `capital-aperture-00167-xst`, created 2026-10-10, image `uat-097b227`. Revision numbering alone did not establish a rollback; browser release and Git baseline were reconciled before promotion.

Release candidate `484fe40ec0a30ca7214d3272e1035f87086362b8` pushed to `origin/main`. Frozen source hash `30be68f4862c9088ddfeae38518a7a36c83eb02426b589694f85e4bd944b2164`; no unrelated strategy files or environment secrets included.

- Guarded production 0072 apply: all three tables absent beforehand, created additively, full metadata verification compatible afterward. No existing deal/Capital rows changed by the migration.
- Cloud Build `282f7480-96fb-4987-b429-3238521b4ec2`: SUCCESS, 2026-10-11T23:28:13Z.
- Image digest `sha256:394911821212253164b45145fc51664afe1ce0f752a8f32b3683109973370a47`.
- Revision `capital-aperture-sec-484fe40` first deployed at 0% traffic. Exact-SHA bundle, health, legacy anonymous-denial smoke checks and new anonymous receipt read/capture denials all passed.
- Promoted to 100%; service traffic read-back confirmed. Firebase-hosted exact-SHA release smoke also passed. Signed-in live-provider/receipt UAT follows below.
- Rollback preserves receipt tables: route traffic back to `capital-aperture-00167-xst`; do not run the destructive down migration against populated evidence.

### Final local verification

- Frozen unit suite after shared-feed enforcement: **3,899 passed, 18 skipped**, 352 passed files / 4 skipped, zero failures. Node 26, explicitly empty database URL, two workers, 20-second test deadline. Earlier failures remain recorded above.
- Guarded 0072 schema tool: **29 tests passed**. Local metadata check compatible. Production read-only check: all three new tables absent; no partial/conflicting installation. Existing Capital 0065–0069 metadata preflight compatible.
- Final typecheck and build passed. Bundle-size warning remains.
- Real local database enforced capture admission 10/11, lookup caller 30/31 and provider 60/61 boundaries. Existing receipts and claims unchanged.
- Real provider probe through shared budgets at 23:21 UTC: all five sources `ok`; dated FX remained 2026-10-09. Decorative favicon HTTP 200. No provider key or invented substitute used.
- Browser: explicit confirmation, successful SEC persistence, reload/read-back, injected timeout saved with unknown count, real-provider recovery, historical selection, storage outage error and same-request retry recovery. Original and failed receipts retained. No silent fallback.
- Mobile override 354×767 (actual document width 350): scroll width equals client width; no horizontal overflow. Keyboard toggles remaining-form disclosure. Screenshot `/tmp/sec-evidence-mobile-uat.jpg`.
- Production initially appeared blank but finished loading; verified signed-in admin `treble.design@gmail.com` and release `097b227`. No rollback inferred from revision numbering.
- Independent code review cleared final concurrency/admission/shared-budget findings. Production migration, candidate smoke and authenticated deployed-route verification remain separate gates.

### Production verification

- Signed-in browser account: `treble.design@gmail.com` (admin). Production served exact release `484fe40`; 27 release smoke assertions passed, plus four new receipt/feed anonymous-access denials.
- SEC AAPL index search succeeded from Cloud Run. Explicit confirmation/capture saved real receipt `44cf7c8d-cee3-4125-af54-ce975a3e749c` at 2026-10-11 19:32:33 America/New_York: 1,001 Apple filings; source CIK 0000320193; payload hash matches the earlier real local capture. No injected test failure or synthetic success entered production.
- Reloaded the production page, searched the issuer again and read back the same receipt ID and original retrieval time. No second capture needed. Browser error log empty. [Production screenshot](screenshots/sec-evidence-production-2026-10-11.jpg).
- Other production tabs succeeded: Polymarket macro, Markbase Tesla, USAspending Boeing, and Frankfurter USD reference rates dated 2026-10-09. Source codes and unknown identifiers remained uninterpreted/unknown; no legal or contractor-status claim added.
- Local frozen `/walkthrough/capital-desk` opened with zero API requests under the final harness counter. Demo remained illustrative, unauthenticated and independent of the new live adapters.
- Linear synchronization still requires reauthentication. Existing bundle-size warning and 18 skipped tests remain disclosed; they are not counted as passed.

No completion claim for the entire API roadmap. PD-06 engine consumption, automatic deal linking and new SEC demo fixtures remain future work.

# Isolated integration fixture authority — 2026-09-09

This is test-environment provenance, not a production migration or a current
market/financing-policy claim. No archived command line, credentials, historical
duplicate deletion, or production connection is executed by the harness.

## Why the seven failures occurred

The first disposable run generated only `drizzle/schema.ts`. That is not the
complete historical database contract: older changes were applied through
tracked `.manus/db` query receipts rather than Drizzle migrations. Searching
ordinary SQL files missed those receipts. STACK remains an active router, not
an obsolete module; therefore its schema/seed assertions must not be removed.

Main subsequently supplied read-only production metadata in
`/tmp/capital-production-legacy-ddl.json`: all three STACK tables already exist.
Main also confirmed two existing unique `(name, source)` indexes,
`uq_deals_name_source` and `deals_name_source_unique`. The source now mirrors the
STACK tables in `drizzle/legacyCapitalStackSchema.ts`, re-exported by
`drizzle/schema.ts`, and mirrors **one** already-existing deal index. Production
DDL is unnecessary. Neither production index is altered or removed.

The explicit harness restores reviewed historical seeds into a **new empty,
scoped, disposable local DB**. It checks the SHA-256 of each receipt's `query`
field before execution. The historical `command`, connection arguments, and
result fields are never executed or used as credentials.

## Concrete authority

| Contract | Existing source | Current implementation corroboration |
| --- | --- | --- |
| Three STACK tables | `.manus/db/db-query-1778509049216.json`, commit `6892337` | `server/stackRouter.ts` reads/writes `capital_stack_templates`, `capital_stacks`, `capital_stack_layers`; `server/routers.ts` mounts `stackRouter` |
| Seven baseline templates | `.manus/db/db-query-1778509076639.json`, commit `6892337` | Current router's seven original `DEFAULT_LAYERS` IDs match; its principal-default read still uses the persisted template flag |
| Six additional historical macro rows | `.manus/db/db-query-1778508961210.json`, commit `6892337` | The unchanged STACK test expressly checks the patch seed, not only the five-row `seedMacroSignals` bootstrap |
| Additional macro columns used by those rows | `.manus/db/db-query-1778508917973.json`, commit `6892337` | Required to replay the exact archived patch rows without discarding fields |
| Global `(name, source)` unique index | `.manus/db/db-query-1774537071003.json`, commit `788476c` | `createDeal` uses `onDuplicateKeyUpdate`; `getDealIdByNameSource` identifies the same pair |
| Scan JSON read boundary | `server/routers.ts` dashboard summary and `scan.getLatest` both call `getLatestScanJob` | `shared/persistedJson.ts` explicitly supports MySQL decoded JSON / MariaDB JSON text and throws for malformed storage |

Archived seed values are reused unchanged. Their original market claims, URLs,
financing terms, and metrics are **historical test fixtures, not verified facts**.
They are not surfaced in a browser or published, and are deleted with the test
database. No new market rows, reference metrics, or seventh-to-sixth count
adjustment was invented to satisfy a test.

The five bootstrap rows from `seedMacroSignals` plus the six archived patch rows
produce eleven fixture rows. The `>= 6` and high-confidence assertions remain
unchanged. All four STACK table/template assertions also remain unchanged.
Current `DEFAULT_LAYERS` additionally has a later `sba_7a_504_combined` route;
the historical seven-row fixture does not certify the deployed eighth template.
No additional template row was invented for it.

## Deal identity and owner boundary

Current `deals` has **no user/owner column**. Current list/get routes are public,
and create forwards input to `createDeal` without an owner identifier. This is
the legacy global acquisition catalog, not the owner-scoped Capital Aperture
thesis or brokerage model. The historical index matches that current source
contract; adding an owner column here would be a domain/auth migration, not a
test repair.

The initial legacy-fixture verification used this exact archived index statement
on an empty local table. The final harness no longer executes it: it asserts
that the source schema already generated the index with these exact columns:

```sql
ALTER TABLE deals ADD UNIQUE KEY uq_deals_name_source (name, source);
```

The earlier `DELETE` in the same receipt is **never executed**. Production
indexes are already confirmed by main; no production index is added here.
`drizzle/schema.ts` now mirrors `uq_deals_name_source` only. Do **not** run
automatic `db:push` against production: the second existing index must remain.
A nullable source retains the historical
SQL unique-index NULL semantics; this run does not redefine manual-deal identity.

Added real-DB checks verify the index's exact two columns and uniqueness, and
that equal names from distinct sources remain separate records.

## Scan assertion correction and regression

The original integration test queried the raw driver and expected a decoded
array. That bypasses the application's actual read boundary. It now calls
`getLatestScanJob` (the same helper used by both current routes), retaining all
existing field assertions and adding exact equality to the written source array.
The getter uses the existing `parsePersistedJson` primitive; no test-only cast,
empty fallback, or weakened assertion hides the failure.

`server/scanJobPersistence.test.ts` exercises that getter with driver-boundary
test doubles for text JSON, already-decoded JSON, null, malformed JSON, and no
row. Before the fix, two tests failed (text decode and corruption rejection);
after the fix, all five pass. The integration run separately verifies the real
MariaDB round trip.

## Execution boundary

Use `node scripts/with-isolated-integration.mjs --integration`. Only
`capital_aperture_test_20260909_zzugqp` and its scoped user may be created or
removed on the already-approved `sh-ch-capital-uat-db` loopback container.
Browser UAT data is not read/copied/mutated. Provider/network calls are denied.

This repairs repeatable integration provisioning and the verified source-schema
drift. All 37 STACK column names, SQL types, and nullability were compared with
main's metadata capture and match. Production collation/engine directives and
AUTO_INCREMENT counters are not copied into fixtures. Full-schema parity beyond
these bounded structures is not claimed. The remaining legacy macro extension
columns needed by the archived seed are restored locally from their original
receipt only.

Main owns deployment. The application read-path delta is the scan getter JSON
repair in `server/db.ts`; source also includes the verified schema descriptors.
These changes are not in main's already-built `f303385` image and require a new
main-owned build to ship. No production migration is necessary for the tables
or indexes already confirmed by main.

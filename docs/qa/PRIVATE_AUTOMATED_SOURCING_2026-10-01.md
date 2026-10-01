# Private automated sourcing — 2026-10-01

## Scope

Signed-in users can start acquisition searches. The initiating user owns the job
from its first insert. Polling, progress writes, deal deduplication, creation,
scoring and enrichment retain that owner. Historical unassigned jobs remain
unassigned and are not exposed as another user's latest search.

Only the four reviewed scan paths are reopened. Other legacy property,
specialist and sharing routes remain contained. V2 and document drafts are not
part of this release. This is private sourcing, not a claim of V2 migration.

## Schema preparation

`add-scan-job-ownership.mjs` adds a nullable owner column without assigning history.
`scope-deal-uniqueness.mjs` replaces the two verified global name/source indexes
with one owner/name/source index, atomically. It refuses unexpected schemas or
unassigned deal records. Neither migration deletes or reassigns deals.

Do not restore global uniqueness after different owners create the same listing.
Rollback should preserve the new schema and close the scan allowlist if needed.

## Validation

- Ownership and ingestion regression set: 37 passed, zero production writes.
- Working-tree suite: 3,115 passed, 18 skipped; TypeScript passed.
- Exact release-only snapshot: TypeScript, production build and 2,974 unit tests
  passed; 18 intentionally skipped. Independent committed-source audit found no
  concrete release blockers.
- Both schema migrations applied and read back successfully. Production still has
  14 deals, all assigned to owner 1; all 16 historical jobs remain unassigned.
- Read-only private-job service check returned no latest job for either tested
  principal and NOT_FOUND for the missing/foreign lookup.
- No live provider search, paper order, or production test deal was created.
- Admin browser UAT and provider-backed end-to-end search remain unverified.

## Production release

- Runtime source `ae25a01ef6ab527c91f6eafce20d307360a84799`, pushed to origin/main.
- Cloud Build `4f0b5a38-97d0-4007-a4d7-530ae575e7bf`: SUCCESS.
- Image `sha256:e3a500e75b21ea65d1b2f08cdc4be38d9df5f54f8e3870f715386fbeaba1f67f`.
- Revision `capital-aperture-00278-boy`: 100% traffic, runtime configuration unchanged.
- Candidate https://uat-ae25a01e---capital-aperture-oxiyp4dcpq-uc.a.run.app
- Production https://third-signal-capital-aperture.web.app
- 27 read-only smoke checks passed on both candidate and production, including
  exact source SHA and anonymous scan polling/comparison denial. Production
  verification completed 2026-10-01T20:12:40.631Z.
- Signed-in Capital Today reloaded and rendered successfully after promotion.
  Its Capital-only role redirects acquisition routes by design; this is not
  signed-in acquisition UAT. No account role was widened.
- Previous revision `capital-aperture-00276-cub` remains available. Preserve the
  new schema on rollback; never restore global uniqueness by deleting duplicates.

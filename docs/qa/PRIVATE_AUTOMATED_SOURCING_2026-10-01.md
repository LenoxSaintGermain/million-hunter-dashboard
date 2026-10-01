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
- Release-only snapshot verification and production release evidence follow.
- No live provider search, paper order, or production test deal was created.
- Admin browser UAT and provider-backed end-to-end search remain unverified.

# Private deal workspace recovery — 2026-10-01

## Scope delivered

Exact-path reopening of private deal list/detail/create/stage/score/archive, saved
signals/memos/outreach, activity and dashboard aggregates. Server identity supplies
ownership, including for admins. Related reads join the owned parent. Manual
creation uses plain INSERT, never a global upsert. Archive retains records.

Historical analysis has no verified current-input fingerprint and is labeled as
such; specialist text is progressively disclosed. Property intake uses neutral
placeholders. New-user empty/error states are distinct. Logout clears query cache.
The investor mark is bundled publicly without reopening private storage.

## Verification

- Working-tree suite: 3,097 passed, 18 intentionally skipped at first full run.
- Subsequent private service regression set: 26 passed.
- Exact staged-tree checkout: TypeScript, full unit suite and production build
  passed with DATABASE_URL empty. Unreleased V2 edits excluded from the snapshot.
- Read-only production DB check: admin owns 14 deals; second verified account owns
  zero; attempting the admin's record through the private service returns NOT_FOUND.
- No provider rerun, trading action or production deal creation during validation.

## Not the full finish line

- Legacy ownerless automated sourcing, property matching, and several specialist/
  sharing routes remain admin-restricted. Exact-path allowlist fails closed for new
  legacy routes. Nonadmin manual intake is enabled; automatic sourcing is not.
- Global name/source uniqueness remains. A conflicting insert fails safely with
  CONFLICT; it never overwrites or returns another account's existing row. Migrating
  this index requires updating background ingestion ownership at the same time.
- Existing model outputs were not regenerated and are not declared reconciled.
- No claim of signed-in admin browser end-to-end UAT or live provider verification.
- V2 draft engine/document files remain separate, uncommitted work; not included.

Production release details will be appended after staged and public verification.

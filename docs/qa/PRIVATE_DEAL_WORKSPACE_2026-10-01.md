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
- Exact staged-tree checkout: TypeScript, full unit suite (2,958 passed, zero
  failed, 18 skipped) and production build passed with DATABASE_URL empty.
  Unreleased V2 edits excluded from the snapshot.
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

## Production release

- Source: `422649bf8db14a30bbfebdbeac23e2387515781e`, pushed to `origin/main`.
- Cloud Build: `0465066f-3c34-42f2-a658-9efd6400d0c5` (SUCCESS).
- Image: `sha256:284f7c8bf7096523b921a56d45b5b2e59cb1374bd7b7d4c31691f68798f66965`.
- Revision: `capital-aperture-00276-cub`, 100% traffic; runtime configuration unchanged.
- Candidate: https://uat-422649bf---capital-aperture-oxiyp4dcpq-uc.a.run.app
- Production: https://third-signal-capital-aperture.web.app
- 24 read-only release checks passed on candidate and production. Production
  verification timestamp: 2026-10-01T19:47:36.372Z. New UI copy and bundled icon
  separately confirmed on the candidate.
- Current signed-in Capital screen reloaded successfully after promotion. The
  browser remained signed in to the nonadmin account; admin workflow UAT is pending.
- Previous revision `capital-aperture-00274-taj` remains the containment fallback.

# Legacy catalog containment — 2026-10-01

## Scope and authority

User reported existing non-Capital records visible after new-account sign-in and authorized isolation work. User explicitly assigned existing deals to their admin account. Verified canonical admin `treble.design@gmail.com`, user ID 1. Added nullable `deals.owner_user_id` and assigned 14 inspected, previously unowned IDs in a transaction with read-back. Preserved records and `updatedAt`; did not infer ownership for future rows.

## Release candidate

- Source: `122cae598fa6b8bcc2df67f0595e3e519ad62595`, pushed to `origin/main`.
- Cloud Build: `ed584db7-dcc6-4eeb-9b23-95f4ef591098`.
- Prior serving revision: `capital-aperture-00272-quf`.
- Clean archived source, not the dirty workspace: TypeScript and build passed; 2,926 unit tests passed, 18 provider/integration tests skipped. No test production DB access.
- Independent route audit found public search and storage signing bypasses; both addressed.

## Enforcement

All tRPC procedure bases enforce admin-only access for the enumerated legacy routers before handlers, direct SQL, or provider calls. Public search uses deterministic fixtures only. Storage signing requires authenticated admin access. Property criteria listing uses owner/assignment predicates; non-admin owners cannot reassign or promote records, and cannot edit/remove another owner's criteria.

## Explicit limitations

This is **containment**, not completed tenant onboarding. Legacy acquisition, property matching/preview, related analysis, insurance, stacks, and legacy share links are temporarily unavailable to non-admins. Capital retains its independent permissions. The owner column alone does not scope legacy queries; removing any containment requires complete read/write scoping and regression tests. New legacy records are not silently assigned by the backfill script.

Existing scheduled jobs remain admin-controlled legacy jobs. Already issued signed storage URLs are not revoked. Some legacy non-admin layout icons use the now-protected storage route and may fail to load. Stale analysis reconciliation and broader editorial/empty-state UI changes are not included. No paid provider reruns, order actions, or deletion were performed.

## Production verification

- Serving revision: `capital-aperture-00274-taj`, verified 100% traffic with runtime settings fingerprint unchanged.
- Image digest: `sha256:392291ac5dc3958fbecde241cb556ecdc16c5043fa0547fa655e57f4f33e11d3`.
- Candidate and production passed all 24 release smoke checks. Production receipt timestamp: `2026-10-01T19:06:56.901Z`. Nine anonymous private API reads return 401 JSON, rather than any catalog payload.
- Candidate supplemental checks: arbitrary storage request returned 401; public search returned 10 fixture records and no migrated legacy IDs.
- Signed-in browser identity was a non-admin Capital user. Opening an existing deal redirected to Capital without displaying that deal; Capital account portrait remained available. A direct authenticated API-document navigation was blocked by the browser itself, so no live authenticated HTTP-denial receipt is claimed. Non-admin API authorization is covered by actual root-router tests and middleware tests across roles.
- Admin access is preserved by policy and unit tests; this session did not switch browser accounts to conduct admin signed-in UAT.
- Rollback revision: `capital-aperture-00272-quf`, but rollback would restore the exposure and is not a safe default recovery action. Ship details are tracked on THI-266.

# Today → exact finding: connected UAT

## Scope and result

September 10, 2026, approximately 04:12–04:20 ET. Agent-operated isolated
Chrome checks, not stakeholder usability research or a market-open execution test.

Production baseline `070d04c` plus review fix `7d38fbc` is isolated in release
commit `a42b16bd8ae474ea4af849c14b5200b3aaa69821`. No backend, schema, risk,
approval or submission change is included in that release.

| Journey | Observed result |
| --- | --- |
| Desktop Today → Review unresolved finding | Opens the exact selected put and catalyst finding; focus moves to that finding. |
| Mobile 390×844 → Enter on the same action | Same route and finding identity; evidence is expanded; the other check remains available. |
| Missing monitoring coverage | Partial-status explanation remains visible; no all-clear. |
| Unverified illustrative source | Not promoted to verified evidence. |
| Review without assessment | Save review remains disabled; no review is persisted. |
| Record preservation across mobile repeat | Full account/order/check rows and explicit review receipts retain the same digest. Seen state is excluded. |

Exact fixture route:
`/aperture/run/27/execute?candidate=20&lifecycle=monitoring&order=26&finding=2&findingVersion=v1-758ed8f1`.

The separate illustrative owner is 144, account 52. This manually seeded record
is not a provider-confirmed fill. One order, two checks and zero explicit reviews
were present before and after the mobile repeat. Their SHA-256 was unchanged:
`139549688b93d6d5d840e69dea8dfccd87126734d53e50700fcdb96ad1310c26`.

No source refresh, review assessment, proposal, approval, submission or exit was
requested. Temporary mobile viewport override was reset. No production records
or schema were modified for this test.

## Reproduction

Use Node 26 and the existing local-only MariaDB container. The runner verifies
its exact container, database and loopback binding, then blanks credentials
before starting child processes. Do not substitute a production URL.

1. `DATABASE_URL= node scripts/with-isolated-capital-uat.mjs --monitoring-seed`
   creates the separate labeled fixture once; retries preserve existing state.
2. `DATABASE_URL= node scripts/with-isolated-capital-uat.mjs --monitoring-inspect`
   reads the record digest without seeding or updating anything.
3. Run the wrapper with `--monitoring-server` from the compatible release source
   to serve port 3112 and the separate fixture identity. It must not replace the
   existing saved-Mission server on port 3110.
4. Open Today, activate Review unresolved finding, and verify exact identity,
   selected focus, other check visibility and disabled Save review.
5. Repeat at 390×844 with Enter; inspect the digest again and reset the viewport.

The current development backend requires unapplied Strategist schema and cannot
be substituted for this release baseline on the older browser database. Its
failed read correctly displayed uncertainty. No automatic migration was added
to the UAT runner.

## Verification and evidence

- Compatible UI package: 1,341 unit tests passed, zero failed, six existing skips.
  `/tmp/aperture-ui-review-release-unit.json`.
- Main source checkpoint: 1,959 unit tests passed, zero failed, eight existing
  skips; type checking and build passed. Those counts include unreleased work
  and are not the release package's count.
- Seed retry preserved the fixture. An explicit production-like wrong host was
  rejected before opening a database connection.
- Screenshots:
  `/Users/lenoxparis/.codex/visualizations/2026/08/25/01a0392e-5a5e-73c2-9f5e-675f1dc136d9/routing-2026-09-10/`
  — `exact-finding-desktop.png`, `exact-today-mobile.png`,
  `exact-finding-mobile.png`.

## Remaining acceptance

Production promotion and authenticated post-release retest require a separate
release receipt. Physical-device, screen-reader, enlarged-text and complete
keyboard traversal are not established by this mobile emulation. The original
Strategist/excess-capital/gains/revision lifecycle remains unfinished; this UAT
does not narrow that scope or prove positive expectancy or ten-second comprehension.

## Production receipt — 2026-09-10 08:31 UTC

- UI-only release `a42b16bd8ae474ea4af849c14b5200b3aaa69821`, branch
  `codex/aperture-review-handoff-release`, based on production `070d04c`.
- Cloud Build `050676f1-318a-4e0e-827d-1035bb6800b5` succeeded;
  `capital-aperture-00094-hay` now serves 100% traffic. Revision 92 remains
  available for rollback. Runtime settings unchanged except image.
- Public Firebase app returned 200 and exact release marker; health returned
  200 JSON with `ok:true` at 08:29 UTC. No migration or broker action.
- **Authenticated production UAT remains failing:** Today review button focused
  without navigating after accessibility click, Enter and direct pointer click.
  Browser attachment also timed out twice. Isolated connected success above does
  not prove production browser success; root cause remains undetermined.
- THI-266 release/blocker comment: `f89f7cbc-96d6-4136-a284-fa92f8a4ea97`.
- Next: diagnose this signed-in navigation discrepancy, then repeat the exact
  desktop/mobile task. Full UAT and gains backend remain open.

### Fresh authenticated production tab comparison

A new tab in the same signed-in Chrome profile successfully opened Today and
activated Review unresolved finding. The destination retained run 360001,
candidate 240003, order 2, finding 120001 and version v1-951cb173. Loading showed
“Loading selected play and order… No checks are being run.” before focusing the
selected finding and expanding catalyst evidence. Save review remained disabled;
no check generation or review/approval/submission action was invoked.

The previous failure is therefore session/tab-specific so far, not universal.
Its root cause remains unverified. Fresh production desktop passes this bounded
handoff; post-release mobile remains pending. Screenshot:
`routing-2026-09-10/production-fresh-finding-desktop.png` in the evidence folder.
Raw Markdown and citation markers in the finding body remain a visible polish
gap; safe rich-text/source rendering needs follow-through.

## Evidence readability increment — local, not deployed

FindingEvidence now uses the existing Markdown parser (react-markdown 10.1.0,
already present transitively, now an explicit dependency). Recorded emphasis and
paragraph structure render normally; no rewriting or summarization is performed.
Raw HTML and embedded images are excluded. Inline and recorded source links are
restricted to HTTP(S) without embedded credentials. Invalid source slots retain
their original number with “link unavailable,” so references are not renumbered.
Numeric citation markers remain literal references to the numbered source list.
Headings are visually restrained and cannot replace the page heading hierarchy.

Regression was reproduced before the change. Four new rendering/safety tests
cover formatted evidence, non-embedding, invalid source slots, and inline URL
safety. Existing complete-narrative assertion now compares all visible text
rather than requiring literal Markdown delimiters. Full unit suite: 1,963 pass,
0 failures, 8 existing skips (`/tmp/aperture-evidence-render-unit.json`). Typecheck,
production build and diff whitespace check pass. Existing chunk-size and Node
deprecation warnings remain. No data, risk or lifecycle mutation added.

Browser visual verification and deployment of this increment are still pending.

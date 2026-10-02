# Capital workspace edition — local integration

Tracking: THI-266. Surface: Research OS. Status: local implementation and verification, not a production release.

## Delivered locally

- Shared compact account context on non-Today pages, with existing controls and evidence disclosed on demand. Today retains its approved account portrait.
- Mission: editorial section hierarchy, concise result, saved wording behind disclosure, measured comparison of entered, policy and effective planned-loss limits. Review buttons do not imply cancellation or a risk-limit change.
- Play Desk: one leading saved priority, supported inline reviews, consolidated snapshot refresh, recorded-risk/return/buying-power evidence. Buying power is not labeled deployable capital.
- Research: searchable question-led records, explicit state, progressively revealed evidence trail. Existing research action and review routes remain; this is not a new conversational AI backend.
- Portfolio: per-account value and measured holdings portraits, separate controls and holding actions, explicit empty/unmeasured states.
- Theses: searchable library, short premise previews and full-text disclosure. Removed unsupported capacity graphics and compile/stage shortcut; canonical activation remains explicit.
- V2 search wiring: explicit full-mandate approval, captured source evidence, deterministic screening, durable owner-scoped run manifests and immutable evidence batches. Empty, failed, pending and inaccessible receipts are distinct. V2 does not rewrite shared deal scores or Capital order gates.

## Verification

- Node 26, empty DATABASE_URL throughout tests/build.
- Full unit pass: 2,875 passed, 18 skipped, 258 files passed and four skipped. Subsequent receipt/library focused pass: 53 tests; shell contracts: 22; V2 router wiring contracts: three. Final TypeScript and production build passed. Router source-contract assertions supplement, not replace, authenticated runtime acceptance.
- Existing large-bundle warning remains.
- Browser inspected integrated Mission, Play Desk, Research, Portfolio and Theses using localhost:3110 and isolated illustrative UAT data. Empty research/holdings states were tested, not populated production account acceptance.
- Mission step navigation and loss comparison rendered; no research, approvals, orders or broker sync launched.
- Mobile thesis/header test: observed 354px viewport and 351px document after fixing the shared practice-badge overflow. Temporary viewport reset.
- Applied existing additive migrations 0066–0069 only to the explicit isolated Docker database capital_aperture_uat_9c18799. Production database unchanged.

## Release boundaries

No commit or deployment is represented by this receipt. Production remains on the previously released edition.

V2 needs reviewed real listing snapshots, category benchmark decisions, remaining scenario acceptance and authenticated runtime/concurrency validation before production activation. Mock transaction tests are not TiDB acceptance. Existing pre-manifest records fail closed and require explicit recovery review. See SEARCH_V2_IMPLEMENTATION_DECISIONS.md.

Document uploads remain deferred by operator direction. No upload/storage/OCR/billing capability is claimed. Unrelated dirty authorization, database and sourcing edits are preserved, not implicitly approved for release.

# Document-first production upgrade

Surface: Research OS. Tracking: THI-266. Operator approved production upgrade.

## Release scope

- Evidence-first landing, acquisition walkthrough, demo tour and investor brief.
- Approved planned launch pricing: $299 single review, $699/month Team Desk, $799 three-deal pack. Preview only; no checkout, active entitlements or claim of finished document intake.
- Jim's file: public, deterministic illustrative Cybercab venture case. Fictional assumptions, adjustable economics, unresolved evidence gates, alternative hypotheses and inline local decisions. No vehicle availability, legal permission, endorsement, provider calls or persisted approval.
- Portfolio portrait, mobile decision-desk presentation and readable mission brief. Existing account permissions, risk gates and actions remain unchanged.
- Public demos do not mount the authentication-query guard; optional analytics excludes the new case.

## Deliberately excluded

Unrelated dirty authorization, database and sourcing changes remain in the original worktree. The live acquisition V2 search migration remains pending real-source acceptance. Its approved editorial prototype is not newly activated in live search by this release. Document engine foundation remains local: no production upload, PDF/OCR, storage, review API or billing is activated. No database migration is required for this presentation release.

## Release method

Create a scoped source commit, validate a clean checkout of that exact commit, build with the existing Capital Aperture Cloud Build configuration, stage without traffic, verify public routes and protected denial, then promote only if the current production revision is unchanged. Preserve runtime configuration and retain the previous revision for rollback.

Production before upgrade: `capital-aperture-00264-wiv`, source `519891ca7c6c62e88e40834ec5811fb68c7def70`.

Validation and deployment receipts follow. Scope exclusions above remain in effect.

## Validation receipt

- Runtime source commit: `a6528f6fe2d9bda5e46728df56fbdda341447e36`, pushed to origin/main.
- Clean detached checkout: `/tmp/signal-document-release-20260930`; unrelated dirty files excluded.
- Typecheck and production build passed. Existing large-bundle warning remains.
- Clean unit lane: 2,771 passed, 18 skipped, 250 files passed and four skipped. Run with empty DATABASE_URL and two workers. An earlier concurrent worktree run hit a timing-only performance assertion; isolated rerun and clean two-worker suite passed without changing the threshold.
- No new database schema or permission change is included.
- Exact built bundle exercised at port 4177: Jim's file, pricing, acquisition walkthrough, demo tour, investor brief and Capital Desk preview render anonymously. Diagnostic static server observed no `/api/` requests during these checks. This is browser smoke coverage, not exhaustive interaction coverage of every demo chapter.
- Jim's utilization change updates positive to negative residual; selecting Plan validation opens an inline local instruction, and changing an economic input clears that decision. Gates remain unverified. Edge tests cover zero fixed cost, zero/negative contribution and complete downtime.
- Pricing clearly says not available for purchase; no checkout or entitlement mutation. Both new surfaces passed narrow layout inspection (observed viewport 354px, document 351px). Viewport override reset.
- Frozen source SHA-256: `a0151798cbbd49524526f9eabc21742fd8f14e9c6b1b25ea7b7083b68e3c25b8` (868 allowlisted tracked runtime/build inputs). Preparation helper always labels working-tree changes true; this invocation used the clean detached commit.
- Cloud Build succeeded: `607ac6b4-d07c-43e3-aafd-c26e3b78c333`.

## Production deployment receipt

- Promoted revision: `capital-aperture-00266-mav`, 100% production traffic.
- Image digest: `sha256:92285ab165933a16ec6ba1dc70bb324d8ca350560258141b81e35d18adf57963`.
- Staged URL: https://uat-a6528f6---capital-aperture-oxiyp4dcpq-uc.a.run.app — 15/15 release checks passed at 2026-09-30T19:31:23.261Z.
- Production: https://third-signal-capital-aperture.web.app — 15/15 release checks passed at 2026-09-30T19:34:48.274Z; exact runtime source SHA matched, API health returned JSON and unauthenticated account access remained denied. Smoke checks performed zero mutations.
- Jim's file rendered on the production domain with default illustrative assumptions, editable utilization and unresolved evidence gates; left open for operator UAT.
- Runtime configuration fingerprint unchanged: `d1d0677b69c65065af1f5d466ba6269e33cb89dae4930663785bf5a848104c83`.
- Rollback revision retained: `capital-aperture-00264-wiv`.
- Remaining risk: existing large client bundle, incomplete exhaustive demo-chapter and authenticated production UAT. Secure document intake, billing and live V2 search acceptance remain separate work, not delivered capabilities of this release.

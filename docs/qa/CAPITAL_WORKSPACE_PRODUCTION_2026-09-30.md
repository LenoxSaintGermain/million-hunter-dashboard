# Capital workspace editorial release

Tracking: THI-266 / Research OS. Operator requested continuation after local UAT.

## Scope

Mission, Play Desk, Research, Portfolio and Theses adopt the approved Today visual language. Shared account context is compact with detailed controls disclosed on demand. Measured risk/holdings graphics distinguish unknowns, stale snapshots and buying power. Supported Play Desk reviews open inline. Mobile identity wrapping and bounded thesis previews preserve full evidence under disclosure.

No V2 activation, document intake, schema, server authorization or shared deal-scoring changes are included. Those working-tree changes remain preserved separately. Existing paper-only and operator approval boundaries remain.

## Exact candidate

- Source: `67d4148d38b0075ab654e087a6ea73d936b04358`, main, pushed to origin.
- Clean detached checkout: `/tmp/capital-workspace-release-20260930`.
- Frozen source hash: `03c70a2279c506607f234cb757d86301b24fea8f369bfa5cc8e2f66dd9863491`.
- TypeScript and production build passed; existing large-bundle warning remains.
- Clean unit lane: 2,799 passed, 18 skipped, 253 files passed and four skipped. Node26 with empty DATABASE_URL.
- Cloud Build: `4f791b1d-6730-41d9-9758-591a0662b557` (deployment receipt to follow).
- Previous production / rollback: `capital-aperture-00266-mav`.

## Remaining acceptance

Local browser inspection covered all five modules with illustrative isolated data; mobile document width was 351px in an observed 354px viewport. Populated production accounts, every review outcome and full mobile interaction regression are not established by those checks. The production release smoke check is read-only and does not place orders, refresh broker data or run research.

V2 still requires frozen real listing acceptance cases, benchmark decisions and runtime validation. Document uploads remain deferred.

## Production receipt

- Cloud Build succeeded; image digest `sha256:ac9abb470c6de8889733862a9f69b547bcc4557b979be49a9a3c4108b9666130`.
- Revision `capital-aperture-00268-goz`, promoted to 100% traffic at 2026-09-30T21:23:21.944Z.
- Staged origin: https://uat-67d4148d---capital-aperture-oxiyp4dcpq-uc.a.run.app . All 15 release checks and five module route/bundle checks passed before promotion.
- Production: https://third-signal-capital-aperture.web.app . Same 15 checks passed at 21:24:01Z and five module route checks at 21:24:07Z. Exact source SHA matched; API health returned JSON and unauthenticated account access remained denied.
- Runtime fingerprint stayed `261f7bfbe6b97cef6c7c3896e2ec01190fdb4c7f1b5bc79ae233d858cfd155c9` across staging and promotion. Previous revision retained.
- Signed-in production Mission rendered the new compact account context, measured saved allocation/loss/horizon, concise no-trade result and evidence disclosures. Stale account and analysis warnings remained visible. No production mutation was invoked; full authenticated workflow acceptance remains operator UAT.
- Browser left on production Mission for review. V2 and upload exclusions remain in force.

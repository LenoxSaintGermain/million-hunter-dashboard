# Capital Aperture Strategist — tagged UAT receipt

**Date:** 2026-09-08  
**Release boundary:** Tagged Cloud Run revisions with zero production traffic. No database migration, paper proposal, approval, submission, broker invocation, or order mutation was performed. Each exact tagged hostname was temporarily added to Firebase Authentication for the approved browser check and removed immediately afterward.

## Release identity

- Source commit: `8f6022b9e008f65e2b7174660e0a400736a2ab56`
- GitHub UAT branch: `codex/aperture-strategist-uat`
- Cloud Build: `8b663e1f-b12d-4aa5-aa3f-bb42b49af51f` — `SUCCESS`
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:8f6022b-firebase`
- Image digest: `sha256:5efc8486f1363a294e13179002cbc52b6e8e14f88c4a3b56b67ad93c918c79c7`
- Cloud Run revision: `capital-aperture-00077-boj`
- Traffic tag: `uat-8f6022b`
- Tagged URL: `https://uat-8f6022b---capital-aperture-oxiyp4dcpq-uc.a.run.app`

## Verification completed

- `GET /aperture` on the tagged revision returned HTTP 200.
- Same-origin `system.health` returned `{ "ok": true }`.
- The served JavaScript bundle contains the exact source SHA.
- Cloud Run retained 100% production traffic on `capital-aperture-00075-fig`; the tagged revision serves 0% of production traffic.
- Local pre-release checks for this source passed: TypeScript, production build, 46 focused contracts, and 949 non-secret behavioral tests. The unfiltered suite's only failure was the existing missing `Poe_api_key` environment-presence check.

## Browser UAT result

The tagged revision rendered the Capital Aperture sign-in surface, then Firebase Authentication refused Google sign-in with:

`Firebase: Error (auth/unauthorized-domain).`

This is an isolated-preview configuration blocker, not an application health failure. The exact tagged `run.app` hostname is not in the project's Firebase Authentication authorized-domain list. No domain was added silently.

Authenticated production comparison on the current parent release reproduced the before-state addressed by `8f6022b`:

- A completed no-trade result is visible.
- The Mission section still says `Ready to underwrite`.
- The primary action remains enabled as `Underwrite my mission`.

At that checkpoint the tagged source changed those states to a completed receipt and disabled duplicate underwriting, but authenticated verification was still blocked. The controlled UAT below subsequently closed that authentication gate and exposed the hydration race.

## Initial authentication gate — closed

The operator subsequently authorized the exact-hostname test. The original `uat-8f6022b` hostname was added only for the signed-in check and removed afterward; its authorized-domain occurrence returned to zero. The same controlled add/test/remove sequence was used for the repair revision below.

## Approved authenticated UAT and race repair

The operator approved temporary exact-hostname authorization and signed-in desktop/mobile UAT. The first tagged revision exposed a client-side state-arbitration race on `/aperture/mission`: before `underwriter.get` resolved, the page briefly presented `$744` effective risk, `Ready to underwrite`, and an enabled action even though the persisted revision had already completed with no trade and `$0` risk.

The repair:

- treats the unresolved persisted-result query as a fail-closed state;
- withholds an interim effective-risk claim;
- disables and defense-in-depth guards the underwriting mutation;
- provides an explicit recovery message if the saved result cannot be reconciled;
- requires the saved underwriting result to match the active decision-revision identity.

Repair release identity:

- Source commit: `6e665848543bf577b17893d2f7e6cac5136e5889`
- Cloud Build: `ecb7587e-5207-4357-af1a-0d631a9052f5` — `SUCCESS`
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:6e66584-firebase`
- Image digest: `sha256:e4322bd65b01824bece9406eb1635a5809457d912b70036824838c4448cfb76b`
- Cloud Run revision: `capital-aperture-00078-bim`
- Traffic tag: `uat-6e66584`
- Tagged URL: `https://uat-6e66584---capital-aperture-oxiyp4dcpq-uc.a.run.app`
- Production traffic during and after UAT: 100% on `capital-aperture-00075-fig`; repair revision 0%.

Verification:

- 49 focused deterministic tests passed across six files.
- TypeScript passed with the production database disabled.
- Client and server production builds passed.
- Authenticated desktop and `390 × 844` mobile UAT showed the PW Mission, named Alpaca Paper account, NVDA binding constraint, completed no-trade result, `$0` effective risk, explicit no-ticket receipt, and disabled duplicate action.
- Today preserved the primary DKNG material-change action, two other critical reviews, and distinct broker-accepted/no-fill versus open-position statuses.
- No paper ticket, proposal, approval, submission, or broker order was created or modified.
- The exact repair hostname occurred once in the authorized-domain list during UAT and zero times after cleanup; the list returned from 11 entries to its prior 10.

New observed blocker:

- On a cold Today navigation, the first rendered state briefly claimed `Account not selected` / `No execution account selected` before the real Alpaca Paper context arrived. This is an honest release blocker for the returning first viewport and is not covered by the Mission repair.

Independent code audit also left the broader addendum open: incomplete draft persistence, durable underwriting job identity, visibility-accurate Seen semantics, merge-safe baselines, router-backed stale/partial/failed states, exact active-play routing, and truthful monitoring refresh behavior remain to be implemented and journey-tested.

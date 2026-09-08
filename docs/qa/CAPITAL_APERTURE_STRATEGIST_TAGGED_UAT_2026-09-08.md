# Capital Aperture Strategist — tagged UAT receipt

**Date:** 2026-09-08  
**Release boundary:** Tagged Cloud Run revision with zero production traffic. No database migration, Firebase Authentication configuration change, paper proposal, approval, submission, broker invocation, or order mutation was performed.

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

The tagged source changes those states to a completed receipt and disables duplicate underwriting, but authenticated browser verification of that after-state remains blocked until the tagged hostname is explicitly authorized or the release is deliberately promoted.

## Exact next gate

Obtain operator approval before changing Firebase Authentication's authorized-domain list. If approved, add only:

`uat-8f6022b---capital-aperture-oxiyp4dcpq-uc.a.run.app`

Then sign in, run read-only Mission and Today checks, capture desktop/mobile evidence, and remove the temporary domain only under a separately controlled cleanup step. Do not move production traffic during this UAT.

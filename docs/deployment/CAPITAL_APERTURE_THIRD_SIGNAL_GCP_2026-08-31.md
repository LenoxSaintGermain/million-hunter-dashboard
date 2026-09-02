# Capital Aperture — Third Signal GCP/Firebase deployment receipt

- Date: 2026-08-31
- Owner project: `third-signal-v2` (`325422432428`)
- Public URL: `https://third-signal-capital-aperture.web.app`

## Release identity

- Source commit: `49df993`
- Cloud Build: `89de161c-754d-4c23-9030-a67f33b76095` — `SUCCESS`
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:49df993`
- Image digest: `sha256:d0997d78acfa28264b6583f2261208ec6417b32141e9d539df6b0ebbccac96d7`
- Cloud Run service: `capital-aperture`
- Region: `us-central1`
- Ready revision: `capital-aperture-00004-9wn`
- Firebase Hosting site: `third-signal-capital-aperture`
- Firebase Hosting target: `capital-aperture`
- Runtime identity: `capital-aperture-runtime@third-signal-v2.iam.gserviceaccount.com`
- Firebase web app: `Capital Aperture` (`1:325422432428:web:fe91c6a76e448d60ba5f09`)

## Validation

- GCP billing is enabled for `third-signal-v2`.
- Cloud Run reports the revision ready and sends 100% of service traffic to `capital-aperture-00004-9wn`.
- `GET /aperture` through Firebase Hosting returns HTTP 200.
- `GET /walkthrough` through Firebase Hosting returns HTTP 200 and renders the zero-login walkthrough.
- Same-origin `system.health` through Firebase Hosting returns HTTP 200 with `ok: true`.
- The production bundle contains the expected `49df993` release marker and dedicated Firebase web-app configuration.
- An unauthenticated browser visit to `/aperture` stays on the Third Signal origin and lands at `/sign-in?returnPath=%2Faperture`.
- `Continue with Google` opens the Google/Firebase account chooser for the Third Signal Firebase project; no Manus URL is generated.
- Firebase Auth authorizes `third-signal-capital-aperture.web.app`; Google sign-in is enabled.
- The server issues Firebase Hosting's permitted `__session` cookie and keeps `app_session_id` as a direct-service compatibility fallback. Authentication, paper-account schedules, and logout read or clear both names consistently.
- A public request carrying a deliberately invalid `__session` reached revision `capital-aperture-00004-9wn` and produced `Session verification failed`, rather than `Missing session cookie`; this proves Firebase Hosting forwarded the cookie to Cloud Run.
- The owner email resolves to exactly one existing administrator profile, so verified-email linking will preserve the existing account rather than create a blank duplicate.
- A cross-origin session request is rejected with HTTP 403, a missing/short token with HTTP 400, and a forged long token with HTTP 401.
- `pnpm check` passed.
- `DATABASE_URL= Poe_api_key=uat-placeholder-not-a-provider-key pnpm test:unit` passed 102 files and 799 tests; 2 files and 2 tests were intentionally skipped.
- The production build passed.

## Boundaries

- Hosting and runtime now belong to Third Signal GCP/Firebase; Manus hosting availability does not control this URL.
- Interactive authentication is owned by Third Signal Firebase Auth. The legacy Manus callback remains registered only for compatibility with existing scheduled-task identities; the client does not route operators or invite recipients through it.
- Verified Google email is the account-linking key. Ambiguous duplicate emails fail closed for administrator repair; email-specific invites still assign roles only after successful invite consumption.
- The runtime is connected to the existing production TiDB and Alpaca Paper configuration. This is not an isolated database copy.
- No custom domain was attached and no existing Third Signal service, Firebase site, or DNS record was changed.
- No database migration, broker configuration change, real-money rail, approval, or broker order occurred during this deployment.

## Rollback

To restore the first known-good infrastructure revision:

```sh
gcloud run services update-traffic capital-aperture \
  --project third-signal-v2 \
  --region us-central1 \
  --to-revisions capital-aperture-00001-rnm=100
```

To return to this release:

```sh
gcloud run services update-traffic capital-aperture \
  --project third-signal-v2 \
  --region us-central1 \
  --to-revisions capital-aperture-00004-9wn=100
```

## Remaining owner check

Complete the Google account chooser once and confirm the verified owner lands in the existing Capital Aperture administrator workspace at `https://third-signal-capital-aperture.web.app/aperture`. Then repeat from the CH Capital email-specific invite before sending that invite externally. Stop before any paper-order approval or submission unless that exact action is separately confirmed.

## 2026-09-01 provider-ensemble release

- Deployed source: `d38770c` (`21ece36` provider policy plus the Settings refresh repair).
- Cloud Build: `270d641b-ccc1-4b4d-95ed-47c2e0e814ab` — `SUCCESS`.
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:d38770c`.
- Image digest: `sha256:ca29fa594e67101c434856bb267e3f53c1acc8ce47827aa065330c5fcc437061`.
- Ready revision: `capital-aperture-00006-5ks`, serving 100% of Cloud Run traffic.
- Release marker: `d38770c`.
- Authenticated production settings were reset to the validated defaults: Gemini 3.1 Pro, Kimi K3, and DeepSeek V4 Pro for consensus; Kimi K3 for investment memos; Claude Sonnet 4.6 through Poe for interpretation; Gemini 3.7 Flash for structured high-volume roles.
- Browser UAT confirmed the signed-in Decision Run still loads, the live settings reflect those exact provider assignments, and the browser reported no console errors.
- Public `/aperture/run/240001` and same-origin `system.health` returned HTTP 200.
- `pnpm check`, the 28 scoped model-policy/memo tests, and `pnpm build` passed. The database-disabled full suite passed 785 tests; 31 legacy database/key-presence tests remained unavailable by design without an isolated database.
- No schema migration, invite change, broker setting, real-money rail, paper-order approval, or broker order occurred in this release.

## 2026-09-02 in-place option-ticket release

- Deployed source: `c01a6785b9bb4320b981e784ee7f141c9aa0b2de`.
- Cloud Build: `ae2acf2c-9c4e-4a56-b19e-019366c4ec5f` — `SUCCESS`.
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:c01a6785-firebase`.
- Image digest: `sha256:5f24460b4bc24f3ca083122482ac263023ab0643557c5655a5ce843f81b4125e`.
- Ready revision: `capital-aperture-00037-maf`, serving 100% of Cloud Run traffic.
- Release behavior: option tickets now load a broker-backed focused contract chain, show bid/ask, mark, spread, volume, and open interest, prefill an editable long-option buy limit from the ask, and resolve unavailable quote evidence in place with retry, another-contract, or durable preserve-cash actions.
- Read-only provider verification returned active MGM 2026-11-20 calls and current OPRA evidence. Authenticated browser UAT selected `MGM261120C00040000`, prefilled one contract at a `$4.20` limit, calculated `$420` maximum premium loss, and advanced to the paper-only acknowledgement checkpoint without a route loop or browser console issue.
- `pnpm check`, 29 focused broker/journey tests, and `pnpm build` passed. The database-disabled broad suite still reports the documented 31 legacy database/key-presence failures; no production database was exposed to the test runner.
- Public `/aperture` returned HTTP 200, same-origin `system.health` returned `ok: true`, and the public client bundle exposed the exact `c01a6785b9bb4320b981e784ee7f141c9aa0b2de` release marker.
- No schema migration, invite change, provider configuration change, proposal creation, paper approval, paper submission, or broker order occurred during this release or UAT.
- Rollback revision: `capital-aperture-00035-zuk`.

## 2026-09-02 proposal-idempotency repair

- Deployed source: `009a2f9503d3a54e4173abad627e0074986be48d`.
- Cloud Build: `5aee6978-7b1a-424e-8248-3b45a26a4ca8` — `SUCCESS`.
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:009a2f95-firebase`.
- Image digest: `sha256:60ae881d20a5e19f49c52bbbcee19ad52c05ec9e1aca54c8801452fc730da93c`.
- Ready revision: `capital-aperture-00039-dug`, serving 100% of Cloud Run traffic.
- Release behavior: creating a paper proposal now invalidates and refreshes the ticket lifecycle immediately instead of reloading the same stale route. Repeated or simultaneous create attempts for the same operator, run, and candidate return the active proposal instead of creating a duplicate.
- Authenticated production UAT confirmed that the repaired route opens the existing proposal directly. The extra proposal created by the pre-repair stale-screen retry was rejected with the durable reason `Duplicate proposal created during stale-screen UAT; original MGM ticket retained for review. No broker order was created.`
- Current MGM UAT state after cleanup: one proposal waiting for review, zero ready to submit, zero accepted or queued, and zero executed. The remaining proposal is `MGM261120C00040000`, one `MGM 2026-11-20 $40 call`, `LIMIT`/`DAY` at `$4.20`, maximum planned loss `$420`, destined for Alpaca Paper account `PA3X46OF7EKJ`.
- `pnpm check`, 20 focused lifecycle safety tests, and `pnpm build` passed. The database-disabled broad suite passed 830 tests; its 31 remaining failures are the documented database/key-dependent suites, with production database access intentionally disabled.
- The Firebase production URL returned HTTP 200 and its client bundle exposed the exact `009a2f9503d3a54e4173abad627e0074986be48d` release marker.
- UAT stopped at the explicit action-time approval dialog. No paper approval, paper submission, or broker order occurred in this repair pass.
- Rollback revision: `capital-aperture-00037-maf`.

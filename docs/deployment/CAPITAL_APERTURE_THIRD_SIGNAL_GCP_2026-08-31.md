# Capital Aperture — Third Signal GCP/Firebase deployment receipt

- Date: 2026-08-31
- Owner project: `third-signal-v2` (`325422432428`)
- Public URL: `https://third-signal-capital-aperture.web.app`

## Release identity

- Source commit: `2968650`
- Cloud Build: `fc06b7ef-a95d-48a6-9bc6-8a16ae73621f` — `SUCCESS`
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:2968650`
- Image digest: `sha256:4e2757364693a70a87941b7a23a7484c937ece6636ebd7dc3070b10bc6a833d7`
- Cloud Run service: `capital-aperture`
- Region: `us-central1`
- Ready revision: `capital-aperture-00003-cn7`
- Firebase Hosting site: `third-signal-capital-aperture`
- Firebase Hosting target: `capital-aperture`
- Runtime identity: `capital-aperture-runtime@third-signal-v2.iam.gserviceaccount.com`
- Firebase web app: `Capital Aperture` (`1:325422432428:web:fe91c6a76e448d60ba5f09`)

## Validation

- GCP billing is enabled for `third-signal-v2`.
- Cloud Run reports the revision ready and sends 100% of service traffic to `capital-aperture-00003-cn7`.
- `GET /aperture` through Firebase Hosting returns HTTP 200.
- `GET /walkthrough` through Firebase Hosting returns HTTP 200 and renders the zero-login walkthrough.
- Same-origin `system.health` through Firebase Hosting returns HTTP 200 with `ok: true`.
- The production bundle contains the expected `2968650` release marker and dedicated Firebase web-app configuration.
- An unauthenticated browser visit to `/aperture` stays on the Third Signal origin and lands at `/sign-in?returnPath=%2Faperture`.
- `Continue with Google` opens the Google/Firebase account chooser for the Third Signal Firebase project; no Manus URL is generated.
- Firebase Auth authorizes `third-signal-capital-aperture.web.app`; Google sign-in is enabled.
- The owner email resolves to exactly one existing administrator profile, so verified-email linking will preserve the existing account rather than create a blank duplicate.
- A cross-origin session request is rejected with HTTP 403, a missing/short token with HTTP 400, and a forged long token with HTTP 401.
- `pnpm check` passed.
- `DATABASE_URL= Poe_api_key=uat-placeholder-not-a-provider-key pnpm test:unit` passed 101 files and 796 tests; 2 files and 2 tests were intentionally skipped.
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
  --to-revisions capital-aperture-00003-cn7=100
```

## Remaining owner check

Complete the Google account chooser once and confirm the verified owner lands in the existing Capital Aperture administrator workspace at `https://third-signal-capital-aperture.web.app/aperture`. Then repeat from the CH Capital email-specific invite before sending that invite externally. Stop before any paper-order approval or submission unless that exact action is separately confirmed.

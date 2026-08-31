# Capital Aperture — Third Signal GCP/Firebase deployment receipt

- Date: 2026-08-31
- Owner project: `third-signal-v2` (`325422432428`)
- Public URL: `https://third-signal-capital-aperture.web.app`

## Release identity

- Source commit: `6ef0132`
- Cloud Build: `ed4eb472-c6f9-41b1-9673-763fbaea717d` — `SUCCESS`
- Container image: `us-central1-docker.pkg.dev/third-signal-v2/cloud-run-source-deploy/capital-aperture:6ef0132`
- Image digest: `sha256:4c232a6b8da690fb3aa050bf6a3b629261c847a9970888b6c94ee03ace34fa83`
- Cloud Run service: `capital-aperture`
- Region: `us-central1`
- Ready revision: `capital-aperture-00002-pbz`
- Firebase Hosting site: `third-signal-capital-aperture`
- Firebase Hosting target: `capital-aperture`
- Runtime identity: `capital-aperture-runtime@third-signal-v2.iam.gserviceaccount.com`

## Validation

- GCP billing is enabled for `third-signal-v2`.
- Cloud Run reports the revision ready and sends 100% of service traffic to `capital-aperture-00002-pbz`.
- `GET /aperture` through Firebase Hosting returns HTTP 200.
- `GET /walkthrough` through Firebase Hosting returns HTTP 200 and renders the zero-login walkthrough.
- Same-origin `system.health` through Firebase Hosting returns HTTP 200 with `ok: true`.
- The production bundle contains the expected release marker and public OAuth identifiers.
- An unauthenticated browser visit to `/aperture` reaches the configured Manus login portal at `/app-auth`; it no longer falls into the blank `#` redirect.
- `pnpm check` passed.
- `DATABASE_URL= Poe_api_key=uat-placeholder-not-a-provider-key pnpm test:unit` passed 99 files and 791 tests; 2 files and 2 tests were intentionally skipped.
- The production build passed.

## Boundaries

- Hosting and runtime now belong to Third Signal GCP/Firebase; Manus hosting availability does not control this URL.
- Authentication still delegates to the existing Manus OAuth identity provider. Migrating identity to Firebase Auth is a separate change.
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
  --to-revisions capital-aperture-00002-pbz=100
```

## Remaining owner check

Complete one authenticated sign-in and Capital Aperture read-only UAT at `https://third-signal-capital-aperture.web.app/aperture`. Stop before any paper-order approval or submission unless that exact action is separately confirmed.

# Capital Aperture startup incident — 2026-10-13

Surface: Infra. Team: Third Signal Lab. Project: Third Signal Lab Agency.
Status: startup failure fixed and deployed; repeated cold-start and authenticated browser acceptance passed.

## Observed failure

The operator saw `Service Unavailable` on both Firebase Hosting and the direct Cloud Run origin. Cloud Run revision `capital-aperture-pd06-a1c51dd` served 100% traffic and logged repeated HTTP 500/503 startup/connection failures around 15:39–15:41 America/New_York. Warm requests subsequently passed; this did not establish recovery.

The production entrypoint ran a development-style port scan: open a temporary TCP server, close it, then configure and bind the actual HTTP server. Cloud Run used a TCP startup probe. Logs showed probe success before the actual server-ready message. A real bundled-process reproduction (`node scripts/verify-cold-start.mjs 10`, database and credentials excluded) failed on cycle 5 with `ECONNRESET` on the first accepted connection. This makes false TCP readiness a reproduced defect, not just a speculative explanation. The old rollback revision has the same code.

## Fix

Runtime commit `81b85b6ba4868c1c94a5d091d4cf8bb0def29320`:

- Only development discovers alternate ports. Production binds the configured port once to the actual HTTP server, on `0.0.0.0`.
- Invalid ports and listen failures fail startup with exit 1; no silently listening on another port.
- `/readyz` is a no-store JSON HTTP response, registered before SPA fallback. It reports HTTP readiness, not database/provider health.
- Startup background work begins only after the real listener is ready.
- Cloud Run uses an HTTP `/readyz` startup probe (2-second period, 1-second timeout, 60 failures allowed).

## Local evidence

- Before fix: first accepted socket reset on cycle 5.
- After fix: 25/25 fresh bundled processes served HTTP on the first accepted socket.
- 11 targeted startup tests pass; full unit suite 4,144 pass / 18 skipped, 366 files pass / 4 skipped.
- Typecheck and production build pass. Existing bundle-size warnings remain.
- Tests explicitly use `DATABASE_URL=`; cold-start subprocesses use no dotenv, credentials or production database.

## Deployment plan and safety

Cloud Build `802cfa85-9146-40e8-86ca-a1825a04635f` builds `gcr.io/third-signal-v2/capital-aperture:startup-81b85b6` from tracked inputs only. Source manifest hash: `862aae0021ed5c202a7119ed9603958ad4e2b22fb4e1d13c37ec3beb7f2297fd`.

First deploy a zero-traffic tagged candidate. Suppress the *deployment-time warmup* (`--no-deploy-health-check`) so its first invocation exercises a genuine cold start; the runtime HTTP startup probe remains enabled. After candidate checks pass, use fresh revisions of the identical image to exercise both production origins on first invocation. Correlate request markers with revision/instance startup logs; ordinary warm 200s alone do not count as cold-start proof.

No schema, credentials, security policy, account, approval or order changes. Previous revision remains available for emergency traffic rollback, but shares the reproduced port-probe defect. Preserve all receipt tables.

Linear connector returned UNAUTHORIZED; this document is the ready-to-sync incident/ship log. Do not claim a Linear update occurred.

## Production acceptance

Cloud Build succeeded. Image digest: `sha256:fdc6b0b2db0dfe32164166f402e6c461cf0a0be12a1ca8d72b7e9719bccdcf8e`.
Final revision `capital-aperture-startup-81b85b6-r3` independently confirmed ready and serving 100% of production traffic. Canary and previous revision retain tags with no production traffic allocation.

Both production origins were checked concurrently, without retries, against three fresh revisions of the identical image. Request logs identify the exact revisions and show request arrival before HTTP readiness, confirming genuine cold starts rather than ordinary warm responses.

| Fresh revision suffix | Hosting | Direct Cloud Run | Marker suffix |
| --- | --- | --- | --- |
| r1 | 200 / 7,032 ms | 200 / 15,679 ms | 1791921643903 |
| r2 | 200 / 27,308 ms | 200 / 27,263 ms | 1791921673210 |
| r3 | 200 / 18,750 ms | 200 / 31,431 ms | 1791921711139 |

Full marker format: `capital-aperture-startup-81b85b6-rN-SUFFIX`. First requests ran from 20:00:43 through 20:02:23 UTC. For r3, both request timestamps were 20:01:51 UTC; the two HTTP-ready messages were 20:02:09 and 20:02:21 UTC. All six first responses passed.

- Canary: 28/28 read-only release checks passed.
- Hosting (`https://third-signal-capital-aperture.web.app`): 28/28 passed at 20:03:04 UTC, exact runtime SHA verified.
- Direct (`https://capital-aperture-325422432428.us-central1.run.app`): 28/28 passed at 20:03:07 UTC, exact runtime SHA verified.
- Original direct-origin browser error tab reloaded successfully to the public landing page; `Service Unavailable` was gone.
- Existing authenticated admin session (`treble.design@gmail.com`) loaded Command Center, Capital Today, Play Desk and Research with release `81b85b6`. Research survived a full browser reload and displayed 23 saved journeys. Play Desk finished loading five order/position records and three scheduled reviews; status correctly became stale rather than remaining loading.
- Error-log query covering all hotfix revisions since 19:58 UTC returned no severity ERROR or HTTP 5xx entries as of 20:07 UTC. This is a bounded observation, not a guarantee against future failures.

## Remaining risks and scope boundary

Cold starts remain slow (7–31 seconds observed); no paid minimum-instance change was made. Existing `Search not found` account-linked warning was observed before and after deployment. Stale broker snapshots, overdue reviews and unconfirmed saved-analysis evidence remain explicitly visible; this hotfix does not certify fresh market data or resolve those separate product/data issues. No trades, research runs, approvals or account synchronization were triggered for verification.

The startup incident acceptance is complete, not a claim of full product UAT or all prior roadmap work being complete. Linear logging remains blocked on connector reauthentication.

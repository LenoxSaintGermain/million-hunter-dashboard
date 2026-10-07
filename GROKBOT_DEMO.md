# Grokbot local demo handoff

## Run locally

Requires Node 22+ and pnpm (packageManager is pinned in package.json).

```sh
git clone --branch codex/grokbot-local-demo git@github.com:LenoxSaintGermain/million-hunter-dashboard.git
cd million-hunter-dashboard
corepack enable
pnpm install --frozen-lockfile
pnpm exec vite --config vite.demo.config.ts
```

For an existing checkout, preserve local edits first, fetch origin, then check out
`codex/grokbot-local-demo`. Repository access is required; no credentials are included.

Open http://127.0.0.1:3137/ for the landing experience.
Public preview routes:

- `/walkthrough` — acquisition walkthrough
- `/walkthrough/capital-desk` — Capital Desk preview
- `/demo-tour` — guided demo
- `/brief` — investor brief
- `/jims-file` — illustrative alternate-use-case demo

Build: `pnpm exec vite build --config vite.demo.config.ts`.

## Boundaries

This branch is a frontend demo fork inside the same repository, not a separate
GitHub repository or a production deployment. It starts no application server,
loads no .env files, exposes no normal VITE_* configuration and proxies no API.
Authenticated workspaces and uploads are not usable in this standalone preview.
Some shared UI may attempt same-origin API requests; no backend is available.
External links or remote media are not guaranteed offline. Do not sign in or
substitute production endpoints to make a demo button work.

Do not copy .env, cloud credentials, customer documents or production data.
The normal `pnpm dev` launcher is NOT the demo launcher. Tests require an explicit
empty DATABASE_URL because other developer checkouts may contain production env.

## Continue development

## Signed-in Capital experience (isolated backend)

The repository also includes the actual Capital workspace and an existing
fixture-authenticated harness: `scripts/isolated-objective-browser.ts`.
This is distinct from the public Capital Desk preview. It supplies a synthetic
capital_operator identity to the real router without copying a browser session.

On Grokbot's machine, provision a fresh MySQL-compatible database on loopback
port 3307 with database `capital_aperture_test_20260909_zzugqp` and a scoped user
`cap_test_20260909_zzugqp`. Give that user access ONLY to this disposable database.
Choose a local password; no production credentials or database dumps are needed.
Use a fresh checkout without .env files and without inherited provider/broker keys.

```sh
export DATABASE_URL='mysql://cap_test_20260909_zzugqp:YOUR_LOCAL_PASSWORD@127.0.0.1:3307/capital_aperture_test_20260909_zzugqp'
export ISOLATED_INTEGRATION_DATABASE=capital_aperture_test_20260909_zzugqp
pnpm exec drizzle-kit push
NODE_ENV=development ISOLATED_UAT_MODE=true ISOLATED_BROWSER_HARNESS=true ISOLATED_BROWSER_SCENARIO=monitor pnpm exec tsx scripts/isolated-objective-browser.ts
```

Open http://127.0.0.1:3114/aperture to preview Today, Mission, Play Desk,
Research, Portfolio and Theses using the fixture identity. The monitor scenario
seeds illustrative held-position, stale-check and pending-review records.
The harness inserts its fixture at startup; use a fresh disposable database for
repeat runs rather than importing or deleting a real user's records.

This harness is already committed source, not newly certified end-to-end here.
It does not mock every provider/broker endpoint. Keep all external credentials
absent; unsupported actions should fail rather than call live services. Grokbot
should finish local fixture coverage and verify all navigation/actions before
presenting it as a complete interactive demo. Never deploy this harness publicly.

## Grokbot development instructions

Read repository AGENTS.md. Preserve the cream/ink editorial visual system,
intelligent charts, progressive disclosure, compact mobile layouts and inline
resolution. Use clearly labeled deterministic examples. Never imply synthetic
data is live or that a demo action places an order.

Base: committed source at 85ab910. Uncommitted trading-flow edits and the local
strategy DOCX were deliberately excluded. Full V2/document production readiness
is not certified by this handoff. Reconcile current code before claiming it.

Make further changes on this demo branch or a child branch; do not deploy or
merge to main as part of local demo work without explicit authorization.

## Ship log / Linear-ready

Surface: Research OS. Change: package an isolated local demo for Grokbot.
Branch: codex/grokbot-local-demo. Production build/revision: not applicable.
Acceptance: clean dependency install and standalone demo build; no backend or
production configuration required. Remaining risk: authenticated flows require
separate isolated backend UAT and external media may need network access.

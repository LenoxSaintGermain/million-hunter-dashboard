# Capital Aperture Production-Readiness Gauntlet

**Date:** 2026-08-26
**Authorized baseline:** `2178215eba7ef853966c44e1dc78cff1f6a0a25e`
**Local branch:** `gauntlet/capital-aperture-readiness-2026-08-26`
**Authorized repository boundary:** `/home/ubuntu/million-hunter-dashboard`

## Execution Guardrails

This gauntlet is strictly local-only. It will not push, merge, deploy, apply migration `0055`, source repository `.env`, connect to production TiDB, create credentials, invoke paid providers, or create, approve, submit, cancel, or modify a broker order.

`todo.md` is a user-owned, pre-existing uncommitted artifact and is outside this gauntlet’s scope. It must not be edited, staged, or committed. The descendant-baseline report is likewise protected and must remain outside the staged diff. The following local fingerprints were recorded after the owner’s correction and before any further gauntlet change:

| Protected path | SHA-256 | Git state at capture | Staged |
|---|---|---|---|
| `todo.md` | `4120e8aa02eed154e6d96897ca07aa1b4642da67b9fe2b6c2a01450adb8db413` | Pre-existing modified/uncommitted | No |
| `docs/qa/CAPITAL_APERTURE_DECISION_RUNWAY_DESCENDANT_BASELINE_REPORT_2026-08-26.md` | `0b10d2e4634cd936bc58742b5c9ff518a1ddba3a276e6a072662ad8eb10fe183` | Pre-existing untracked | No |

The attempted checklist edit after the correction was rejected before any content was written. Before every local commit, the gauntlet will re-run SHA-256, `git diff --cached --name-status`, and protected-path status checks; fingerprints must match and neither path may appear in the staged diff.

> **Invalidated evidence:** Both Wide Research attempts are permanently excluded. They attempted activity outside the authorized local repository boundary; no finding, analysis, file list, or recommendation from either run will be used in this ledger.

## Work Packages

| Track | Owner | State | Evidence boundary |
|---|---|---|---|
| A — Build reliability | Main agent | Completed | Local Vite/package/import/build output only |
| B — Test architecture | Main agent | Completed | Local Vitest config, tests, scripts, empty-DB behavior only |
| C — Decision Runway pressure matrix | Main agent | Completed | Local components, router, fixtures, and unit tests only |
| D — Authority/security/no-order | Main agent | Completed (static) | Local router, gates, schema, migration, and adapters only |
| E — UI/UX/accessibility | Main agent | Completed (read-only) | Local components, CSS, deterministic preview only |

## Findings Ledger

| ID | Severity | Finding | Evidence | Owner | Disposition | Command / Artifact |
|---|---|---|---|---|---|---|
| PRG-001 | P1 | Build termination was reproduced only while the local development watcher was resident; it is an environment-memory contention issue, not a passing build result or a source regression. | First retry: exit `143` at `rendering chunks...` after `25.62s`, with `2.1 GiB` reported available after termination. After stopping the `322 MiB` watcher, two clean builds passed. | Main agent | Resolved locally | Restore the preview server after isolated builds; retain this operating procedure for constrained sandboxes. |
| PRG-002 | P0 (validation gate) | No isolated preview/test database URL is available. | Empty-URL test run; no shell target | Owner | Blocked | Do not migrate or claim authenticated UAT. |
| PRG-003 | P1 (verification gap) | Unauthenticated preview cannot prove assigned-thesis handoff, keyboard owner flow, or stateful authority. | Missing session cookie in preview | Owner / main agent | Blocked | Requires isolated DB and authenticated identities. |
| PRG-004 | P0 (validation gate) | Database/schema assertions cannot run without an explicitly supplied isolated `DATABASE_URL`; repository `.env` and production TiDB remain prohibited. | `DATABASE_URL= pnpm test:integration` selected exactly 10 database-required files, stopped at the isolated-target guard, and skipped 57 assertions. | Owner | Blocked | `server/test/requireIsolatedDatabase.ts`; requires a disposable isolated database only. |
| PRG-005 | P0 | Stale authoritative binding validation was evaluated before the proved-close exception, so an exposure-reducing paper close could be trapped by a later mission revision. | Static helper order in `server/aperture/decisionRunway.ts`; no broker call or database action occurred. | Main agent | Fixed locally | `requiresCurrentDecisionBinding` now requires the current exact binding for `open` and `unknown` only; focused safety suite passed 128/128. |

## Track B — Test Architecture Evidence

The full mandated empty-URL baseline was run locally without sourcing repository `.env`:

```text
DATABASE_URL= pnpm test
Test Files  10 failed | 72 passed | 2 skipped (84)
Tests       29 failed | 698 passed | 8 skipped (735)
```

The ten failures are all database/schema/seed-dependent files, not muted individual assertions: `server/aperture/activeCapitalThesisSchema.test.ts`, `server/aperture/playOutcomeLedgerSchema.test.ts`, `server/scan-pipeline.test.ts`, `server/sprint4.test.ts`, `server/sprint5.test.ts`, `server/sprint6.test.ts`, `server/sprint8.test.ts`, `server/sprint11.test.ts`, `server/stack.test.ts`, and `server/urlImport.test.ts`.

The local test lanes now make that boundary explicit:

| Command | Result | Meaning |
|---|---:|---|
| `pnpm check` | Passed | TypeScript accepts the local lane configuration. |
| `pnpm test:unit` | 72 files passed, 2 skipped; 676 tests passed, 2 skipped | Pure/no-database regression lane is green with `DATABASE_URL` forcibly empty. |
| `DATABASE_URL= pnpm test:integration` | Exit 1; exactly 10 files selected, 57 assertions skipped | Correct fail-closed behavior: the required isolated target is absent, so database assertions are not falsely reported as passing. |

`vitest.unit.config.ts` excludes only the ten database-required files. `vitest.integration.config.ts` declares exactly those same files and `server/test/requireIsolatedDatabase.ts` rejects missing or blank targets before their assertions execute. Neither lane sources `.env`, changes data, or hides a database assertion.

## Track A — Build Reliability Evidence

The first bounded reproduction was intentionally run while the local development watcher was active. It transformed the client, reached `rendering chunks...`, and terminated with exit `143` after `25.62s`. Memory after termination was `2.1 GiB` available with no swap use, while the active watcher’s server process was measured at approximately `322 MiB` RSS. This failure is recorded as a constrained local environment contention signal, not as a build pass.

The watcher was then stopped temporarily, reducing memory use from `1.7 GiB` to `1.1 GiB` and increasing available memory from `2.1 GiB` to `2.7 GiB`. With the watcher absent, two independent production builds completed:

| Build command | Result | Vite result | Wall time | Post-build available memory |
|---|---:|---:|---:|---:|
| `DATABASE_URL= NODE_OPTIONS=--max-old-space-size=2304 pnpm build` | Exit 0 | 7,088 modules transformed; built in 27.31s | 29.53s | 2.7 GiB |
| `DATABASE_URL= pnpm build` | Exit 0 | 7,088 modules transformed; built in 27.05s | 28.94s | 2.7 GiB |

No bundle topology, chunking, import, dependency, environment, or source change was made to obtain those passes. The local preview server was restored after the second clean build. The accepted result is therefore **two successful clean `pnpm build` runs**, with a documented local operating constraint: do not run a production build concurrently with the long-lived watcher in this memory-constrained sandbox.

## Track C — Deterministic Decision Runway Pressure Evidence

The pure regression suite now covers the pressure cases that can be proven without a database, provider, or broker: cash and conditional blocks for all opening lifecycle actions; unknown intent treated as opening exposure; stale run/account binding blocks; proved-close escape behavior; no authoritative binding; concentration control; stale account state; verified versus absent catalyst context; intraday, swing, catalyst-deadline, and long-horizon outcome timing; unmeasured paper amount; intraday evidence/risk-plan requirements; and 10/50/100-candidate queue ordering. The queue fixture asserts ordering by evidence readiness and live catalyst timing only; its deliberately present `ignoredPredictedReturn` cannot influence the result.

| Command | Result |
|---|---:|
| `DATABASE_URL= pnpm vitest run --config vitest.unit.config.ts server/aperture/decisionRunway.test.ts server/aperture/gates.test.ts server/aperture/orderFlow.test.ts` | 3 files passed; 128 tests passed |
| `pnpm test:unit` | 74 files passed, 2 skipped; 690 tests passed, 2 skipped |
| `pnpm check` | Passed |

`shared/dailyPlayQueue.test.ts` and `shared/playRecipe.test.ts` are included in the no-database lane. Database-only assertions such as owner-specific stored outcomes, duplicate persisted run idempotency, and no-order record counts remain intentionally blocked behind PRG-002 rather than simulated.

## Track D — Static Authority, No-Order, and Credential Evidence

Static inspection establishes the following local control chain: `aperture.runway.begin` owner-scopes thesis projection, canonical thesis, paper account, prior decision run, current revision, in-flight dispatch, and conditional outcome records with `ctx.user.id`; the router persists `paperOnly: true` and `humanApprovalRequired: true` in the immutable gate snapshot; `orderFlow` resolves intent before calling Decision Runway authorization, uses the same evaluator for preflight and proposal creation, writes an approved proposal only as `pending_approval`, owner-scopes approve/reject/submit lookups by `brokerOrders.userId`, and serializes the current decision revision immediately before the broker seam.

The P0 close correction adds `requiresCurrentDecisionBinding`: `open`, `unknown`, and absent intent remain exact-binding/fail-closed, while a resolved `close` can proceed through revision drift or an unavailable historical revision row. This does **not** grant an opening action, bypass paper-only adapter checks, or trigger a broker call; the order intent resolver must already have classified the request as exposure-reducing.

A filename-only local credential scan found no committed private-key, AWS-style access-key, non-empty Alpaca credential assignment, or non-empty database URL pattern under `client`, `server`, `shared`, or `drizzle`. Alpaca environment references were limited to the expected server adapter/tests. No secrets were printed. This was static evidence only; no provider credential was used and no order was created, approved, submitted, cancelled, or modified.

## Track E — Read-Only Responsive Evidence (In Progress)

Read-only full-page captures were taken from `/aperture` at `375×812` and `768×1024`. At the narrow viewport, the Decision Runway presents a single-column sequence—status rail, current mission, then the bounded Today slate—with controls at or above the visible mobile target height. At tablet width, the context rail forms four readable columns, the thesis assignment control remains a bounded three-part row, and the queue retains its one-decision-first hierarchy. Neither capture showed an apparent horizontal overflow, clipped primary control, chat surface, or proposal/submit control.

At `1024×900` and `1162×900`, the context and mandate surfaces retain their column boundaries, the thesis assignment surface remains compact rather than expanding into a general form, and the Today surface keeps its research-only next action separate from the cash-control state. Neither desktop capture showed a horizontally clipped rail, overlapping primary action, or unbounded candidate list. The `xl` two-column Decision Runway cannot be visually asserted from these captures because this session’s displayed state has no active assigned thesis; that stateful condition remains part of blocked authenticated UAT.

The final `1440×1000` capture preserves the same bounded operator hierarchy and visible paper-only/human-approval language. No local browser-console errors or failed requests were recorded in the final 250 preview-log lines after the captures. Source audit adds the following keyboard/accessibility evidence: native labels wrap the mission, money, select, and conditional-receipt fields; thesis switching has an explicit accessible name; Play Slate expansion uses `aria-expanded` and `aria-controls`; decision feedback is announced through `role="status"`/`aria-live`; skip/defer text areas have an explicit screen-reader label; and `Ctrl/Cmd+Enter` ignores editable targets and only opens the already-expanded play’s evidence or human-review surface. The shortcut does not record a decision or submit an order.

No P0/P1 visual or source accessibility defect was found in this read-only surface. The persistent gate is verification scope: no authenticated or stateful behavior has been claimed.

## Owner UAT Script — Maximum 10 Minutes (Blocked Until Isolated DB + Auth Are Supplied)

> **Precondition:** Run only against a disposable isolated database with migration `0055` already applied by an explicitly authorized operator, and with separate authenticated Lenox and Jim sessions available. Do not source repository `.env`, connect to production TiDB, invoke a paid provider, or create/approve/submit/cancel/modify a broker order. The following script is intentionally not performed by this gauntlet.

| Time | Operator / Route | Action | Expected evidence | Prohibited action |
|---:|---|---|---|---|
| 0:00–1:00 | Lenox at `/aperture` | Confirm the account badge is paper-only, the operating state says human approval required, and capture initial `broker_orders` count in the isolated DB. | A paper account only; baseline count recorded. | Do not create a ticket or touch broker controls. |
| 1:00–2:30 | Lenox at Decision Center | Record a **cash** receipt with a reason, blocker, and reopen condition. | `$0 at risk` receipt; paper-proposal path stays unavailable for that run. | No research promotion, proposal, approval, or submit. |
| 2:30–4:00 | Lenox at Decision Center | Record a **conditional** receipt with a named gate and review time. | Conditional receipt and one pending `gate_review`; proposal path held. | Do not clear the gate through a broker or provider call. |
| 4:00–5:30 | Lenox at Decision Center | Record a **research** mission using an assigned thesis and paper account; open the resulting Play Slate. | Exact thesis/projection/account/revision binding is visible in the state; only evidence/research next steps are used. | Do not open or prepare a paper ticket. |
| 5:30–6:30 | Lenox at Today | Expand one play and use `Ctrl/Cmd+Enter` outside an editable field. | It opens decisive evidence or human-review context only; no mutation or order state change. | Do not invoke any order action. |
| 6:30–8:00 | Jim at `/aperture` | Confirm Jim cannot retrieve Lenox’s thesis/run/account state and can see only Jim-owned Capital context. | Owner-scoped query results and protected mutation denial/read isolation are captured. | Do not reuse Lenox session/cookie or alter rows manually. |
| 8:00–9:00 | Lenox and Jim | Attempt opening preparation from cash, conditional, stale, and unbound receipts using a non-broker preflight/read path only if the test harness supports it. | Each opening/unknown intent fails closed; a proven held-position close remains permitted by pure regression evidence, not executed. | Never create, approve, or submit an order. |
| 9:00–10:00 | Isolated DB read-back | Compare initial/final `broker_orders` count and inspect new Decision Run/revision/outcome records. | **Zero new broker orders**; owner-scoped immutable revisions and expected cash/conditional outcome records only. | No cleanup through destructive database operations. |

The handoff is accepted only if this script produces evidence consistent with the static safeguards and leaves the broker-order count unchanged. Any unavailable isolated database, missing authentication identity, migration mismatch, or nonzero order delta is a stop condition requiring owner review.

These are **visual, unauthenticated/read-only observations only**. They do not prove identity isolation, persisted thesis ownership, revision binding, keyboard action behavior, database counts, or any broker state. Those remain blocked by PRG-002/PRG-003.

## Evidence Rules

Every subsequent entry will name the exact local file, command, result, and disposition. Database-backed and authenticated claims will remain explicitly blocked until an isolated test database target is supplied and verified.

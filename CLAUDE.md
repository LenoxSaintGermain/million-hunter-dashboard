# CLAUDE.md — **Signal Hunter OS (million-hunter-dashboard)**

Operating context for any Claude Code session in this repo. Read this fully before editing.

---

## What this is

Signal Hunter OS — a multi-agent **deal diligence & decision** engine for small-business/asset acquisition. It pressure-tests a target (thesis fit → IC consensus → red team → capital stack → memo → LOI) so a buyer kills bad deals *before* spending on a Quality-of-Earnings report. Positioning: "most deals fail before they close"; it sits **upstream of QoE**, not competing with it. Audiences: independent sponsors / searchers, and family offices (via a live prospect, the Wingate attorney).

---

## PRIME DIRECTIVES (non-negotiable — these override convenience)

1. **No fabricated anything.** Never invent testimonials, customer quotes, traction, metrics, or logos. This has already caused a problem here: composite test-deal data was once dressed up as real customer testimonials on the landing page (removed — see `LandingPage.tsx`, A-1). If you find first-person endorsements not backed by a real, named, consenting customer, flag or remove them. Illustrative examples must be explicitly labeled "Illustrative — composite deal, not a real customer."

2. **Demos are deterministic and zero-API.** Any public/demo surface (`/walkthrough`, the demo tour, `/brief`, inline simulators) must run on **cached fixtures with zero live API calls** — it cannot fail or cost tokens in front of a prospect. Real runs are captured once and frozen ("live-run-then-bake"), never called live at demo time.

3. **Honest labels only.** Nothing says "Live" that isn't. Synthesized/placeholder data is labeled as such. Forward-looking items are labeled "Roadmap"/"Projection." **Market Scan** runs non-live data and lives in **Labs (Experimental)**. **Opportunity Radar** is back in primary nav because it is now backed by real Perplexity sonar-pro data with citations (WP-DR2) — if that backing ever breaks, demote it back to Labs rather than fake it.

4. **Never commit secrets.** Provider keys (Gemini, Anthropic/Poe, Perplexity Sonar, DB URL, JWT) stay server-side in env / secret storage. `.env` is gitignored — confirm before any commit. No API keys in client code, ever.

5. **Label gaps honestly, audit-style.** If something can't be verified, sourced, or made to work, say so explicitly. Do not paper over a gap to look finished.

---

## Model policy (current API key)

**`shared/models.ts` is the single source of truth. This section describes it; it does not override it.** Re-validated live against the production `GEMINI_API_KEY` on **2026-08-18** by `npx tsx scripts/validate-models.ts` (run from the repo root — a one-token `generateContent` probe per candidate, costs almost nothing, re-runnable). That script is the authority. Before changing any model ID, re-run it and update `shared/models.ts` and this section together.

### Validated set (6 of 7 candidates passed, 2026-08-18)

| Model ID | Result |
| --- | --- |
| `gemini-3.1-pro-preview` | PASS |
| `gemini-3.6-flash` | PASS |
| `gemini-3.5-flash` | PASS |
| `gemini-3.5-flash-lite` | PASS |
| `gemini-3.1-flash-lite` | PASS (legacy, fallback only) |
| `gemini-3-flash-preview` | PASS (superseded by `3.5-flash`) |
| `gemini-3.1-flash` | **FAIL — HTTP 404 NOT_FOUND**, "not found for API version v1beta, or is not supported for generateContent" |

`gemini-3.1-flash` does not exist. It was hardcoded in `server/_core/llm.ts` until 2026-08-18. Do not re-add it on the assumption it is a typo for something real.

Note: the previous version of this section claimed only `gemini-3.1-pro-preview` and `gemini-3.1-flash-lite` were valid. That was wrong — four more IDs validate live. The doc had drifted behind the code.

### The four role constants — import these, never a literal

| Constant | Resolves to | Use for |
| --- | --- | --- |
| `GEMINI_STRONG` | `gemini-3.1-pro-preview` | Red Team, Investment Memo — deepest reasoning, 2M context |
| `GEMINI_FAST` | `gemini-3.6-flash` | High-volume: capital stack math, scoring, market scan |
| `GEMINI_BALANCED` | `gemini-3.5-flash` | Middle tier: deal scoring, consensus |
| `GEMINI_LITE` | `gemini-3.5-flash-lite` | Ultra-cheap background/subagent tasks |

(`GEMINI_LEGACY_LITE` = `gemini-3.1-flash-lite` exists as a fallback only.)

### Rules

1. **Call sites import role constants from `shared/models.ts`.** No hardcoded model strings anywhere in `server/`, `client/`, or `scripts/` except `shared/models.ts` itself and `scripts/validate-models.ts`. Enforce with:
   `grep -rn "gemini-[0-9]" server client shared scripts`
2. **Anything read from the DB `model_configs` table must pass through `toValidGeminiId(id, fallback)`** with a valid fallback. A stale row must never reach the API. Verified at every call site: `server/routers.ts` (`consensusConfig`), `server/agents/index.ts` (`getConsensusModelIds`); `updateConsensus` additionally rejects writes outside `VALID_GEMINI_IDS` via zod.
3. **The Memos "Generation failed" bug came from mixed versions** (`2.5-*`, `3.1-pro`, `3.1-flash`, `3.1-pro-exp`) scattered across routers, plus stale `model_configs` rows reaching the API uncoerced. Both halves of that failure mode are still live risks — keep the registry single-sourced and keep the coercion.

### Non-Gemini providers — unverified, do not invent

`scripts/validate-models.ts` only holds a Gemini key, so **Poe and Perplexity IDs are unvalidated.** Poe uses its own label-style namespace (`Claude-Opus-4`, `GPT-5.5`, …). The current Anthropic family is Opus 5 / Sonnet 5 / Haiku 4.5, so the Poe labels in the catalog are likely stale — but **do not rename them without confirming the exact label against the live Poe gateway.** An invented Poe label fails at request time exactly the way `gemini-3.1-flash` did. Known drift, left deliberately untouched: `shared/models.ts` catalogs `Claude-Opus-4.7` while `server/poe.ts` actually sends `Claude-Opus-4`.

---

## Architecture map (verify against current code — it moves)

- **Client:** React + Vite. Design system = CSS custom properties prefixed `--sh-*` in `client/src/index.css` (surface, border, signal, primary, red, text tokens). **Use these tokens — do not invent a new visual language.** Key pages: `client/src/pages/LandingPage.tsx` (public landing), `client/src/pages/DemoTour.tsx` (cached 5-chapter demo), `client/src/pages/Walkthrough.tsx` (`/walkthrough` — 8-step public solo walkthrough, zero auth, zero API), `client/src/pages/InvestorBrief.tsx` (`/brief` — 13-section scrollytelling pitch with 6 deterministic simulators). Nav/layout: `DashboardLayout.tsx`, `EditorialTopNav.tsx`, `InvestorLayout.tsx`.
- **Server:** Node/Express, entry `server/_core/index.ts`. Agents in `server/agents/` — the IC consensus scorer runs three Gemini calls in parallel and is surfaced in the UI via **persona labels** ("The Structuralist," "The Restructurer," "The Market Analyst"), NOT vendor names. Keep it that way (persona labels are the honest relabel). `server/poe.ts` = Poe gateway (Claude/Gemini). Real web research uses Perplexity Sonar (`server/deepResearch.ts`, RippleEffect Scanner, TIDE) — the pattern to reuse for any real cited data.
- **Data:** Drizzle ORM. Runtime deal data in DB; model selection in `model_configs` table (`server/db.ts`). **Ground-truth fixtures:** `server/fixtures/ground-truth-deals.json` — 3 anonymized composite deals (e.g. "Apex Commercial Cleaning," $2.1M — customer concentration + add-back inflation) + a `rigor_gate_test` block. These composites are the sanctioned demo/test deals; keep them labeled composite.
- **Run/build:** pnpm. `pnpm dev` (tsx watch), `pnpm check` (tsc), `pnpm test` (vitest, last known 99/99), `pnpm build`, `pnpm db:push`.

---

## Specs live in `/specs`

Execute against these; they are the source of truth for scope. When a spec conflicts with a prime directive, the prime directive wins.

- **`TSL-BUILD-2026-004` Part A — Fix-It.** ✅ Shipped (commit `6de766d`): testimonials removed, Market Scan demoted to Labs, IC persona labels verified. A-3 rigor-gate hardening still open.
- **`TSL-BUILD-2026-006` — Bulletproof Solo Walkthrough.** 🟡 `/walkthrough` shipped; needs the hardening pass against the "must-not-happen" acceptance list.
- **`TSL-BUILD-2026-007` — Wingate Bespoke Demo Rails.** ⬜ Personalized instance of 006 on a real deal in the prospect's thesis, via live-run-then-bake. Needs operator inputs (thesis, deal, captured run).
- **`TSL-BUILD-2026-005` — Deep Research Data Layer.** 🟡 WP-DR1–5 shipped (research schema, Radar on sonar-pro with citations, Deal Dossier module). Remainder: deep-research-as-diligence-enrichment.

---

## CURRENT PRIORITY QUEUE (reconcile with live code first)

1. ✅ **Memos "Generation failed" fix** — shipped `1fed7ce`: model policy enforced, stale DB config coerced, failures no longer persisted/cached. Remaining: verify failed cards regenerate in the deployed app.
2. ✅ **Rigor gate hardening** (004 A-3) — shipped: GT-001/002/003 run cold through production Red Team, raw output in `server/fixtures/ground-truth-deals.json` → `rigor_gate_test.results`; runner at `scripts/rigor-gate-cold.ts`. All 3 passed; gaps documented honestly (contract-term extraction still the flagged enhancement).
3. **006 walkthrough hardening** — drive `/walkthrough` end-to-end against the acceptance list: zero API calls, no login walls, no dead ends, no unexplained buttons.
4. **007 / 005 remainder** — when their inputs / phase are ready.

## ⚠️ Local environment hazards

- **`.env` points at the PRODUCTION TiDB database.** `server/_core/index.ts` and `sprint8.test.ts` import `dotenv/config`, so `pnpm test` WILL write test data into prod (this caused the Sprint 45 cleanup). **Always run tests as `DATABASE_URL= pnpm test`** (empty override wins — dotenv does not overwrite existing vars). Same caution for `pnpm dev` mutations.
- Node ≥22 required; default shell resolves Node 18. Prefix: `export PATH="/opt/homebrew/opt/node@26/bin:/opt/homebrew/bin:$PATH"`.

---

## Working agreement

- **Verify current state before editing** — this file's line-level details may lag the code; inspect, then act.
- Make focused commits with clear messages; push to `origin/main` (GitHub is the sync point with Manus).
- After any change to a demo surface, re-check: zero API calls, no login walls, no unexplained buttons, no fabricated data.
- When uncertain about scope, the `/specs` doc wins; when a spec conflicts with a prime directive, the prime directive wins.

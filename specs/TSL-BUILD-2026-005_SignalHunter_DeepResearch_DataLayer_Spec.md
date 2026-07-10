# TSL-BUILD-2026-005 — Signal Hunter: Deep Research Data Layer (Phase 2)
**Target agent:** Manus | **App:** Signal Hunter OS (`million-hunter-dashboard`)
**Phase:** 2 — build AFTER the TSL-BUILD-2026-004 Part A fixes ship. Do NOT bundle with the ship-now fixes.

---

## 0. Context & Prime Directive

The "AI-synthesized/plausible-but-fictional" data in Market Scan and Opportunity Radar was the reason those modules had to be hidden. This spec **kills that problem at the root** by replacing synthesized data with **real, cited, timestamped** data from deep-research models — and redirects the same capability toward the higher-value target: the diligence engine.

**Prime directive:** Every datum this layer produces is **real, source-cited, and timestamped — or it does not render.** No synthesized data, no plausible-fiction, no hardcoded fallback. Ever again. The citations are the product; provenance is the trust signal.

**Sequencing guard:** TSL-BUILD-2026-004 Part A (demote Radar/Market Scan, kill the "Live" badge) still ships **first and immediately.** This Phase-2 build is what brings a module *back* — as a real feature — once it's cited and cached. Do not let this delay the ship-now fixes.

---

## 1. Global Rules

1. **No synthesized or fabricated data.** Every result carries `citations[]` (source URLs) + `retrieved_at` timestamp. If research returns nothing, the UI says "researching — check back," not a fabricated card.
2. **Never live-per-click.** Deep research is slow (30s–several min) and token-heavy. A user never waits on it and never triggers cost on a tab tap. All research is **scheduled and cached**; the UI reads from cache; a cache miss enqueues a background job, it does not block the user with a multi-minute spinner.
3. **Provenance visible in UI.** Every card/finding shows its source link(s) and an "as of [date]" stamp.
4. **Cost-capped.** Per-thesis / per-target research budgets, dedupe, TTL, batched scheduling, and a hard monthly spend cap with a kill-switch.

---

## 2. WP-DR1 — Deep Research Service (shared infrastructure)

Build one service all the features call. Do **not** reinvent — extend the patterns already working in the repo.

- **Engine:** Perplexity's deep-research tier (confirm the current model string against the live integration — do not hardcode a stale name). Build on the existing Sonar integration already used by **RippleEffect Scanner** and **TIDE Intelligence** (`SONAR_API_KEY` is already set). Provider-flexible: structure so the research engine can be swapped.
- **Interface:** input = a structured research brief `{ subject_type, subject, geography?, question_template, query_version }`; output = structured JSON `{ findings[], citations[], retrieved_at, model, confidence }`.
- **Cache table (Drizzle):** `research_results` keyed by `(subject_type, subject_hash, query_version)` with columns: `payload` (jsonb), `citations` (jsonb), `retrieved_at`, `expires_at`, `model`, `cost_tokens`. Reuse the RippleEffect 24h-cache pattern as the template; make TTL configurable per `subject_type`.
- **Job runner:** scheduled refresh (Cloud Run job / cron) + on-demand enqueue. Rate-limited, deduped, budget-aware.
- **Acceptance:** a research brief in → cited structured result cached out; second identical call served from cache with zero new API spend; cache miss enqueues a job, returns "researching" state.

---

## 3. WP-DR2 — Opportunity Radar, Made Real

Route Radar through WP-DR1 (or directly extend the RippleEffect path it most resembles).

- **Real local signals only:** permits, development plays, TAD/infrastructure announcements, ownership-transition and distress signals — researched **per geography / per active thesis on a cadence**, served from cache.
- **Every signal card:** claim + source link(s) + `retrieved_at` + confidence. No card without a citation.
- **Delete the hardcoded fallback** (the 6 Atlanta seed cards). Empty cache → "researching this market — check back," never fiction.
- **Nav restoration:** once Radar is real + cited + cached, it may return from "Labs" to primary nav. This is the *only* sanctioned reversal of 004 Part A-2, and only after this WP lands and is verified.
- **Acceptance:** every Radar card has a working source link and timestamp; no hardcoded data remains; empty-state is honest.

---

## 4. WP-DR3 — Market Scan: Reposition or Cut (decision required)

**Real-talk for the build:** deep research *can* make Market Scan return real listings — but it would re-list public marketplaces (BizBuySell, Axial-public, broker sites). That's a commodity aggregator: honest, but undifferentiated, and a slower version of free tools. **Do not invest heavily here.**

Two acceptable outcomes — **default is (a):**
- **(a) Park/cut** Market Scan from the active roadmap surface. Redirect the deep-research capability to WP-DR4, where it actually differentiates.
- **(b)** Keep only as a thin, honestly-labeled **"Public Listings Sweep"** inside Labs — cited, timestamped, no "Live" claim, low priority — if there's a specific reason to retain it.

- **Acceptance:** Market Scan is either parked or relabeled as a cited Labs-only sweep; it makes no "Live"/proprietary-flow claim under any circumstance.

---

## 5. WP-DR4 — Deep Research as Diligence Enrichment (THE PRIZE)

The highest-leverage use of this capability. Point deep research at a **specific target deal**, not at sourcing. This lands on the diligence wedge and is genuinely differentiated.

- **Per-target research dossier**, cached per deal: market position, customer sentiment/review signals, litigation & regulatory exposure, the owner's other ventures/affiliations, local competitive dynamics, key-customer health/visible risk.
- **Trigger:** when a deal enters the Deal Room or before a diligence run — enqueue the dossier job; cache per target; show "researching" until ready.
- **Wire into diligence:** the dossier flows into **Red Team** and **IC Review** inputs as **cited evidence**, so findings reference real, sourced facts (e.g., "3 recent 1-star reviews citing staff turnover [link]") rather than only the deal's own numbers.
- **Positioning:** "Run deep background on this target before you wire funds" — a headline diligence feature, every finding cited.
- **Acceptance:** entering a deal produces a cached, cited dossier; at least one dossier field demonstrably feeds a Red Team / IC finding with its citation intact.

---

## 6. WP-DR5 — Investor-Brief Reuse

Cached, real, cited results from DR2/DR4 become honest data behind the TSL-BUILD-2026-004 Part B investor-brief simulators — replacing composite-only data where real cited data exists, still labeled appropriately ("Interactive Demo — real cited data, sample target"). One caching layer, three payoffs (real features, honest demos, lower cost).

---

## 7. Out of Scope / Do Not

- Do NOT make any deep-research call live-per-click / blocking the user.
- Do NOT ship any synthesized or hardcoded fallback data — empty state is honest, not fictional.
- Do NOT delay or alter the 004 Part A ship-now fixes; this is strictly after.
- Do NOT route provider keys through client code (existing doctrine).
- Do NOT over-invest in Market Scan (WP-DR3 default is park/cut).

---

## 8. Sequencing

1. **WP-DR1** (shared service + cache + job runner) — foundation, build first.
2. **WP-DR4** (diligence enrichment) — the priority feature; build before reviving Radar if forced to choose.
3. **WP-DR2** (Radar real) — then restore to nav.
4. **WP-DR3** (Market Scan decision) — park/cut by default.
5. **WP-DR5** (brief reuse) — last, ties into 004 Part B.

---

## 9. Report Back With

- The `research_results` cache schema + a sample **cited** result (with source links + timestamp).
- Confirmation that no module makes a blocking live-per-click research call (architecture note).
- Confirmation that all synthesized/hardcoded fallback data is removed.
- The cost controls in place (per-subject budget, TTL, monthly cap, kill-switch).
- Which modules now read from cache, and Radar's nav status.
- Anything you couldn't source with real citations — flagged, not faked.

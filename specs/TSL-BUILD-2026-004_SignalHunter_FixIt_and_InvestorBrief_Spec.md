# TSL-BUILD-2026-004 — Signal Hunter: Fix-It + Investor Brief Page
**Target agent:** Manus | **App:** Signal Hunter OS (`million-hunter-dashboard`)
**Two tracks. Part A ships first and independently. Part B is the new build.**

---

# PART A — FIX-IT (urgent, do first)

These are ship-blockers from the post-build review. The product must not go in front of an external searcher, investor, or Jim until A-1 and A-2 are done.

## A-1 — Remove the fabricated testimonials (SHIP-BLOCKER)
`client/src/pages/LandingPage.tsx` contains three first-person customer quotes (~lines 75, 81, 87) — e.g. "Saved me from a $2.1M mistake," "flagged 54% customer concentration." These are **not real customers**, and the numbers are lifted from the GT-001 composite test deal. Presenting synthetic fixture data as customer endorsements is a credibility *and* FTC fabricated-endorsement problem.

- **Default action: delete all three.** A page with no testimonials beats a page with fake ones for this audience.
- If illustrative examples are wanted instead, they must be explicitly labeled: **"Illustrative scenario — composite deal, not a real customer,"** with no invented names, companies, or attributions.
- **Acceptance:** zero unlabeled first-person endorsements anywhere on any public route.

## A-2 — Demote Market Scan + Opportunity Radar; kill the "Live" badge (SHIP-BLOCKER)
Both modules are still in primary nav (`client/src/components/DashboardLayout.tsx` lines ~40, 53; `EditorialTopNav.tsx` lines ~47, 56), and Market Scan carries a **"Live"** badge. Per the audit these run LLM-synthesized data, not live feeds. The "Live" badge is the exact network-tab trap that breaks trust.

- Move both into a clearly-labeled **"Labs (Experimental)"** nav group, gated behind an internal flag.
- **Remove the "Live" badge.** If any label remains, it reads "Experimental — not live data."
- **Acceptance:** neither module appears in primary nav; no "Live" badge anywhere on synthesized-data modules.

## A-3 — Harden the rigor gate (do before any "catch the landmine" claim ships)
`server/fixtures/ground-truth-deals.json` ran the gate on GT-001 only — the easy failure mode (concentration/owner-dependence). The fixture's own honest note says contract-cliff risk was caught *only after prompting.*

- Run the gate **cold (no prompting)** on **GT-003 (contract cliff)** and **GT-002 (fake growth)**.
- Append the **raw Red Team output** for each — not a prose summary — to `rigor_gate_test` as an array of results.
- If GT-003's cliff is missed without prompting, **document it honestly** and flag a red-team prompt enhancement. Then scope every public "catch the landmine" claim to the failure modes it reliably catches cold.
- **Acceptance:** ≥3 gate results with raw output; any miss documented, not hidden.

## A-4 — Verify IC Consensus labeling (quick check)
Backend runs three Gemini models for consensus (`server/agents/index.ts`). That's fine **only if** the UI no longer badges it as Claude + Gemini + Sonar. Persona labels ("The Structuralist," etc.) are an acceptable honest relabel.
- **Acceptance:** the IC Review UI makes no multi-vendor model claim it doesn't fulfill.

> **Note:** WP5 (Searcher Intelligence DB + gated free run) was not built. It is **not** part of this fix-it — it's a separate build. Part B references it as the strategic asset/roadmap; build it as its own track afterward.

---

# PART B — INVESTOR BRIEF: SCROLLYTELLING PITCH PAGE (new build)

## Purpose & audience
A standalone, beautiful, scroll-driven investor brief for Signal Hunter OS, suitable for the **FIS investable-assets catalog**. It walks the product top-to-bottom like a pitch deck, and **demonstrates each feature inline with a working micro-simulator** so the value is shown, not described. It doubles as (1) a capability checklist for the catalog, and (2) a gateway to the live app.

**Audience is investors, not searchers.** Investors aren't buying the tool — they're evaluating the *asset*. Lead with moat, market, model, and defensibility. Features are the wedge; the data asset is the investment.

- **Separate route:** `/brief` (or `/investor`). Does NOT replace the searcher landing page.
- Access: public-readable brief + a clear **"Log in to run the live flow"** CTA so Jim can demo the real product.

## NON-NEGOTIABLE honesty guardrails (investor context — securities-grade)
- **Zero fabricated anything.** No invented traction, revenue, user counts, logos, or testimonials.
- Anything forward-looking is labeled **"Projection"** or **"Roadmap."**
- Every inline simulator is labeled **"Interactive Demo — sample composite deal,"** never implying live production usage.
- The composite deals stay labeled composite.
- The Searcher Intelligence DB is presented as the **strategic asset / roadmap** (it is not yet built) — never as existing traction.
- If a number isn't real and verifiable, it does not appear unlabeled.

## The inline simulators — hard technical spec
This is the centerpiece and the risk. Each simulator MUST be:
- **Deterministic and cached.** Pre-baked fixtures (reuse the GT composite deals). **Zero live API calls. Zero token cost. Cannot fail in front of an investor.** Same discipline as the WP2 demo.
- **Self-contained and inline** — it runs in the scroll section, no navigation away.
- **Paced to reveal** — show the work happening (the IC models weighing in, the Red Team surfacing concerns one by one), not a spinner→verdict. Visible reasoning is the product.
- Labeled as a demo on a sample deal.

## Scroll narrative (top to bottom)
Each product section follows the same rhythm: **What it is → Why it matters (the loss it prevents) → [inline simulator] → checklist tick.**

1. **Hook** — one investor sentence: the category and the claim. ("Signal Hunter OS is the diligence-and-decision layer for the $X trillion small-business acquisition wave.")
2. **Problem / Why now** — the ETA/search-fund boom, the retiring-owner "silver tsunami," the diligence gap, the loss searchers eat on deals that looked clean. Market context, sized honestly (cite real, sourced figures or label as estimate).
3. **Product walkthrough** — feature by feature, each with its inline simulator:
   - **Thesis Engine** — structure a buy-box; sim shows criteria compiled from an input.
   - **IC Review / Consensus** — committee-style scoring with divergence; sim shows a composite deal scored, models disagreeing.
   - **Red Team — Always On** — the wow. Sim runs a composite deal and surfaces the landmines (concentration, owner-dependence, contract cliff) one by one. This is the section that sells.
   - **Owner / Seller Sim** — negotiation read; sim shows the seller persona + leverage points.
   - **Capital Stack** — sim shows a structured stack for the sample deal.
   - **Memo + LOI** — sim shows generated memo/LOI excerpt (labeled sample).
4. **The moat — Searcher Intelligence DB** (Roadmap-labeled) — the demand graph: every diligence run captures a searcher's live thesis, compounding into a proprietary demand-side dataset no competitor holds. Frame as the defensible asset and the path to a data/matching business. Clearly labeled as the build-ahead asset.
5. **Business model** — wedge (free gated run) → conversion → the data asset. How it compounds. Projections labeled.
6. **Validation / why it's real** — the rigor gate as the costly, falsifiable signal: the engine was tested against documented failed deals using only pre-close data. Show the (real) gate results from Part A-3. This is the credibility centerpiece for an investor — falsifiable proof the core works.
7. **The ask / next step** — what the catalog needs + **"Log in to run the live flow."**

## Checklist function (the FIS catalog dual-use)
- A **persistent progress rail** (sticky side nav) lists the capability sections and checks them off as the investor scrolls — doubling as the catalog capability checklist.
- End the page with a **summary capability matrix**: Capability | What it does | Status (Live / Demo / Roadmap) — honest status per row. This is the scannable checklist Jim hands to the catalog.

## Design direction
- **Use the existing Signal Hunter design system** — the `--sh-*` CSS tokens already in `client/src/index.css` (hardened in the latest commit: `--sh-surface`, `--sh-surface-2/3`, `--sh-border-1`, `--sh-signal`, `--sh-primary`, `--sh-primary-fg`, `--sh-fg-muted`, `--sh-red`, `--sh-text-primary/secondary`, `--sh-bg`). Do NOT invent a new visual language — extend the app's, so the brief and the product feel like one asset.
- Investor-grade polish: generous whitespace, restrained motion, the scroll-driven sticky-panel pattern (narrative scrolls, visual/simulator panel pins and updates). Smooth, deliberate, premium — not flashy.
- Fully responsive; the simulators must work on a laptop in a meeting and on mobile.

## Acceptance criteria (Part B)
- Lives at `/brief` (or `/investor`), separate from the searcher homepage.
- Every feature section has a working, **zero-API, deterministic** inline simulator labeled as a demo.
- No fabricated traction/metrics/testimonials/logos anywhere; all forward-looking items labeled Projection/Roadmap; Searcher DB labeled Roadmap.
- Persistent checklist rail + end-of-page status matrix with honest Live/Demo/Roadmap labels.
- "Log in to run the live flow" CTA routes to the real app.
- Built on the existing `--sh-*` design tokens.

## Report back with
- The `/brief` URL.
- Confirmation that every simulator makes **zero API calls** (network tab).
- The end-of-page capability matrix with its honest status labels.
- Any item you couldn't make deterministic — flagged, not faked.

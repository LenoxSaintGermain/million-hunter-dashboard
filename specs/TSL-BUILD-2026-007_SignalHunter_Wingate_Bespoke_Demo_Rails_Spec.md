# TSL-BUILD-2026-007 — Signal Hunter: Wingate Bespoke Demo Rails
**Target agent:** Manus | **App:** Signal Hunter OS (`million-hunter-dashboard`)
**Builds on:** TSL-BUILD-2026-006 (bulletproof solo walkthrough) — this is a *bespoke instance* of that engine, personalized to one prospect.
**Depends on:** 004 Part A (fixes) → 006 (generic walkthrough) ship first. This is the personalized layer on top.

---

## 0. Context & Prime Directive

A generic composite-deal walkthrough proves the tool works. A walkthrough running on a **real deal in the prospect's own thesis** proves it works *in their world* — which is what closes. This spec builds a personalized rail for the Wingate attorney (family-office / PE real-estate buyer), running on a real matching deal, frozen so it's bulletproof.

**Prime directive:** The prospect watches the engine analyze a **real deal that matches their own thesis** and surface an insight *their own team would have missed* — and it can never break, because the real run is pre-captured and replayed deterministically.

**The trap to avoid:** Do NOT build this as a "find listings" property search. That demos the tool on its weakest terrain (on-market data everyone already sees) and amplifies the data-source objection. The star of every bespoke rail is the **off-market / broker-blind-spot insight**, not the listing.

---

## 1. Inputs Required (from operator, before build)

This spec is a template. It cannot be built until the operator supplies:

1. **The confirmed Wingate thesis** (geography, deal-size range, real-estate-only vs. business-inclusive) — to be added to the system as a selectable thesis / Investor-DNA profile.
2. **The selected real deal** — a real, publicly-listed deal matching the thesis, chosen specifically because the tool surfaces a **non-obvious off-market/risk signal** on it (e.g., anchor-tenant lease-cliff, zoning/permit trajectory, area-development exposure, owner-transition signal). Not a vanilla listing.
3. **The captured live run output** — the operator runs the tool live on that deal once and captures the real findings (see §2). Manus bakes this in; Manus does not fabricate findings.

If any input is missing, Manus builds the shell and flags the placeholders — it does not invent deal data.

---

## 2. Core Mechanism — LIVE-RUN-THEN-BAKE (reconciles "real" with "bulletproof")

1. **Operator runs the tool live** on the selected real deal, producing genuine output: thesis-fit score, IC review, Red Team findings, the off-market signal, capital/structure notes.
2. **Capture that real output** as a fixture (JSON) — real findings, real citations/sources, timestamped.
3. **Manus bakes the fixture into deterministic cached rails.** The bespoke walkthrough replays the *real* run step by step. **Zero live API calls at demo time** — it cannot fail or cost tokens, exactly like 006.

Result: a real deal, with real findings, in the prospect's thesis — served as an unbreakable replay.

---

## 3. The Bespoke Rail Structure (personalized 006 arc)

Same bulletproof, self-narrating, on-rails engine as 006, personalized:

1. **"Built for your thesis."** Open by naming their buy-box back to them: "[Wingate thesis in plain language] — value-add historic commercial real estate where the real risk is what the broker won't tell you." Immediate relevance.
2. **The real deal.** "Here's a real deal on the market right now that fits your thesis: [deal]." Show the listing basics (public, fine).
3. **THE GET-IT MOMENT — the blind-spot catch.** Replay the engine surfacing the **off-market/risk insight their team combing CoStar would miss** — the star of the demo. "Your team sees the listing. Here's what the engine caught that the broker didn't disclose: [real finding]." This is the section that closes.
4. **The full teardown.** Replay Thesis-fit → IC Review → Red Team → structure notes on the real deal. Each self-narrating, on the real findings.
5. **Why you can trust it — the backtest.** Keep the Acquiring Minds credibility section: "and here's proof it catches what actually kills deals" — historical validation alongside the live relevance.
6. **The value.** Family-office framing: surface-not-dig, and know before you spend $40–50K on QoE.
7. **Get the real thing.** Single optional CTA to log into the live app — where their Wingate thesis is already loaded as their profile. Door, not wall.

---

## 4. Thesis-in-system requirement

Add the confirmed Wingate thesis as a **real, selectable thesis / Investor-DNA profile** in the system — not just demo copy. So (a) the bespoke rail reflects a real profile, and (b) if the attorney logs into the live app, their thesis is already there and the experience is continuous.

---

## 5. Honesty & privacy guardrails
- **Real on-market listing = fine** (public information).
- **Anonymize any off-market signal about a real, identifiable person or business.** If the engine surfaces "owner posted about selling in a Facebook group," do not expose a real identifiable individual in a demo — anonymize or use a representative example. Same discipline as the Acquiring Minds post-mortem anonymization.
- Findings shown are the **real captured run** — never fabricated. If a finding can't be sourced, it doesn't appear.
- The backtest section stays labeled (composite/anonymized).

## 6. Bulletproof carry-over (all 006 criteria apply)
- Public, no auth, no dead-ends; the only login is the single optional end CTA.
- **Zero live API calls at demo time** (network-tab verified) — the replay cannot fail or cost tokens.
- No role/token gate blocks any step.
- Every element self-explains; persistent progress indicator; mobile + laptop flawless.
- Uses the existing `--sh-*` design system.

## 7. Acceptance Criteria
- [ ] Bespoke rail runs on a **real deal matching the confirmed Wingate thesis**, with **real captured findings** (not fabricated).
- [ ] The centerpiece is an **off-market/blind-spot insight**, not a listing search.
- [ ] **Zero live API calls** across the full rail (network tab).
- [ ] The Wingate thesis exists as a real selectable profile in the system.
- [ ] All 006 "must-not-happen" criteria pass (no login walls, no role/token gates, everything self-explains).
- [ ] Any off-market signal about a real identifiable entity is anonymized.

## 8. Report back with
- The bespoke rail URL.
- The captured-run fixture used (confirming findings are real, not generated).
- Network-tab confirmation of zero API calls at demo time.
- Confirmation the Wingate thesis is a real system profile.
- Any placeholder left pending operator inputs — flagged, not faked.

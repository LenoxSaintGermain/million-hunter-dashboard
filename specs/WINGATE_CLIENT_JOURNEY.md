# Wingate Client Journey Map — first login → search → analyze → act

**Purpose:** a shareable link a Wingate principal (e.g. Chad Wingate, role `investor`) can open cold and get an elevated, thesis-correct experience with no operator hand-holding.

**Validated 2026-07-26 against `9caf398`.** Status legend: ✅ works · ⚠️ partial · ❌ broken/missing.

---

## The journey (target)

| # | Stage | What the client does | What the app must do | Status before this build |
|---|---|---|---|---|
| 1 | **Arrive** | Opens the shared link, signs in with Google | Recognize role `investor`, route to *their thesis*, not a generic portal | ❌ routes to generic `/investor` deal room |
| 2 | **Declare thesis** | "I acquire historic adaptive-reuse buildings" | Ask **which asset class** first (from the registry), persist it | ❌ quiz never asks; no field exists |
| 3 | **Calibrate** | Answers a short intake | Capture risk/horizon **in the context of that thesis** | ⚠️ quiz is generic (time horizon/ESG/sectors) |
| 4 | **Land** | Sees their command surface | Ranked assets **for their asset class**, scored by the right model | ❌ lands in a room of HVAC businesses |
| 5 | **Search** | Filters/searches the pipeline | Class-aware search + filters | ⚠️ exists on `/wingate`, unreachable for investors |
| 6 | **Analyze** | Opens an asset | Full A–G dossier: dimensions, gates, confidence, VERIFY, risks | ⚠️ exists, unreachable for investors |
| 7 | **Act** | Registers interest / next step | Express interest, request info, or promote | ⚠️ operator-only actions today |

---

## Root causes found (validation)

1. **`OnboardingGuard`** (`client/src/App.tsx`) sends `role === "investor"` → `/investor`, and if the DNA quiz is incomplete → `/investor/onboarding`. Neither path knows about asset classes.
2. **`InvestorOnboarding.tsx`** is a 5-step generic quiz ("Calibrate Your Diligence Lens": time horizon, risk, liquidity, ESG, sectors). Nothing about historic buildings, HTC, or adaptive reuse.
3. **`investor_dna` table** has no asset-class/thesis column — the preference has nowhere to live.
4. **`DealRoom`** (`/investor`) reads `trpc.deals.list` (business-for-sale deals), ranked by generic DNA match — the wrong dataset for a real-estate thesis.
5. **`InvestorLayout` nav** has no Wingate entry, so `/wingate` is unreachable inside the investor shell. Wingate was only added to the *operator* nav (`EditorialTopNav`).

**Net effect if shared today:** Chad answers an irrelevant quiz, then lands in a list of HVAC and cleaning companies. The historic engine we built is invisible to him.

---

## What this build changes

- **Thesis-first intake.** A new step 1 asks *"What are you here to acquire?"*, generated from `shared/assetClasses.ts` — so **every future asset class appears automatically**, no code edits (the adaptive requirement).
- **Persisted preference.** `investor_dna.asset_class` (migration 0022) stores it; `investor.saveDna` accepts it; `getDnaStatus` returns it.
- **Thesis-correct landing.** After intake, the client is routed to `/wingate?class=<their class>` — their ranked, scored pipeline — instead of the generic deal room.
- **Reachable in the investor shell.** "My Thesis" nav entry in `InvestorLayout`, pointing at their class.
- **Elevated first impression.** The command page greets a first-time client with their thesis name and criteria rather than an empty grid.

---

## Acceptance criteria (end-to-end) — validated 2026-07-26

- [x] A fresh `investor` user is asked which asset class they acquire, before any risk questions.
- [x] The class list is generated from the registry (adding a class in `assetClasses.ts` makes it appear with no page edits).
- [x] The choice persists to `investor_dna.asset_class` and survives reload. *(verified over HTTP: saveDna → getDnaStatus returns `assetClass`)*
- [x] After intake the client lands on their thesis command page with assets **of that class only**, ranked by the correct scorer. *(verified: `scout.search` isolates by class)*
- [x] The investor nav exposes the thesis surface ("My Thesis", first entry); the client never has to type a URL.
- [x] Search, filter, and the full A–G dossier are reachable from that page without operator tools. *(`/wingate` renders the investor shell for investor role; operator-only actions hidden)*
- [x] No fabricated data anywhere on the client-visible path. *(`scout.researchAssets` sources real, cited listings; conservative scoring + VERIFY on anything unstated)*

## Known state / operator prerequisite before sharing

The pipeline was emptied during the Jul 26 UAT session (`commercial_assets` = 0). A client landing on an empty grid is a poor first impression, so **before sharing the link an operator should populate the pipeline**: open `/wingate` → **Source real** (sonar-pro research), and/or add known targets manually, then **Run & Save** to score them.

Expect sourced assets to arrive **low-confidence / archive tier**: public listings rarely publish year-built verification, FAR, lot coverage, or incentive status. That is the system working as designed — it refuses to inflate confidence it hasn't earned. Raise a candidate by filling the VERIFY fields (intake or Scout) and re-running the score.

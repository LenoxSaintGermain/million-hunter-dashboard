# Deal Room vs. Wingate Spec — Gap Analysis Report

**Prepared for:** Lenox Saint Germain  
**Date:** July 26, 2026  
**Classification:** Internal QA / Product Roadmap  
**Scope:** `InvestorDealDetail.tsx` (investor Deal Room) vs. `server/scoring/historicScore.ts` (Wingate A–G Spec)

---

## Executive Summary

The current investor Deal Room (`/investor/deal/:id`) was built for a **generic business acquisition thesis** — revenue, cash flow, asking price, EBITDA, and owner psychology. The Wingate Historic Adaptive Reuse thesis operates on a fundamentally different underwriting logic: **seven scoring dimensions (A–G, 100 pts), five mandatory critical fields, hard stops, penalties, and alpha bonuses** that have no representation in the current Deal Room UI whatsoever.

The result is a **structural mismatch**: an investor looking at a Wingate-qualified historic asset in the Deal Room sees a generic business card with an AI score and an investment memo. They cannot see the 7-dimension scorecard, the confidence score, the VERIFY flags on unverified critical fields, the incentive stack breakdown (HTC, OZ, NMTC, TIF), the development envelope analysis, the hard stop status, or the disposition code. The Deal Room is not just incomplete for Wingate — it actively obscures the thesis-specific signals that determine whether a deal is Tier 1, Tier 2, or archived.

The gap is **not cosmetic**. It affects investment decision quality. A Tier 1 asset with a 0.82 AI score and an unverified prior HTC syndication check (which would be a hard stop) looks identical to a clean Tier 1 asset in the current Deal Room. That is a capital risk.

---

## 1. What the Deal Room Currently Shows

The Deal Room renders three tabs for every deal, regardless of asset type:

| Tab | Sections Rendered |
|---|---|
| **Overview** | Business name, stage badge, industry tag, OZ badge, AI score (0–1), Revenue / Cash Flow / Asking Price / Multiple KPIs, Business description, Year est. / Employees / EBITDA / Source / OZ Tract / OZ Gain, Red flags (from `signal.redFlags`) |
| **Investment Memo** | Full memo markdown if generated; empty state if not |
| **Third Signals** | Owner Psychology + Distress Score, Digital Audit, Capital Stack (SBA / Seller Note / Equity), Red Team Analysis + Kill Probability |

Every field in the Overview tab maps to the **generic `deals` table** (`revenue`, `cashFlow`, `askingPrice`, `multiple`, `ebitda`, `yearEstablished`, `employees`). None of the Wingate-specific columns from `commercial_assets` (`yearBuilt`, `stories`, `isHistoric`, `historicRegisterEligible`, `isStabilized`, `occupancyRate`, `capRate`, `hasAirRights`, `lotSqFt`, `higherAndBetterUseNotes`, `historicInputs`) are fetched or displayed.

The `deals.getById` procedure returns `{ deal, signal, memo, contacts }`. It does not return a historic scorecard, `HistoricInputs`, a `HistoricScore` object, or any Wingate-specific data payload.

---

## 2. What the Wingate Spec Requires

The Wingate A–G scoring engine (`historicScore.ts`) defines the complete underwriting surface for a historic adaptive reuse asset. The following table maps each spec requirement to its current Deal Room status.

### 2.1 Hard Stops (§5 Stage 1)

Hard stops are binary disqualifiers. If any fires, the asset is **archived immediately** regardless of score. The Deal Room shows no hard stop panel.

| Hard Stop Condition | Deal Room Status |
|---|---|
| Built after 1945 (not historic-eligible vintage) | **Missing** — `yearBuilt` not shown |
| More than 4 stories above grade | **Missing** — `stories` not shown |
| Prior HTC syndication — arbitrage already captured | **Missing** — `priorHtcSyndicated` not shown |
| No tripling path (FAR / coverage / vertical all fail) | **Missing** — `triplingPathExists` not shown |

**Risk:** An asset with a prior HTC syndication hard stop would display a normal AI score in the current Deal Room. An investor would see no indication the deal is disqualified.

---

### 2.2 Five Mandatory Critical Fields (§11)

These are the fields that drive the **confidence score** (0–1). Unverified fields raise `VERIFY` flags and prevent Tier 1 assignment. The Deal Room shows none of them.

| Critical Field | Spec Requirement | Deal Room Status |
|---|---|---|
| Year Built (pre-1945, 2-source) | `yearBuilt` verified via Sanborn / city directory | **Missing** — not displayed |
| GSF & parcel boundaries | `squareFootage` + `lotSqFt` confirmed | **Missing** — not displayed |
| Ownership entity & title | `ownershipVerified` = true | **Missing** — not displayed |
| NRHP / district status | `isHistoric` or `historicRegisterEligible` or `registerStatus` ≠ unresearched | **Missing** — not displayed |
| Prior HTC syndication check | `priorHtcChecked` = true | **Missing** — not displayed |

**Risk:** The confidence score and rank score (`composite × (0.5 + 0.5 × confidence)`) are the primary Tier 1 gatekeepers. An asset with 0/5 critical fields verified has a confidence score of 0.0 and a rank score of 50% of its composite — it cannot reach Tier 1. This is invisible to the investor in the current Deal Room.

---

### 2.3 Dimension A — Historic Qualification (max 20 pts, gated)

Dimension A must score ≥ 12 for Tier 1 eligibility. It is the primary qualification gate.

| Factor | Max Pts | Deal Room Status |
|---|---|---|
| Vintage (1880–1930 prime, 1931–1945 standard) | 4 | **Missing** |
| Register status (listed / contributing / eligible / endangered) | 6 | **Missing** |
| Integrity grade (high / moderate / compromised) | 5 | **Missing** |
| Significance hook (cited / plausible / none) | 5 | **Missing** |
| **Dimension A total** | **20** | **0/20 shown** |

The OZ badge in the current Deal Room header is the only incentive-adjacent signal displayed — and it belongs to Dimension C, not A.

---

### 2.4 Dimension B — Development Envelope & Parking (max 20 pts, gated)

Dimension B must also score ≥ 12 for Tier 1. It captures the physical optionality of the asset — the "tripling path."

| Factor | Max Pts | Deal Room Status |
|---|---|---|
| FAR utilization (≤0.33 = 6 pts, ≤0.5 = 3 pts) | 6 | **Missing** |
| Lot coverage (derived from GSF / stories / lot) | 5 | **Missing** |
| Vertical addition support | 4 | **Missing** |
| Floor plate depth (≤70ft = 3 pts) | 3 | **Missing** |
| Zoning height headroom (≥2 stories = 2 pts) | 2 | **Missing** |
| **Dimension B total** | **20** | **0/20 shown** |

The air rights flag (`hasAirRights`) is stored in the DB and shown on Scout cards, but it does not appear in the Deal Room.

---

### 2.5 Dimension C — Incentive Stack (max 15 pts)

This is the financial engineering layer — the combination of federal HTC (20%), state HTC, OZ, NMTC, TIF, and abatements that makes the Wingate thesis viable.

| Factor | Max Pts | Deal Room Status |
|---|---|---|
| State HTC rate and transferability | 3 | **Missing** — state HTC not shown |
| State HTC certainty (as-of-right vs. competitive) | 2 | **Missing** |
| Opportunity Zone | 3 | **Partial** — OZ badge shown in header, but no pts context |
| Tax abatement / freeze available | 3 | **Missing** |
| NMTC tract eligible | 2 | **Missing** |
| TIF / development district active | 2 | **Missing** |
| **Dimension C total** | **15** | **~1/15 shown** |

The OZ badge is the only incentive signal currently visible. The state HTC rate — which varies from 0% (TX, FL) to 25% transferable (IL, OH, MO) — is entirely absent. For the Wingate corridor states, this is the single most important financial variable after the federal 20% credit.

---

### 2.6 Dimension D — Market Fundamentals & Forward Supply (max 15 pts)

| Factor | Max Pts | Deal Room Status |
|---|---|---|
| Submarket vacancy (< 6% = 4 pts) | 4 | **Missing** |
| Rent growth 3-yr CAGR (≥ 4% = 3 pts) | 3 | **Missing** |
| Adaptive-reuse comps within 3 miles | 3 | **Missing** |
| Population growth 5-yr (≥ 3% = 2 pts) | 2 | **Missing** |
| Anchor institution present | 2 | **Missing** |
| SHPO Part 1 processing speed | 1 | **Missing** |
| **Dimension D total** | **15** | **0/15 shown** |

The Deal Room shows the deal's `location` field as a text string. No market-tier context, no vacancy, no rent growth, no comp count is surfaced.

---

### 2.7 Dimension E — Acquisition Basis, Access & Exit (max 15 pts)

| Factor | Max Pts | Deal Room Status |
|---|---|---|
| Basis ratio (ask ÷ GSF ÷ replacement cost; < 0.25 = 5 pts) | 5 | **Missing** — asking price shown but no basis ratio |
| Seller motivation signals (estate / tax-delinquent / DOM>180 / liens) | 4 | **Missing** |
| Off-market / thin competition | 3 | **Missing** |
| Vacant / underutilized (low relocation friction) | 2 | **Partial** — `isStabilized` in DB but not shown |
| Exit liquidity (market tier A = 1 pt) | 1 | **Missing** |
| **Dimension E total** | **15** | **~0/15 shown** |

The asking price is shown in the KPI strip, but without the GSF and replacement cost context, it is meaningless for Wingate underwriting. A $2M ask on a 10,000 SF building in Columbus (replacement cost ~$275/SF = $2.75M) is a 0.73 basis ratio — not a deep-basis deal. The Deal Room cannot communicate this.

---

### 2.8 Dimension F — Entitlement & Political Path (max 10 pts)

| Factor | Max Pts | Deal Room Status |
|---|---|---|
| Residential by-right (byright = 4 pts, CUP = 2 pts) | 4 | **Missing** |
| HPC facilitator (< 30% denial = 3 pts) | 3 | **Missing** |
| Main Street / adaptive reuse ordinance active | 2 | **Missing** |
| Named in downtown plan | 1 | **Missing** |
| **Dimension F total** | **10** | **0/10 shown** |

---

### 2.9 Dimension G — Core Adequacy & Baseline Risk (max 5 pts)

| Factor | Max Pts | Deal Room Status |
|---|---|---|
| Egress & core adequacy | 2 | **Missing** |
| Low-risk prior use (no env REC) | 2 | **Missing** |
| Clean single-entity title | 1 | **Missing** |
| **Dimension G total** | **5** | **0/5 shown** |

---

### 2.10 Penalties (§7)

Penalties reduce the composite score and surface critical risks. None are shown in the Deal Room.

| Penalty Condition | Pts Deducted | Deal Room Status |
|---|---|---|
| Previously adaptively reused / prior HTC syndicated | −15 | **Missing** |
| High-risk prior use (env REC risk) | −10 | **Missing** |
| HPC gatekeeper (> 50% denial rate) | −8 | **Missing** |
| Submarket vacancy > 8% | −8 | **Missing** |
| Estate / heir title tangle | −6 | **Missing** |
| State HTC cap exhausted / near sunset | −6 | **Missing** |
| FEMA Flood Zone AE/VE | −4 | **Missing** |
| URM / seismic exposure | −4 | **Missing** |
| Facade easement restricts vertical addition | −4 | **Missing** |
| Local overlay + vertical addition required | −3 | **Missing** |

The Deal Room's "Red Flags" section (from `signal.redFlags`) is a generic text array generated by the Third Signal agent — it is not the deterministic penalty list from the Wingate scorer. The two are structurally different and should not be conflated.

---

### 2.11 Alpha Bonuses (cap +8)

| Bonus Condition | Pts Added | Deal Room Status |
|---|---|---|
| Double-eligible OZ + NMTC | +3 | **Missing** |
| SHPO / landmarks actively assisting | +3 | **Missing** |
| Corner lot, two exposures | +2 | **Missing** |
| TDR receiving / transferable FAR | +2 | **Missing** |
| Existing freight elevator / reusable cores | +1 | **Missing** |

---

### 2.12 Composite Scores and Tier Assignment

The Wingate scorer produces five outputs that drive the investment decision. None appear in the Deal Room.

| Output | Description | Deal Room Status |
|---|---|---|
| `compositeScore` | Raw sum + bonuses − penalties, clamped 0–100 | **Missing** — only generic AI score (0–1) shown |
| `confidenceScore` | Verified critical fields / 5 | **Missing** |
| `rankScore` | `composite × (0.5 + 0.5 × confidence)` | **Missing** |
| `assetTier` | tier1 / tier2 / tier3 / archive / fasttrack | **Missing** |
| `dispositionCode` | R1–R10 archive reason codes | **Missing** |
| `verifyFields` | List of unverified mandatory-critical fields | **Missing** |
| `hardStopFailed` | Hard stop description if triggered | **Missing** |

---

## 3. Structural Root Cause

The mismatch has two structural causes:

**First**, the `deals.getById` server procedure returns data from the `deals` table, not the `commercial_assets` table. The Wingate scoring engine operates on `commercial_assets`. These are two separate data models. The investor Deal Room has never been connected to the `commercial_assets` schema.

**Second**, the `investorDossier.generate` procedure does produce Wingate-aware analysis (it was updated with the `historic_building` mode), but its output is stored in a separate `dossier` table and is not surfaced in the investor Deal Room. The dossier and the deal room are disconnected.

The Wingate scorecard — computed by `scoreHistoricAsset()` — is called from the Scout page and the Wingate dashboard, but its output is never persisted to the database or returned by any procedure that the investor Deal Room queries.

---

## 4. Gap Summary by Severity

| Category | Fields Missing | Severity | Investment Risk |
|---|---|---|---|
| Hard stops | 4 conditions | **Critical** | Investor may commit to a disqualified asset |
| Critical field verification | 5 VERIFY flags | **Critical** | Tier 1 vs. Tier 2 distinction invisible |
| Dim A — Historic Qualification | 4 factors / 20 pts | **Critical** | Primary gate not visible |
| Dim B — Development Envelope | 5 factors / 20 pts | **Critical** | Tripling path not visible |
| Dim C — Incentive Stack | 5 factors / 15 pts | **High** | HTC arbitrage case not visible |
| Dim E — Acquisition Basis | 5 factors / 15 pts | **High** | Basis ratio not calculable |
| Dim D — Market Fundamentals | 6 factors / 15 pts | **High** | Market tier not visible |
| Dim F — Entitlement | 4 factors / 10 pts | **Medium** | Zoning path not visible |
| Dim G — Core Adequacy | 3 factors / 5 pts | **Medium** | Physical risk not visible |
| Penalties | 10 conditions | **High** | Score-reducing risks not shown |
| Alpha bonuses | 5 conditions | **Low** | Upside signals not shown |
| Composite / Rank / Tier | 7 outputs | **Critical** | Investment tier decision not visible |

---

## 5. Recommended Deal Room Redesign for Wingate Assets

When a deal is linked to a `commercial_asset` with `isHistoric = true` or `historicRegisterEligible = true`, the Deal Room should render a **Wingate-specific layout** in place of the generic business acquisition layout. The recommended tab structure is:

| Tab | Sections |
|---|---|
| **Scorecard** | Composite score (0–100), Rank score, Confidence score, Asset tier badge (Tier 1 / 2 / 3 / Archive / Fast-Track), Hard stop alert (if triggered), Dimension A–G bars with factor-level breakdown, VERIFY flags on unverified critical fields |
| **Incentive Stack** | Federal HTC (20%), State HTC rate + transferability + certainty, OZ status, NMTC tract, TIF district, Tax abatement, Double-eligible bonus |
| **Development Envelope** | FAR utilization, Lot coverage, Vertical addition support, Floor plate depth, Zoning headroom, Air rights flag, Tripling path status |
| **Acquisition Basis** | Asking price, GSF, Basis ratio ($/SF ÷ replacement cost), Seller motivation signals, Off-market flag, Vacant/underutilized status |
| **Risk & Penalties** | Deterministic penalty list with pts deducted, Alpha bonuses with pts added, Red Team analysis, Kill probability |
| **Market Context** | Market tier (A/B/C), Submarket vacancy, Rent growth CAGR, Adaptive-reuse comps, Population growth, Anchor institution, SHPO speed |
| **Evidence Checklist** | 5 critical fields with verified / unverified status, Source notes, Disposition code (if archived) |

---

## 6. Implementation Path

The following changes are required to close the gap, in dependency order:

1. **Extend `deals.getById`** — join `commercial_assets` on `dealId` and return the full `ScorableAsset` + `HistoricInputs` payload alongside the existing `{ deal, signal, memo }`.
2. **Persist the scorecard** — call `scoreHistoricAsset()` server-side in `deals.getById` (or on mutation) and return the `HistoricScore` object in the response. Do not recompute client-side.
3. **Add a Wingate tab layout** — detect `isHistoric || historicRegisterEligible` on the deal and render the 7-tab Wingate layout instead of the 3-tab generic layout.
4. **Wire the dossier** — surface the `investorDossier` output (already generated with `historic_building` mode) in the Deal Room's Incentive Stack and Risk tabs.
5. **Add the evidence checklist** — render the 5 critical fields with VERIFY status and the disposition code.

---

*This report was generated from a direct code audit of `InvestorDealDetail.tsx` (683 lines), `historicScore.ts` (352 lines), `DealRoom.tsx` (683 lines), and `routers.ts` (deals.getById procedure). No assumptions were made about intended behavior — all gaps are confirmed against the live codebase.*

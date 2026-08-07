/**
 * Historic Adaptive Reuse — deterministic A–G scorer.
 * Implements specs/Historic Adaptive Reuse ... (Unified Spec) §7–§13:
 * 7 dimensions (A–G, 100 pts) with hard gates (A≥12 ∧ B≥12 for Tier 1),
 * penalties, alpha bonuses (+8 cap), weighted confidence, Rank Score, tiering,
 * VERIFY tagging, R-code disposition. Pure and side-effect free.
 *
 * Missing inputs score CONSERVATIVELY (low end, not midpoint) and raise a VERIFY
 * flag — opacity is itself a signal, and unverified data must not reach Tier 1.
 */
import { getMarketGate, type MarketTier } from "./marketGates";

const REPLACEMENT_COST_PER_SF = 275; // masonry default, spec §9

// Columns available on commercial_assets (see drizzle/schema.ts).
export interface ScorableAsset {
  yearBuilt?: number | null;
  stories?: number | null;
  squareFootage?: number | null;
  lotSqFt?: number | null;
  occupancyRate?: number | null;      // 0–1
  capRate?: number | null;            // 0–1
  noi?: number | null;
  askingPrice?: number | null;
  isHistoric?: boolean | null;
  historicRegisterEligible?: boolean | null;
  isStabilized?: boolean | null;
  hasAirRights?: boolean | null;
  opportunityZone?: boolean | null;
  city?: string | null;
  state?: string | null;
  higherAndBetterUseNotes?: string | null;
  historicInputs?: HistoricInputs | null;
}

// Qualitative / underwriting inputs the spec needs that aren't first-class columns.
// All optional — absence means "unverified", scored conservatively.
export interface HistoricInputs {
  registerStatus?: "listed" | "contributing" | "eligible" | "endangered" | "unresearched";
  integrityGrade?: "high" | "moderate" | "compromised";
  significanceHook?: "cited" | "plausible" | "none";
  yearBuiltVerified?: boolean;        // 2-source (Sanborn/directory)
  ownershipVerified?: boolean;
  priorHtcChecked?: boolean;
  priorHtcSyndicated?: boolean;       // hard stop if true
  farUtilization?: number;            // 0–1 of max
  lotCoverage?: number;               // 0–1 (else derived from footprint/lot)
  verticalAdditionSupport?: boolean;
  floorPlateDepthFt?: number;
  zoningHeadroomStories?: number;
  triplingPathExists?: boolean;
  abatementAvailable?: boolean;
  nmtcTract?: boolean;
  tifDistrict?: boolean;
  sellerMotivationSignals?: string[]; // estate, tax-delinquent, DOM>180, liens, land-bank...
  offMarket?: boolean;
  residentialByRight?: "byright" | "cup" | "rezoning";
  mainStreetProgram?: boolean;
  namedInDowntownPlan?: boolean;
  egressAdequate?: boolean;
  priorUse?: string;                  // matched against high-risk set
  highRiskPriorUse?: boolean;
  cleanOwnership?: boolean;
  cornerLotTwoExposures?: boolean;
  freightElevator?: boolean;
  tdrReceiving?: boolean;
  shpoAssisting?: boolean;
  estateTitleTangle?: boolean;
  stateHtcCapExhausted?: boolean;
  floodZoneAEorVE?: boolean;
  urmSeismic?: boolean;
  facadeEasement?: boolean;
  localHistoricOverlay?: boolean;
  deadlineDays?: number;              // auction/RFP/sheriff-sale countdown → fast-track
  replacementCostPerSf?: number;
}

export interface Factor { label: string; points: number; max: number; note?: string; verify?: boolean }
export interface DimensionScore { key: string; label: string; score: number; max: number; factors: Factor[] }

export type AssetTier = "tier1" | "tier2" | "tier3" | "archive" | "fasttrack";

export interface HistoricScore {
  dimA: number; dimB: number; dimC: number; dimD: number;
  dimE: number; dimF: number; dimG: number;
  rawSum: number;
  penalties: number;
  bonuses: number;
  compositeScore: number;       // clamp(rawSum + bonuses - penalties, 0, 100)
  confidenceScore: number;      // 0–1
  rankScore: number;            // composite × (0.5 + 0.5 × confidence)
  assetTier: AssetTier;
  marketTier: MarketTier;
  dispositionCode: string | null;   // R1..R10 when archived
  verifyFields: string[];           // unverified mandatory-critical fields (§11)
  hardStopFailed: string | null;
  scorecard: {
    dimensions: DimensionScore[];
    penalties: Factor[];
    bonuses: Factor[];
    strengths: string[];
    risks: string[];
    marketNote: string;
    sourceNote: string;
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Thesis knobs.
 *
 * Chad's criteria are one thesis, not the only one — a building that fails his
 * 4-storey cap or 1945 vintage rule can be exactly right for another client. A
 * variant overrides these dials without forking the scorer, so the same asset
 * can be evaluated against several theses at once.
 */
export interface ThesisOverrides {
  maxYearBuilt?: number;        // default 1945
  minYearBuilt?: number | null; // default none
  maxStories?: number;          // default 4
  gateA?: number;               // default 12
  gateB?: number;               // default 12
  tier1MinComposite?: number;   // default 75
  tier2MinComposite?: number;   // default 60
  archiveBelowComposite?: number; // default 45
  /** Relax the hard stop entirely — the asset is still scored, just not killed. */
  allowPriorHtc?: boolean;
  requireTriplingPath?: boolean; // default true
}

export const DEFAULT_THESIS: Required<Omit<ThesisOverrides, "minYearBuilt">> & { minYearBuilt: number | null } = {
  maxYearBuilt: 1945,
  minYearBuilt: null,
  maxStories: 4,
  gateA: 12,
  gateB: 12,
  tier1MinComposite: 75,
  tier2MinComposite: 60,
  archiveBelowComposite: 45,
  allowPriorHtc: false,
  requireTriplingPath: true,
};

// The 5 mandatory critical fields (§11). Confidence = verified / 5.
function criticalFieldStatus(a: ScorableAsset, h: HistoricInputs) {
  const status: Record<string, boolean> = {
    "Year Built (pre-1945, 2-source)": a.yearBuilt != null && h.yearBuiltVerified === true,
    "GSF & parcel boundaries": a.squareFootage != null && a.lotSqFt != null,
    "Ownership entity & title": h.ownershipVerified === true,
    "NRHP / district status": !!a.isHistoric || !!a.historicRegisterEligible || (h.registerStatus != null && h.registerStatus !== "unresearched"),
    "Prior HTC syndication check": h.priorHtcChecked === true,
  };
  return status;
}

export function scoreHistoricAsset(a: ScorableAsset, overrides?: ThesisOverrides): HistoricScore {
  const T = { ...DEFAULT_THESIS, ...(overrides ?? {}) };
  const h: HistoricInputs = a.historicInputs ?? {};
  const gate = getMarketGate(a.city, a.state);
  const strengths: string[] = [];
  const risks: string[] = [];

  // ─── Hard stops (§5 Stage 1) ──────────────────────────────────────────────
  let hardStop: string | null = null;
  if (a.yearBuilt != null && a.yearBuilt > T.maxYearBuilt) hardStop = `Built after ${T.maxYearBuilt} (outside this thesis's vintage)`;
  else if (T.minYearBuilt != null && a.yearBuilt != null && a.yearBuilt < T.minYearBuilt) hardStop = `Built before ${T.minYearBuilt} (outside this thesis's vintage)`;
  else if (a.stories != null && a.stories > T.maxStories) hardStop = `More than ${T.maxStories} stories above grade`;
  else if (!T.allowPriorHtc && h.priorHtcSyndicated === true) hardStop = "Prior HTC syndication — arbitrage already captured";
  else if (T.requireTriplingPath && h.triplingPathExists === false) hardStop = "No tripling path (FAR/coverage/vertical all fail)";

  // ─── Dimension A — Historic Qualification (max 20, gated) ─────────────────
  const A: Factor[] = [];
  // Vintage
  let vintage = 0, vNote = "unknown vintage";
  if (a.yearBuilt != null) {
    if (a.yearBuilt >= 1880 && a.yearBuilt <= 1930) { vintage = 4; vNote = `${a.yearBuilt} — prime 1880–1930`; }
    else if (a.yearBuilt < 1880) { vintage = 2; vNote = `${a.yearBuilt} — pre-1880`; }
    else if (a.yearBuilt <= 1945) { vintage = 3; vNote = `${a.yearBuilt} — 1931–1945`; }
    else { vintage = 0; vNote = `${a.yearBuilt} — post-1945`; }
  }
  A.push({ label: "Vintage", points: vintage, max: 4, note: vNote, verify: a.yearBuilt == null });
  // Register status
  const reg = h.registerStatus ?? (a.isHistoric ? "listed" : a.historicRegisterEligible ? "eligible" : "unresearched");
  const regPts = reg === "listed" ? 6 : reg === "contributing" ? 5 : reg === "eligible" ? 4 : reg === "endangered" ? 3 : 0;
  A.push({ label: "Register status", points: regPts, max: 6, note: reg, verify: reg === "unresearched" });
  if (regPts >= 5) strengths.push(`Historic status: ${reg} (unlocks 20% federal HTC)`);
  // Integrity
  const integrity = h.integrityGrade === "high" ? 5 : h.integrityGrade === "moderate" ? 3 : h.integrityGrade === "compromised" ? 1 : 1;
  A.push({ label: "Integrity grade", points: integrity, max: 5, note: h.integrityGrade ?? "unassessed → conservative", verify: h.integrityGrade == null });
  // Significance hook
  const sig = h.significanceHook === "cited" ? 5 : h.significanceHook === "plausible" ? 2 : 0;
  A.push({ label: "Significance hook", points: sig, max: 5, note: h.significanceHook ?? "none", verify: h.significanceHook == null });
  const dimA = A.reduce((s, f) => s + f.points, 0);

  // ─── Dimension B — Development Envelope & Parking (max 20, gated) ──────────
  const B: Factor[] = [];
  // FAR utilization
  const far = h.farUtilization;
  const farPts = far == null ? 1 : far <= 0.33 ? 6 : far <= 0.5 ? 3 : 0;
  B.push({ label: "FAR utilization", points: farPts, max: 6, note: far == null ? "unknown → conservative" : `${far.toFixed(2)}`, verify: far == null });
  // Lot coverage (derive footprint = GSF / stories, coverage = footprint / lot)
  let coverage = h.lotCoverage;
  if (coverage == null && a.squareFootage && a.stories && a.lotSqFt) {
    coverage = (a.squareFootage / a.stories) / a.lotSqFt;
  }
  const covPts = coverage == null ? 2 : coverage < 0.6 ? 5 : coverage <= 0.8 ? 2 : 0;
  B.push({ label: "Lot coverage", points: covPts, max: 5, note: coverage == null ? "unknown" : `${(coverage * 100).toFixed(0)}%`, verify: coverage == null });
  // Vertical addition support
  const vert = h.verticalAdditionSupport === true ? 4 : 1;
  B.push({ label: "Vertical addition support", points: vert, max: 4, note: h.verticalAdditionSupport == null ? "unknown → conservative" : String(h.verticalAdditionSupport), verify: h.verticalAdditionSupport == null });
  // Floor plate depth
  const fp = h.floorPlateDepthFt;
  const fpPts = fp == null ? 1 : fp <= 70 ? 3 : fp <= 90 ? 1 : 0;
  B.push({ label: "Floor plate depth", points: fpPts, max: 3, note: fp == null ? "unknown" : `${fp}ft`, verify: fp == null });
  // Zoning height headroom
  const zh = (h.zoningHeadroomStories ?? 0) >= 2 ? 2 : 0;
  B.push({ label: "Zoning height headroom", points: zh, max: 2, note: `${h.zoningHeadroomStories ?? "?"} stories`, verify: h.zoningHeadroomStories == null });
  const dimB = B.reduce((s, f) => s + f.points, 0);
  if (a.hasAirRights) strengths.push("Air rights / vertical optionality present");

  // ─── Dimension C — Incentive Stack (max 15) ───────────────────────────────
  const C: Factor[] = [];
  const htcPts = gate.stateHtcRate >= 25 && gate.stateHtcTransferable ? 3 : gate.stateHtcRate >= 20 ? 2 : gate.stateHtcRate > 0 ? 1 : 0;
  C.push({ label: "State HTC rate/transfer", points: htcPts, max: 3, note: gate.stateHtcRate === 0 ? `${a.state}: no state credit` : `${gate.stateHtcRate}%${gate.stateHtcTransferable ? " transferable" : ""}` });
  if (gate.stateHtcRate === 0) risks.push(`${a.state} has no state historic tax credit — incentive stack thinner`);
  C.push({ label: "State HTC certainty", points: gate.stateHtcRate > 0 ? (gate.stateHtcAsOfRight ? 2 : 1) : 0, max: 2, note: gate.stateHtcAsOfRight ? "as-of-right" : "competitive" });
  const oz = !!a.opportunityZone;
  C.push({ label: "Opportunity Zone", points: oz ? 3 : 0, max: 3, note: oz ? "OZ tract" : "not OZ" });
  if (oz) strengths.push("Opportunity Zone tract");
  C.push({ label: "Tax abatement/freeze", points: h.abatementAvailable ? 3 : 0, max: 3, note: h.abatementAvailable ? "available" : "none/unverified", verify: h.abatementAvailable == null });
  C.push({ label: "NMTC tract", points: h.nmtcTract ? 2 : 0, max: 2, note: h.nmtcTract ? "eligible" : "no", verify: h.nmtcTract == null });
  C.push({ label: "TIF / dev district", points: h.tifDistrict ? 2 : 0, max: 2, note: h.tifDistrict ? "active" : "no", verify: h.tifDistrict == null });
  const dimC = C.reduce((s, f) => s + f.points, 0);

  // ─── Dimension D — Market Fundamentals & Forward Supply (max 15) ──────────
  const D: Factor[] = [];
  D.push({ label: "Submarket vacancy", points: gate.vacancy < 6 ? 4 : gate.vacancy <= 8 ? 2 : 0, max: 4, note: `${gate.vacancy}% (seeded)` });
  D.push({ label: "Rent growth (3-yr)", points: gate.rentGrowthCagr3yr >= 4 ? 3 : gate.rentGrowthCagr3yr >= 2 ? 1 : 0, max: 3, note: `${gate.rentGrowthCagr3yr}% CAGR (seeded)` });
  D.push({ label: "Adaptive-reuse comps", points: gate.adaptiveReuseComps >= 1 ? 3 : 0, max: 3, note: `${gate.adaptiveReuseComps} within 3mi (seeded)` });
  D.push({ label: "Population growth (5-yr)", points: gate.popGrowth5yr >= 3 ? 2 : gate.popGrowth5yr > 0 ? 1 : 0, max: 2, note: `${gate.popGrowth5yr}% (seeded)` });
  D.push({ label: "Anchor institution", points: gate.anchorInstitution ? 2 : 0, max: 2, note: gate.anchorInstitution ? "≥1 anchor" : "none" });
  D.push({ label: "SHPO Part 1 speed", points: 0, max: 1, note: "unverified", verify: true });
  const dimD = D.reduce((s, f) => s + f.points, 0);

  // ─── Dimension E — Acquisition Basis, Access & Exit (max 15) ──────────────
  const E: Factor[] = [];
  const replCost = h.replacementCostPerSf ?? REPLACEMENT_COST_PER_SF;
  let basisRatio: number | null = null;
  // Guard against headline/auction prices ("$1 starting bid", $0 placeholders):
  // a nominal number is NOT a real basis and must never earn deep-basis points.
  const PLAUSIBLE_MIN_PRICE = 50_000;
  const priceIsPlausible = !!a.askingPrice && a.askingPrice >= PLAUSIBLE_MIN_PRICE;
  if (priceIsPlausible && a.squareFootage) basisRatio = (a.askingPrice! / a.squareFootage) / replCost;
  const nominalPrice = !!a.askingPrice && a.askingPrice < PLAUSIBLE_MIN_PRICE;
  const basisPts = basisRatio == null ? 1 : basisRatio < 0.25 ? 5 : basisRatio <= 0.4 ? 3 : basisRatio <= 0.6 ? 1 : 0;
  E.push({
    label: "Basis ratio",
    points: basisPts,
    max: 5,
    note: basisRatio != null ? `${basisRatio.toFixed(2)} ($/SF ÷ $${replCost})`
      : nominalPrice ? `nominal/auction price ($${a.askingPrice!.toLocaleString()}) — not a basis; verify true clearing price`
      : "unknown (need ask + GSF)",
    verify: basisRatio == null,
  });
  if (nominalPrice) risks.push(`Headline price of $${a.askingPrice!.toLocaleString()} is nominal (auction/placeholder) — true acquisition basis unverified`);
  if (basisRatio != null && basisRatio < 0.25) strengths.push(`Deep basis: ${basisRatio.toFixed(2)}× replacement cost`);
  const sig2 = h.sellerMotivationSignals?.length ?? 0;
  E.push({ label: "Seller motivation", points: sig2 >= 2 ? 4 : sig2 === 1 ? 2 : 0, max: 4, note: sig2 ? `${sig2} signal(s)` : "none/unverified", verify: h.sellerMotivationSignals == null });
  E.push({ label: "Off-market / thin", points: h.offMarket ? 3 : 0, max: 3, note: h.offMarket ? "off-market" : "marketed/unknown", verify: h.offMarket == null });
  const underutil = a.isStabilized === false || (a.occupancyRate != null && a.occupancyRate < 0.2);
  E.push({ label: "Vacant/underutilized", points: underutil ? 2 : 0, max: 2, note: underutil ? "low relocation friction" : "occupied" });
  E.push({ label: "Exit liquidity", points: gate.tier === "A" ? 1 : 0, max: 1, note: `market tier ${gate.tier}` });
  const dimE = E.reduce((s, f) => s + f.points, 0);

  // ─── Dimension F — Entitlement & Political Path (max 10) ──────────────────
  const F: Factor[] = [];
  const rbr = h.residentialByRight;
  F.push({ label: "Residential by-right", points: rbr === "byright" ? 4 : rbr === "cup" ? 2 : 0, max: 4, note: rbr ?? "unknown", verify: rbr == null });
  F.push({ label: "HPC facilitator", points: gate.hpcDenialRate < 30 ? 3 : gate.hpcDenialRate >= 50 ? 0 : 1, max: 3, note: `${gate.hpcDenialRate}% denial (seeded)` });
  F.push({ label: "Main Street / reuse ord.", points: h.mainStreetProgram ? 2 : 0, max: 2, note: h.mainStreetProgram ? "active" : "no/unknown", verify: h.mainStreetProgram == null });
  F.push({ label: "Named in downtown plan", points: h.namedInDowntownPlan ? 1 : 0, max: 1, note: h.namedInDowntownPlan ? "yes" : "no/unknown" });
  const dimF = F.reduce((s, f) => s + f.points, 0);

  // ─── Dimension G — Core Adequacy & Baseline Risk (max 5) ──────────────────
  const G: Factor[] = [];
  G.push({ label: "Egress & core adequacy", points: h.egressAdequate ? 2 : 0, max: 2, note: h.egressAdequate ? "adequate" : "unverified", verify: h.egressAdequate == null });
  G.push({ label: "Low-risk prior use", points: h.highRiskPriorUse ? 0 : 2, max: 2, note: h.priorUse ?? "assumed low-risk" });
  G.push({ label: "Clean single-entity title", points: h.cleanOwnership ? 1 : 0, max: 1, note: h.cleanOwnership ? "clean" : "unverified", verify: h.cleanOwnership == null });
  const dimG = G.reduce((s, f) => s + f.points, 0);

  // ─── Penalties (§7) ────────────────────────────────────────────────────────
  const pen: Factor[] = [];
  const addPen = (cond: boolean | undefined, points: number, label: string) => { if (cond) { pen.push({ label, points, max: points }); risks.push(label); } };
  addPen(h.priorHtcSyndicated, 15, "Previously adaptively reused / prior HTC");
  addPen(h.highRiskPriorUse, 10, "High-risk prior use (env REC risk)");
  addPen(gate.hpcDenialRate > 50, 8, "HPC gatekeeper (>50% denial)");
  addPen(gate.vacancy > 8, 8, "Submarket vacancy >8%");
  addPen(h.estateTitleTangle, 6, "Estate/heir title tangle");
  addPen(h.stateHtcCapExhausted, 6, "State HTC cap exhausted / near sunset");
  addPen(h.floodZoneAEorVE, 4, "FEMA Flood Zone AE/VE");
  addPen(h.urmSeismic, 4, "URM / seismic exposure");
  addPen(h.facadeEasement, 4, "Facade easement restricts vertical addition");
  addPen(h.localHistoricOverlay && h.verticalAdditionSupport === true, 3, "Local overlay + vertical addition required");
  const penalties = pen.reduce((s, f) => s + f.points, 0);

  // ─── Alpha bonuses (cap +8) ────────────────────────────────────────────────
  const bon: Factor[] = [];
  const addBon = (cond: boolean | undefined, points: number, label: string) => { if (cond) bon.push({ label, points, max: points }); };
  addBon(oz && h.nmtcTract, 3, "Double-eligible OZ + NMTC");
  addBon(h.shpoAssisting, 3, "SHPO/landmarks actively assisting");
  addBon(h.cornerLotTwoExposures, 2, "Corner lot, two exposures");
  addBon(h.tdrReceiving, 2, "TDR receiving / transferable FAR");
  addBon(h.freightElevator, 1, "Existing freight elevator / reusable cores");
  const bonuses = Math.min(bon.reduce((s, f) => s + f.points, 0), 8);

  // ─── Composite, confidence, rank ───────────────────────────────────────────
  const rawSum = dimA + dimB + dimC + dimD + dimE + dimF + dimG;
  const compositeScore = clamp(rawSum + bonuses - penalties, 0, 100);

  const critical = criticalFieldStatus(a, h);
  const verifyFields = Object.entries(critical).filter(([, ok]) => !ok).map(([k]) => k);
  const confidenceScore = Object.values(critical).filter(Boolean).length / 5;
  const rankScore = Math.round(compositeScore * (0.5 + 0.5 * confidenceScore) * 10) / 10;

  // ─── Tier assignment (§12) ─────────────────────────────────────────────────
  let assetTier: AssetTier;
  let dispositionCode: string | null = null;
  const allCriticalVerified = verifyFields.length === 0;
  const gatesPass = dimA >= T.gateA && dimB >= T.gateB;
  const fastTrack = (h.deadlineDays != null && h.deadlineDays < 21 && compositeScore >= 60);

  if (hardStop || compositeScore < T.archiveBelowComposite) {
    assetTier = "archive";
    dispositionCode =
      hardStop?.includes("Prior HTC") ? "R7" :
      hardStop?.includes("stories") || h.urmSeismic ? "R6" :
      hardStop?.includes("tripling") ? "R5" :
      h.integrityGrade === "compromised" ? "R1" :
      h.estateTitleTangle ? "R9" :
      gate.hpcDenialRate > 50 ? "R8" :
      h.highRiskPriorUse ? "R4" :
      gate.tier === "C" ? "R10" :
      basisRatio != null && basisRatio > 0.6 ? "R3" : "R1";
  } else if (fastTrack) {
    assetTier = "fasttrack";
  } else if (compositeScore >= T.tier1MinComposite && rankScore >= 70 && gatesPass && allCriticalVerified && gate.tier !== "C") {
    assetTier = "tier1";
  } else if (compositeScore >= T.tier2MinComposite || (compositeScore >= T.tier1MinComposite && !allCriticalVerified)) {
    assetTier = "tier2";
  } else {
    assetTier = "tier3";
  }

  if (!gatesPass && compositeScore >= T.tier2MinComposite) risks.push(`Dimension gate not met (A=${dimA}, B=${dimB}; need ≥${T.gateA}/${T.gateB} for Tier 1)`);

  const marketNote = gate.tier === "C"
    ? `${a.city ?? "?"}, ${a.state ?? "?"} is outside the priority corridor (Tier C) — logged, capped below Tier 1. [seeded gate data]`
    : `${gate.city}, ${gate.state} — Market Tier ${gate.tier}. [seeded gate metrics, verify before capital]`;

  return {
    dimA, dimB, dimC, dimD, dimE, dimF, dimG,
    rawSum, penalties, bonuses, compositeScore, confidenceScore, rankScore,
    assetTier, marketTier: gate.tier, dispositionCode, verifyFields, hardStopFailed: hardStop,
    scorecard: {
      dimensions: [
        { key: "A", label: "Historic Qualification", score: dimA, max: 20, factors: A },
        { key: "B", label: "Development Envelope", score: dimB, max: 20, factors: B },
        { key: "C", label: "Incentive Stack", score: dimC, max: 15, factors: C },
        { key: "D", label: "Market Fundamentals", score: dimD, max: 15, factors: D },
        { key: "E", label: "Acquisition Basis & Exit", score: dimE, max: 15, factors: E },
        { key: "F", label: "Entitlement & Political", score: dimF, max: 10, factors: F },
        { key: "G", label: "Core Adequacy", score: dimG, max: 5, factors: G },
      ],
      penalties: pen,
      bonuses: bon,
      strengths: strengths.slice(0, 3),
      risks: risks.slice(0, 3),
      marketNote,
      sourceNote: "Scored by the deterministic A–G engine. Market/HTC metrics are seeded placeholders pending real-source verification (spec §13).",
    },
  };
}

// Tier display labels
export const TIER_LABEL: Record<AssetTier, string> = {
  tier1: "Tier 1", tier2: "Tier 2", tier3: "Tier 3", archive: "Archive", fasttrack: "Fast-Track",
};

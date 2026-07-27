/**
 * Historic Adaptive Reuse — deal economics (Unified Spec §9 + §10).
 *
 * The A–G scorer answers "does this qualify?". This answers "what would I make?"
 *
 * HONESTY CONTRACT: every metric declares its `basis`:
 *   verified — computed only from figures on the asset record
 *   modeled  — depends on an assumption (rehab $/SF, HTC pricing, FAR…)
 *   unknown  — a required input is missing; NO number is invented
 * The UI must render `modeled` figures as estimates with the assumption shown,
 * and must never present them as fact. Missing inputs return null, never a guess.
 */
import { getMarketGate } from "./marketGates";
import type { ScorableAsset } from "./historicScore";

// ─── §10 Archetype conversion cost matrix ($/SF, fair→poor condition) ────────
export const ARCHETYPE_COSTS: Record<string, { low: number; high: number; difficulty: string }> = {
  "department store": { low: 160, high: 210, difficulty: "Low" },
  mercantile:         { low: 160, high: 210, difficulty: "Low" },
  office:             { low: 150, high: 195, difficulty: "Low" },
  hotel:              { low: 165, high: 215, difficulty: "Low–Med" },
  "auto row":         { low: 160, high: 210, difficulty: "Low–Med" },
  school:             { low: 185, high: 240, difficulty: "Med" },
  warehouse:          { low: 175, high: 230, difficulty: "Med" },
  "bottling plant":   { low: 175, high: 230, difficulty: "Med" },
  "telephone exchange": { low: 180, high: 235, difficulty: "Med" },
  "fraternal lodge":  { low: 200, high: 260, difficulty: "Med–High" },
  "opera house":      { low: 200, high: 260, difficulty: "Med–High" },
  bank:               { low: 190, high: 250, difficulty: "Med–High" },
  theater:            { low: 240, high: 320, difficulty: "High" },
  church:             { low: 230, high: 310, difficulty: "High" },
};
const DEFAULT_REHAB = { low: 175, high: 230, difficulty: "Med" }; // generic masonry commercial

/** Infer the archetype from the asset name / prior use. Returns null when unclear. */
export function inferArchetype(a: ScorableAsset & { name?: string | null; propertyType?: string | null }): string | null {
  const hay = `${a.name ?? ""} ${(a as any).higherAndBetterUseNotes ?? ""} ${a.historicInputs?.priorUse ?? ""}`.toLowerCase();
  for (const key of Object.keys(ARCHETYPE_COSTS)) if (hay.includes(key)) return key;
  if (/masonic|lodge|elks|odd fellows/.test(hay)) return "fraternal lodge";
  if (/mill|factory|industrial/.test(hay)) return "warehouse";
  return null;
}

export interface EconomicsAssumptions {
  rehabCostPerSf?: number;
  replacementCostPerSf?: number;   // §9 default $275 masonry
  federalHtcRate?: number;         // 0.20
  htcSyndicationFactor?: number;   // $0.90 per credit $ (refresh quarterly)
  stateHtcPricingFactor?: number;  // transferable state credits trade at a discount
  qreShareOfRehab?: number;        // QREs ≈ 85–90% of rehab hard + eligible soft
  avgUnitSf?: number;              // 950
  efficiencyFactor?: number;       // 0.80 GSF→NSF
  targetSpreadBps?: number;        // yield-on-cost target = mkt cap + 175bps
  marketCapRate?: number;
}

const DEFAULTS: Required<Pick<EconomicsAssumptions,
  "replacementCostPerSf" | "federalHtcRate" | "htcSyndicationFactor" | "stateHtcPricingFactor" |
  "qreShareOfRehab" | "avgUnitSf" | "efficiencyFactor" | "targetSpreadBps">> = {
  replacementCostPerSf: 275,
  federalHtcRate: 0.20,
  htcSyndicationFactor: 0.90,
  stateHtcPricingFactor: 0.85,
  qreShareOfRehab: 0.875,
  avgUnitSf: 950,
  efficiencyFactor: 0.80,
  targetSpreadBps: 175,
};

export type MetricBasis = "verified" | "modeled" | "unknown";
export type MetricStatus = "pass" | "watch" | "fail" | "unknown";

export interface EconMetric {
  key: string;
  label: string;
  value: number | null;
  display: string;
  target?: string;
  status: MetricStatus;
  basis: MetricBasis;
  assumption?: string;   // shown inline in the UI when basis === "modeled"
  note?: string;
}

export interface DealEconomics {
  metrics: EconMetric[];
  headline: {
    totalProjectCost: number | null;
    incentiveEquity: number | null;   // fed + state HTC equity
    equityGapPct: number | null;      // (cost − incentives) ÷ cost
  };
  assumptionsUsed: Record<string, string>;
  archetype: string | null;
  disclaimer: string;
}

const money = (n: number | null) =>
  n == null ? "—" : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}k` : `$${Math.round(n)}`;

const PLAUSIBLE_MIN_PRICE = 50_000; // auction/placeholder guard (matches the scorer)

export function computeEconomics(
  a: ScorableAsset & { name?: string | null; propertyType?: string | null },
  opts: EconomicsAssumptions = {},
): DealEconomics {
  const A = { ...DEFAULTS, ...opts };
  const h = a.historicInputs ?? {};
  const gate = getMarketGate(a.city, a.state);
  const metrics: EconMetric[] = [];

  const gsf = a.squareFootage ?? null;
  const askPlausible = !!a.askingPrice && a.askingPrice >= PLAUSIBLE_MIN_PRICE;
  const ask = askPlausible ? a.askingPrice! : null;

  // ── Archetype → rehab cost band (§10) ──────────────────────────────────────
  const archetype = inferArchetype(a);
  const band = archetype ? ARCHETYPE_COSTS[archetype] : DEFAULT_REHAB;
  const rehabPerSf = opts.rehabCostPerSf ?? Math.round((band.low + band.high) / 2);
  const rehabAssumption = opts.rehabCostPerSf
    ? `operator override $${rehabPerSf}/SF`
    : `$${rehabPerSf}/SF midpoint of ${archetype ?? "generic masonry"} band $${band.low}–$${band.high} (§10)`;

  // ── Basis ratio (§9) ───────────────────────────────────────────────────────
  const basisRatio = ask && gsf ? (ask / gsf) / A.replacementCostPerSf : null;
  metrics.push({
    key: "basisRatio", label: "Basis ratio", value: basisRatio,
    display: basisRatio != null ? `${basisRatio.toFixed(2)}×` : "—",
    target: "< 0.25×",
    status: basisRatio == null ? "unknown" : basisRatio < 0.25 ? "pass" : basisRatio <= 0.4 ? "watch" : "fail",
    basis: basisRatio == null ? "unknown" : "modeled",
    assumption: basisRatio != null ? `replacement cost $${A.replacementCostPerSf}/SF` : undefined,
    note: !askPlausible && a.askingPrice ? `headline price $${a.askingPrice.toLocaleString()} is nominal — not a basis` : gsf == null ? "needs GSF" : undefined,
  });

  // ── Tripling headroom (§9) — max buildable ÷ existing ──────────────────────
  // farUtilization = existing ÷ max allowed, so headroom = 1 ÷ farUtilization.
  const headroom = h.farUtilization && h.farUtilization > 0 ? 1 / h.farUtilization : null;
  metrics.push({
    key: "triplingHeadroom", label: "Tripling headroom", value: headroom,
    display: headroom != null ? `${headroom.toFixed(1)}×` : "—",
    target: "≥ 3.0×",
    status: headroom == null ? "unknown" : headroom >= 3 ? "pass" : headroom >= 2 ? "watch" : "fail",
    basis: headroom == null ? "unknown" : "verified",
    note: headroom == null ? "needs FAR utilization (zoning max vs. existing GSF)" : undefined,
  });

  // ── Rehab cost, QREs, HTC equity (§9) ──────────────────────────────────────
  const rehabCost = gsf != null ? gsf * rehabPerSf : null;
  const qres = rehabCost != null ? rehabCost * A.qreShareOfRehab : null;
  metrics.push({
    key: "rehabCost", label: "Est. rehab cost", value: rehabCost,
    display: money(rehabCost), status: rehabCost == null ? "unknown" : "watch",
    basis: rehabCost == null ? "unknown" : "modeled",
    assumption: rehabCost != null ? rehabAssumption : undefined,
    note: gsf == null ? "needs GSF" : undefined,
  });

  const fedEquity = qres != null ? qres * A.federalHtcRate * A.htcSyndicationFactor : null;
  metrics.push({
    key: "fedHtcEquity", label: "Fed HTC equity", value: fedEquity,
    display: money(fedEquity), status: fedEquity == null ? "unknown" : "pass",
    basis: fedEquity == null ? "unknown" : "modeled",
    assumption: fedEquity != null ? `QREs ${Math.round(A.qreShareOfRehab * 100)}% of rehab × ${Math.round(A.federalHtcRate * 100)}% × $${A.htcSyndicationFactor.toFixed(2)} pricing` : undefined,
  });

  const stateRate = (opts as any).stateHtcRate ?? gate.stateHtcRate / 100;
  const stateEquity = qres != null && stateRate > 0 ? qres * stateRate * A.stateHtcPricingFactor : (qres != null ? 0 : null);
  metrics.push({
    key: "stateHtcEquity", label: "State HTC equity", value: stateEquity,
    display: money(stateEquity),
    status: stateEquity == null ? "unknown" : stateEquity > 0 ? "pass" : "fail",
    basis: stateEquity == null ? "unknown" : "modeled",
    assumption: stateEquity != null && stateRate > 0
      ? `${a.state} ${Math.round(stateRate * 100)}%${gate.stateHtcTransferable ? " transferable" : ""} × $${A.stateHtcPricingFactor.toFixed(2)} [seeded program data]`
      : undefined,
    note: stateRate === 0 ? `${a.state ?? "state"} has no state historic credit` : undefined,
  });

  // ── Incentive coverage ratio (§9) ──────────────────────────────────────────
  const incentiveEquity = fedEquity != null ? fedEquity + (stateEquity ?? 0) : null;
  const coverage = incentiveEquity != null && rehabCost ? incentiveEquity / rehabCost : null;
  metrics.push({
    key: "incentiveCoverage", label: "Incentive coverage", value: coverage,
    display: coverage != null ? `${Math.round(coverage * 100)}%` : "—",
    target: "≥ 40% of rehab",
    status: coverage == null ? "unknown" : coverage >= 0.4 ? "pass" : coverage >= 0.3 ? "watch" : "fail",
    basis: coverage == null ? "unknown" : "modeled",
    note: "excludes PV of abatements (not yet modeled)",
  });

  // ── Unit yield (§9) ────────────────────────────────────────────────────────
  const units = gsf != null ? Math.floor((gsf * A.efficiencyFactor) / A.avgUnitSf) : null;
  metrics.push({
    key: "unitYield", label: "Est. units", value: units,
    display: units != null ? `${units}` : "—",
    status: units == null ? "unknown" : "watch",
    basis: units == null ? "unknown" : "modeled",
    assumption: units != null ? `${Math.round(A.efficiencyFactor * 100)}% efficiency ÷ ${A.avgUnitSf} SF avg unit` : undefined,
  });

  // ── Total project cost + equity gap ────────────────────────────────────────
  const totalCost = ask != null && rehabCost != null ? ask + rehabCost : null;
  metrics.push({
    key: "totalProjectCost", label: "Total project cost", value: totalCost,
    display: money(totalCost), status: totalCost == null ? "unknown" : "watch",
    basis: totalCost == null ? "unknown" : "modeled",
    assumption: totalCost != null ? "acquisition + rehab (excludes soft costs/carry)" : undefined,
  });

  // ── Yield on cost (§9) — needs stabilized NOI ──────────────────────────────
  const yoc = a.noi && totalCost ? a.noi / totalCost : null;
  const targetYoc = (opts.marketCapRate ?? a.capRate ?? null) != null
    ? (opts.marketCapRate ?? a.capRate!) + A.targetSpreadBps / 10000 : null;
  metrics.push({
    key: "yieldOnCost", label: "Yield on cost", value: yoc,
    display: yoc != null ? `${(yoc * 100).toFixed(1)}%` : "—",
    target: targetYoc != null ? `≥ ${(targetYoc * 100).toFixed(1)}% (mkt cap +${A.targetSpreadBps}bps)` : `mkt cap +${A.targetSpreadBps}bps`,
    status: yoc == null || targetYoc == null ? "unknown" : yoc >= targetYoc ? "pass" : "fail",
    basis: yoc == null ? "unknown" : "modeled",
    note: a.noi == null ? "needs stabilized NOI projection" : undefined,
  });

  // ── Time to income (§9) — months to first CO ───────────────────────────────
  let months: number | null = null;
  const parts: string[] = [];
  if (h.residentialByRight) {
    months = h.residentialByRight === "byright" ? 18 : h.residentialByRight === "cup" ? 24 : 30;
    parts.push(`${h.residentialByRight} entitlement`);
    if (h.registerStatus === "listed" || h.registerStatus === "contributing") { months -= 2; parts.push("Part 1 shortcut (already listed)"); }
    else if (!h.registerStatus || h.registerStatus === "unresearched") { months += 4; parts.push("nomination required"); }
    if (gate.hpcDenialRate > 30) { months += 3; parts.push("HPC friction"); }
  }
  metrics.push({
    key: "timeToIncome", label: "Time to first income", value: months,
    display: months != null ? `~${months} mo` : "—",
    status: months == null ? "unknown" : months <= 24 ? "pass" : months <= 30 ? "watch" : "fail",
    basis: months == null ? "unknown" : "modeled",
    assumption: months != null ? parts.join(" · ") : undefined,
    note: months == null ? "needs entitlement path" : undefined,
  });

  // ── Diligence gates that must be answered before Tier 1 (§9) ───────────────
  metrics.push({
    key: "creditPricing", label: "Credit pricing freshness", value: null,
    display: "not checked", target: "< 90 days",
    status: "unknown", basis: "unknown",
    note: "syndication pricing must be re-confirmed before underwriting",
  });
  metrics.push({
    key: "insurability", label: "Insurability", value: null,
    display: h.floodZoneAEorVE ? "flood zone risk" : "not confirmed",
    target: "builders-risk + vacant coverage",
    status: h.floodZoneAEorVE ? "fail" : "unknown", basis: "unknown",
    note: "required before Tier 1",
  });

  const equityGapPct = totalCost && incentiveEquity != null ? (totalCost - incentiveEquity) / totalCost : null;

  return {
    metrics,
    headline: { totalProjectCost: totalCost, incentiveEquity, equityGapPct },
    assumptionsUsed: {
      "Rehab $/SF": rehabAssumption,
      "Replacement cost": `$${A.replacementCostPerSf}/SF (§9 masonry default)`,
      "HTC pricing": `$${A.htcSyndicationFactor.toFixed(2)} per credit dollar`,
      "QRE share": `${Math.round(A.qreShareOfRehab * 100)}% of rehab cost`,
      "Unit sizing": `${A.avgUnitSf} SF avg · ${Math.round(A.efficiencyFactor * 100)}% efficiency`,
    },
    archetype,
    disclaimer: "Modeled figures are estimates from the assumptions shown — not verified underwriting. Confirm rehab scope, QRE eligibility, and credit pricing before committing capital.",
  };
}

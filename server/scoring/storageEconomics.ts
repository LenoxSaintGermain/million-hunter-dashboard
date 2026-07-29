/**
 * Self-storage underwriting — the second economics model.
 *
 * Historic adaptive reuse is a DEVELOPMENT model: cost to build, incentives that
 * come back, equity left to raise. Self-storage is an INCOME model: what it
 * earns today, what it earns stabilised, and what you're paying per rentable
 * foot. Same honesty contract as the historic model — every figure declares
 * whether it is verified, modeled, or unknown, and every assumption is printed.
 *
 * This file existing is the point: adding an asset class no longer means
 * borrowing another class's vocabulary.
 */
import type { DealEconomics, EconMetric } from "./economics";
import { NOMINAL_PRICE_FLOOR } from "../../shared/pricing";

/** Industry defaults, stated so they can be argued with. */
export const STORAGE_ASSUMPTIONS = {
  /** Operating expense ratio on effective gross income. */
  opexRatio: 0.35,
  /** Economic occupancy runs below physical — units discounted, concessions. */
  economicOccupancyHaircut: 0.05,
  /** What "stabilised" means for this asset type. */
  stabilizedOccupancy: 0.9,
  /** Screening debt assumption. */
  ltv: 0.65,
  rate: 0.07,
  amortYears: 25,
  /** Submarket supply benchmark (national average ≈ 7 SF per capita). */
  balancedSupplySfPerCapita: 7,
};

const money = (n: number | null) =>
  n == null ? "—" : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}k` : `$${Math.round(n)}`;

const pct = (n: number | null, dp = 1) => (n == null ? "—" : `${(n * 100).toFixed(dp)}%`);

/** MySQL hands decimals back as strings — coerce at the boundary or math silently concatenates. */
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

/** Annual debt service on a level-payment mortgage. */
function annualDebtService(principal: number, rate: number, years: number): number {
  const r = rate / 12;
  const n = years * 12;
  const payment = (principal * r) / (1 - Math.pow(1 + r, -n));
  return payment * 12;
}

export function computeStorageEconomics(
  asset: Record<string, any>,
  A = STORAGE_ASSUMPTIONS,
): DealEconomics {
  const meta = (asset.classMetadata ?? asset.class_metadata ?? {}) as Record<string, any>;
  const read = (k: string) => num(meta[k] ?? asset[k]);

  const nrsf = read("netRentableSqFt");
  const units = read("units");
  const physOcc = read("occupancyRate");
  const rentPerSf = read("rentPerSqFt");
  const capRate = read("capRate");
  const supplyRatio = read("supplyRatio");
  const askRaw = read("askingPrice");
  const askPlausible = askRaw != null && askRaw >= NOMINAL_PRICE_FLOOR;
  const ask = askPlausible ? askRaw : null;

  const metrics: EconMetric[] = [];

  // ── Income ────────────────────────────────────────────────────────────────
  const gpr = nrsf != null && rentPerSf != null ? nrsf * rentPerSf : null;
  metrics.push({
    key: "gpr", value: gpr, label: "Gross potential rent", display: money(gpr),
    basis: gpr == null ? "unknown" : "modeled", status: gpr == null ? "unknown" : "pass",
    assumption: gpr != null ? "net rentable SF × asking rate/SF, before vacancy" : undefined,
    note: gpr == null ? "needs net rentable SF and rate/SF" : undefined,
  });

  const econOcc = physOcc != null ? Math.max(0, physOcc - A.economicOccupancyHaircut) : null;
  const egi = gpr != null && econOcc != null ? gpr * econOcc : null;
  metrics.push({
    key: "egi", value: egi, label: "Effective gross income", display: money(egi),
    basis: egi == null ? "unknown" : "modeled", status: egi == null ? "unknown" : "pass",
    assumption: egi != null
      ? `economic occupancy ${pct(econOcc)} (physical ${pct(physOcc)} less ${Math.round(A.economicOccupancyHaircut * 100)}pt for concessions)`
      : undefined,
    note: egi == null ? "needs physical occupancy" : undefined,
  });

  const noi = egi != null ? egi * (1 - A.opexRatio) : null;
  metrics.push({
    key: "noi", value: noi, label: "NOI (in place)", display: money(noi),
    basis: noi == null ? "unknown" : "modeled", status: noi == null ? "unknown" : "pass",
    assumption: noi != null ? `${Math.round(A.opexRatio * 100)}% operating expense ratio` : undefined,
  });

  // ── Basis ─────────────────────────────────────────────────────────────────
  const ppsf = ask != null && nrsf != null ? ask / nrsf : null;
  metrics.push({
    key: "ppsf", value: ppsf, label: "Price per rentable SF", display: ppsf == null ? "—" : `$${Math.round(ppsf)}`,
    basis: ppsf == null ? "unknown" : "modeled",
    status: ppsf == null ? "unknown" : ppsf <= 80 ? "pass" : ppsf <= 120 ? "watch" : "fail",
    target: "≤ $80/SF strong · ≤ $120/SF acceptable",
    note: !askPlausible && askRaw != null
      ? `headline price ${money(askRaw)} is nominal — not a basis`
      : ask == null ? "needs asking price" : undefined,
  });

  const goingIn = noi != null && ask != null ? noi / ask : null;
  metrics.push({
    key: "goingInCap", value: goingIn, label: "Going-in cap rate", display: pct(goingIn),
    basis: goingIn == null ? "unknown" : "modeled",
    status: goingIn == null ? "unknown" : goingIn >= 0.07 ? "pass" : goingIn >= 0.055 ? "watch" : "fail",
    target: "≥ 7.0% strong · ≥ 5.5% acceptable",
    assumption: goingIn != null ? "modeled NOI ÷ asking price" : undefined,
    note: capRate != null && goingIn != null && Math.abs(capRate - goingIn) > 0.01
      ? `broker-quoted cap ${pct(capRate)} differs from modeled — reconcile the expense load`
      : undefined,
  });

  // The listing's own cap rate is a stated fact — keep it even when there is not
  // enough data to model NOI, rather than showing nothing at all.
  metrics.push({
    key: "brokerCap", value: capRate, label: "Cap rate (as listed)", display: pct(capRate),
    basis: capRate == null ? "unknown" : "verified",
    status: capRate == null ? "unknown" : capRate >= 0.07 ? "pass" : capRate >= 0.055 ? "watch" : "fail",
    target: "≥ 7.0% strong · ≥ 5.5% acceptable",
    note: capRate != null && noi == null
      ? "stated by the listing — unverified against a rent roll, and no independent NOI to check it"
      : undefined,
  });

  // ── Stabilised upside ─────────────────────────────────────────────────────
  const stabilizedNoi =
    gpr != null && physOcc != null && physOcc < A.stabilizedOccupancy
      ? gpr * (A.stabilizedOccupancy - A.economicOccupancyHaircut) * (1 - A.opexRatio)
      : null;
  const yieldOnCost = stabilizedNoi != null && ask != null ? stabilizedNoi / ask : null;
  metrics.push({
    key: "stabilizedYield", value: yieldOnCost, label: "Yield on cost (stabilised)", display: pct(yieldOnCost),
    basis: yieldOnCost == null ? "unknown" : "modeled",
    status: yieldOnCost == null ? "unknown" : yieldOnCost >= 0.08 ? "pass" : yieldOnCost >= 0.065 ? "watch" : "fail",
    target: "≥ 8.0%",
    assumption: yieldOnCost != null ? `lease-up to ${pct(A.stabilizedOccupancy, 0)} physical occupancy` : undefined,
    note: stabilizedNoi == null
      ? (physOcc != null && physOcc >= A.stabilizedOccupancy ? "already at or above stabilised occupancy" : "needs occupancy and rate/SF")
      : undefined,
  });

  // ── Debt coverage ─────────────────────────────────────────────────────────
  const loan = ask != null ? ask * A.ltv : null;
  const ads = loan != null ? annualDebtService(loan, A.rate, A.amortYears) : null;
  const dscr = noi != null && ads != null && ads > 0 ? noi / ads : null;
  metrics.push({
    key: "dscr", value: dscr, label: "DSCR (in place)", display: dscr == null ? "—" : `${dscr.toFixed(2)}×`,
    basis: dscr == null ? "unknown" : "modeled",
    status: dscr == null ? "unknown" : dscr >= 1.35 ? "pass" : dscr >= 1.2 ? "watch" : "fail",
    target: "≥ 1.35×",
    assumption: dscr != null
      ? `${Math.round(A.ltv * 100)}% LTV · ${(A.rate * 100).toFixed(1)}% · ${A.amortYears}-yr amortisation`
      : undefined,
  });

  // ── Supply ────────────────────────────────────────────────────────────────
  metrics.push({
    key: "supply", value: supplyRatio, label: "Submarket supply", display: supplyRatio == null ? "—" : `${supplyRatio.toFixed(1)} SF/capita`,
    basis: supplyRatio == null ? "unknown" : "modeled",
    status: supplyRatio == null ? "unknown" : supplyRatio <= 5 ? "pass" : supplyRatio <= A.balancedSupplySfPerCapita ? "watch" : "fail",
    target: `≤ ${A.balancedSupplySfPerCapita} SF/capita (national average)`,
    note: supplyRatio == null ? "submarket supply not researched — the single biggest driver of rate growth" : undefined,
  });

  metrics.push({
    key: "unitMix", value: nrsf != null && units != null ? nrsf / units : null, label: "Average unit size", display: nrsf != null && units != null ? `${Math.round(nrsf / units)} SF` : "—",
    basis: nrsf != null && units != null ? "modeled" : "unknown",
    status: "unknown",
    note: "climate-controlled share and unit mix drive rate — confirm from the rent roll",
  });

  return {
    metrics,
    headline: [
      { label: "NOI (in place)", display: money(noi), value: noi },
      // Prefer the modeled cap; fall back to the listed one, labelled as such.
      goingIn != null
        ? { label: "Going-in cap", display: pct(goingIn), value: goingIn }
        : { label: "Cap rate (as listed)", display: pct(capRate), value: capRate },
      { label: "Price / rentable SF", display: ppsf == null ? "—" : `$${Math.round(ppsf)}`, value: ppsf },
    ],
    assumptionsUsed: {
      "Operating expense ratio": `${Math.round(A.opexRatio * 100)}% of EGI`,
      "Economic occupancy": `physical less ${Math.round(A.economicOccupancyHaircut * 100)}pt`,
      "Stabilised occupancy": `${Math.round(A.stabilizedOccupancy * 100)}%`,
      "Screening debt": `${Math.round(A.ltv * 100)}% LTV · ${(A.rate * 100).toFixed(1)}% · ${A.amortYears}-yr`,
      "Supply benchmark": `${A.balancedSupplySfPerCapita} SF per capita`,
    },
    archetype: "self-storage",
    disclaimer: "Modeled from the asking rate and occupancy shown — not underwriting. Confirm the rent roll, expense load, and submarket supply before committing capital.",
  };
}

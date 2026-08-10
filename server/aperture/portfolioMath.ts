/**
 * Portfolio interaction math.
 *
 * The question is never "is this a good stock" — it is "what does adding this do
 * to what I already own". Concentration, correlation, liquidity and utilisation
 * are the four answers, and each one is only as good as its inputs.
 *
 * HONESTY CONTRACT, same as server/scoring/economics.ts: every metric declares
 *   verified — computed only from figures on the record
 *   modeled  — depends on an assumption, which is stated inline
 *   unknown  — a required input is missing; the metric returns null, never a guess
 * A correlation estimated from sector labels is NOT the same claim as one
 * computed from returns, and the UI must not be able to confuse them.
 */
export type Basis = "verified" | "modeled" | "unknown";

export interface Metric<T = number> {
  value: T | null;
  basis: Basis;
  /** Required whenever basis === "modeled". Rendered next to the number. */
  assumption?: string;
  /** Why the value is null, when it is. */
  note?: string;
}

export interface Holding {
  symbol: string;
  /** Position value in cents. */
  valueCents: number;
  sector?: string | null;
  /** 30-day average dollar volume, in dollars. */
  advUsd?: number | null;
}

// Non-generic on purpose: with a generic `value: T | null`, TypeScript infers
// T = null at every call that reports a missing metric, and Metric<null> is not
// assignable to Metric<number>. Every metric here is numeric.
const metric = (value: number | null, basis: Basis, extra: Partial<Metric> = {}): Metric =>
  ({ value, basis, ...extra });

export const totalValueCents = (hs: Holding[]): number => hs.reduce((s, h) => s + h.valueCents, 0);

/** Weight per symbol, 0..1. Empty portfolio → empty map (not a divide by zero). */
export function weights(hs: Holding[]): Map<string, number> {
  const total = totalValueCents(hs);
  const out = new Map<string, number>();
  if (total <= 0) return out;
  for (const h of hs) out.set(h.symbol, (out.get(h.symbol) ?? 0) + h.valueCents / total);
  return out;
}

/**
 * Herfindahl-Hirschman index of position weights, 0..1.
 * 1 = everything in one name. 1/n = perfectly even across n names.
 */
export function concentrationHhi(hs: Holding[]): Metric {
  if (!hs.length || totalValueCents(hs) <= 0) {
    return metric(null, "unknown", { note: "no positions with a value" });
  }
  let hhi = 0;
  for (const w of Array.from(weights(hs).values())) hhi += w * w;
  return metric(round(hhi, 4), "verified");
}

export function maxSingleNamePct(hs: Holding[]): Metric {
  if (!hs.length || totalValueCents(hs) <= 0) {
    return metric(null, "unknown", { note: "no positions with a value" });
  }
  return metric(round(Math.max(...Array.from(weights(hs).values())) * 100, 2), "verified");
}

/**
 * Largest share of the portfolio sitting in one correlated cluster.
 *
 * With return series we could compute this properly. Without them, sector is the
 * available proxy — and it is a genuinely weaker claim, so it is labelled
 * `modeled` and says so. Holdings with no sector are excluded from clusters and
 * reported, rather than being silently lumped into an "Other" bucket that would
 * understate concentration.
 */
export function maxCorrelatedClusterPct(hs: Holding[]): Metric<number> & { unclassified?: string[] } {
  const total = totalValueCents(hs);
  if (!hs.length || total <= 0) {
    return metric(null, "unknown", { note: "no positions with a value" });
  }
  const unclassified = hs.filter((h) => !h.sector).map((h) => h.symbol);
  const bySector = new Map<string, number>();
  for (const h of hs) {
    if (!h.sector) continue;
    bySector.set(h.sector, (bySector.get(h.sector) ?? 0) + h.valueCents);
  }
  if (!bySector.size) {
    return {
      ...metric(null, "unknown", { note: "no holding carries a sector label" }),
      unclassified,
    };
  }
  const pct = round((Math.max(...Array.from(bySector.values())) / total) * 100, 2);
  return {
    ...metric(pct, "modeled", {
      assumption:
        "clusters proxied by sector label, not by return correlation" +
        (unclassified.length ? `; ${unclassified.length} holding(s) unclassified and excluded` : ""),
    }),
    unclassified,
  };
}

/**
 * Pearson correlation of two aligned return series. Returns `unknown` rather
 * than a number when there is not enough overlap to mean anything.
 */
export function correlationFromReturns(a: number[], b: number[], minPoints = 30): Metric {
  const n = Math.min(a.length, b.length);
  if (n < minPoints) {
    return metric(null, "unknown", { note: `needs ${minPoints} overlapping returns, has ${n}` });
  }
  const xs = a.slice(-n);
  const ys = b.slice(-n);
  // A constant series has no correlation to report. Testing the sum of squares
  // against exact zero is not enough: summing 40 copies of 0.001 leaves float
  // noise, which would otherwise yield a "verified" correlation computed
  // entirely from rounding error.
  if (isConstant(xs) || isConstant(ys)) {
    return metric(null, "unknown", { note: "a series has zero variance" });
  }
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const px = xs[i] - mx;
    const py = ys[i] - my;
    num += px * py;
    dx += px * px;
    dy += py * py;
  }
  const den = Math.sqrt(dx * dy);
  if (den === 0) return metric(null, "unknown", { note: "a series has zero variance" });
  return metric(round(num / den, 4), "verified");
}

/**
 * How many trading days it would take to exit at `participationPct` of average
 * daily volume. This is the metric that stops a thesis-perfect microcap from
 * being sized like a mega-cap.
 */
export function daysToExit(valueCents: number, advUsd: number | null | undefined, participationPct = 0.1): Metric {
  if (advUsd == null || advUsd <= 0) {
    return metric(null, "unknown", { note: "no average daily volume on record" });
  }
  const capacityPerDay = advUsd * participationPct;
  return metric(round(valueCents / 100 / capacityPerDay, 2), "modeled", {
    assumption: `exiting at ${round(participationPct * 100, 0)}% of 30-day average dollar volume`,
  });
}

/** Share of investable capital actually deployed, 0..100. */
export function capitalUtilizationPct(investedCents: number, cashCents: number): Metric {
  const total = investedCents + cashCents;
  if (total <= 0) return metric(null, "unknown", { note: "no capital on record" });
  return metric(round((investedCents / total) * 100, 2), "verified");
}

/** Portfolio weight sitting in names that express a thesis exposure node. */
export function thesisExposurePct(hs: Holding[], symbolsOnThesis: Set<string>): Metric {
  const total = totalValueCents(hs);
  if (!hs.length || total <= 0) return metric(null, "unknown", { note: "no positions with a value" });
  const on = hs.filter((h) => symbolsOnThesis.has(h.symbol)).reduce((s, h) => s + h.valueCents, 0);
  return metric(round((on / total) * 100, 2), "verified");
}

export interface PortfolioSnapshot {
  hhi: Metric;
  maxSingleNamePct: Metric;
  maxClusterPct: Metric<number> & { unclassified?: string[] };
  capitalUtilizationPct: Metric;
  positionCount: number;
  investedCents: number;
  cashCents: number;
}

export function snapshot(hs: Holding[], cashCents: number): PortfolioSnapshot {
  const invested = totalValueCents(hs);
  return {
    hhi: concentrationHhi(hs),
    maxSingleNamePct: maxSingleNamePct(hs),
    maxClusterPct: maxCorrelatedClusterPct(hs),
    capitalUtilizationPct: capitalUtilizationPct(invested, cashCents),
    positionCount: hs.length,
    investedCents: invested,
    cashCents,
  };
}

/** Before/after for a proposed allocation — the "portfolio impact" panel. */
export interface ImpactDelta {
  before: PortfolioSnapshot;
  after: PortfolioSnapshot;
  /** Signed change; null when either side is unknown. */
  deltas: {
    hhi: number | null;
    maxSingleNamePct: number | null;
    maxClusterPct: number | null;
    capitalUtilizationPct: number | null;
  };
}

export function applyAllocations(
  hs: Holding[],
  allocations: Array<{ symbol: string; dollarsCents: number; sector?: string | null; advUsd?: number | null }>,
): Holding[] {
  const out = hs.map((h) => ({ ...h }));
  for (const a of allocations) {
    if (a.dollarsCents <= 0) continue;
    const existing = out.find((h) => h.symbol === a.symbol);
    if (existing) existing.valueCents += a.dollarsCents;
    else out.push({ symbol: a.symbol, valueCents: a.dollarsCents, sector: a.sector ?? null, advUsd: a.advUsd ?? null });
  }
  return out;
}

export function impactOf(
  hs: Holding[],
  cashCents: number,
  allocations: Array<{ symbol: string; dollarsCents: number; sector?: string | null; advUsd?: number | null }>,
): ImpactDelta {
  const spent = allocations.reduce((s, a) => s + Math.max(0, a.dollarsCents), 0);
  const before = snapshot(hs, cashCents);
  const after = snapshot(applyAllocations(hs, allocations), cashCents - spent);
  const d = (a: Metric, b: Metric) => (a.value == null || b.value == null ? null : round(b.value - a.value, 4));
  return {
    before,
    after,
    deltas: {
      hhi: d(before.hhi, after.hhi),
      maxSingleNamePct: d(before.maxSingleNamePct, after.maxSingleNamePct),
      maxClusterPct: d(before.maxClusterPct, after.maxClusterPct),
      capitalUtilizationPct: d(before.capitalUtilizationPct, after.capitalUtilizationPct),
    },
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Flat to within float noise — spread is negligible against the values' scale. */
function isConstant(xs: number[]): boolean {
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of xs) {
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  const scale = Math.max(Math.abs(hi), Math.abs(lo), Number.EPSILON);
  return hi - lo <= scale * 1e-9;
}

export const round = (n: number, dp: number) => {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
};

/**
 * Config-driven scorer for NON-historic asset classes (scorer: "generic").
 * Reads an AssetClass.scoring config + an asset (native columns + class_metadata)
 * and produces the SAME result shape as the historic A–G scorer, so every surface
 * renders any class uniformly. Historic keeps its bespoke engine untouched.
 */
import type { AssetClass, Band, FactorDef } from "../../shared/assetClasses";
import { criticalFields } from "../../shared/assetClasses";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function bandPoints(value: number, bands: Band[]): number | null {
  for (const b of bands) {
    if (b.eq !== undefined) { if (value === b.eq) return b.points; continue; }
    if (b.lte !== undefined && !(value <= b.lte)) continue;
    if (b.gte !== undefined && !(value >= b.gte)) continue;
    if (b.lt !== undefined && !(value < b.lt)) continue;
    if (b.gt !== undefined && !(value > b.gt)) continue;
    return b.points;
  }
  return null;
}

function factorScore(f: FactorDef, get: (k: string) => any): { points: number; note: string; verify: boolean } {
  const raw = get(f.field);
  const present = raw !== undefined && raw !== null && raw !== "";
  if (!present) {
    return { points: f.missing ?? 0, note: "unknown → conservative", verify: !!f.verifyWhenMissing };
  }
  if (f.whenTrue !== undefined) {
    const on = raw === true || raw === "true" || raw === 1;
    return { points: on ? f.whenTrue : 0, note: on ? "yes" : "no", verify: false };
  }
  if (f.map) {
    return { points: f.map[String(raw)] ?? 0, note: String(raw), verify: false };
  }
  if (f.bands) {
    const p = bandPoints(Number(raw), f.bands);
    return { points: p ?? 0, note: String(raw), verify: false };
  }
  return { points: 0, note: String(raw), verify: false };
}

export function scoreGenericAsset(cls: AssetClass, asset: any) {
  const model = cls.scoring!;
  const meta = (asset.classMetadata ?? asset.class_metadata ?? {}) as Record<string, any>;
  const baseGet = (k: string): any => (asset[k] !== undefined ? asset[k] : meta[k]);
  const derived = model.derive ? model.derive((k) => { const v = baseGet(k); return v == null ? undefined : Number(v); }) : {};
  const get = (k: string): any => (derived[k] !== undefined ? derived[k] : baseGet(k));

  const verifyFields: string[] = [];
  const dimResults = model.dimensions.map((d) => {
    const factors = d.factors.map((f) => {
      const r = factorScore(f, get);
      if (r.verify) verifyFields.push(`${d.key}: ${f.label}`);
      return { label: f.label, points: clamp(r.points, 0, f.max), max: f.max, note: r.note, verify: r.verify };
    });
    const score = clamp(factors.reduce((s, f) => s + f.points, 0), 0, d.max);
    return { key: d.key, label: d.label, max: d.max, gate: d.gate, score, factors };
  });

  const rawSum = dimResults.reduce((s, d) => s + d.score, 0);
  const compositeScore = clamp(rawSum, 0, 100);

  // Confidence: fraction of critical fields present (2-source verification isn't
  // available generically, so presence = verified; absence raises VERIFY).
  const crit = criticalFields(cls);
  const critVerified = crit.filter((k) => { const v = baseGet(k); return v !== undefined && v !== null && v !== ""; });
  const missingCrit = crit.filter((k) => !critVerified.includes(k)).map((k) => {
    const fd = cls.fields.find((f) => f.key === k);
    return fd?.label ?? k;
  });
  for (const m of missingCrit) if (!verifyFields.includes(m)) verifyFields.push(m);
  const confidenceScore = crit.length ? critVerified.length / crit.length : 1;
  const rankScore = Math.round(compositeScore * (0.5 + 0.5 * confidenceScore) * 10) / 10;

  const gatesPass = dimResults.every((d) => d.gate == null || d.score >= d.gate);
  const allCriticalVerified = missingCrit.length === 0;

  // Market tier from the class's own priority markets (state-level).
  const st = (asset.state ?? "").toUpperCase();
  const marketTier: "A" | "B" | "C" = cls.markets?.includes(st) ? "A" : "C";

  let assetTier: string;
  if (compositeScore < model.tier3MinComposite) assetTier = "archive";
  else if (compositeScore >= model.tier1MinComposite && gatesPass && allCriticalVerified && marketTier !== "C") assetTier = "tier1";
  else if (compositeScore >= model.tier2MinComposite) assetTier = "tier2";
  else assetTier = "tier3";

  const strengths = dimResults.flatMap((d) => d.factors.filter((f) => f.points >= f.max && f.max >= 5).map((f) => `${f.label}: ${f.note}`)).slice(0, 3);
  const risks: string[] = [];
  if (!gatesPass) risks.push(`Gate not met on ${dimResults.filter((d) => d.gate != null && d.score < d.gate).map((d) => d.key).join(", ")}`);
  if (marketTier === "C") risks.push(`${asset.city ?? "?"}, ${st} is outside the ${cls.shortLabel} target markets`);
  dimResults.flatMap((d) => d.factors.filter((f) => f.points === 0 && f.max >= 8)).slice(0, 2).forEach((f) => risks.push(`Weak: ${f.label}`));

  // Map the first up-to-7 dimensions onto dimA..dimG for legacy render compatibility.
  const [A, B, C, D, E, F, G] = dimResults.map((d) => d.score);

  return {
    dimA: A ?? 0, dimB: B ?? 0, dimC: C ?? 0, dimD: D ?? 0, dimE: E ?? 0, dimF: F ?? 0, dimG: G ?? 0,
    rawSum, penalties: 0, bonuses: 0, compositeScore, confidenceScore, rankScore,
    assetTier, marketTier, dispositionCode: assetTier === "archive" ? "R-GEN" : null,
    verifyFields, hardStopFailed: null, gatesPass,
    scorecard: {
      dimensions: dimResults,
      penalties: [] as any[], bonuses: [] as any[],
      strengths, risks: risks.slice(0, 3),
      marketNote: `${asset.city ?? "?"}, ${st} — ${cls.shortLabel} market tier ${marketTier}.`,
      sourceNote: `Scored by the generic engine from the "${cls.label}" class config.`,
    },
  };
}

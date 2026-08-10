/**
 * Band / factor / dimension primitives — shared by every config-driven scorer.
 *
 * Extracted from genericScore.ts so the property engine (an asset class scored
 * against its config) and Capital Aperture (a security scored against a thesis
 * graph) run the SAME arithmetic instead of two drifting copies. The historic
 * A–G scorer keeps its bespoke engine and is untouched.
 *
 * Behaviour is deliberately identical to the original implementation, including
 * its conservative treatment of missing inputs: an absent field scores `missing`
 * points (0 unless the config says otherwise) and can raise a VERIFY flag. A gap
 * never scores as if it were good news.
 */
import type { Band } from "../../shared/assetClasses";

export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Structural shape shared by AssetClass FactorDef and Aperture thesis factors. */
export interface ScorableFactor {
  key: string;
  label: string;
  max: number;
  /** Which field (native, metadata, or derived) this factor reads. */
  field: string;
  bands?: Band[];
  whenTrue?: number;
  map?: Record<string, number>;
  missing?: number;
  verifyWhenMissing?: boolean;
}

export interface ScorableDimension<F extends ScorableFactor = ScorableFactor> {
  key: string;
  label: string;
  max: number;
  gate?: number;
  factors: F[];
}

export interface FactorResult {
  label: string;
  points: number;
  max: number;
  note: string;
  verify: boolean;
}

export interface DimensionResult {
  key: string;
  label: string;
  max: number;
  gate?: number;
  score: number;
  factors: FactorResult[];
}

/** First matching band wins. Returns null when no band matches. */
export function bandPoints(value: number, bands: Band[]): number | null {
  for (const b of bands) {
    if (b.eq !== undefined) {
      if (value === b.eq) return b.points;
      continue;
    }
    if (b.lte !== undefined && !(value <= b.lte)) continue;
    if (b.gte !== undefined && !(value >= b.gte)) continue;
    if (b.lt !== undefined && !(value < b.lt)) continue;
    if (b.gt !== undefined && !(value > b.gt)) continue;
    return b.points;
  }
  return null;
}

/** Score a single factor against a field getter. */
export function resolveFactor(
  f: ScorableFactor,
  get: (k: string) => any,
): { points: number; note: string; verify: boolean } {
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

/**
 * Score every dimension. Returns the per-dimension breakdown, the raw sum, and
 * the VERIFY flags raised by factors whose input was missing.
 */
export function scoreDimensions(
  dimensions: ScorableDimension[],
  get: (k: string) => any,
): { dimResults: DimensionResult[]; rawSum: number; verifyFields: string[] } {
  const verifyFields: string[] = [];
  const dimResults = dimensions.map((d) => {
    const factors = d.factors.map((f) => {
      const r = resolveFactor(f, get);
      if (r.verify) verifyFields.push(`${d.key}: ${f.label}`);
      return { label: f.label, points: clamp(r.points, 0, f.max), max: f.max, note: r.note, verify: r.verify };
    });
    const score = clamp(factors.reduce((s, f) => s + f.points, 0), 0, d.max);
    return { key: d.key, label: d.label, max: d.max, gate: d.gate, score, factors };
  });
  const rawSum = dimResults.reduce((s, d) => s + d.score, 0);
  return { dimResults, rawSum, verifyFields };
}

/** Every dimension that declares a gate must meet it. */
export function gatesPass(dimResults: DimensionResult[]): boolean {
  return dimResults.every((d) => d.gate == null || d.score >= d.gate);
}

/** Which gated dimensions failed — for the "why" line, not just a boolean. */
export function failedGates(dimResults: DimensionResult[]): DimensionResult[] {
  return dimResults.filter((d) => d.gate != null && d.score < d.gate);
}

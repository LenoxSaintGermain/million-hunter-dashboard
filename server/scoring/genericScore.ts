/**
 * Config-driven scorer for NON-historic asset classes (scorer: "generic").
 * Reads an AssetClass.scoring config + an asset (native columns + class_metadata)
 * and produces the SAME result shape as the historic A–G scorer, so every surface
 * renders any class uniformly. Historic keeps its bespoke engine untouched.
 */
import type { AssetClass } from "../../shared/assetClasses";
import { criticalFields } from "../../shared/assetClasses";
import { clamp, scoreDimensions, gatesPass as allGatesPass, failedGates } from "./bands";

export function scoreGenericAsset(cls: AssetClass, asset: any) {
  const model = cls.scoring!;
  const meta = (asset.classMetadata ?? asset.class_metadata ?? {}) as Record<string, any>;
  const baseGet = (k: string): any => (asset[k] !== undefined ? asset[k] : meta[k]);
  const derived = model.derive ? model.derive((k) => { const v = baseGet(k); return v == null ? undefined : Number(v); }) : {};
  const get = (k: string): any => (derived[k] !== undefined ? derived[k] : baseGet(k));

  const { dimResults, rawSum, verifyFields } = scoreDimensions(model.dimensions, get);
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

  const gatesPass = allGatesPass(dimResults);
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
  if (!gatesPass) risks.push(`Gate not met on ${failedGates(dimResults).map((d) => d.key).join(", ")}`);
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

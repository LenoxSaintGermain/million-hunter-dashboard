/**
 * Thesis-fit scoring for a security.
 *
 * Reuses the band/factor/dimension primitives the property engine runs on
 * (server/scoring/bands.ts) so there is one implementation of "score a thing
 * against a config", not two that drift.
 *
 * What is scored is deliberately NOT "is this a good company". It is:
 *   A  does it express the thesis (exposure-node coverage, sector match)
 *   B  do we actually know anything (ledger coverage — evidence, not vibes)
 *   C  what are we paying (valuation, only where sourced)
 *   D  can it be traded at size (liquidity)
 *
 * Confidence is the fraction of scoring-relevant facts that exist. A name with
 * a great score and low confidence outranks nothing — rankScore discounts it,
 * exactly as the property scorer does.
 */
import { scoreDimensions, gatesPass, failedGates, clamp, type ScorableDimension } from "../scoring/bands";
import type { SecurityFact } from "../../drizzle/schema";
import type { ThesisGraph } from "./thesisGraph";

export interface ThesisFitScore {
  symbol: string;
  compositeScore: number;
  confidenceScore: number;
  rankScore: number;
  dimensions: ReturnType<typeof scoreDimensions>["dimResults"];
  verifyFields: string[];
  /** Set when an exclusion in the thesis rules this out entirely. */
  hardStopFailed: string | null;
  gatesPass: boolean;
  matchedNodes: string[];
  strengths: string[];
  risks: string[];
}

/** Facts that carry weight. Missing ones lower confidence rather than the score. */
const SCORING_FACTS = ["revenue_ttm", "pe_ratio", "price_to_sales", "adv_usd_30d", "last_price", "market_cap"];
export type ScoreHoldingPeriod = "intraday" | "overnight" | "swing" | "catalyst_window";

function normalizeHoldingPeriod(value: unknown): ScoreHoldingPeriod {
  return ["intraday", "overnight", "swing", "catalyst_window"].includes(String(value))
    ? value as ScoreHoldingPeriod
    : "swing";
}

function scoringFactsFor(holdingPeriod: ScoreHoldingPeriod): string[] {
  // Valuation multiples describe a longer-horizon ownership question. They do
  // not confirm or invalidate a same-session tape setup, so they cannot block
  // an intraday candidate through the evidence-review gate.
  return holdingPeriod === "intraday"
    ? SCORING_FACTS.filter((key) => key !== "pe_ratio" && key !== "price_to_sales")
    : SCORING_FACTS;
}

/**
 * Dimensions are fixed in shape but their thresholds come from the thesis: a
 * liquidity floor the investor stated becomes the gate on D.
 */
export function dimensionsFor(graph: ThesisGraph, holdingPeriod: ScoreHoldingPeriod = "swing"): ScorableDimension[] {
  const minAdv = graph.portfolioRules.minAvgDailyVolumeUsd;
  return [
    {
      key: "A", label: "Thesis expression", max: 40, gate: 12,
      factors: [
        { key: "nodes", label: "Exposure nodes matched", max: 28, field: "nodeMatchCount", missing: 0, verifyWhenMissing: true,
          bands: [{ gte: 4, points: 28 }, { gte: 3, points: 22 }, { gte: 2, points: 15 }, { gte: 1, points: 8 }, { gte: 0, points: 0 }] },
        { key: "sector", label: "Named-sector match", max: 12, field: "sectorMatch", whenTrue: 12 },
      ],
    },
    {
      key: "B", label: "Evidence coverage", max: 25, gate: 8,
      factors: [
        { key: "coverage", label: "Sourced facts available", max: 25, field: "factCoveragePct", missing: 0, verifyWhenMissing: true,
          bands: [{ gte: 80, points: 25 }, { gte: 60, points: 19 }, { gte: 40, points: 12 }, { gte: 20, points: 6 }, { gte: 0, points: 0 }] },
      ],
    },
    holdingPeriod === "intraday"
      ? { key: "C", label: "Valuation (not used for intraday)", max: 0, factors: [] }
      : {
        key: "C", label: "Valuation", max: 20,
        factors: [
          // No sourced multiple → mid-range points, not a bonus. Absence is not cheapness.
          { key: "pe", label: "Price / earnings", max: 12, field: "pe_ratio", missing: 4, verifyWhenMissing: true,
            bands: [{ lte: 15, points: 12 }, { lte: 25, points: 9 }, { lte: 40, points: 5 }, { gt: 40, points: 1 }] },
          { key: "ps", label: "Price / sales", max: 8, field: "price_to_sales", missing: 3, verifyWhenMissing: true,
            bands: [{ lte: 3, points: 8 }, { lte: 8, points: 5 }, { lte: 15, points: 2 }, { gt: 15, points: 0 }] },
        ],
      },
    {
      key: "D", label: "Tradability", max: 15, gate: minAdv != null ? 6 : undefined,
      factors: [
        { key: "adv", label: "Average daily dollar volume", max: 10, field: "adv_usd_30d", missing: 0, verifyWhenMissing: true,
          bands: minAdv != null
            ? [{ gte: minAdv * 5, points: 10 }, { gte: minAdv * 2, points: 8 }, { gte: minAdv, points: 6 }, { gt: 0, points: 0 }]
            : [{ gte: 50e6, points: 10 }, { gte: 10e6, points: 8 }, { gte: 2e6, points: 5 }, { gt: 0, points: 2 }] },
        { key: "vol", label: "Realised volatility", max: 5, field: "volatility_30d", missing: 2, verifyWhenMissing: true,
          bands: [{ lte: 0.3, points: 5 }, { lte: 0.5, points: 4 }, { lte: 0.8, points: 2 }, { gt: 0.8, points: 0 }] },
      ],
    },
  ];
}

/** Which exposure-tree node labels this security's text facts mention. */
export function matchExposureNodes(facts: SecurityFact[], nodeLabels: string[]): string[] {
  const hay = facts
    .filter((f) => f.basis !== "unknown")
    .map((f) => `${f.factKey} ${f.valueText ?? ""} ${f.sourceName ?? ""}`)
    .join(" ")
    .toLowerCase();
  return nodeLabels.filter((label) => {
    const l = label.toLowerCase().trim();
    return l.length > 3 && hay.includes(l);
  });
}

/** Thesis exclusions are hard stops, not penalties. */
export function checkExclusions(facts: SecurityFact[], graph: ThesisGraph): string | null {
  const hay = facts
    .filter((f) => f.basis !== "unknown")
    .map((f) => `${f.valueText ?? ""} ${f.factKey}`)
    .join(" ")
    .toLowerCase();
  for (const ex of graph.exclusions) {
    const e = ex.toLowerCase().trim();
    if (e.length > 3 && hay.includes(e)) return `Excluded by the thesis: "${ex}"`;
  }
  return null;
}

export interface ScoreInput {
  symbol: string;
  facts: SecurityFact[];
  graph: ThesisGraph;
  /** Flattened exposure-tree labels; matched against the security's facts. */
  nodeLabels: string[];
  /** Sector supplied by a provider, if any. */
  sector?: string | null;
  /** Intraday scoring deliberately excludes trailing valuation multiples. */
  holdingPeriod?: ScoreHoldingPeriod | null;
}

export function scoreThesisFit(input: ScoreInput): ThesisFitScore {
  const { symbol, facts, graph, nodeLabels } = input;
  const holdingPeriod = normalizeHoldingPeriod(input.holdingPeriod);

  const byKey = new Map<string, SecurityFact>();
  for (const f of facts) if (f.basis !== "unknown") byKey.set(f.factKey, f);

  const matchedNodes = matchExposureNodes(facts, nodeLabels);
  const sectorFact = input.sector ?? (byKey.get("sector")?.valueText ?? null);
  const sectorMatch = Boolean(
    sectorFact && graph.sectors.some((s) => s.toLowerCase().trim() && sectorFact.toLowerCase().includes(s.toLowerCase().trim())),
  );

  const scoringFacts = scoringFactsFor(holdingPeriod);
  const present = scoringFacts.filter((k) => byKey.has(k));
  const factCoveragePct = (present.length / scoringFacts.length) * 100;

  const derived: Record<string, unknown> = {
    nodeMatchCount: matchedNodes.length,
    sectorMatch,
    factCoveragePct,
  };
  const get = (k: string): any => {
    if (k in derived) return derived[k];
    const f = byKey.get(k);
    if (!f) return undefined;
    return f.valueNum ?? f.valueText ?? undefined;
  };

  const dims = dimensionsFor(graph, holdingPeriod);
  const { dimResults, rawSum, verifyFields } = scoreDimensions(dims, get);
  const maxAvailablePoints = dims.reduce((sum, dimension) => sum + dimension.max, 0);
  const compositeScore = clamp(Math.round(maxAvailablePoints > 0 ? (rawSum / maxAvailablePoints) * 100 : 0), 0, 100);

  const confidenceScore = present.length / SCORING_FACTS.length;
  const rankScore = Math.round(compositeScore * (0.5 + 0.5 * confidenceScore) * 10) / 10;

  const hardStopFailed = checkExclusions(facts, graph);
  const passes = gatesPass(dimResults);

  const strengths: string[] = [];
  if (matchedNodes.length) strengths.push(`Expresses ${matchedNodes.length} thesis node(s): ${matchedNodes.slice(0, 3).join(", ")}`);
  if (sectorMatch && sectorFact) strengths.push(`In a named target sector (${sectorFact})`);
  if (factCoveragePct >= 80) strengths.push("Well covered by sourced facts");

  const risks: string[] = [];
  if (hardStopFailed) risks.push(hardStopFailed);
  if (!passes) risks.push(`Gate not met on ${failedGates(dimResults).map((d) => d.key).join(", ")}`);
  if (confidenceScore < 0.5) {
    risks.push(`Only ${present.length}/${scoringFacts.length} scoring facts are sourced — this score rests on thin evidence`);
  }
  if (!matchedNodes.length) risks.push("No exposure node matched — the thesis link is asserted, not evidenced");

  return {
    symbol,
    compositeScore: hardStopFailed ? 0 : compositeScore,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    rankScore: hardStopFailed ? 0 : rankScore,
    dimensions: dimResults,
    verifyFields,
    hardStopFailed,
    gatesPass: passes,
    matchedNodes,
    strengths,
    risks: risks.slice(0, 4),
  };
}

/**
 * Assign a role from the score and what the investor already planned.
 * `core` is reserved for names that clear the gates AND were already on the
 * investor's list or match strongly — everything discovered sits below it until
 * it earns the promotion.
 */
export function assignRole(
  score: ThesisFitScore,
  opts: { intended: Set<string>; held: Set<string> },
): "core" | "complementary" | "remainder" | "alternative_expression" {
  if (opts.intended.has(score.symbol)) return "core";
  if (score.gatesPass && score.matchedNodes.length >= 3 && score.confidenceScore >= 0.6) return "core";
  if (score.matchedNodes.length >= 2) return "complementary";
  if (score.matchedNodes.length >= 1) return "alternative_expression";
  return "remainder";
}

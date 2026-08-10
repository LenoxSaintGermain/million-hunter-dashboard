/**
 * Run assembly — discover → research → score → construct.
 *
 * Split deliberately: `assembleRun` is PURE. Given the discovered universe, the
 * fact ledger, the thesis and the portfolio, it produces candidates, exposure
 * coverage, strategies and the recomposition — with no database, no network and
 * no clock. That is what makes the interesting logic testable, and it keeps the
 * I/O (Sonar calls, provider fan-out, persistence) at the edge in the router.
 *
 * The order of operations matters and is not arbitrary:
 *   1. score EVERY discovered symbol, including ones that will lose
 *   2. drop hard-stopped names, but keep the count so the run can report it
 *   3. assign roles from evidence, not from where the name came from
 *   4. build strategies, which apply the portfolio rules
 *   5. recompose against the human's own plan
 * A name the investor intended is scored on the same basis as one the system
 * found. That symmetry is the point — otherwise "re-underwrite the plan" is
 * just a slogan.
 */
import type { SecurityFact } from "../../drizzle/schema";
import { normSymbol } from "./facts";
import { scoreThesisFit, assignRole, type ThesisFitScore } from "./score";
import {
  buildStrategies,
  recompose,
  opportunityCost,
  type Candidate,
  type Strategy,
  type Recomposition,
} from "./strategies";
import { snapshot, type Holding, type PortfolioSnapshot } from "./portfolioMath";
import { flattenExposureTree, type ThesisGraph } from "./thesisGraph";
import type { DiscoveredSymbol } from "./universe";

export interface AssembleInput {
  graph: ThesisGraph;
  /** Symbols found by discovery, plus anything the investor already named. */
  discovered: DiscoveredSymbol[];
  /** symbol → its facts. Symbols with no entry are scored on an empty ledger. */
  factsBySymbol: Map<string, SecurityFact[]>;
  holdings: Holding[];
  cashCents: number;
  deployableCapitalCents: number;
  intendedTrades: Array<{ symbol: string; dollarsCents: number }>;
  hurdleRateBps?: number | null;
}

export interface AssembledCandidate {
  symbol: string;
  role: Candidate["role"];
  score: ThesisFitScore;
  /** Which exposure-node paths this name covers. */
  nodePaths: string[];
  /** Where it came from, when discovery found it. */
  discoveredVia: string | null;
  rationale: string | null;
  citations: string[];
}

export interface AssembledRun {
  candidates: AssembledCandidate[];
  strategies: Strategy[];
  recomposition: Recomposition | null;
  opportunityCost: ReturnType<typeof opportunityCost> | null;
  portfolioBefore: PortfolioSnapshot;
  /** node path → symbols covering it, from holdings + intended + candidates. */
  exposureCoverage: Array<{
    nodePath: string;
    symbol: string;
    source: "holding" | "intended" | "candidate";
  }>;
  /** Nodes in the thesis that nothing covers — the underexposed list. */
  uncoveredNodes: string[];
  stats: {
    universeCount: number;
    scoredCount: number;
    hardStoppedCount: number;
    candidateCount: number;
    /** Names carried purely on an empty or near-empty ledger. */
    thinEvidenceCount: number;
  };
  /** Everything deliberately set aside, and why. Rendered, not swallowed. */
  setAside: Array<{ symbol: string; reason: string }>;
}

const advOf = (facts: SecurityFact[] | undefined): number | null => {
  const f = facts?.find((x) => x.factKey === "adv_usd_30d" && x.basis !== "unknown");
  return f?.valueNum ?? null;
};

const sectorOf = (facts: SecurityFact[] | undefined): string | null => {
  const f = facts?.find((x) => x.factKey === "sector" && x.basis !== "unknown");
  return f?.valueText ?? null;
};

const expectedReturnBpsOf = (facts: SecurityFact[] | undefined): number | null => {
  const f = facts?.find((x) => x.factKey === "expected_return_bps" && x.basis !== "unknown");
  return f?.valueNum ?? null;
};

export function assembleRun(input: AssembleInput): AssembledRun {
  const {
    graph,
    discovered,
    factsBySymbol,
    holdings,
    cashCents,
    deployableCapitalCents,
    intendedTrades,
    hurdleRateBps,
  } = input;

  const nodeRows = flattenExposureTree(graph.exposureTree);
  const nodeLabels = nodeRows.map((n) => n.label);
  const pathByLabel = new Map(nodeRows.map((n) => [n.label, n.path]));

  const intendedSet = new Set(intendedTrades.map((t) => normSymbol(t.symbol)));
  const heldSet = new Set(holdings.map((h) => normSymbol(h.symbol)));

  // The investor's own picks are scored alongside everything else. Without this
  // there is no baseline to re-underwrite against.
  const bySymbol = new Map<string, DiscoveredSymbol>();
  for (const d of discovered) bySymbol.set(normSymbol(d.symbol), d);
  for (const sym of Array.from(intendedSet)) {
    if (!bySymbol.has(sym)) {
      bySymbol.set(sym, {
        symbol: sym,
        name: null,
        nodeLabel: "",
        rationale: "Named in your intended trades",
        citations: [],
      });
    }
  }

  const setAside: Array<{ symbol: string; reason: string }> = [];
  const candidates: AssembledCandidate[] = [];
  let hardStopped = 0;
  let thinEvidence = 0;

  for (const [symbol, d] of Array.from(bySymbol.entries())) {
    const facts = factsBySymbol.get(symbol) ?? [];
    const score = scoreThesisFit({
      symbol,
      facts,
      graph,
      nodeLabels,
      sector: sectorOf(facts),
    });

    if (score.hardStopFailed) {
      hardStopped++;
      setAside.push({ symbol, reason: score.hardStopFailed });
      continue;
    }
    if (score.confidenceScore < 0.2) {
      // Not discarded — surfaced as thin. The investor decides whether an
      // unresearched name is worth pursuing; the system does not decide for them.
      thinEvidence++;
    }

    const role = assignRole(score, { intended: intendedSet, held: heldSet });
    candidates.push({
      symbol,
      role,
      score,
      nodePaths: score.matchedNodes.map((l) => pathByLabel.get(l) ?? l),
      discoveredVia: d.nodeLabel || null,
      rationale: d.rationale,
      citations: d.citations,
    });
  }

  candidates.sort((a, b) => b.score.rankScore - a.score.rankScore);

  const strategyCandidates: Candidate[] = candidates.map((c) => {
    const facts = factsBySymbol.get(c.symbol);
    return {
      symbol: c.symbol,
      role: c.role,
      compositeScore: c.score.compositeScore,
      confidenceScore: c.score.confidenceScore,
      sector: sectorOf(facts),
      advUsd: advOf(facts),
      expectedReturnBps: expectedReturnBpsOf(facts),
    };
  });

  const strategies = buildStrategies({
    deployableCapitalCents,
    candidates: strategyCandidates,
    holdings,
    cashCents,
    rules: graph.portfolioRules,
    intendedTrades: intendedTrades.map((t) => ({
      symbol: normSymbol(t.symbol),
      dollarsCents: t.dollarsCents,
    })),
    hurdleRateBps: hurdleRateBps ?? null,
  });

  const human = strategies.find((s) => s.kind === "human_baseline") ?? null;
  const expanded = strategies.find((s) => s.kind === "expanded") ?? null;

  // ── Exposure coverage: what the thesis asks for vs what is actually held ──
  const coverage: AssembledRun["exposureCoverage"] = [];
  const coveredPaths = new Set<string>();
  const addCoverage = (
    symbol: string,
    source: "holding" | "intended" | "candidate"
  ) => {
    const c = candidates.find((x) => x.symbol === symbol);
    for (const path of c?.nodePaths ?? []) {
      coverage.push({ nodePath: path, symbol, source });
      coveredPaths.add(path);
    }
  };
  for (const h of holdings) addCoverage(normSymbol(h.symbol), "holding");
  for (const t of Array.from(intendedSet)) {
    if (!heldSet.has(t)) addCoverage(t, "intended");
  }
  for (const c of candidates) {
    if (heldSet.has(c.symbol) || intendedSet.has(c.symbol)) continue;
    addCoverage(c.symbol, "candidate");
  }

  const uncoveredNodes = nodeRows
    .filter((n) => !coveredPaths.has(n.path))
    .map((n) => n.path);

  return {
    candidates,
    strategies,
    recomposition: human && expanded ? recompose(human, expanded) : null,
    opportunityCost: expanded ? opportunityCost(expanded, strategies) : null,
    portfolioBefore: snapshot(holdings, cashCents),
    exposureCoverage: coverage,
    uncoveredNodes,
    stats: {
      universeCount: bySymbol.size,
      scoredCount: bySymbol.size,
      hardStoppedCount: hardStopped,
      candidateCount: candidates.length,
      thinEvidenceCount: thinEvidence,
    },
    setAside,
  };
}

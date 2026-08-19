/**
 * Capital Aperture decision brief.
 *
 * This is deliberately a research-orientation layer, not an allocation engine.
 * It turns the run's existing evidence into a plain-language decision frame:
 * thesis horizon → portfolio gap → evidence state → next human decision.
 */
import { buildProgressiveEvidenceGate } from "@shared/evidenceGate";

export type DecisionCandidate = {
  id: number;
  symbol: string;
  role: string;
  compositeScore: number | null;
  confidenceScore: number | null;
  verifyFields: unknown;
  memoStatus: string;
};

export type DecisionStrategy = {
  id: number;
  kind: string;
  label: string;
  rationale: string | null;
  allocations: unknown;
  cashRetainedCents: number | null;
  portfolioImpact: unknown;
};

export type DecisionCoverage = { nodePath: string; symbol: string; source: string };

export type CapitalDecisionBrief = {
  horizon: {
    label: string;
    specified: boolean;
    guidance: string;
  };
  thesis: {
    belief: string | null;
    seek: string[];
    avoid: string[];
  };
  portfolioContext: {
    deployableCapitalCents: number;
    hurdleRateBps: number | null;
    intendedTradeCount: number;
    uncoveredNodes: string[];
    coveredNodeCount: number;
  };
  evidence: {
    candidateCount: number;
    researchPriorityCount: number;
    memoReadyCount: number;
    verificationCount: number;
    lowConfidenceCount: number;
    decisionCriticalCheckCount: number;
    researchFollowUpCheckCount: number;
    researchReady: boolean;
    paperOrderEligible: boolean;
  };
  nextDecision: {
    stage: "set_horizon" | "validate_evidence" | "compare_postures" | "review_memo" | "monitor";
    title: string;
    detail: string;
    primaryCandidateId: number | null;
  };
  recommendedResearchPosture: {
    strategyId: number | null;
    label: string;
    rationale: string;
  } | null;
  priorityCandidate: {
    id: number;
    symbol: string;
    role: string;
    confidenceScore: number;
    verifyCount: number;
    leadReason: string;
  } | null;
};

const verifyCount = (value: unknown) => Array.isArray(value) ? value.length : 0;

const displayHorizon = (horizons: unknown): string | null => {
  if (!Array.isArray(horizons) || !horizons.length) return null;
  const first = horizons.find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return first?.trim() ?? null;
};

export function buildCapitalDecisionBrief(input: {
  graph: { beliefs?: string[]; seek?: string[]; avoid?: string[]; horizons?: string[] } | null | undefined;
  run: { deployableCapitalCents: number; hurdleRateBps: number | null; intendedTrades: unknown };
  candidates: DecisionCandidate[];
  strategies: DecisionStrategy[];
  coverage: DecisionCoverage[];
  thesisNodePaths: string[];
}): CapitalDecisionBrief {
  const graph = input.graph ?? {};
  const horizonLabel = displayHorizon(graph.horizons);
  const candidateOrder = [...input.candidates].sort((left, right) => {
    const leftRole = left.role === "core" ? 1 : 0;
    const rightRole = right.role === "core" ? 1 : 0;
    if (leftRole !== rightRole) return rightRole - leftRole;
    return ((right.compositeScore ?? 0) * (right.confidenceScore ?? 0)) - ((left.compositeScore ?? 0) * (left.confidenceScore ?? 0));
  });
  const priorityCandidate = candidateOrder[0] ?? null;
  const verificationCount = input.candidates.reduce((total, candidate) => total + verifyCount(candidate.verifyFields), 0);
  const lowConfidenceCount = input.candidates.filter((candidate) => (candidate.confidenceScore ?? 0) < 0.5).length;
  const coveredNodePaths = new Set(input.coverage.map((coverage) => coverage.nodePath));
  const uncoveredNodes = input.thesisNodePaths
    .filter((nodePath) => !coveredNodePaths.has(nodePath))
    .filter((value, index, values) => values.indexOf(value) === index);
  const intendedTradeCount = Array.isArray(input.run.intendedTrades) ? input.run.intendedTrades.length : 0;
  const memoReadyCount = input.candidates.filter((candidate) => candidate.memoStatus === "ok").length;
  const riskBalanced = input.strategies.find((strategy) => strategy.kind === "risk_balanced")
    ?? input.strategies.find((strategy) => strategy.kind === "dry_powder")
    ?? input.strategies[0]
    ?? null;
  const evidenceGate = buildProgressiveEvidenceGate(priorityCandidate, input.candidates);

  let nextDecision: CapitalDecisionBrief["nextDecision"];
  if (!horizonLabel) {
    nextDecision = {
      stage: "set_horizon",
      title: "Set the time horizon before comparing portfolio postures",
      detail: "A horizon tells the research process whether to prioritise nearer catalysts, multi-quarter compounding, or a reserve-first posture.",
      primaryCandidateId: null,
    };
  } else if (priorityCandidate && evidenceGate.decisionCriticalCheckCount > 0) {
    nextDecision = {
      stage: "validate_evidence",
      title: evidenceGate.headline,
      detail: `${evidenceGate.researchFollowUpCheckCount} supporting check${evidenceGate.researchFollowUpCheckCount === 1 ? "" : "s"} can continue in parallel; they do not block memo review, posture comparison, or research continuation. A paper order remains off-limits until the decision-critical checks and human approval are complete.`,
      primaryCandidateId: priorityCandidate.id,
    };
  } else if (memoReadyCount > 0 && priorityCandidate) {
    nextDecision = {
      stage: "review_memo",
      title: "Read the fact-traced decision memo before choosing a posture",
      detail: "The memo explains thesis fit, catalyst, invalidation, and relation to the current portfolio with its cited evidence.",
      primaryCandidateId: priorityCandidate.id,
    };
  } else if (riskBalanced) {
    nextDecision = {
      stage: "compare_postures",
      title: "Compare portfolio postures rather than browsing symbols",
      detail: "Choose the degree of concentration, diversification, and retained cash that fits the stated horizon and evidence quality.",
      primaryCandidateId: priorityCandidate?.id ?? null,
    };
  } else {
    nextDecision = {
      stage: "monitor",
      title: "Wait for research completion before forming a paper portfolio view",
      detail: "The system has not yet produced enough evidence-backed strategic options to compare.",
      primaryCandidateId: priorityCandidate?.id ?? null,
    };
  }

  return {
    horizon: {
      label: horizonLabel ?? "Not specified",
      specified: Boolean(horizonLabel),
      guidance: horizonLabel
        ? `Research is being interpreted against the stated ${horizonLabel.toLowerCase()} horizon.`
        : "Specify a horizon in the canonical thesis so the research can distinguish catalyst timing from long-duration thesis fit.",
    },
    thesis: {
      belief: graph.beliefs?.[0] ?? null,
      seek: graph.seek ?? [],
      avoid: graph.avoid ?? [],
    },
    portfolioContext: {
      deployableCapitalCents: input.run.deployableCapitalCents,
      hurdleRateBps: input.run.hurdleRateBps,
      intendedTradeCount,
      uncoveredNodes,
      coveredNodeCount: coveredNodePaths.size,
    },
    evidence: {
      candidateCount: input.candidates.length,
      researchPriorityCount: input.candidates.filter((candidate) => candidate.role === "core" || candidate.role === "complementary").length,
      memoReadyCount,
      verificationCount,
      lowConfidenceCount,
      decisionCriticalCheckCount: evidenceGate.decisionCriticalCheckCount,
      researchFollowUpCheckCount: evidenceGate.researchFollowUpCheckCount,
      researchReady: evidenceGate.researchReady,
      paperOrderEligible: evidenceGate.paperOrderEligible,
    },
    nextDecision,
    recommendedResearchPosture: riskBalanced ? {
      strategyId: riskBalanced.id,
      label: riskBalanced.label,
      rationale: riskBalanced.rationale ?? "Compare this posture against the thesis horizon, evidence gaps, and existing portfolio before any paper order is created.",
    } : null,
    priorityCandidate: priorityCandidate ? {
      id: priorityCandidate.id,
      symbol: priorityCandidate.symbol,
      role: priorityCandidate.role,
      confidenceScore: priorityCandidate.confidenceScore ?? 0,
      verifyCount: verifyCount(priorityCandidate.verifyFields),
      leadReason: priorityCandidate.role === "core"
        ? "It is a direct thesis expression; direct expressions lead this brief before complementary or reserve ideas, then current research fit and confidence break ties."
        : "No direct thesis expression was available, so this candidate leads on the current research-fit and confidence tie-breaker.",
    } : null,
  };
}

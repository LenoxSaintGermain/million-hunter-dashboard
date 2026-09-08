import {
  assessCausalEconomicPath,
  deriveCapitalEnvelope,
  type CapitalEnvelopeInput,
  type CapitalInvestmentAlternative,
  type CapitalSearchScope,
  type CapitalStrategyCandidate,
  type CapitalStrategyDecision,
  type StrategyIntent,
} from "../../shared/capitalStrategy";
import type { UnderwritingHoldingPeriod } from "../../shared/playUnderwriting";

export type CapitalStrategistInput = {
  intent: StrategyIntent;
  capital: CapitalEnvelopeInput;
  candidates: CapitalStrategyCandidate[];
  searchScope: CapitalSearchScope;
  reviewedUniverse: string[];
  coverageGaps: string[];
  providerState: { status: "available" | "partial" | "failed"; failures: string[] };
  comparisonHorizon?: UnderwritingHoldingPeriod | null;
  now: number;
  reviewAt: number | null;
};

const compareCandidates = (left: CapitalStrategyCandidate, right: CapitalStrategyCandidate) => {
  const scoreDelta = (right.underwriter.overallScore ?? -1) - (left.underwriter.overallScore ?? -1);
  return scoreDelta || left.id.localeCompare(right.id);
};

/**
 * Deterministically compares capital uses already sized by the Play Underwriter.
 * It is pure: no persistence, proposal, order, broker, or buying-power mutation.
 */
export function buildCapitalStrategyDecision(input: CapitalStrategistInput): CapitalStrategyDecision {
  const envelope = deriveCapitalEnvelope(input.capital);
  const assessed = input.candidates.map((candidate) => ({
    candidate,
    assessment: assessCausalEconomicPath(candidate.causalPath),
  }));
  const unavailable = input.providerState.status === "failed";
  const capitalUsableForComparison = envelope.status === "verified" || envelope.status === "operator_declared";
  const qualified = assessed
    .filter(({ candidate, assessment }) =>
      !unavailable
      && capitalUsableForComparison
      && candidate.underwriter.state === "qualified"
      && candidate.underwriter.overallScore != null
      && assessment.status === "verified"
      && (input.comparisonHorizon == null || candidate.horizon === input.comparisonHorizon),
    )
    .map(({ candidate }) => candidate)
    .sort(compareCandidates);

  const bestByUse = new Map<CapitalStrategyCandidate["use"], CapitalStrategyCandidate>();
  for (const candidate of qualified) if (!bestByUse.has(candidate.use)) bestByUse.set(candidate.use, candidate);
  const selected = Array.from(bestByUse.values()).sort(compareCandidates).slice(0, 2);
  if (selected.length < 2) {
    for (const candidate of qualified) {
      if (selected.some((item) => item.id === candidate.id)) continue;
      selected.push(candidate);
      if (selected.length === 2) break;
    }
  }

  const investmentAlternatives: CapitalInvestmentAlternative[] = selected.map((candidate) => ({
    candidateId: candidate.id,
    kind: candidate.use,
    title: candidate.title,
    symbol: candidate.symbol,
    horizon: candidate.horizon,
    underwritingResultId: candidate.underwriter.resultId,
    playId: candidate.underwriter.playId,
    underwriterScore: candidate.underwriter.overallScore!,
    plannedRiskCents: candidate.underwriter.plannedRiskCents,
    evidenceStatus: "verified",
    whyThisUse: candidate.whyThisUse,
    whyNow: candidate.whyNow,
    whyNotAlternatives: candidate.whyNotAlternatives,
    changeCondition: candidate.changeCondition,
  }));

  const first = investmentAlternatives[0];
  const retainExplanation = unavailable
    ? "Retain capital because required provider evidence is unavailable; no confidence is inferred from the failure."
    : !capitalUsableForComparison
      ? "Retain capital because the source is hypothetical, unavailable, or already claimed."
      : "Retain capital until a reviewed candidate clears both causal evidence and existing underwriting gates.";
  const primaryConclusion: CapitalStrategyDecision["primaryConclusion"] = first
    ? { kind: first.kind, candidateId: first.candidateId, explanation: `${first.whyThisUse} ${first.whyNow}` }
    : { kind: "retain_capital", candidateId: null, explanation: retainExplanation };

  return {
    intent: input.intent,
    status: unavailable
      ? "unavailable"
      : input.providerState.status === "partial" || envelope.status === "hypothetical_only" || envelope.status === "blocked"
        ? "incomplete"
        : "complete",
    asOf: input.now,
    searchScope: input.searchScope,
    envelope,
    primaryConclusion,
    investmentAlternatives,
    retainCapital: {
      alwaysAvailable: true,
      amountCents: envelope.deployableCents,
      reason: first ? "Retaining the eligible envelope remains valid; spare capital does not require deployment." : retainExplanation,
      reviewCondition: first?.changeCondition ?? "Reassess after the named evidence, availability, or provider gap changes.",
      reviewAt: input.reviewAt,
    },
    reviewedUniverse: Array.from(new Set(input.reviewedUniverse)),
    coverageGaps: Array.from(new Set([...input.coverageGaps, ...input.providerState.failures])),
    rejectedHypotheses: assessed
      .filter(({ candidate, assessment }) => candidate.underwriter.state !== "qualified" || assessment.status !== "verified")
      .map(({ candidate, assessment }) => ({
        candidateId: candidate.id,
        reasons: Array.from(new Set([
          ...assessment.reasons,
          ...(candidate.underwriter.state === "qualified" ? [] : [`underwriter_${candidate.underwriter.state}`]),
        ])),
      })),
    sideEffects: {
      capitalReserved: false,
      proposalCreated: false,
      orderCreated: false,
      brokerInvoked: false,
    },
  };
}

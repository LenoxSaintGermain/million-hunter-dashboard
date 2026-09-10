import {
  assessCausalEconomicPath,
  deriveCapitalEnvelope,
  capitalSourceLineageId,
  capitalStrategyBindingReceiptSchema,
  type CapitalEnvelopeInput,
  type CapitalInvestmentAlternative,
  type CapitalSearchScope,
  type CapitalStrategyCandidate,
  type CapitalStrategyDecision,
  type CapitalStrategyBindingReceipt,
  type StrategyIntent,
  type StrategyEvidenceState,
} from "../../shared/capitalStrategy";
import type { UnderwritingHoldingPeriod } from "../../shared/playUnderwriting";

export type CapitalStrategistInput = {
  intent: StrategyIntent;
  capital: CapitalEnvelopeInput;
  candidates: CapitalStrategyCandidate[];
  searchScope: CapitalSearchScope;
  reviewedUniverse: string[];
  coverageGaps: string[];
  providerState: StrategyEvidenceState;
  classifierState?: StrategyEvidenceState;
  comparisonHorizon?: UnderwritingHoldingPeriod | null;
  now: number;
  reviewAt: number | null;
  /** Server-owned persisted identity lookup; never constructed from model/browser claims.
   * Optional for caller compatibility, but required before an alternative can qualify. */
  bindingReceipt?: CapitalStrategyBindingReceipt | null;
};

const compareCandidates = (left: CapitalStrategyCandidate, right: CapitalStrategyCandidate) => {
  const scoreDelta = (right.underwriter.overallScore ?? -1) - (left.underwriter.overallScore ?? -1);
  return scoreDelta || left.id.localeCompare(right.id);
};

const nonBlank = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const symbolKey = (value: unknown) => nonBlank(value) ? value.trim().toUpperCase() : null;

function candidateIdentityChecks(input: CapitalStrategistInput) {
  const parsed = capitalStrategyBindingReceiptSchema.safeParse(input.bindingReceipt);
  const receipt = parsed.success ? parsed.data : null;
  let globalReason: string | null = !receipt || receipt.status !== "complete" ? "underwriting_binding_unverified" : null;
  if (receipt && !globalReason && (!Number.isSafeInteger(input.now) || input.now < 0 || receipt.asOf !== input.now
    || receipt.sourceId !== input.capital.source.id || receipt.accountId !== input.capital.source.account.id
    || receipt.capitalEventId !== capitalSourceLineageId(input.capital.source))) globalReason = "underwriting_source_mismatch";
  const bindings = new Map<string, CapitalStrategyBindingReceipt["candidates"][number]>();
  const boundPlays = new Set<string>();
  for (const binding of receipt?.candidates ?? []) {
    const playKey = JSON.stringify([binding.underwritingResultId, binding.playId]);
    if (bindings.has(binding.candidateId) || boundPlays.has(playKey)) globalReason = "underwriting_binding_ambiguous";
    bindings.set(binding.candidateId, binding);
    boundPlays.add(playKey);
  }
  const counts = new Map<string, number>();
  for (const candidate of input.candidates) counts.set(candidate.id, (counts.get(candidate.id) ?? 0) + 1);
  const reviewed = new Set(input.reviewedUniverse.map(symbolKey));
  return (candidate: CapitalStrategyCandidate): string[] => {
    const reasons = globalReason ? [globalReason] : [];
    const symbol = symbolKey(candidate.symbol);
    if (!symbol || symbol !== symbolKey(candidate.causalPath.securityMapping.symbol) || !reviewed.has(symbol)) reasons.push("candidate_security_mismatch");
    if (!nonBlank(candidate.id) || counts.get(candidate.id) !== 1 || !nonBlank(candidate.causalPath.id)
      || !nonBlank(candidate.underwriter.resultId) || !nonBlank(candidate.underwriter.playId)) reasons.push("underwriting_identity_unverified");
    const binding = bindings.get(candidate.id);
    if (!binding || binding.causalPathId !== candidate.causalPath.id || symbolKey(binding.symbol) !== symbol
      || binding.underwritingResultId !== candidate.underwriter.resultId || binding.playId !== candidate.underwriter.playId) reasons.push("underwriting_identity_mismatch");
    return reasons;
  };
}

/**
 * Deterministically compares capital uses already sized by the Play Underwriter.
 * It is pure: no persistence, proposal, order, broker, or buying-power mutation.
 */
export function buildCapitalStrategyDecision(input: CapitalStrategistInput): CapitalStrategyDecision {
  const envelope = deriveCapitalEnvelope(input.capital, input.now);
  const unavailable = input.providerState.status === "failed" || input.classifierState?.status === "failed";
  const capitalUsableForComparison = envelope.status === "verified" || envelope.status === "operator_declared";
  const identityReasons = candidateIdentityChecks(input);
  const assessed = input.candidates.map((candidate) => {
    const assessment = assessCausalEconomicPath(candidate.causalPath, input.now);
    const reasons: string[] = [...identityReasons(candidate), ...(assessment.status === "verified" ? [] : assessment.reasons)];
    if (input.providerState.status === "failed") reasons.push("provider_failure");
    if (input.classifierState?.status === "failed") reasons.push("classifier_failure");
    if (input.classifierState?.status === "partial") reasons.push("classifier_partial");
    if (!capitalUsableForComparison) reasons.push("capital_unavailable", ...envelope.blockers);
    else if (envelope.deployableCents <= 0) reasons.push("capital_envelope_empty");
    if (candidate.underwriter.state !== "qualified") reasons.push(`underwriter_${candidate.underwriter.state}`);
    const score = candidate.underwriter.overallScore;
    if (score == null || !Number.isFinite(score) || score < 0) reasons.push("underwriter_score_unavailable");
    const risk = candidate.underwriter.plannedRiskCents;
    if (risk == null || !Number.isSafeInteger(risk) || risk < 0) reasons.push("underwriter_risk_unavailable");
    else if (capitalUsableForComparison && envelope.deployableCents > 0 && risk > envelope.deployableCents) reasons.push("capital_envelope_exceeded");
    if (candidate.underwriter.proposedNotionalCents !== undefined) {
      const notional = candidate.underwriter.proposedNotionalCents;
      if (notional == null || !Number.isSafeInteger(notional) || notional < 0) reasons.push("underwriter_capital_unavailable");
      else if (capitalUsableForComparison && notional > envelope.deployableCents) reasons.push("capital_envelope_exceeded");
    }
    if (input.comparisonHorizon != null && candidate.horizon !== input.comparisonHorizon) reasons.push("horizon_mismatch");
    return { candidate, assessment, exclusionReasons: Array.from(new Set(reasons)) };
  });
  const qualified = assessed
    .filter(({ exclusionReasons }) => !exclusionReasons.length)
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
    ? "Retain capital because required evidence or classification is unavailable; no confidence is inferred from the failure."
    : !capitalUsableForComparison
      ? "Retain capital because the source is hypothetical, unavailable, or already claimed."
      : envelope.deployableCents <= 0
        ? "Retain capital: no eligible gains remain after cost basis and reserve. Returned principal is not profit."
        : "Retain capital until a reviewed candidate clears both causal evidence and existing underwriting gates.";
  const primaryConclusion: CapitalStrategyDecision["primaryConclusion"] = first
    ? { kind: first.kind, candidateId: first.candidateId, explanation: `${first.whyThisUse} ${first.whyNow}` }
    : { kind: "retain_capital", candidateId: null, explanation: retainExplanation };

  return {
    intent: input.intent,
    status: unavailable
      ? "unavailable"
      : input.providerState.status === "partial" || input.classifierState?.status === "partial"
        || envelope.status === "hypothetical_only" || envelope.status === "blocked"
        || assessed.some(({ assessment }) => assessment.status === "unavailable" || assessment.status === "conditional_research")
        || assessed.some(({ exclusionReasons }) => exclusionReasons.some(reason => reason.startsWith("underwriting_binding_") || reason.startsWith("underwriting_identity_") || reason === "underwriting_source_mismatch" || reason === "candidate_security_mismatch"))
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
    coverageGaps: Array.from(new Set([
      ...input.coverageGaps, ...input.providerState.failures, ...(input.classifierState?.failures ?? []),
      ...assessed.flatMap(({ candidate }) => [
        ...candidate.causalPath.providerState.failures, ...(candidate.causalPath.classifierState?.failures ?? []),
      ]),
    ])),
    rejectedHypotheses: assessed
      .filter(({ candidate }) => !selected.includes(candidate))
      .map(({ candidate, exclusionReasons }) => ({
        candidateId: candidate.id,
        reasons: exclusionReasons.length ? exclusionReasons : ["not_shortlisted"],
      })),
    sideEffects: {
      capitalReserved: false,
      proposalCreated: false,
      orderCreated: false,
      brokerInvoked: false,
    },
  };
}

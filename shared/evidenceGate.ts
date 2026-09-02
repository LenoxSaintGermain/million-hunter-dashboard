import { proposalEvidenceChecks } from "./evidenceReview";

export type EvidenceGateCandidate = {
  id: number;
  symbol: string;
  confidenceScore: number | null;
  memoStatus: string;
  verifyFields: unknown;
};

const checksFor = (value: unknown) => proposalEvidenceChecks(
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [],
).requiredChecks.length;

/**
 * Research navigation should never be blocked by a long tail of checks. This
 * distinguishes the priority candidate's decision-critical evidence from the
 * supporting research queue, while retaining a stricter paper-order boundary.
 */
export function buildProgressiveEvidenceGate(priority: EvidenceGateCandidate | null, candidates: EvidenceGateCandidate[]) {
  const totalChecks = candidates.reduce((total, candidate) => total + checksFor(candidate.verifyFields), 0);
  const decisionCriticalCheckCount = priority ? checksFor(priority.verifyFields) : 0;
  const researchFollowUpCheckCount = Math.max(0, totalChecks - decisionCriticalCheckCount);
  const researchReady = Boolean(priority);
  const paperOrderEligible = Boolean(priority)
    && decisionCriticalCheckCount === 0
    && priority!.memoStatus === "ok"
    && (priority!.confidenceScore ?? 0) >= 0.6;
  return {
    totalChecks,
    decisionCriticalCheckCount,
    researchFollowUpCheckCount,
    researchReady,
    paperOrderEligible,
    headline: !priority
      ? "Wait for the first evidence-backed candidate"
      : decisionCriticalCheckCount > 0
        ? `Clear ${decisionCriticalCheckCount} decision-critical check${decisionCriticalCheckCount === 1 ? "" : "s"} on ${priority.symbol}`
        : paperOrderEligible
          ? `${priority.symbol} has cleared the research gate; retain human approval for any paper order`
          : `Review ${priority.symbol}'s memo and confidence before considering paper-order eligibility`,
  };
}

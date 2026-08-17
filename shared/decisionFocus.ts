export interface DecisionCandidate {
  symbol: string;
  role: string;
  compositeScore: number | null;
  confidenceScore: number | null;
  verifyFields: unknown;
  memo?: unknown;
}

export interface PaperPosition { symbol: string; marketValueCents?: number | null; }

export interface DecisionFocus {
  verdict: "not_ready" | "review_ready";
  headline: string;
  portfolioEffect: string;
  returnOutlook: string;
  humanChecks: string[];
  nextAction: string;
}

const asStrings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/**
 * Deliberately does not predict P&L: research can identify portfolio change and
 * decision conditions, not establish a positive return outcome.
 */
export function buildDecisionFocus(candidate: DecisionCandidate, positions: PaperPosition[]): DecisionFocus {
  const checks = asStrings(candidate.verifyFields);
  const held = positions.some((position) => position.symbol === candidate.symbol);
  const confidence = candidate.confidenceScore ?? 0;
  const lowFit = (candidate.compositeScore ?? 0) < 60 || candidate.role === "remainder";
  const needsMoreEvidence = checks.length > 0 || confidence < 0.7 || lowFit;
  const memo = candidate.memo as Record<string, unknown> | null | undefined;
  const invalidation = typeof memo?.whatWouldInvalidate === "string" ? memo.whatWouldInvalidate : null;
  const humanChecks = [
    ...checks.map((check) => `Verify ${check.replace(/^\w:\s*/, "")}`),
    ...(invalidation ? ["Reconfirm that the stated invalidation condition remains false."] : ["Confirm the catalyst and invalidation condition from primary sources."]),
  ].slice(0, 3);

  return {
    verdict: needsMoreEvidence ? "not_ready" : "review_ready",
    headline: needsMoreEvidence
      ? `${candidate.symbol} is a research lead, not yet a paper-allocation decision.`
      : `${candidate.symbol} has cleared the current research gate and is ready for human review.`,
    portfolioEffect: held
      ? `${candidate.symbol} is already in the paper context; any new paper allocation would increase existing single-name exposure.`
      : `${candidate.symbol} is not held in the current paper context, so it would add a new research exposure rather than increase an existing position.`,
    returnOutlook: "The current evidence cannot establish whether this will improve portfolio returns. It can only show the conditions that would need to hold and the evidence still missing.",
    humanChecks,
    nextAction: needsMoreEvidence ? "Clear the listed evidence checks before comparing a paper allocation." : "Compare the paper postures, then decide whether to create a human-approved paper order.",
  };
}

export function decisionPriority(candidate: DecisionCandidate): number {
  const checks = asStrings(candidate.verifyFields).length;
  const confidence = candidate.confidenceScore ?? 0;
  return checks * 100 + (1 - confidence) * 10 + ((candidate.compositeScore ?? 0) < 60 ? 5 : 0);
}

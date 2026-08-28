export type EvidenceReviewStatus = "reviewed" | "confirmed" | "not_confirmed" | "not_applicable" | "needs_follow_up";

export interface EvidenceReviewRecord {
  candidateId: number;
  checkLabel: string;
  status: EvidenceReviewStatus;
}

/**
 * Translates the raw acknowledgement records into the only decision relevant to
 * proposal preparation: which required questions remain open, and whether a
 * resolved answer itself declines the paper stage. Legacy "reviewed" records
 * remain visible as history but never clear a decision gate because they do not
 * state what the operator concluded. A "needs follow up" acknowledgement intentionally stays open. A "not
 * confirmed" answer closes the question but blocks the paper stage until the
 * operator creates a new research decision.
 */
export function getEvidenceReviewReadiness(requiredChecks: readonly string[] | null | undefined, reviews: readonly EvidenceReviewRecord[] | null | undefined) {
  const normalizedRequired = Array.from(new Set((requiredChecks ?? [])
    .filter((check): check is string => typeof check === "string")
    .map((check) => check.trim())
    .filter(Boolean)));
  const resolved = new Set((reviews ?? [])
    .filter((review) => review.status === "confirmed" || review.status === "not_confirmed" || review.status === "not_applicable")
    .map((review) => review.checkLabel.trim()));
  const negativeChecks = normalizedRequired.filter((check) => (reviews ?? []).some((review) => review.checkLabel.trim() === check && review.status === "not_confirmed"));
  const unreviewedChecks = normalizedRequired.filter((check) => !resolved.has(check));
  return {
    requiredChecks: normalizedRequired,
    reviewedChecks: normalizedRequired.filter((check) => resolved.has(check)),
    unreviewedChecks,
    negativeChecks,
    paperProposalReady: normalizedRequired.length > 0 && unreviewedChecks.length === 0 && negativeChecks.length === 0,
    paperStageDeclined: negativeChecks.length > 0,
  };
}

export type EvidenceReviewStatus = "reviewed" | "needs_follow_up";

export interface EvidenceReviewRecord {
  candidateId: number;
  checkLabel: string;
  status: EvidenceReviewStatus;
}

/**
 * Translates the raw acknowledgement records into the only decision relevant to
 * proposal preparation: which required questions still lack a completed human
 * review. A "needs follow up" acknowledgement intentionally does not count as
 * complete; it records that the operator saw the issue but kept it open.
 */
export function getEvidenceReviewReadiness(requiredChecks: readonly string[] | null | undefined, reviews: readonly EvidenceReviewRecord[] | null | undefined) {
  const normalizedRequired = Array.from(new Set((requiredChecks ?? [])
    .filter((check): check is string => typeof check === "string")
    .map((check) => check.trim())
    .filter(Boolean)));
  const reviewed = new Set((reviews ?? [])
    .filter((review) => review.status === "reviewed")
    .map((review) => review.checkLabel.trim()));
  const unreviewedChecks = normalizedRequired.filter((check) => !reviewed.has(check));
  return {
    requiredChecks: normalizedRequired,
    reviewedChecks: normalizedRequired.filter((check) => reviewed.has(check)),
    unreviewedChecks,
    paperProposalReady: normalizedRequired.length > 0 && unreviewedChecks.length === 0,
  };
}

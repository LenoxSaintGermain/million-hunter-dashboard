export type EvidenceReviewStatus = "reviewed" | "confirmed" | "not_confirmed" | "not_applicable" | "needs_follow_up";

export interface EvidenceReviewRecord {
  candidateId: number;
  checkLabel: string;
  status: EvidenceReviewStatus;
}

/**
 * These checks cannot be answered until the operator has chosen an exact OCC
 * contract in the paper ticket. Keeping them in the pre-ticket review creates
 * a circular lock: the ticket is needed to verify the contract, while the
 * contract review is required to open the ticket. They remain hard broker
 * preflight checks after contract selection; they are not waived.
 */
const PAPER_TICKET_EVIDENCE_CHECKS = new Set([
  "Option chain and contract terms",
  "Option bid/ask and liquidity",
]);

export function proposalEvidenceChecks(checks: readonly string[] | null | undefined) {
  const normalized = Array.from(new Set((checks ?? [])
    .filter((check): check is string => typeof check === "string")
    .map((check) => check.trim())
    .filter(Boolean)));
  return {
    requiredChecks: normalized.filter((check) => !PAPER_TICKET_EVIDENCE_CHECKS.has(check)),
    ticketChecks: normalized.filter((check) => PAPER_TICKET_EVIDENCE_CHECKS.has(check)),
  };
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
  const { requiredChecks: normalizedRequired, ticketChecks } = proposalEvidenceChecks(requiredChecks);
  const resolved = new Set((reviews ?? [])
    .filter((review) => review.status === "confirmed" || review.status === "not_confirmed" || review.status === "not_applicable")
    .map((review) => review.checkLabel.trim()));
  const negativeChecks = normalizedRequired.filter((check) => (reviews ?? []).some((review) => review.checkLabel.trim() === check && review.status === "not_confirmed"));
  const unreviewedChecks = normalizedRequired.filter((check) => !resolved.has(check));
  return {
    requiredChecks: normalizedRequired,
    ticketChecks,
    reviewedChecks: normalizedRequired.filter((check) => resolved.has(check)),
    unreviewedChecks,
    negativeChecks,
    paperProposalReady: unreviewedChecks.length === 0 && negativeChecks.length === 0,
    paperStageDeclined: negativeChecks.length > 0,
  };
}

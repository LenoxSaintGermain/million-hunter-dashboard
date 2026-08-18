import { describe, expect, it } from "vitest";
import { getEvidenceReviewReadiness } from "../../shared/evidenceReview";

describe("getEvidenceReviewReadiness", () => {
  it("requires a recorded completed review for every decision-critical question", () => {
    const result = getEvidenceReviewReadiness(
      ["Confirm the catalyst date", "Check valuation support"],
      [{ candidateId: 9, checkLabel: "Confirm the catalyst date", status: "reviewed" }],
    );
    expect(result.paperProposalReady).toBe(false);
    expect(result.unreviewedChecks).toEqual(["Check valuation support"]);
  });

  it("does not treat a follow-up acknowledgement as a completed human review", () => {
    const result = getEvidenceReviewReadiness(
      ["Confirm the catalyst date"],
      [{ candidateId: 9, checkLabel: "Confirm the catalyst date", status: "needs_follow_up" }],
    );
    expect(result.paperProposalReady).toBe(false);
    expect(result.unreviewedChecks).toEqual(["Confirm the catalyst date"]);
  });

  it("unlocks proposal preparation only after every required review is recorded", () => {
    const result = getEvidenceReviewReadiness(
      ["Confirm the catalyst date", "Check valuation support"],
      [
        { candidateId: 9, checkLabel: "Confirm the catalyst date", status: "reviewed" },
        { candidateId: 9, checkLabel: "Check valuation support", status: "reviewed" },
      ],
    );
    expect(result.paperProposalReady).toBe(true);
    expect(result.unreviewedChecks).toEqual([]);
  });
});

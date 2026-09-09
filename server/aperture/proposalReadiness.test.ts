import { describe, expect, it } from "vitest";
import { buildProposalReadiness } from "@shared/proposalReadiness";
import { getEvidenceReviewReadiness } from "@shared/evidenceReview";

describe("buildProposalReadiness", () => {
  it.each([
    "the session has not opened yet",
    "no SIP minute bars returned for PWR since 2026-09-09T04:00:00.000Z",
    "Market data request failed. Retry to verify this setup.",
  ])("keeps completed PWR evidence complete when the recipe is unavailable: %s", (unavailableReason) => {
    const evidence = getEvidenceReviewReadiness(["Price / earnings", "Price / sales"], [
      { candidateId: 540001, checkLabel: "Price / earnings", status: "confirmed" },
      { candidateId: 540001, checkLabel: "Price / sales", status: "confirmed" },
    ]);
    const state = buildProposalReadiness({
      recipeReady: false,
      unavailableReason,
      evidenceReviewComplete: evidence.paperProposalReady,
      paperAcknowledged: true,
    });
    expect(evidence.unreviewedChecks).toHaveLength(0);
    expect(state.action).toBe("refresh_recipe");
    expect(state.actionLabel).toBe("Refresh market checks");
    expect(state.explanation).toContain("No paper ticket has been created");
    expect(state.action).not.toBe("create_proposal");
  });

  it("keeps an incomplete ticket on the ticket instead of sending the operator back to evidence", () => {
    const state = buildProposalReadiness({
      recipeReady: true,
      ticketReady: false,
      ticketMissing: ["strike price", "limit premium"],
    });

    expect(state.action).toBe("complete_ticket");
    expect(state.actionLabel).toBe("Enter strike price");
    expect(state.explanation).toContain("strike price and limit premium");
  });

  it("puts an unavailable measured recipe ahead of any form field", () => {
    const state = buildProposalReadiness({ recipeReady: false, unavailableReason: "No verified minute bars." });
    expect(state.action).toBe("return_to_evidence");
    expect(state.explanation).toContain("No verified minute bars");
  });

  it("progresses only through guardrails and a human paper acknowledgement", () => {
    expect(buildProposalReadiness({ recipeReady: true, preflightReady: false, blocking: ["reason is required"] }).action).toBe("review_recipe");
    expect(buildProposalReadiness({ recipeReady: true, preflightReady: false, blocking: ["reason is required", "ADV is below the floor."], hardBlocker: "ADV is below the floor." })).toMatchObject({
      action: "return_to_decision",
      actionLabel: "Choose another play here",
      title: "This paper play cannot be prepared",
      explanation: expect.stringContaining("Choose another play below or preserve cash."),
    });
    expect(buildProposalReadiness({ recipeReady: true, preflightReady: true, paperAcknowledged: false }).action).toBe("confirm_paper");
    expect(buildProposalReadiness({ recipeReady: true, preflightReady: true, paperAcknowledged: true }).action).toBe("create_proposal");
  });
});

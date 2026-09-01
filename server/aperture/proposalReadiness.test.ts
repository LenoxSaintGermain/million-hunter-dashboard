import { describe, expect, it } from "vitest";
import { buildProposalReadiness } from "@shared/proposalReadiness";

describe("buildProposalReadiness", () => {
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

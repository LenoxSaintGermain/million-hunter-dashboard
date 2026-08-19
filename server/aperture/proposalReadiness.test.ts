import { describe, expect, it } from "vitest";
import { buildProposalReadiness } from "@shared/proposalReadiness";

describe("buildProposalReadiness", () => {
  it("puts an unavailable measured recipe ahead of any form field", () => {
    const state = buildProposalReadiness({ recipeReady: false, unavailableReason: "No verified minute bars." });
    expect(state.action).toBe("return_to_evidence");
    expect(state.explanation).toContain("No verified minute bars");
  });

  it("progresses only through guardrails and a human paper acknowledgement", () => {
    expect(buildProposalReadiness({ recipeReady: true, preflightReady: false, blocking: ["No liquidity fact."] }).action).toBe("review_recipe");
    expect(buildProposalReadiness({ recipeReady: true, preflightReady: true, paperAcknowledged: false }).action).toBe("confirm_paper");
    expect(buildProposalReadiness({ recipeReady: true, preflightReady: true, paperAcknowledged: true }).action).toBe("create_proposal");
  });
});

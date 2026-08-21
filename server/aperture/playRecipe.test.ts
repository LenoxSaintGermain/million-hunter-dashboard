import { describe, expect, it } from "vitest";
import { buildPlayRecipe } from "../../shared/playRecipe";

describe("legacy play recipe compatibility", () => {
  it("does not invent a market play, direction, or execution strategy from a legacy candidate", () => {
    const recipe = buildPlayRecipe({
      candidate: {
        symbol: "LEN",
        suggestedSizeLowCents: 500_000,
        verifyFields: ["Catalyst timing"],
      },
      run: { holdingPeriod: "intraday" },
      reviewedChecks: ["Catalyst timing"],
    });

    expect(recipe.marketOpportunityStatus).toBe("not_classified");
    expect(recipe.readiness).toBe("needs_risk_plan");
    expect(recipe.steps[0]).toMatchObject({ label: "Review market evidence", complete: true });
    expect(recipe.steps[1]).toMatchObject({ label: "Design the execution plan", complete: false });
  });
});

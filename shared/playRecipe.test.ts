import { describe, expect, it } from "vitest";
import { buildPlayRecipe } from "./playRecipe";

describe("paper play recipe blockers", () => {
  it("fails closed when neither an operator amount nor a modeled research range is available", () => {
    const recipe = buildPlayRecipe({
      candidate: { symbol: "SAFE", verifyFields: [] },
      run: { holdingPeriod: "swing" },
      reviewedChecks: [],
    });

    expect(recipe.readiness).toBe("needs_risk_plan");
    expect(recipe.estimatedAmountCents).toBeNull();
    expect(recipe.blockingReasons.join(" ")).toMatch(/No paper amount is set/i);
  });

  it("requires a live entry, stop, and market-state check for every intraday recipe", () => {
    const recipe = buildPlayRecipe({
      candidate: { symbol: "SAFE", suggestedSizeLowCents: 25_000, verifyFields: ["Catalyst provenance"] },
      run: { holdingPeriod: "intraday", intendedTrades: [{ symbol: "SAFE", dollarsCents: 50_000 }] },
      reviewedChecks: ["Catalyst provenance"],
    });

    expect(recipe.readiness).toBe("needs_risk_plan");
    expect(recipe.blockingReasons.join(" ")).toMatch(/live entry, stop, and market-state/i);
    expect(recipe.marketOpportunityStatus).toBe("not_classified");
  });
});

import { describe, expect, it } from "vitest";
import { buildPlayRecipe } from "../../shared/playRecipe";

describe("buildPlayRecipe", () => {
  it("does not present an intraday candidate as ready without a current structured risk plan", () => {
    const recipe = buildPlayRecipe({
      candidate: { symbol: "XHB", suggestedSizeLowCents: 445_500, verifyFields: ["Confirm the release time"] },
      run: { holdingPeriod: "intraday", intendedTrades: [] },
      reviewedChecks: ["Confirm the release time"],
    });

    expect(recipe.readiness).toBe("needs_risk_plan");
    expect(recipe.estimatedAmountCents).toBe(445_500);
    expect(recipe.blockingReasons.join(" ")).toContain("live entry, stop, and market-state");
  });

  it("leads with evidence review before a non-intraday paper proposal can be prepared", () => {
    const recipe = buildPlayRecipe({
      candidate: { symbol: "LLY", suggestedSizeLowCents: 120_000, verifyFields: ["Confirm valuation", "Confirm catalyst"] },
      run: { holdingPeriod: "swing", intendedTrades: [] },
      reviewedChecks: ["Confirm valuation"],
    });

    expect(recipe.readiness).toBe("needs_evidence");
    expect(recipe.blockingReasons[0]).toContain("1 evidence check");
  });

  it("uses an operator-stated amount ahead of a modeled research range", () => {
    const recipe = buildPlayRecipe({
      candidate: { symbol: "MSFT", suggestedSizeLowCents: 100_000, verifyFields: [] },
      run: { holdingPeriod: "swing", intendedTrades: [{ symbol: "MSFT", dollarsCents: 275_000 }] },
      reviewedChecks: [],
    });

    expect(recipe.readiness).toBe("ready_to_prepare");
    expect(recipe.estimatedAmountCents).toBe(275_000);
    expect(recipe.amountBasis).toBe("operator_stated");
  });
});

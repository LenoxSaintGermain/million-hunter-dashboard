import { describe, expect, it } from "vitest";
import { missingIntradayRecipeMessage } from "../../shared/intradayRecipeGuard";

describe("intraday paper-recipe guard", () => {
  it("explains unavailable modeled levels without treating them as zero", () => {
    expect(missingIntradayRecipeMessage({ holdingPeriod: "intraday", entryPriceCents: 0, stopPriceCents: 0, slippageCents: 0 })).toContain("No paper proposal yet");
    expect(missingIntradayRecipeMessage({ holdingPeriod: "intraday", entryPriceCents: 0, stopPriceCents: 0, slippageCents: 0 })).toContain("entry");
  });

  it("allows a complete intraday recipe and does not apply to non-intraday research", () => {
    expect(missingIntradayRecipeMessage({ holdingPeriod: "intraday", entryPriceCents: 12_000, stopPriceCents: 11_800, slippageCents: 0, timeStopAt: 1, noTradeConditions: ["Do not chase"] })).toBeNull();
    expect(missingIntradayRecipeMessage({ holdingPeriod: "swing", entryPriceCents: 0, stopPriceCents: 0 })).toBeNull();
  });
});

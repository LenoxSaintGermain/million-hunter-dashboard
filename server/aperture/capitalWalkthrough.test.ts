import { describe, expect, it } from "vitest";
import { CAPITAL_WALKTHROUGH_DISCLOSURE } from "../../shared/capitalWalkthrough";

describe("Capital walkthrough fixture contract", () => {
  it("requires an explicit frozen-data disclosure rather than a claim of current market state", () => {
    expect(CAPITAL_WALKTHROUGH_DISCLOSURE).toContain("Frozen replay");
    expect(CAPITAL_WALKTHROUGH_DISCLOSURE).toContain("not recalculated");
    expect(CAPITAL_WALKTHROUGH_DISCLOSURE).toContain("No order can be created");
  });
});

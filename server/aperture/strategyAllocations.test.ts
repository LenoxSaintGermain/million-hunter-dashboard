import { describe, expect, it } from "vitest";
import { consolidateStrategyAllocations } from "@shared/strategyAllocations";

describe("consolidateStrategyAllocations", () => {
  it("returns one deterministic row per symbol while preserving total modeled exposure", () => {
    const rows = consolidateStrategyAllocations([
      { symbol: "CSCO", dollarsCents: 1_500, pctOfDeployable: 15 },
      { symbol: "PLD", dollarsCents: 1_400, pctOfDeployable: 14 },
      { symbol: "CSCO", dollarsCents: 1_500, pctOfDeployable: 15 },
    ]);
    expect(rows.map((row) => row.symbol)).toEqual(["CSCO", "PLD"]);
    expect(rows[0]).toMatchObject({ dollarsCents: 3_000, pctOfDeployable: 30 });
    expect(rows.reduce((sum, row) => sum + row.pctOfDeployable, 0)).toBe(44);
  });
});

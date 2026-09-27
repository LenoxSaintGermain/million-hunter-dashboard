import { describe, expect, it } from "vitest";
import { modelAcquisitionFinancing } from "./acquisitionFinancing";

describe("illustrative acquisition financing", () => {
  it("amortizes the debt instead of treating 7% of asking price as debt service", () => {
    const result = modelAcquisitionFinancing(1_100_000, 338_930)!;
    expect(result.loanAmount).toBe(990_000);
    expect(result.equityAmount).toBe(110_000);
    expect(result.annualDebtService).toBeCloseTo(167_027.39, 2);
    expect(result.cashCoverage).toBeCloseTo(2.03, 2);
    expect(result.cashCoverage).not.toBeCloseTo(4.40, 2);
  });
  it("does not turn missing financial data into a zero or positive coverage claim", () => {
    expect(modelAcquisitionFinancing(null, 300_000)).toBeNull();
    expect(modelAcquisitionFinancing(NaN, 300_000)).toBeNull();
    expect(modelAcquisitionFinancing(1_000_000, null)?.cashCoverage).toBeNull();
    expect(modelAcquisitionFinancing(1_000_000, 0)?.cashCoverage).toBe(0);
    expect(modelAcquisitionFinancing(1_000_000, -10)?.cashCoverage).toBeLessThan(0);
  });
});

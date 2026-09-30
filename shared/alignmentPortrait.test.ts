import { describe, expect, it } from "vitest";
import { alignmentGeometry, formatAlignment, type AlignmentMeasure } from "./alignmentPortrait";
import { walkthroughModel, walkthroughMeasures } from "./hunterWalkthrough";
const row: AlignmentMeasure = { id: "price", label: "Price", value: 2, min: 1, max: 5, unit: "usd", basis: "reported", wanted: "Price", explanation: "Reported" };
describe("alignment portrait", () => {
  it("keeps in-range and out-of-range points on the zero-based axis", () => {
    expect(alignmentGeometry(row)?.fits).toBe(true);
    expect(alignmentGeometry({ ...row, value: 8 })?.fits).toBe(false);
    expect(alignmentGeometry({ ...row, value: 8 })?.point).toBeLessThan(100);
  });
  it("never plots missing, partial, non-finite, reversed or negative ranges", () => {
    for (const patch of [{ value: null }, { min: undefined }, { max: NaN }, { min: 9 }, { value: -1 }, { max: Infinity }]) expect(alignmentGeometry({ ...row, ...patch })).toBeNull();
  });
  it("retains zero as a value, not missing", () => {
    expect(alignmentGeometry({ ...row, value: 0, min: 0 })?.point).toBe(0);
    expect(formatAlignment(0, "usd")).toBe("$0");
    expect(formatAlignment(null, "usd")).toBe("Not established");
  });
});
describe("deterministic walkthrough", () => {
  it("uses amortizing debt and updates the scenario", () => {
    const base = walkthroughModel("asset", 0), stress = walkthroughModel("asset", -40);
    expect(base.cash).toBe(720000);
    expect(stress.cash).toBe(432000);
    expect(stress.debt).toBe(base.debt);
    expect(stress.coverage).toBeCloseTo(base.coverage * .6);
  });
  it("bounds invalid inputs without inventing outcomes", () => {
    expect(walkthroughModel("capital", -100).pnl).toBe(-800);
    expect(walkthroughModel("capital", 30).pnl).toBe(300);
    expect(walkthroughModel("asset", NaN).change).toBe(0);
  });
  it("never upgrades unknown evidence when an assumption moves", () => {
    for (const path of ["asset", "capital"] as const) for (const change of [-80, 0, 30]) {
      expect(walkthroughMeasures(path, change).filter(x => x.basis === "unknown")).toHaveLength(2);
      expect(walkthroughMeasures(path, change).some(x => x.basis === "corroborated")).toBe(false);
    }
  });
});

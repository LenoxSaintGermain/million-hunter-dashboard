import { describe, expect, it } from "vitest";
import { buildPlayReturn, PLAY_RETURN_DISCLOSURE } from "./playReturn";

/** MYRG's constructed ticket as it stood on production 2026-09-10. */
const myrg = {
  quantity: 17,
  entryCents: 28_517,
  stopCents: 28_053,
  targets: [{ label: "1.5R target", priceCents: 29_215 }, { label: "2.5R target", priceCents: 29_680 }],
};

describe("RETURN is arithmetic over modeled terms, never a forecast", () => {
  it("states capital deployed and planned downside from the recorded ticket", () => {
    const r = buildPlayReturn(myrg);
    if (!r.measured) throw new Error("expected measured");
    expect(r.deployedCents).toBe(484_789);
    expect(r.plannedDownsideCents).toBe(7_888);
    expect(r.downsideRoiPct).toBeCloseTo(-1.63, 2);
  });

  it("gives profit, ROI and R for each modeled target, cheapest first", () => {
    const r = buildPlayReturn(myrg);
    if (!r.measured) throw new Error("expected measured");
    expect(r.outcomes.map(o => o.label)).toEqual(["1.5R target", "2.5R target"]);
    expect(r.outcomes[0].profitCents).toBe(11_866);
    expect(r.outcomes[0].roiPct).toBeCloseTo(2.45, 2);
    expect(r.outcomes[0].rMultiple).toBeCloseTo(1.504, 2);
    expect(r.outcomes[1].profitCents).toBe(19_771);
    expect(r.outcomes[1].rMultiple).toBeCloseTo(2.506, 2);
  });

  it("carries the disclosure the spec requires", () => {
    const r = buildPlayReturn(myrg);
    if (!r.measured) throw new Error("expected measured");
    expect(r.disclosure).toBe(PLAY_RETURN_DISCLOSURE);
    expect(r.disclosure).toMatch(/No probability is assigned/);
  });

  it("applies the contract multiplier for options", () => {
    const r = buildPlayReturn({ ...myrg, quantity: 2, multiplier: 100 });
    if (!r.measured) throw new Error("expected measured");
    expect(r.deployedCents).toBe(28_517 * 200);
  });
});

describe("an unmeasurable return is named, never rendered as a number", () => {
  it("refuses without a quantity", () => {
    const r = buildPlayReturn({ ...myrg, quantity: null });
    expect(r.measured).toBe(false);
    if (r.measured) return;
    expect(r.missing).toContain("quantity");
  });

  it("names every missing term at once", () => {
    const r = buildPlayReturn({ quantity: null, entryCents: null, stopCents: null });
    if (r.measured) throw new Error("expected unmeasured");
    expect(r.missing).toEqual(["quantity", "entry price", "stop price"]);
  });

  it("refuses a stop that is not below the entry", () => {
    const r = buildPlayReturn({ ...myrg, stopCents: 28_517 });
    expect(r.measured).toBe(false);
    if (r.measured) return;
    expect(r.missing[0]).toMatch(/stop below the entry/);
  });

  it("drops a target that is not above the entry rather than showing a loss as upside", () => {
    const r = buildPlayReturn({ ...myrg, targets: [{ label: "below", priceCents: 28_000 }, { label: "1.5R target", priceCents: 29_215 }] });
    if (!r.measured) throw new Error("expected measured");
    expect(r.outcomes.map(o => o.label)).toEqual(["1.5R target"]);
  });

  it("measures downside even when no target is recorded", () => {
    const r = buildPlayReturn({ ...myrg, targets: [] });
    if (!r.measured) throw new Error("expected measured");
    expect(r.plannedDownsideCents).toBe(7_888);
    expect(r.outcomes).toEqual([]);
  });
});

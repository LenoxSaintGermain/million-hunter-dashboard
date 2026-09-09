import { describe, expect, it } from "vitest";
import { sumMeasuredOpenRiskCents } from "../../shared/measuredOpenRisk";

describe("measured open-risk sum", () => {
  it("sums only measured nonnegative safe integer cents, including an explicit zero", () => {
    expect(sumMeasuredOpenRiskCents([{ plannedRiskCents: 0 }, { plannedRiskCents: 18_750 }, { plannedRiskCents: 25_000 }])).toEqual({ ok: true, totalCents: 43_750 });
    expect(sumMeasuredOpenRiskCents([])).toEqual({ ok: true, totalCents: 0 });
    expect(sumMeasuredOpenRiskCents([{ plannedRiskCents: Number.MAX_SAFE_INTEGER }])).toEqual({ ok: true, totalCents: Number.MAX_SAFE_INTEGER });
  });

  it.each([null, undefined, -1, NaN, Infinity, -Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1, "25000", "", false])("withholds the entire total when a value is unmeasured or invalid: %s", (value) => {
    const result = sumMeasuredOpenRiskCents([{ plannedRiskCents: 100 }, { plannedRiskCents: value }]);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("totalCents");
  });

  it("rejects aggregate overflow even when every input is a safe integer", () => {
    expect(sumMeasuredOpenRiskCents([{ plannedRiskCents: Number.MAX_SAFE_INTEGER }, { plannedRiskCents: 1 }])).toEqual({ ok: false, reason: "unsafe_total" });
  });
});

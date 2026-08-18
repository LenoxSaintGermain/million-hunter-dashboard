import { describe, expect, it } from "vitest";
import { formatMandatePercentPoints } from "@shared/cockpitPresentation";

describe("cockpit mandate percentage presentation", () => {
  it("renders mandate values as percentage points instead of multiplying them by 100", () => {
    expect(formatMandatePercentPoints(0.75)).toBe("0.75%");
    expect(formatMandatePercentPoints(2)).toBe("2.00%");
    expect(formatMandatePercentPoints(1.25)).toBe("1.25%");
  });

  it("does not invent a percentage when the mandate value is unavailable", () => {
    expect(formatMandatePercentPoints(null)).toBe("not measured");
    expect(formatMandatePercentPoints(undefined)).toBe("not measured");
  });
});

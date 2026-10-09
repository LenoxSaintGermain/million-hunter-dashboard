import { describe, expect, it } from "vitest";
import { PROHIBITED_LANGUAGE } from "./disclosure";
import { singleOrderLimit } from "./singleOrderLimit";

const line = (ceilingCents: number | null) => ({ key: "single_order", label: "Single order", subject: null, usedCents: null, ceilingCents, remainingCents: ceilingCents, usedPct: null, ceilingPct: 5, basis: "", reason: ceilingCents == null ? "equity unknown" : null });

describe("singleOrderLimit (#109)", () => {
  it("uses the server ceiling and says the 5% rule binds", () => {
    const l = singleOrderLimit([line(497_885)], 1_000_000, 9_957_700);
    expect(l).toMatchObject({ ceilingCents: 497_885, value: "$4,978.85" });
    expect(l.explanation).toBe("5% of your account value, never more than $10,000. Right now 5% of $99,577 is the lower of the two, so it is your limit.");
    expect(l.explanation).not.toMatch(PROHIBITED_LANGUAGE);
  });
  it("says the cap binds on a large account", () => {
    expect(singleOrderLimit([line(1_000_000)], 1_000_000, 50_000_000).explanation).toContain("the $10,000 cap is the lower of the two");
  });
  it("never invents a number when equity is unknown", () => {
    expect(singleOrderLimit([line(null)], 1_000_000, null)).toMatchObject({ ceilingCents: null, value: "Not measured" });
    expect(singleOrderLimit([], 1_000_000, null).ceilingCents).toBeNull();
  });
});

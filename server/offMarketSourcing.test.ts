import { describe, it, expect } from "vitest";
import { computeMotivation } from "../shared/offMarket";

describe("computeMotivation", () => {
  it("returns cold with no signals", () => {
    const m = computeMotivation({});
    expect(m.score).toBe(0);
    expect(m.band).toBe("cold");
    expect(m.headline).toMatch(/cold approach/i);
  });

  it("weights sustained tax delinquency above mere absentee ownership", () => {
    const delinquent = computeMotivation({ taxDelinquentYears: 3 });
    const absentee = computeMotivation({ ownerOutOfState: true });
    expect(delinquent.score).toBeGreaterThan(absentee.score * 4);
  });

  it("escalates the band as signals stack", () => {
    expect(computeMotivation({ reportedVacantOrUnderused: true }).band).toBe("cold");
    expect(computeMotivation({ taxDelinquentYears: 2 }).band).toBe("warm");
    expect(computeMotivation({ taxDelinquentYears: 3, onVacantRegistry: true }).band).toBe("hot");
    expect(computeMotivation({
      taxDelinquentYears: 3, onVacantRegistry: true, foreclosureFiled: true, openCodeViolations: 4,
    }).band).toBe("distressed");
  });

  it("caps at 100 even when every signal fires", () => {
    const m = computeMotivation({
      taxDelinquentYears: 5, foreclosureFiled: true, onVacantRegistry: true, landBankOwned: true,
      openCodeViolations: 9, onPreservationWatchList: true, reportedVacantOrUnderused: true,
      ownerIsEstateOrTrust: true, ownerOutOfState: true, yearsSinceLastSale: 40,
      condemnedOrDemolitionList: true,
    });
    expect(m.score).toBe(100);
    expect(m.band).toBe("distressed");
  });

  it("leads the headline with the strongest present signal", () => {
    const m = computeMotivation({ taxDelinquentYears: 3, ownerOutOfState: true });
    expect(m.headline.toLowerCase()).toContain("tax delinquent 3 years");
  });

  it("only reports factors that are actually present", () => {
    const m = computeMotivation({ landBankOwned: true });
    const present = m.factors.filter((f) => f.present).map((f) => f.label);
    expect(present).toEqual(["Land bank owned (motivated by mandate)"]);
  });
});

describe("computeMotivation — county lien data", () => {
  it("scores a large lien even when the record gives no delinquent-year count", () => {
    // County lien tables publish an amount, not a duration. Scoring only on
    // years made a $467k lien read as "cold".
    const m = computeMotivation({ taxDelinquentAmount: 467_468, taxDelinquentYears: null });
    expect(m.score).toBeGreaterThanOrEqual(28);
    expect(m.headline).toContain("467,468");
  });

  it("takes the stronger of the year-based and amount-based reads", () => {
    const byYears = computeMotivation({ taxDelinquentYears: 3, taxDelinquentAmount: 500 });
    expect(byYears.factors.find((f) => f.max === 30)?.points).toBe(30);
  });

  it("treats a lien exceeding assessed value as the sharpest signal", () => {
    const under = computeMotivation({ taxDelinquentAmount: 20_000, assessedValue: 900_000 });
    const over = computeMotivation({ taxDelinquentAmount: 120_000, assessedValue: 18_000 });
    expect(over.score).toBeGreaterThan(under.score);
    expect(over.factors.find((f) => f.label.includes("assessed value"))?.points).toBe(20);
  });

  it("ignores the ratio when the county gives no assessed value", () => {
    const m = computeMotivation({ taxDelinquentAmount: 50_000, assessedValue: null });
    expect(m.factors.find((f) => f.label.includes("assessed value"))?.present).toBe(false);
  });
});

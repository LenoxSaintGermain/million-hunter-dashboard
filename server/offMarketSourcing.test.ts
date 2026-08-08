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

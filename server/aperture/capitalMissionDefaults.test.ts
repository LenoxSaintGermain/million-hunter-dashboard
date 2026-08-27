import { describe, expect, it } from "vitest";
import { extractCapitalMissionDefaults } from "../../shared/capitalMissionDefaults";

const conciseTltThesis = `Paper-only short-term thesis for Friday, August 28, 2026: research a long TLT share play only after the BLS Current Employment Statistics preliminary benchmark revision at 10:00 a.m. ET. Do not predict the release and do not enter before 10:15.

Use shares only, at most $5,000 notional and $50 maximum planned loss. Stop below the release-range low or 0.60% below entry, whichever is tighter. Close by 3:45 p.m. ET and record the outcome after the close. Desired ending value $5,075 is an aspiration, not a forecast.`;

describe("Capital Mission defaults", () => {
  it("extracts the operator's declared money, timing, horizon and instrument without inventing defaults", () => {
    expect(extractCapitalMissionDefaults(conciseTltThesis)).toEqual({
      deployableCapitalCents: 500_000,
      desiredEndingValueCents: 507_500,
      maxPlannedLossCents: 5_000,
      holdingPeriod: "intraday",
      instrumentPreference: "shares",
      catalystAt: Date.UTC(2026, 7, 28, 14, 0),
      eligibilityReviewAt: Date.UTC(2026, 7, 28, 14, 15),
      outcomeReviewAt: Date.UTC(2026, 7, 28, 19, 45),
      source: "declared",
      warnings: [],
    });
  });

  it("keeps unstated mission terms unknown instead of substituting old UI defaults", () => {
    expect(extractCapitalMissionDefaults("I want to research liquid infrastructure companies without making a return forecast.")).toEqual({
      deployableCapitalCents: null,
      desiredEndingValueCents: null,
      maxPlannedLossCents: null,
      holdingPeriod: null,
      instrumentPreference: null,
      catalystAt: null,
      eligibilityReviewAt: null,
      outcomeReviewAt: null,
      source: "unknown",
      warnings: ["No dated catalyst or review point was declared."],
    });
  });
});

import { describe, expect, it } from "vitest";
import { extractCapitalMissionDefaults, resolveCapitalMissionDefaults } from "../../shared/capitalMissionDefaults";

const conciseTltThesis = `Paper-only short-term thesis for Friday, August 28, 2026: research a long TLT share play only after the BLS Current Employment Statistics preliminary benchmark revision at 10:00 a.m. ET. Do not predict the release and do not enter before 10:15.

Use shares only, at most $5,000 notional and $50 maximum planned loss. Stop below the release-range low or 0.60% below entry, whichever is tighter. Close by 3:45 p.m. ET and record the outcome after the close. Desired ending value $5,075 is an aspiration, not a forecast.`;

const iwmRejectPathThesis = `Paper-only intraday research for Friday, August 28, 2026. After the 10:00 ET BLS payroll benchmark release and no earlier than 10:30 ET, research a long IWM share expression only if the 10-year yield is below its 9:55 level, IWM is above VWAP and its 10:00–10:30 range high, and volume is at least 1.25 times its normal intraday rate. Use at most $3,000 notional and $30 maximum planned loss, size from entry-to-stop distance plus slippage, close by 3:45 ET, and preserve cash if tape, breadth, liquidity, or thesis evidence is missing or contradictory. Desired ending value $3,045 is an aspiration, not a forecast.`;

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

  it("interprets an unqualified close-by time in the regular-session afternoon", () => {
    const defaults = extractCapitalMissionDefaults(iwmRejectPathThesis);

    expect(defaults.outcomeReviewAt).toBe(Date.UTC(2026, 7, 28, 19, 45));
    expect(defaults.holdingPeriod).toBe("intraday");
  });

  it("prefers first-class operator structure over narrative re-inference", () => {
    const defaults = resolveCapitalMissionDefaults(
      "Research defined-risk options in a named catalyst window as a multi-week position study.",
      { holdingPeriod: "position", instrumentPreference: "options" },
    );

    expect(defaults.holdingPeriod).toBe("position");
    expect(defaults.instrumentPreference).toBe("options");
    expect(defaults.source).toBe("declared");
  });
});

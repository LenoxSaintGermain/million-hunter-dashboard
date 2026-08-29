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
      catalystLabel: "Paper-only short-term thesis for Friday, August 28, 2026: research a long TLT share play only after the BLS Current Employment Statistics preliminary benchmark revision at 10:00 a.m. ET",
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
      catalystLabel: null,
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

  it("preserves explicit catalyst language when no exact date or time can be normalized", () => {
    const defaults = extractCapitalMissionDefaults(`The upcoming football season is the demand catalyst for public betting platforms. A new state regulation ruling could change market access. Research defined-risk options only.`);

    expect(defaults.catalystAt).toBeNull();
    expect(defaults.catalystLabel).toBe("The upcoming football season is the demand catalyst for public betting platforms · A new state regulation ruling could change market access");
    expect(defaults.source).toBe("declared");
    expect(defaults.warnings).toEqual(["Catalyst was declared, but its date and time were not normalized."]);
  });

  it("does not promote negated catalyst language into a declaration", () => {
    const noEarnings = extractCapitalMissionDefaults("This thesis is not based on earnings. Research liquid shares only.");
    const noRegulation = extractCapitalMissionDefaults("No regulatory catalyst has been declared. Preserve cash when evidence is missing.");
    const excludedEarnings = extractCapitalMissionDefaults("Earnings are explicitly excluded. Research the football season demand effect instead.");
    const avoidEarnings = extractCapitalMissionDefaults("Avoid earnings as a catalyst. Preserve cash unless the named regulation ruling is dated.");
    const backgroundReport = extractCapitalMissionDefaults("Background reports describe historical betting demand. Research liquid shares only.");

    expect(noEarnings.catalystLabel).toBeNull();
    expect(noRegulation.catalystLabel).toBeNull();
    expect(excludedEarnings.catalystLabel).toBe("Research the football season demand effect instead");
    expect(avoidEarnings.catalystLabel).toBe("Preserve cash unless the named regulation ruling is dated");
    expect(backgroundReport.catalystLabel).toBeNull();
    expect(noEarnings.source).toBe("declared");
    expect(noRegulation.source).toBe("unknown");
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

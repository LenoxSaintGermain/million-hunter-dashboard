import { describe, expect, it } from "vitest";
import { addTradingSessions, earningsRecordFromFact, evaluateEventWindow, type EventWindowInput } from "./weeklyIncomeEventWindows";
import { passesWeeklyIncomeLanguage } from "../../shared/weeklyIncome/copy";

// Fixture dates only (Example data): XYZ is hypothetical; no real earnings calendar is implied.
const base: EventWindowInput = {
  symbol: "XYZ", structure: "P1", entryDateEt: "2026-10-12", expirationDateEt: "2026-10-16",
  earnings: [], exDividends: [], earningsWindowSessionsAfter: 1, exDividendBlackoutCalls: true,
};
const earningsOn = (date: string) => [{ symbol: "XYZ", date, source: "operator" as const, sourceUrl: "https://example.invalid/ir", recordedBy: "fixture", recordedAt: 1 }];

describe("Weekly Income event windows (#85)", () => {
  it("counts trading sessions across weekends and holidays", () => {
    expect(addTradingSessions("2026-10-16", 1)).toBe("2026-10-19");
    expect(addTradingSessions("2026-11-25", 1)).toBe("2026-11-27");
    expect(addTradingSessions("2027-12-31", 1)).toBeNull();
  });

  it("excludes earnings on expiration + 1 session and allows + 2 sessions (default 1)", () => {
    const plusOne = evaluateEventWindow({ ...base, earnings: earningsOn("2026-10-19") });
    expect(plusOne.eligible).toBe(false);
    expect(plusOne.exclusions[0]).toMatchObject({ code: "earnings_in_window", source: { name: "Operator-entered", url: "https://example.invalid/ir", recordedBy: "fixture" } });
    expect(plusOne.earningsWindow).toEqual({ from: "2026-10-12", to: "2026-10-19" });
    const plusTwo = evaluateEventWindow({ ...base, earnings: earningsOn("2026-10-20") });
    expect(plusTwo).toMatchObject({ eligible: true, exclusions: [] });
    expect(plusTwo.nextEarnings?.date).toBe("2026-10-20");
  });

  it("uses trading sessions, not calendar days, for the window", () => {
    expect(evaluateEventWindow({ ...base, expirationDateEt: "2026-11-25", entryDateEt: "2026-11-23", earnings: earningsOn("2026-11-27") }).eligible).toBe(false);
    expect(evaluateEventWindow({ ...base, expirationDateEt: "2026-11-25", entryDateEt: "2026-11-23", earnings: earningsOn("2026-11-30") }).eligible).toBe(true);
  });

  it("excludes P3 but not P1 when ex-dividend is the day before expiration", () => {
    const exDividends = [{ symbol: "XYZ", date: "2026-10-15", source: "operator" as const }];
    const earnings = earningsOn("2026-11-05");
    expect(evaluateEventWindow({ ...base, structure: "P3", exDividends, earnings }).exclusions.map((e) => e.code)).toEqual(["ex_dividend_in_window"]);
    expect(evaluateEventWindow({ ...base, structure: "P1", exDividends, earnings }).eligible).toBe(true);
  });

  it("an unknown earnings date excludes the name with the reason shown; unknown ex-dividend excludes P3 only", () => {
    const unknown = evaluateEventWindow({ ...base, earnings: null });
    expect(unknown.exclusions).toEqual([expect.objectContaining({ code: "earnings_unknown", plain: "We don't know when XYZ next reports results, so we skip it. Surprise moves around a report can be large." })]);
    expect(evaluateEventWindow({ ...base, earnings: earningsOn("2026-09-01") }).exclusions[0].code).toBe("earnings_unknown");
    expect(evaluateEventWindow({ ...base, structure: "P3", earnings: earningsOn("2026-11-05"), exDividends: null }).exclusions.map((e) => e.code)).toEqual(["ex_dividend_unknown"]);
    expect(evaluateEventWindow({ ...base, structure: "P1", earnings: earningsOn("2026-11-05"), exDividends: null }).eligible).toBe(true);
  });

  it("fails closed when the window leaves the maintained calendar", () => {
    const result = evaluateEventWindow({ ...base, entryDateEt: "2027-12-27", expirationDateEt: "2027-12-31", earnings: earningsOn("2028-02-01") });
    expect(result).toMatchObject({ eligible: false, exclusions: [{ code: "calendar_outside_horizon" }] });
  });

  it("reads the Benzinga fact only when verified", () => {
    expect(earningsRecordFromFact("xyz", { factKey: "next_earnings_date", valueText: "2026-10-29", basis: "verified", sourceUrl: "https://www.benzinga.com/quote/XYZ", asOf: 5 })).toMatchObject({ symbol: "XYZ", date: "2026-10-29", source: "benzinga" });
    expect(earningsRecordFromFact("XYZ", { factKey: "next_earnings_date", valueText: null, basis: "unknown" as any, sourceUrl: null, asOf: null })).toBeNull();
  });

  it("every Quick Play reason is plain and passes the language rules", () => {
    const cases = [
      evaluateEventWindow({ ...base, earnings: earningsOn("2026-10-19") }),
      evaluateEventWindow({ ...base, earnings: null }),
      evaluateEventWindow({ ...base, structure: "P3", earnings: earningsOn("2026-11-05"), exDividends: [{ symbol: "XYZ", date: "2026-10-15", source: "operator" }] }),
      evaluateEventWindow({ ...base, entryDateEt: "2027-12-27", expirationDateEt: "2027-12-31" }),
    ];
    for (const result of cases) for (const exclusion of result.exclusions) expect(passesWeeklyIncomeLanguage(exclusion.plain), exclusion.plain).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { addTradingSessions, earningsRecordFromFact, evaluateEventWindow, exDividendRecordsFromCorporateActions, type EventWindowInput } from "./weeklyIncomeEventWindows";
import { WI_EARNINGS_EXEMPT_INDEX_ETFS, earningsExemptIndexEtf } from "../../shared/weeklyIncome/indexEtfs";
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

  describe("broad-index ETF earnings exemption", () => {
    // Fixture dates only (Example data); not a real dividend calendar.
    const spy = { ...base, symbol: "SPY", earnings: null };
    const exDiv = (date: string) => [{ symbol: "SPY", date, source: "alpaca" as const }];

    it("keeps the allowlist explicit and short", () => {
      expect(WI_EARNINGS_EXEMPT_INDEX_ETFS.map((etf) => etf.symbol)).toEqual(["SPY", "IVV", "VOO", "VTI", "QQQ", "IWM", "DIA"]);
      expect(earningsExemptIndexEtf("spy")?.index).toBe("S&P 500");
      for (const notListed of ["XLK", "TQQQ", "SQQQ", "ARKK", "EWZ", "TLT", "NVDA"]) expect(earningsExemptIndexEtf(notListed)).toBeNull();
    });

    it("lifts the earnings rule for allowlisted funds and says why in one plain line", () => {
      const result = evaluateEventWindow({ ...spy, exDividends: [] });
      expect(result).toMatchObject({ eligible: true, exclusions: [], nextEarnings: null });
      expect(result.allowedBecause).toBe("SPY is a fund that tracks the S&P 500 (about 500 large US companies). Funds don't report earnings, so the earnings rule doesn't apply; the dividend-date rule still does.");
      expect(passesWeeklyIncomeLanguage(result.allowedBecause!)).toBe(true);
    });

    it("still applies the ex-dividend blackout to funds, and unknown ex-dividend excludes", () => {
      const inWindow = evaluateEventWindow({ ...spy, exDividends: exDiv("2026-10-16") });
      expect(inWindow.exclusions.map((e) => e.code)).toEqual(["ex_dividend_in_window"]);
      expect(inWindow.allowedBecause).toBeNull();
      expect(evaluateEventWindow({ ...spy, exDividends: exDiv("2026-10-19") }).eligible).toBe(true);
      const unknown = evaluateEventWindow({ ...spy, exDividends: null, exDividendUnknownDetail: "Next ex-dividend expected around 2026-10-15 (every ~91 days) but not announced yet." });
      expect(unknown.exclusions).toEqual([expect.objectContaining({ code: "ex_dividend_unknown", plain: "We can't confirm SPY's next dividend date, so we skip it this week.", detail: expect.stringContaining("not announced yet") })]);
      for (const e of [...inWindow.exclusions, ...unknown.exclusions]) expect(passesWeeklyIncomeLanguage(e.plain), e.plain).toBe(true);
    });

    it("single stocks keep the skip-if-unknown earnings rule and ignore ex-dividend for P1", () => {
      expect(evaluateEventWindow({ ...base, symbol: "NVDA", earnings: null, exDividends: null }).exclusions.map((e) => e.code)).toEqual(["earnings_unknown"]);
      expect(evaluateEventWindow({ ...base, earnings: earningsOn("2026-11-05"), exDividends: null }).allowedBecause).toBeNull();
    });

    it("reads Alpaca corporate-action dividends, treating late or unannounced dates as unknown", () => {
      const quarterly = ["2025-12-19", "2026-03-20", "2026-06-19", "2026-09-18"].map((ex_date) => ({ symbol: "SPY", ex_date }));
      const w = { entryDateEt: "2026-10-12", expirationDateEt: "2026-10-16" };
      // next expected ~2026-12-18: clearly outside the window → known, no ex-dividend in window
      expect(exDividendRecordsFromCorporateActions("SPY", quarterly, w)).toMatchObject({ unknownDetail: null, records: expect.arrayContaining([expect.objectContaining({ date: "2026-09-18", source: "alpaca" })]) });
      // a week near the expected date with nothing announced → unknown
      const dec = exDividendRecordsFromCorporateActions("SPY", quarterly, { entryDateEt: "2026-12-14", expirationDateEt: "2026-12-18" });
      expect(dec.records).toBeNull();
      expect(dec.unknownDetail).toMatch(/expected around 2026-12-18.*not announced/);
      // announced inside the window → records returned so the blackout fires
      const announced = exDividendRecordsFromCorporateActions("SPY", [...quarterly, { symbol: "SPY", ex_date: "2026-12-18" }], { entryDateEt: "2026-12-14", expirationDateEt: "2026-12-18" });
      expect(evaluateEventWindow({ ...spy, entryDateEt: "2026-12-14", expirationDateEt: "2026-12-18", exDividends: announced.records }).exclusions.map((e) => e.code)).toEqual(["ex_dividend_in_window"]);
      // unreadable source, thin history, or an expected date that passed with no record → unknown
      expect(exDividendRecordsFromCorporateActions("SPY", null, w).records).toBeNull();
      expect(exDividendRecordsFromCorporateActions("SPY", quarterly.slice(-1), w).records).toBeNull();
      expect(exDividendRecordsFromCorporateActions("SPY", quarterly.slice(0, 2), w).unknownDetail).toMatch(/no record yet/);
      // special dividends are ignored for cadence; other symbols are ignored
      expect(exDividendRecordsFromCorporateActions("SPY", [...quarterly, { symbol: "SPY", ex_date: "2026-10-14", special: true }, { symbol: "QQQ", ex_date: "2026-10-14" }], w).records?.map((r) => r.date)).not.toContain("2026-10-14");
    });
  });
});

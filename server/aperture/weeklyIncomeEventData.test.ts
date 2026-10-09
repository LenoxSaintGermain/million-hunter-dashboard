import { describe, expect, it, vi } from "vitest";
import { benzingaConfigured, fetchCashDividends, fetchUpcomingEarnings } from "./weeklyIncomeEventData";

// Fixture responses only (Example data). No network: every fetch is a stub.
describe("Weekly Income event data (read-only GETs)", () => {
  it("uses Benzinga only when the deploy already has BENZINGA_API_KEY", async () => {
    expect(benzingaConfigured({})).toBe(false);
    expect(benzingaConfigured({ BENZINGA_API_KEY: "x" })).toBe(true);
    const fetchJson = vi.fn();
    expect(await fetchUpcomingEarnings("XYZ", "2026-10-12", { apiKey: undefined, fetchJson })).toBeNull();
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("asks Benzinga for the next report (forward from entry, ascending), not the latest past one", async () => {
    const fetchJson = vi.fn(async () => ({ earnings: [{ date: "2026-07-20", ticker: "XYZ" }, { date: "2026-11-03", ticker: "XYZ" }, { date: "2026-10-29", ticker: "XYZ" }, { date: "2026-10-28", ticker: "ABC" }] }));
    const records = await fetchUpcomingEarnings("xyz", "2026-10-12", { apiKey: "fixture-key", fetchJson: fetchJson as any });
    expect(records?.map((r) => r.date)).toEqual(["2026-10-29", "2026-11-03"]);
    expect(records?.[0]).toMatchObject({ symbol: "XYZ", source: "benzinga" });
    const url = String((fetchJson.mock.calls[0] as any[])[0]);
    expect(url).toContain("parameters[tickers]=XYZ");
    expect(url).toContain("parameters[date_from]=2026-10-12");
    expect(url).toContain("parameters[date_to]=2027-02-09");
    expect(url).toContain("parameters[date_sort]=date:asc");
  });

  it("a failed Benzinga call is unknown (null); an empty calendar is 'none on record' ([])", async () => {
    expect(await fetchUpcomingEarnings("XYZ", "2026-10-12", { apiKey: "k", fetchJson: async () => null })).toBeNull();
    expect(await fetchUpcomingEarnings("XYZ", "2026-10-12", { apiKey: "k", fetchJson: (async () => ({ earnings: [] })) as any })).toEqual([]);
  });

  it("reads Alpaca cash dividends with the existing market-data headers and pages safely", async () => {
    const fetchJson = vi.fn()
      .mockResolvedValueOnce({ corporate_actions: { cash_dividends: [{ symbol: "SPY", ex_date: "2026-06-19" }] }, next_page_token: "p2" })
      .mockResolvedValueOnce({ corporate_actions: { cash_dividends: [{ symbol: "SPY", ex_date: "2026-09-18" }] }, next_page_token: null });
    const rows = await fetchCashDividends("spy", "2025-09-07", "2026-12-11", { headers: { "APCA-API-KEY-ID": "k", "APCA-API-SECRET-KEY": "s" }, fetchJson: fetchJson as any });
    expect(rows?.map((r) => r.ex_date)).toEqual(["2026-06-19", "2026-09-18"]);
    expect(String(fetchJson.mock.calls[0][0])).toContain("/v1/corporate-actions?symbols=SPY&types=cash_dividend&start=2025-09-07&end=2026-12-11");
    expect(String(fetchJson.mock.calls[1][0])).toContain("page_token=p2");
    expect(await fetchCashDividends("SPY", "2025-09-07", "2026-12-11", { headers: null, fetchJson: fetchJson as any })).toBeNull();
    expect(await fetchCashDividends("SPY", "2025-09-07", "2026-12-11", { headers: {}, fetchJson: async () => null })).toBeNull();
  });
});

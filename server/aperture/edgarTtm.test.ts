import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __edgarInternals, edgarProvider } from "./providers/edgar";

// Synthetic arithmetic fixtures, not claimed Valero financial values. The
// including-assessed-tax concept reproduces the reported VLO coverage gap.
const INCLUDING = "RevenueFromContractWithCustomerIncludingAssessedTax";
const EXCLUDING = "RevenueFromContractWithCustomerExcludingAssessedTax";
const row = (val: number, start: string, end: string, filed: string, form = "10-Q") => ({
  val, start, end, filed, form, fp: form === "10-K" ? "FY" : "Q2",
  accn: form === "10-K" ? "0000000001-26-000001" : "0000000001-26-000002",
});
const annual = () => row(1000, "2025-01-01", "2025-12-31", "2026-02-20", "10-K");
const current = () => row(600, "2026-01-01", "2026-06-30", "2026-07-30");
const prior = () => row(450, "2025-01-01", "2025-06-30", "2026-07-30");
const usd = (rows: object[]) => ({ units: { USD: rows } });

async function fetchFacts(gaap: Record<string, unknown>, asOf = "2026-09-14") {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
    ok: true,
    json: async () => url.includes("company_tickers")
      ? { "0": { cik_str: 1, ticker: "TEST" } }
      : { entityName: "Synthetic fixture issuer", facts: { "us-gaap": gaap } },
  })));
  return edgarProvider.fetchSecurityFacts!("TEST", { now: Date.parse(`${asOf}T12:00:00Z`) });
}
async function revenue(rows: object[], concept = "Revenues", asOf?: string) {
  return (await fetchFacts({ [concept]: usd(rows) }, asOf)).find(f => f.factKey === "revenue_ttm")!;
}

beforeEach(() => __edgarInternals.resetTickerCache());
afterEach(() => vi.unstubAllGlobals());

describe("SEC EDGAR TTM at the provider boundary", () => {
  it("covers including-assessed-tax consolidated revenue with FY + H1 - prior H1", async () => {
    const fact = await revenue([annual(), current(), prior()], INCLUDING);
    expect(fact.valueNum).toBe(1150);
    expect(fact.asOf).toBe(Date.parse("2026-06-30T00:00:00Z"));
    expect(fact.basis).toBe("modeled");
    expect(fact.assumption).toContain("FY + current YTD - prior YTD");
    expect(fact.sourceName).toContain(INCLUDING);
  });

  it("does not relabel last FY as current TTM when the H1 bridge is incomplete", async () => {
    expect(await revenue([annual(), current()])).toMatchObject({ basis: "unknown", valueNum: null });
  });

  it("applies the filing cutoff before selecting a historical period or restatement", async () => {
    const future = { ...annual(), val: 9999, filed: "2026-10-01", form: "10-K/A" };
    const fact = await revenue([annual(), future], "Revenues", "2026-09-14");
    expect(fact.valueNum).toBe(1000);
  });

  it("derives TTM for already-supported concepts instead of returning the annual", async () => {
    expect((await revenue([annual(), current(), prior()], EXCLUDING)).valueNum).toBe(1150);
  });

  it("replays official VLO companyfacts rows captured 2026-09-14", async () => {
    // https://data.sec.gov/api/xbrl/companyfacts/CIK0001035002.json
    const fact = await revenue([
      { start: "2025-01-01", end: "2025-12-31", val: 122687000000, accn: "0001628280-26-011499", fy: 2025, fp: "FY", form: "10-K", filed: "2026-02-25", frame: "CY2025" },
      { start: "2026-01-01", end: "2026-06-30", val: 76857000000, accn: "0001628280-26-050937", fy: 2026, fp: "Q2", form: "10-Q", filed: "2026-07-30" },
      { start: "2025-01-01", end: "2025-06-30", val: 60147000000, accn: "0001628280-26-050937", fy: 2026, fp: "Q2", form: "10-Q", filed: "2026-07-30" },
      { start: "2026-04-01", end: "2026-06-30", val: 44476000000, accn: "0001628280-26-050937", fy: 2026, fp: "Q2", form: "10-Q", filed: "2026-07-30", frame: "CY2026Q2" },
    ], INCLUDING);
    expect(fact.valueNum).toBe(139397000000);
    expect(fact.assumption).toContain("0001628280-26-011499");
    expect(fact.assumption).toContain("0001628280-26-050937");
    expect(fact.assumption).toContain("122687000000");
    expect(fact.assumption).toContain("76857000000");
    expect(fact.assumption).toContain("60147000000");
    expect(fact.sourceUrl).toContain("000162828026050937");
  });

  it.each(["Revenues", EXCLUDING, INCLUDING, "SalesRevenueNet"])("supports consolidated %s without symbol-specific rules", async concept => {
    expect((await revenue([annual(), current(), prior()], concept)).valueNum).toBe(1150);
  });

  it.each(["NetIncomeLoss", "GrossProfit", "OperatingIncomeLoss"])("uses the same TTM semantics for %s", async concept => {
    const facts = await fetchFacts({ [concept]: usd([annual(), current(), prior()]) });
    expect(facts.find(f => f.factKey.endsWith("_ttm") && f.basis !== "unknown")?.valueNum).toBe(1150);
  });

  it("keeps an annual at its own period end when no newer reporting period is available", async () => {
    const fact = await revenue([annual(), current(), prior()], "Revenues", "2026-03-01");
    expect(fact).toMatchObject({ basis: "verified", valueNum: 1000, asOf: Date.parse("2025-12-31T00:00:00Z") });
    expect(fact.sourceName).toMatch(/annual/i);
  });

  it.each([
    ["missing FY", () => [current(), prior()]],
    ["standalone Q2 instead of H1", () => [annual(), { ...current(), start: "2026-04-01" }, { ...prior(), start: "2025-04-01" }]],
    ["mismatched YTD lengths", () => [annual(), current(), { ...prior(), end: "2025-03-31" }]],
    ["gap after FY", () => [annual(), { ...current(), start: "2026-01-02" }, prior()]],
    ["overlap after FY", () => [annual(), { ...current(), start: "2025-12-31" }, prior()]],
    ["prior YTD not starting at FY start", () => [annual(), current(), { ...prior(), start: "2025-01-10" }]],
    ["non-adjacent fiscal year", () => [{ ...annual(), start: "2024-01-01", end: "2024-12-31" }, current(), prior()]],
    ["future-filed prior comparison", () => [annual(), current(), { ...prior(), filed: "2026-10-01" }]],
    ["missing prior filing date", () => [annual(), current(), { ...prior(), filed: undefined }]],
    ["invalid prior filing date", () => [annual(), current(), { ...prior(), filed: "2026-02-30" }]],
    ["invalid start date", () => [annual(), { ...current(), start: "2026-02-30" }, prior()]],
    ["non-finite value", () => [annual(), { ...current(), val: Infinity }, prior()]],
    ["ambiguous same-filing annual", () => [annual(), { ...annual(), val: 9999 }, current(), prior()]],
    ["ambiguous same-filing YTD", () => [annual(), current(), { ...current(), val: 9999 }, prior()]],
  ] as const)("returns unknown for %s", async (_name, makeRows) => {
    expect(await revenue(makeRows())).toMatchObject({ basis: "unknown", valueNum: null });
  });

  it("never bridges excluding-tax FY with including-tax YTD", async () => {
    const facts = await fetchFacts({ [EXCLUDING]: usd([annual()]), [INCLUDING]: usd([current(), prior()]) });
    expect(facts.find(f => f.factKey === "revenue_ttm")).toMatchObject({ basis: "unknown", valueNum: null });
  });

  it("never combines different currency units", async () => {
    const facts = await fetchFacts({ Revenues: { units: { USD: [annual(), current()], EUR: [prior()] } } });
    expect(facts.find(f => f.factKey === "revenue_ttm")).toMatchObject({ basis: "unknown", valueNum: null });
  });

  it("excludes same-day filings until the next UTC day because acceptance time is unavailable", async () => {
    expect((await revenue([annual(), current(), prior()], "Revenues", "2026-07-30")).valueNum).toBe(1000);
    expect((await revenue([annual(), current(), prior()], "Revenues", "2026-07-31")).valueNum).toBe(1150);
  });

  it.each([undefined, "not-a-date", "2026-02-30"])("does not accept an annual without a valid filing date: %s", async filed => {
    expect(await revenue([{ ...annual(), filed }])).toMatchObject({ basis: "unknown", valueNum: null });
  });

  it("rejects explicit segment or dimension contexts", async () => {
    expect(await revenue([
      { ...annual(), segment: "Refining" },
      { ...current(), dimensions: { ProductOrServiceAxis: "Diesel" } }, prior(),
    ])).toMatchObject({ basis: "unknown", valueNum: null });
  });

  it("accepts duplicate identical rows but never counts them twice", async () => {
    expect((await revenue([annual(), annual(), current(), current(), prior(), prior()])).valueNum).toBe(1150);
  });

  it("ignores future-filed amendments for each leg of the bridge", async () => {
    expect((await revenue([
      annual(), current(), prior(),
      ...[annual(), current(), prior()].map(r => ({ ...r, val: 9999, filed: "2026-10-01" })),
    ])).valueNum).toBe(1150);
  });

  it("rejects overflow rather than emitting a non-finite derived fact", async () => {
    expect(await revenue([{ ...annual(), val: Number.MAX_VALUE }, { ...current(), val: Number.MAX_VALUE }, prior()]))
      .toMatchObject({ basis: "unknown", valueNum: null });
  });

  it("preserves the PRIM and EME protections through the actual provider", async () => {
    const prim = await revenue([
      { ...annual(), val: 7574900000 },
      row(1857700000, "2025-10-01", "2025-12-31", "2026-02-20", "10-K"),
    ]);
    expect(prim.valueNum).toBe(7574900000);
    const eme = await fetchFacts({
      [EXCLUDING]: usd([row(1900388000, "2018-01-01", "2018-03-31", "2018-05-01")]),
      Revenues: usd([{ ...annual(), val: 16986422000 }]),
    });
    expect(eme.find(f => f.factKey === "revenue_ttm")?.valueNum).toBe(16986422000);
  });

  it("does not use a stale annual for one flow when other flows show a newer reporting period", async () => {
    const facts = await fetchFacts({ Revenues: usd([annual()]), NetIncomeLoss: usd([annual(), current(), prior()]) });
    expect(facts.find(f => f.factKey === "revenue_ttm")?.basis).toBe("unknown");
  });

  it("does not reuse old FY when a newer balance sheet establishes a reporting gap", async () => {
    const facts = await fetchFacts({ Revenues: usd([annual()]), Assets: usd([
      { val: 1200, end: "2026-06-30", filed: "2026-07-30", form: "10-Q" },
    ]) });
    expect(facts.find(f => f.factKey === "revenue_ttm")?.basis).toBe("unknown");
  });

  it("does not mistake a cover-page share count date for a newer reporting period", async () => {
    const facts = await fetchFacts({ Revenues: usd([annual()]), CommonStockSharesOutstanding: { units: { shares: [
      { val: 100, end: "2026-02-10", filed: "2026-02-20", form: "10-K" },
    ] } } });
    expect(facts.find(f => f.factKey === "revenue_ttm")?.valueNum).toBe(1000);
  });

  it("does not fall back to Q1 TTM when Q2 is reported but cannot be bridged", async () => {
    expect(await revenue([
      annual(), row(300, "2026-01-01", "2026-03-31", "2026-04-30"),
      row(200, "2025-01-01", "2025-03-31", "2026-04-30"), current(),
    ])).toMatchObject({ basis: "unknown", valueNum: null });
  });

  it("selects the freshest complete concept, never sums alternative revenue concepts", async () => {
    const facts = await fetchFacts({ [EXCLUDING]: usd([annual()]), Revenues: usd([annual(), current(), prior()]) });
    expect(facts.find(f => f.factKey === "revenue_ttm")?.valueNum).toBe(1150);
  });

  it("does not promote component concepts to consolidated revenue", async () => {
    const facts = await fetchFacts({ SalesRevenueGoodsNet: usd([annual(), current(), prior()]), SalesRevenueServicesNet: usd([annual(), current(), prior()]) });
    expect(facts.find(f => f.factKey === "revenue_ttm")?.basis).toBe("unknown");
  });

  it("selects the latest known restatement independent of input order", async () => {
    const amended = { ...annual(), val: 1100, filed: "2026-08-01", form: "10-K/A", accn: "0000000001-26-000003" };
    for (const rows of [[amended, annual(), current(), prior()], [prior(), current(), annual(), amended]]) {
      expect((await revenue(rows)).valueNum).toBe(1250);
    }
  });

  it("supports Q1, Q3, leap years, and non-calendar fiscal years", async () => {
    for (const end of ["2024-09-30", "2025-03-31"]) {
      const priorEnd = `${Number(end.slice(0, 4)) - 1}${end.slice(4)}`;
      const fact = await revenue([
        row(1000, "2023-07-01", "2024-06-30", "2024-08-01", "10-K"),
        row(600, "2024-07-01", end, "2025-05-01"),
        row(450, "2023-07-01", priorEnd, "2025-05-01"),
      ]);
      expect(fact.valueNum).toBe(1150);
    }
  });

  it("supports compatible 52/53-week fiscal calendars", async () => {
    expect((await revenue([
      row(1000, "2023-01-29", "2024-02-03", "2024-03-01", "10-K"),
      row(600, "2024-02-04", "2024-08-03", "2024-09-01"),
      row(450, "2023-01-29", "2023-07-29", "2024-09-01"),
    ])).valueNum).toBe(1150);
  });

  it("does not call a 54-week bridge TTM when calendar shifts compound", async () => {
    expect(await revenue([
      row(1000, "2023-01-29", "2024-02-03", "2024-03-01", "10-K"),
      row(600, "2024-02-04", "2024-08-10", "2024-09-01"),
      row(450, "2023-01-29", "2023-07-29", "2024-09-01"),
    ])).toMatchObject({ basis: "unknown", valueNum: null });
  });

  it("preserves zero and negative results rather than treating them as missing", async () => {
    expect((await revenue([{ ...annual(), val: 0 }, { ...current(), val: 0 }, { ...prior(), val: 0 }])).valueNum).toBe(0);
    const facts = await fetchFacts({ NetIncomeLoss: usd([{ ...annual(), val: -100 }, { ...current(), val: -20 }, { ...prior(), val: -10 }]) });
    expect(facts.find(f => f.factKey === "net_income_ttm")?.valueNum).toBe(-110);
  });

  it("rejects future period ends even if their filing dates are backdated", async () => {
    expect(await revenue([row(1000, "2026-01-01", "2026-12-31", "2026-08-01", "10-K")])).toMatchObject({ basis: "unknown", valueNum: null });
  });

  it("selects recent instant balances, excludes future filings and invalid duration rows", async () => {
    const facts = await fetchFacts({ Assets: usd([
      { val: 100, end: "2025-12-31", filed: "2026-02-01", form: "10-K", fp: "FY" },
      { val: 120, end: "2026-06-30", filed: "2026-07-30", form: "10-Q", fp: "Q2" },
      { val: 999, end: "2026-06-30", filed: "2026-10-01", form: "10-Q/A" },
      { val: 777, start: "invalid", end: "2026-08-31", filed: "2026-09-01", form: "10-Q" },
    ]) });
    expect(facts.find(f => f.factKey === "total_assets")).toMatchObject({ basis: "verified", valueNum: 120 });
  });
});

import { describe, expect, it } from "vitest";
import { __edgarInternals } from "./providers/edgar";

const { latestAnnual, selectConceptHit } = __edgarInternals as any;

/**
 * Production 2026-09-10: two recorded revenue facts were wrong by roughly an
 * order of magnitude and reached a trade gate unmarked.
 *
 * PRIM: a 91-day figure was accepted as annual ($1.86B against $7.57B).
 * EME:  the first concept held exactly one datapoint — an 89-day 10-Q from
 *       2018 — and the blind `pool = units` fallback returned it, while the
 *       correct $16.99B annual sat in a later concept the loop never reached.
 *
 * Shapes below mirror the real SEC companyfacts payloads.
 */
const usd = (rows: any[]) => ({ units: { USD: rows } });
const flow = (val: number, start: string, end: string, form = "10-K", fp = "FY") => ({ val, start, end, form, fp });
const instant = (val: number, end: string, form = "10-K", fp = "FY") => ({ val, end, form, fp });

describe("a quarterly figure is never accepted as an annual one", () => {
  it("rejects the 91-day datapoint that produced PRIM's wrong revenue", () => {
    const prim = usd([
      flow(7_574_900_000, "2025-01-01", "2025-12-31"),
      flow(1_857_700_000, "2025-10-01", "2025-12-31"),
    ]);
    expect(latestAnnual(prim, "USD", { instant: false })?.value).toBe(7_574_900_000);
  });

  it("returns nothing rather than falling back to a stale 10-Q", () => {
    // EME's RevenueFromContractWithCustomerExcludingAssessedTax: one quarterly row.
    const only = usd([flow(1_900_388_000, "2018-01-01", "2018-03-31", "10-Q", "Q1")]);
    expect(latestAnnual(only, "USD", { instant: false })).toBeNull();
  });

  it("excludes a multi-year cumulative period", () => {
    const rows = usd([flow(1_000, "2024-01-01", "2024-12-31"), flow(9_999, "2022-01-01", "2025-12-31")]);
    expect(latestAnnual(rows, "USD", { instant: false })?.value).toBe(1_000);
  });

  it("still accepts a 364-day year, as MYRG files", () => {
    const rows = usd([flow(3_657_889_000, "2025-01-01", "2025-12-30")]);
    expect(latestAnnual(rows, "USD", { instant: false })?.value).toBe(3_657_889_000);
  });

  it("keeps point-in-time balance figures, which carry no start date", () => {
    const assets = usd([instant(1_644_078_976, "2025-12-31")]);
    expect(latestAnnual(assets, "USD", { instant: true })?.value).toBe(1_644_078_976);
    // and a duration row is not a balance figure
    expect(latestAnnual(usd([flow(5, "2025-01-01", "2025-12-31")]), "USD", { instant: true })).toBeNull();
  });

  it("prefers a 10-K annual over an annual restated in another form", () => {
    const rows = usd([
      flow(100, "2025-01-01", "2025-12-31", "10-Q", "Q3"),
      flow(200, "2025-01-01", "2025-12-31", "10-K", "FY"),
    ]);
    expect(latestAnnual(rows, "USD", { instant: false })?.value).toBe(200);
  });
});

describe("the freshest qualifying concept wins, not the first one listed", () => {
  it("reaches past EME's single stale concept to the correct annual revenue", () => {
    const facts: Record<string, any> = {
      RevenueFromContractWithCustomerExcludingAssessedTax: usd([flow(1_900_388_000, "2018-01-01", "2018-03-31", "10-Q", "Q1")]),
      Revenues: usd([flow(16_986_422_000, "2025-01-01", "2025-12-31")]),
      SalesRevenueNet: usd([flow(7_686_999_000, "2017-01-01", "2017-12-31")]),
    };
    const hit = selectConceptHit(facts, {}, ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"], "USD", false);
    expect(hit?.value).toBe(16_986_422_000);
    expect(hit?.end).toBe("2025-12-31");
  });

  it("keeps the first concept when it is the freshest", () => {
    const facts: Record<string, any> = {
      RevenueFromContractWithCustomerExcludingAssessedTax: usd([flow(3_657_889_000, "2025-01-01", "2025-12-31")]),
      Revenues: usd([flow(3_000_000_000, "2024-01-01", "2024-12-31")]),
    };
    expect(selectConceptHit(facts, {}, ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues"], "USD", false)?.value).toBe(3_657_889_000);
  });

  it("returns nothing when no concept has a qualifying annual period", () => {
    const facts: Record<string, any> = { Revenues: usd([flow(1, "2025-10-01", "2025-12-31")]) };
    expect(selectConceptHit(facts, {}, ["Revenues"], "USD", false)).toBeNull();
  });
});

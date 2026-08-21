import { describe, expect, it } from "vitest";
import { buildPortfolioImpactTrend, type PortfolioImpactTrendRow } from "../../shared/portfolioImpactTrend";

const row = (overrides: Partial<PortfolioImpactTrendRow> = {}): PortfolioImpactTrendRow => ({
  slateId: 1,
  snapshotBasis: "live_capture",
  slateStatus: "complete",
  itemDecision: "selected",
  outcomeStatus: "resolved",
  outcomeResult: "win",
  outcomeBasis: "verified",
  entryPriceCents: 10000,
  settlementPriceCents: 10100,
  play: { side: "long", qty: 10, notionalCents: 100000, plannedLossCents: 2500 },
  ...overrides,
});

describe("portfolio impact trend", () => {
  it("aggregates only selected, verified live paper outcomes", () => {
    const result = buildPortfolioImpactTrend([
      row(),
      row({ slateId: 2, snapshotBasis: "historical_reconstruction", settlementPriceCents: 20000 }),
      row({ slateId: 3, itemDecision: "not_recorded" }),
      row({ slateId: 4, outcomeResult: "not_triggered", settlementPriceCents: null }),
      row({ slateId: 5, outcomeStatus: "unavailable", outcomeResult: "unresolved", outcomeBasis: "unknown", settlementPriceCents: null }),
    ]);
    expect(result.liveCohortCount).toBe(4);
    expect(result.historicalCohortCountExcluded).toBe(1);
    expect(result.selectedPaperPlayCount).toBe(3);
    expect(result.measuredSelectedOutcomeCount).toBe(1);
    expect(result.modeledExposureCents).toBe(300000);
    expect(result.plannedLossCents).toBe(7500);
    expect(result.observedImpactCents).toBe(1000);
    expect(result.nonTriggeredSelectedCount).toBe(1);
    expect(result.unavailableSelectedCount).toBe(1);
  });

  it("keeps missing selected measurements null rather than turning them into zero P&L", () => {
    const result = buildPortfolioImpactTrend([row({ outcomeStatus: "unavailable", outcomeResult: "unresolved", outcomeBasis: "unknown", settlementPriceCents: null })]);
    expect(result.observedImpactCents).toBeNull();
    expect(result.evidenceNote).toContain("not measured yet");
  });
});

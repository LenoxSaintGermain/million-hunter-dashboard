/**
 * Pilot scorecard — the arithmetic the pilot's whole claim rests on.
 *
 * The tests that matter most here are the negative ones: a benchmark that stays
 * null when nothing states it, a sample size that refuses to imply an edge, and
 * a system P&L that admits it was human-filtered.
 */
import { describe, it, expect } from "vitest";
import {
  buildScorecard, computeHhi, computeMaxDrawdownBps, sampleSufficiencyFor,
  EDGE_SAMPLE_FLOOR, INDICATIVE_SAMPLE_FLOOR, PAPER_SLIPPAGE_ASSUMPTION,
  type ScorecardInput, type ScorecardOrder,
} from "./scorecard";

const T0 = Date.parse("2026-06-01T13:30:00Z");
const DAY = 86_400_000;

const order = (over: Partial<ScorecardOrder> = {}): ScorecardOrder => ({
  symbol: "NVDA",
  side: "buy",
  status: "filled",
  filledQty: 10,
  filledAvgPriceCents: 10_000,
  notionalCents: null,
  gatedNotionalCents: 100_000,
  filledAt: T0 + DAY,
  ...over,
});

const input = (over: Partial<ScorecardInput> = {}): ScorecardInput => ({
  run: {
    deployableCapitalCents: 1_000_000,
    intendedTrades: [{ symbol: "AAPL", dollarsCents: 500_000 }],
    holdingPeriod: "swing",
    createdAt: T0,
    startedAt: T0,
    completedAt: T0 + 5 * DAY,
    catalystDeadlineAt: T0 + 7 * DAY,
  },
  candidateSymbols: ["AAPL", "NVDA", "AVGO"],
  orders: [],
  snapshots: [],
  benchmark: null,
  now: T0 + 6 * DAY,
  ...over,
});

// ── Baseline ──────────────────────────────────────────────────────────────────

describe("baseline", () => {
  it("is the operator's own plan when they named intended trades", () => {
    const s = buildScorecard(input());
    expect(s.baselineKind).toBe("human_intended");
    expect(s.baselineNote).toContain("operator's own plan");
  });

  it("is cash — explicitly zero — when no trades were intended", () => {
    const s = buildScorecard(input({ run: { ...input().run, intendedTrades: [] } }));
    expect(s.baselineKind).toBe("cash_only");
    expect(s.baselinePnlCents).toBe(0);
    expect(s.baselineNote).toContain("doing nothing");
  });

  it("carries the human P&L as the baseline figure once there are fills", () => {
    const s = buildScorecard(input({
      orders: [order({ symbol: "AAPL" })],
      snapshots: [{ symbol: "AAPL", marketValueCents: 500_000, unrealizedPnlCents: 12_000, priceBasis: "verified", snapshotAt: T0 + DAY }],
    }));
    expect(s.humanPnlCents).toBe(12_000);
    expect(s.baselinePnlCents).toBe(12_000);
  });
});

// ── Benchmark ─────────────────────────────────────────────────────────────────

describe("benchmark", () => {
  it("stays null and unknown when no source states one", () => {
    const s = buildScorecard(input());
    expect(s.benchmarkSymbol).toBeNull();
    expect(s.benchmarkReturnBps).toBeNull();
    expect(s.benchmarkBasis).toBe("unknown");
    expect(s.benchmarkNote).toContain("left null rather than approximated");
  });

  it("records the quote and its basis when one is supplied", () => {
    const s = buildScorecard(input({ benchmark: { symbol: "SPY", returnBps: 180, basis: "verified" } }));
    expect(s.benchmarkSymbol).toBe("SPY");
    expect(s.benchmarkReturnBps).toBe(180);
    expect(s.benchmarkBasis).toBe("verified");
    expect(s.benchmarkNote).toContain("1.80%");
  });
});

// ── Sample size ───────────────────────────────────────────────────────────────

describe("sample size", () => {
  const sells = (n: number) =>
    Array.from({ length: n }, (_, i) => order({ side: "sell" as const, symbol: `S${i}` }));

  it("counts closed trades as exits, not as fills", () => {
    const s = buildScorecard(input({ orders: [order(), order({ side: "sell" })] }));
    expect(s.filledOrderCount).toBe(2);
    expect(s.closedTradeCount).toBe(1);
  });

  it("does not count an open position — it has not been right or wrong yet", () => {
    const s = buildScorecard(input({ orders: [order(), order({ symbol: "AVGO" })] }));
    expect(s.closedTradeCount).toBe(0);
  });

  it("refuses to imply an edge at n=30", () => {
    const s = buildScorecard(input({ orders: sells(30) }));
    expect(s.sampleSufficiency).toBe("indicative");
    expect(s.sampleNote).toContain(`${EDGE_SAMPLE_FLOOR}+`);
  });

  it("says process-only below the indicative floor", () => {
    const s = buildScorecard(input({ orders: sells(5) }));
    expect(s.sampleSufficiency).toBe("process_only");
    expect(s.sampleNote).toContain("decision process");
    expect(s.sampleNote).toContain("cannot measure an edge");
  });

  it("only reaches edge_capable at the edge floor", () => {
    expect(sampleSufficiencyFor(EDGE_SAMPLE_FLOOR - 1)).toBe("indicative");
    expect(sampleSufficiencyFor(EDGE_SAMPLE_FLOOR)).toBe("edge_capable");
    expect(sampleSufficiencyFor(INDICATIVE_SAMPLE_FLOOR - 1)).toBe("process_only");
  });
});

// ── Horizon ───────────────────────────────────────────────────────────────────

describe("horizon", () => {
  it("runs from the run's start to its completion", () => {
    const s = buildScorecard(input());
    expect(s.horizonStartAt).toBe(T0);
    expect(s.horizonEndAt).toBe(T0 + 5 * DAY);
    expect(s.horizonDays).toBe(5);
  });

  it("falls back to the last fill when the run has not completed", () => {
    const s = buildScorecard(input({
      run: { ...input().run, completedAt: null },
      orders: [order({ filledAt: T0 + 2 * DAY })],
    }));
    expect(s.horizonEndAt).toBe(T0 + 2 * DAY);
  });

  it("falls back to now when there is neither a completion nor a fill", () => {
    const s = buildScorecard(input({ run: { ...input().run, completedAt: null } }));
    expect(s.horizonEndAt).toBe(T0 + 6 * DAY);
  });

  it("carries the run's holding period so the window has a name", () => {
    expect(buildScorecard(input()).holdingPeriod).toBe("swing");
  });
});

// ── Selection bias ────────────────────────────────────────────────────────────

describe("selection bias", () => {
  it("counts every system candidate that reached an order, not just the filled ones", () => {
    const s = buildScorecard(input({
      orders: [
        order({ symbol: "NVDA", status: "filled" }),
        order({ symbol: "AVGO", status: "rejected" }),
      ],
    }));
    expect(s.systemSurfacedCount).toBe(2);
    expect(s.systemFilledCount).toBe(1);
    expect(s.systemDeclinedCount).toBe(1);
    expect(s.selectionBiasNote).toContain("human-filtered");
  });

  it("does not count the operator's own names as system candidates", () => {
    const s = buildScorecard(input({ orders: [order({ symbol: "AAPL" })] }));
    expect(s.systemSurfacedCount).toBe(0);
    expect(s.humanOpportunitySetCount).toBe(1);
    expect(s.systemAddedCount).toBe(2); // NVDA, AVGO
  });

  it("says plainly when no system candidate has been acted on", () => {
    expect(buildScorecard(input()).selectionBiasNote).toContain("no decisions yet");
  });
});

// ── Slippage ──────────────────────────────────────────────────────────────────

describe("slippage disclosure", () => {
  it("travels with every scorecard", () => {
    expect(buildScorecard(input()).slippageAssumption).toBe(PAPER_SLIPPAGE_ASSUMPTION);
    expect(PAPER_SLIPPAGE_ASSUMPTION).toContain("upper bound");
  });
});

// ── Return, basis and shape ───────────────────────────────────────────────────

describe("return and basis", () => {
  it("leaves P&L null when nothing has filled", () => {
    const s = buildScorecard(input());
    expect(s.humanPnlCents).toBeNull();
    expect(s.systemPnlCents).toBeNull();
  });

  it("splits P&L between the operator's names and the system's", () => {
    const s = buildScorecard(input({
      orders: [order({ symbol: "AAPL" }), order({ symbol: "NVDA" })],
      snapshots: [
        { symbol: "AAPL", marketValueCents: 500_000, unrealizedPnlCents: 10_000, priceBasis: "verified", snapshotAt: T0 + DAY },
        { symbol: "NVDA", marketValueCents: 100_000, unrealizedPnlCents: -3_000, priceBasis: "verified", snapshotAt: T0 + DAY },
      ],
    }));
    expect(s.humanPnlCents).toBe(10_000);
    expect(s.systemPnlCents).toBe(-3_000);
    expect(s.metricBasis).toBe("verified");
  });

  it("reports mixed basis when some prices are modeled", () => {
    const s = buildScorecard(input({
      orders: [order({ symbol: "AAPL" }), order({ symbol: "NVDA" })],
      snapshots: [
        { symbol: "AAPL", marketValueCents: 500_000, unrealizedPnlCents: 10_000, priceBasis: "verified", snapshotAt: T0 },
        { symbol: "NVDA", marketValueCents: 100_000, unrealizedPnlCents: 500, priceBasis: "modeled", snapshotAt: T0 },
      ],
    }));
    expect(s.metricBasis).toBe("mixed");
  });

  it("uses the latest snapshot per symbol", () => {
    const s = buildScorecard(input({
      orders: [order({ symbol: "AAPL" })],
      snapshots: [
        { symbol: "AAPL", marketValueCents: 500_000, unrealizedPnlCents: 1_000, priceBasis: "verified", snapshotAt: T0 },
        { symbol: "AAPL", marketValueCents: 520_000, unrealizedPnlCents: 20_000, priceBasis: "verified", snapshotAt: T0 + DAY },
      ],
    }));
    expect(s.humanPnlCents).toBe(20_000);
  });

  it("computes capital utilization from filled value against deployable capital", () => {
    const s = buildScorecard(input({ orders: [order()] })); // $1,000 of $10,000
    expect(s.capitalUtilizationPct).toBeCloseTo(0.1, 5);
  });
});

describe("HHI and drawdown", () => {
  it("returns 1 for a single-name portfolio and 0 for an empty one", () => {
    expect(computeHhi([{ valueCents: 100 }])).toBe(1);
    expect(computeHhi([])).toBe(0);
  });

  it("halves for two equal positions", () => {
    expect(computeHhi([{ valueCents: 50 }, { valueCents: 50 }])).toBeCloseTo(0.5, 5);
  });

  it("measures peak-to-trough in basis points", () => {
    const bps = computeMaxDrawdownBps([
      { marketValueCents: 1_000, snapshotAt: 1 },
      { marketValueCents: 1_200, snapshotAt: 2 },
      { marketValueCents: 900, snapshotAt: 3 },
      { marketValueCents: 1_100, snapshotAt: 4 },
    ]);
    expect(bps).toBe(2_500); // 1200 → 900
  });

  it("is zero with fewer than two snapshots", () => {
    expect(computeMaxDrawdownBps([{ marketValueCents: 1_000, snapshotAt: 1 }])).toBe(0);
  });
});

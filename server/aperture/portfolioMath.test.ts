import { describe, it, expect } from "vitest";
import {
  concentrationHhi, maxSingleNamePct, maxCorrelatedClusterPct, correlationFromReturns,
  daysToExit, capitalUtilizationPct, thesisExposurePct, snapshot, impactOf, applyAllocations,
  type Holding,
} from "./portfolioMath";

const $ = (dollars: number) => dollars * 100; // cents

const PORTFOLIO: Holding[] = [
  { symbol: "NVDA", valueCents: $(100_000), sector: "Semiconductors", advUsd: 30e9 },
  { symbol: "VRT", valueCents: $(60_000), sector: "Industrials", advUsd: 800e6 },
  { symbol: "CEG", valueCents: $(40_000), sector: "Utilities", advUsd: 900e6 },
];

describe("concentration", () => {
  it("computes HHI from position weights", () => {
    const r = concentrationHhi(PORTFOLIO);
    // 0.5^2 + 0.3^2 + 0.2^2 = 0.38
    expect(r.value).toBeCloseTo(0.38, 4);
    expect(r.basis).toBe("verified");
  });

  it("reports the largest single name", () => {
    expect(maxSingleNamePct(PORTFOLIO).value).toBe(50);
  });

  it("returns unknown — not zero — for an empty portfolio", () => {
    const r = concentrationHhi([]);
    expect(r.value).toBeNull();
    expect(r.basis).toBe("unknown");
    expect(r.note).toMatch(/no positions/);
  });

  it("sums duplicate lots of the same symbol into one weight", () => {
    const r = maxSingleNamePct([
      { symbol: "NVDA", valueCents: $(30_000) },
      { symbol: "NVDA", valueCents: $(30_000) },
      { symbol: "VRT", valueCents: $(40_000) },
    ]);
    expect(r.value).toBe(60);
  });
});

describe("correlated clusters — a weaker claim, labelled as one", () => {
  it("labels a sector-proxied cluster as modeled and states the proxy", () => {
    const r = maxCorrelatedClusterPct(PORTFOLIO);
    expect(r.value).toBe(50);
    expect(r.basis).toBe("modeled");
    expect(r.assumption).toMatch(/proxied by sector/);
  });

  it("excludes unlabelled holdings and names them rather than burying them", () => {
    const r = maxCorrelatedClusterPct([...PORTFOLIO, { symbol: "MYSTERY", valueCents: $(200_000) }]);
    expect(r.unclassified).toEqual(["MYSTERY"]);
    expect(r.assumption).toMatch(/1 holding\(s\) unclassified and excluded/);
  });

  it("returns unknown when nothing carries a sector", () => {
    const r = maxCorrelatedClusterPct([{ symbol: "A", valueCents: $(100) }]);
    expect(r.value).toBeNull();
    expect(r.basis).toBe("unknown");
  });
});

describe("correlation from returns", () => {
  const up = Array.from({ length: 40 }, (_, i) => i * 0.001);

  it("computes a verified correlation when there is enough overlap", () => {
    const r = correlationFromReturns(up, up);
    expect(r.value).toBeCloseTo(1, 3);
    expect(r.basis).toBe("verified");
  });

  it("finds perfect inverse correlation", () => {
    expect(correlationFromReturns(up, up.map((x) => -x)).value).toBeCloseTo(-1, 3);
  });

  it("refuses to report a correlation from too few points", () => {
    const r = correlationFromReturns(up.slice(0, 5), up.slice(0, 5));
    expect(r.value).toBeNull();
    expect(r.basis).toBe("unknown");
    expect(r.note).toMatch(/needs 30 overlapping returns, has 5/);
  });

  it("refuses when a series never moves", () => {
    const flat = new Array(40).fill(0.001);
    expect(correlationFromReturns(up, flat).basis).toBe("unknown");
  });
});

describe("liquidity", () => {
  it("models days-to-exit against average daily volume", () => {
    const r = daysToExit($(1_000_000), 20e6);
    expect(r.value).toBe(0.5); // $1M at 10% of $20M ADV = 2M/day
    expect(r.basis).toBe("modeled");
    expect(r.assumption).toMatch(/10% of 30-day average dollar volume/);
  });

  it("returns unknown when no volume is on record", () => {
    expect(daysToExit($(1_000_000), null).basis).toBe("unknown");
  });
});

describe("utilisation and thesis exposure", () => {
  it("computes capital utilisation", () => {
    expect(capitalUtilizationPct($(84_000), $(16_000)).value).toBe(84);
  });

  it("returns unknown with no capital rather than 0%", () => {
    expect(capitalUtilizationPct(0, 0).basis).toBe("unknown");
  });

  it("measures the share of the portfolio that expresses the thesis", () => {
    expect(thesisExposurePct(PORTFOLIO, new Set(["NVDA", "CEG"])).value).toBe(70);
  });
});

describe("impact of a proposed allocation", () => {
  it("adds to an existing position rather than creating a duplicate line", () => {
    const after = applyAllocations(PORTFOLIO, [{ symbol: "NVDA", dollarsCents: $(10_000) }]);
    expect(after).toHaveLength(3);
    expect(after.find((h) => h.symbol === "NVDA")!.valueCents).toBe($(110_000));
  });

  it("shows diversifying deployment lowering concentration", () => {
    const d = impactOf(PORTFOLIO, $(50_000), [
      { symbol: "ANET", dollarsCents: $(20_000), sector: "Networking" },
      { symbol: "XLU", dollarsCents: $(20_000), sector: "Utilities" },
    ]);
    expect(d.deltas.hhi).toBeLessThan(0);
    expect(d.deltas.maxSingleNamePct).toBeLessThan(0);
    expect(d.after.positionCount).toBe(5);
  });

  it("shows doubling down raising concentration and spending cash", () => {
    const d = impactOf(PORTFOLIO, $(50_000), [{ symbol: "NVDA", dollarsCents: $(50_000), sector: "Semiconductors" }]);
    expect(d.deltas.hhi).toBeGreaterThan(0);
    expect(d.after.cashCents).toBe(0);
    expect(d.deltas.capitalUtilizationPct).toBeGreaterThan(0);
  });

  it("carries a null delta through rather than inventing a zero", () => {
    const d = impactOf([], 0, []);
    expect(d.deltas.hhi).toBeNull();
  });
});

describe("snapshot", () => {
  it("bundles the four portfolio metrics with their bases", () => {
    const s = snapshot(PORTFOLIO, $(60_000));
    expect(s.positionCount).toBe(3);
    expect(s.investedCents).toBe($(200_000));
    expect(s.hhi.basis).toBe("verified");
    expect(s.maxClusterPct.basis).toBe("modeled");
    expect(s.capitalUtilizationPct.value).toBeCloseTo(76.92, 1);
  });
});

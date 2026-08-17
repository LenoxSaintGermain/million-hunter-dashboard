import { describe, it, expect } from "vitest";
import {
  buildStrategies, humanBaseline, sizeByRank, rankOf, recompose, opportunityCost, uniqueCandidatesBySymbol,
  type Candidate, type BuildInput,
} from "./strategies";
import type { Holding } from "./portfolioMath";

const $ = (d: number) => d * 100;

const HOLDINGS: Holding[] = [
  { symbol: "NVDA", valueCents: $(100_000), sector: "Semiconductors", advUsd: 30e9 },
  { symbol: "VRT", valueCents: $(60_000), sector: "Industrials", advUsd: 800e6 },
];

const cand = (p: Partial<Candidate> & { symbol: string }): Candidate => ({
  role: "core", compositeScore: 80, confidenceScore: 1, sector: "Semiconductors", advUsd: 1e9,
  expectedReturnBps: null, ...p,
});

const CANDIDATES: Candidate[] = [
  cand({ symbol: "NVDA", compositeScore: 92, expectedReturnBps: 1400 }),
  cand({ symbol: "VRT", compositeScore: 86, sector: "Industrials", expectedReturnBps: 1100 }),
  cand({ symbol: "CEG", compositeScore: 81, sector: "Utilities", expectedReturnBps: 900 }),
  cand({ symbol: "ANET", role: "complementary", compositeScore: 78, sector: "Networking", expectedReturnBps: 800 }),
  cand({ symbol: "ETN", role: "complementary", compositeScore: 74, sector: "Electrical", expectedReturnBps: 600 }),
  cand({ symbol: "XLU", role: "alternative_expression", compositeScore: 66, sector: "Utilities", expectedReturnBps: 400 }),
  cand({ symbol: "CCJ", role: "remainder", compositeScore: 61, sector: "Uranium", expectedReturnBps: null }),
];

const BASE: BuildInput = {
  deployableCapitalCents: $(50_000),
  candidates: CANDIDATES,
  holdings: HOLDINGS,
  cashCents: $(60_000),
  intendedTrades: [
    { symbol: "NVDA", dollarsCents: $(10_000) },
    { symbol: "VRT", dollarsCents: $(10_000) },
    { symbol: "CEG", dollarsCents: $(10_000) },
  ],
};

describe("rankOf — conviction discounted by evidence", () => {
  it("penalises a high score that rests on thin facts", () => {
    expect(rankOf(cand({ symbol: "A", compositeScore: 90, confidenceScore: 1 }))).toBe(90);
    expect(rankOf(cand({ symbol: "A", compositeScore: 90, confidenceScore: 0 }))).toBe(45);
  });
});

describe("sizeByRank — portfolio rules are constraints, not preferences", () => {
  it("sizes by rank so conviction shows up in dollars", () => {
    const { allocations } = sizeByRank(CANDIDATES.slice(0, 3), $(30_000), []);
    expect(allocations[0].symbol).toBe("NVDA");
    expect(allocations[0].dollarsCents).toBeGreaterThan(allocations[2].dollarsCents);
  });

  it("always emits a sizing range, never a bare point estimate", () => {
    const { allocations } = sizeByRank([CANDIDATES[0]], $(10_000), []);
    expect(allocations[0].lowCents).toBeLessThan(allocations[0].dollarsCents);
    expect(allocations[0].highCents).toBeGreaterThan(allocations[0].dollarsCents);
  });

  it("caps a single name and says so when it is already at the cap", () => {
    // NVDA is $100k of a $160k book; adding $50k of deployable → $210k projected.
    // An 8% cap allows $16.8k total, less than the $100k already held.
    const { allocations, excluded } = sizeByRank(CANDIDATES.slice(0, 3), $(50_000), HOLDINGS, { maxSingleNamePct: 8 });
    expect(allocations.find((a) => a.symbol === "NVDA")).toBeUndefined();
    expect(excluded.find((e) => e.symbol === "NVDA")!.reason).toMatch(/single-name cap/);
  });

  it("excludes an illiquid name rather than sizing it small", () => {
    const thin = cand({ symbol: "TINY", advUsd: 200_000 });
    const { allocations, excluded } = sizeByRank([thin], $(10_000), [], { minAvgDailyVolumeUsd: 5e6 });
    expect(allocations).toHaveLength(0);
    expect(excluded[0].reason).toMatch(/ADV floor/);
  });

  it("treats missing liquidity data as a fail, not a pass", () => {
    const unknown = cand({ symbol: "NOVOL", advUsd: null });
    const { excluded } = sizeByRank([unknown], $(10_000), [], { minAvgDailyVolumeUsd: 5e6 });
    expect(excluded[0].reason).toMatch(/no average daily volume on record/);
  });

  it("holds back the reserve before sizing anything", () => {
    const s = buildStrategies({ ...BASE, rules: { reservePct: 20 } }).find((x) => x.kind === "concentrated")!;
    const deployed = s.allocations.reduce((a, b) => a + b.dollarsCents, 0);
    expect(deployed).toBeLessThanOrEqual($(40_000));
    expect(s.cashRetainedCents).toBeGreaterThanOrEqual($(10_000));
  });
});

describe("buildStrategies", () => {
  const built = buildStrategies(BASE);
  const byKind = (k: string) => built.find((s) => s.kind === k)!;

  it("produces the human baseline plus four competing constructions", () => {
    expect(built.map((s) => s.kind)).toEqual([
      "human_baseline", "concentrated", "expanded", "risk_balanced", "dry_powder",
    ]);
  });

  it("concentrated funds at most three names", () => {
    expect(byKind("concentrated").allocations.length).toBeLessThanOrEqual(3);
  });

  it("expanded reaches further than concentrated", () => {
    expect(byKind("expanded").allocations.length).toBeGreaterThan(byKind("concentrated").allocations.length);
  });

  it("risk-balanced spreads across clusters before doubling up", () => {
    const sectors = byKind("risk_balanced").allocations
      .map((a) => CANDIDATES.find((c) => c.symbol === a.symbol)!.sector);
    expect(new Set(sectors).size).toBe(sectors.length);
  });

  it("expanded lowers concentration relative to concentrated", () => {
    expect(byKind("expanded").impact!.after.hhi.value!)
      .toBeLessThan(byKind("concentrated").impact!.after.hhi.value!);
  });

  // The honesty rule that matters most in this module.
  it("dry powder does NOT fund a name that lacks expected-return evidence", () => {
    const s = buildStrategies({ ...BASE, hurdleRateBps: 700 }).find((x) => x.kind === "dry_powder")!;
    const funded = s.allocations.map((a) => a.symbol);
    expect(funded).not.toContain("CCJ"); // expectedReturnBps === null
    expect(funded).not.toContain("XLU"); // 400bps, below the hurdle
    expect(funded).toEqual(["NVDA"]); // one strongest evidenced research lead
    expect(s.rationale).toMatch(/a gap is not a pass/);
  });

  it("retains cash when a high hurdle disqualifies nearly everything", () => {
    const s = buildStrategies({ ...BASE, hurdleRateBps: 1300 }).find((x) => x.kind === "dry_powder")!;
    expect(s.allocations.map((a) => a.symbol)).toEqual(["NVDA"]);
    expect(s.cashRetainedCents).toBeGreaterThan(0); // dry powder intentionally preserves a reserve
  });

  it("omits the human baseline when there were no intended trades", () => {
    const s = buildStrategies({ ...BASE, intendedTrades: [] });
    expect(s.find((x) => x.kind === "human_baseline")).toBeUndefined();
  });

  it("never deploys more than the capital available", () => {
    for (const s of built) {
      const spent = s.allocations.reduce((a, b) => a + b.dollarsCents, 0);
      expect(spent).toBeLessThanOrEqual(BASE.deployableCapitalCents);
    }
  });

  it("collapses repeated research paths into one stable allocation per symbol", () => {
    const repeated = [
      cand({ symbol: "LITE", role: "remainder", compositeScore: 62, confidenceScore: 0.7 }),
      cand({ symbol: "LITE", role: "core", compositeScore: 84, confidenceScore: 0.9 }),
      cand({ symbol: "PLD", role: "complementary", compositeScore: 76 }),
      cand({ symbol: "PLD", role: "alternative_expression", compositeScore: 69 }),
    ];
    expect(uniqueCandidatesBySymbol(repeated).map((candidate) => candidate.symbol)).toEqual(["LITE", "PLD"]);
    expect(uniqueCandidatesBySymbol(repeated)[0].role).toBe("core");

    const strategies = buildStrategies({ ...BASE, candidates: repeated, intendedTrades: [] });
    for (const strategy of strategies) {
      const symbols = strategy.allocations.map((allocation) => allocation.symbol);
      expect(new Set(symbols).size).toBe(symbols.length);
    }
  });
});

describe("Capital Recomposition — re-underwrite the plan, not just the remainder", () => {
  const built = buildStrategies(BASE);
  const human = built.find((s) => s.kind === "human_baseline")!;
  const expanded = built.find((s) => s.kind === "expanded")!;
  const r = recompose(human, expanded);

  it("surfaces names the human never considered", () => {
    expect(r.discovered.length).toBeGreaterThan(0);
    expect(r.discovered).toEqual(expect.arrayContaining(["ANET"]));
  });

  it("reports the human's idle cash against the proposal's", () => {
    expect(r.humanCashCents).toBe($(20_000)); // $50k available, $30k planned
    expect(r.proposedCashCents).toBeLessThan(r.humanCashCents);
  });

  it("classifies each line as added, trimmed, increased, dropped or unchanged", () => {
    const nvda = r.lines.find((l) => l.symbol === "NVDA")!;
    expect(["trimmed", "increased", "unchanged"]).toContain(nvda.change);
    expect(r.lines.every((l) => l.proposedCents - l.humanCents === l.deltaCents)).toBe(true);
  });

  it("orders lines by how much they move", () => {
    const moves = r.lines.map((l) => Math.abs(l.deltaCents));
    expect(moves).toEqual(moves.slice().sort((a, b) => b - a));
  });

  it("marks a planned name the proposal will not fund as dropped", () => {
    const humanOnly = humanBaseline({ ...BASE, intendedTrades: [{ symbol: "ZZZZ", dollarsCents: $(5_000) }] });
    const d = recompose(humanOnly, expanded);
    expect(d.dropped).toContain("ZZZZ");
  });
});

describe("opportunityCost", () => {
  const built = buildStrategies(BASE);
  const chosen = built.find((s) => s.kind === "concentrated")!;

  it("says what each alternative would have given you instead", () => {
    const oc = opportunityCost(chosen, built);
    expect(oc.versus.map((v) => v.kind)).not.toContain("concentrated");
    const vsExpanded = oc.versus.find((v) => v.kind === "expanded")!;
    expect(vsExpanded.givesUp.join(" ")).toMatch(/concentrated|fewer position/);
  });

  it("states plainly when there is no measured disadvantage", () => {
    const oc = opportunityCost(chosen, [chosen, { ...chosen, kind: "dry_powder", label: "twin" }]);
    expect(oc.versus[0].givesUp).toEqual(["no measured disadvantage on concentration, cash, or breadth"]);
  });
});

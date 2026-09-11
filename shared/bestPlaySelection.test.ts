import { describe, expect, it } from "vitest";
import { selectBestPlays, evidenceState, type ReadyPlayCandidate } from "./bestPlaySelection";

const CHECKS = ["C: Price / earnings", "C: Price / sales"];
const cand = (symbol: string, over: Partial<ReadyPlayCandidate> = {}): ReadyPlayCandidate => ({
  runId: 690001, candidateId: 1, symbol, role: "remainder", holdingPeriod: "swing",
  rankScore: 0.5, compositeScore: 50, checks: CHECKS,
  reviews: { [CHECKS[0]]: "confirmed", [CHECKS[1]]: "confirmed" }, ...over,
});

describe("only a fully resolved candidate is offered", () => {
  it("treats every check confirmed as ready", () => {
    expect(evidenceState(cand("MYRG"))).toBe("ready");
  });

  it("treats a single not-confirmed answer as declined, however many passed", () => {
    expect(evidenceState(cand("MTZ", { reviews: { [CHECKS[0]]: "not_confirmed", [CHECKS[1]]: "confirmed" } }))).toBe("declined");
  });

  it("treats needs-follow-up as unresolved, not as a pass", () => {
    expect(evidenceState(cand("PRIM", { reviews: { [CHECKS[0]]: "needs_follow_up", [CHECKS[1]]: "confirmed" } }))).toBe("unresolved");
  });

  it("treats an unanswered check as unresolved", () => {
    expect(evidenceState(cand("GRID", { reviews: {} }))).toBe("unresolved");
  });

  it("accepts not-applicable as a resolution", () => {
    expect(evidenceState(cand("X", { reviews: { [CHECKS[0]]: "not_applicable", [CHECKS[1]]: "confirmed" } }))).toBe("ready");
  });

  it("does not call a candidate with no recorded checks ready", () => {
    expect(evidenceState(cand("Y", { checks: [] }))).toBe("unresolved");
  });
});

describe("the best play is one recommendation with at most two alternatives", () => {
  it("ranks by score and returns a single best", () => {
    const r = selectBestPlays([cand("A", { rankScore: 0.2 }), cand("B", { rankScore: 0.9 }), cand("C", { rankScore: 0.5 })]);
    expect(r.best?.symbol).toBe("B");
    expect(r.alternatives.map(a => a.symbol)).toEqual(["C", "A"]);
  });

  it("never offers more than two alternatives", () => {
    const r = selectBestPlays(["A", "B", "C", "D", "E"].map((s, i) => cand(s, { rankScore: 1 - i / 10 })));
    expect(r.alternatives).toHaveLength(2);
  });

  it("breaks a tie by symbol so ranking is deterministic", () => {
    const r = selectBestPlays([cand("ZZZ"), cand("AAA")]);
    expect(r.best?.symbol).toBe("AAA");
  });

  it("counts what it withheld instead of hiding it", () => {
    const r = selectBestPlays([
      cand("READY"),
      cand("DECLINED", { reviews: { [CHECKS[0]]: "not_confirmed", [CHECKS[1]]: "confirmed" } }),
      cand("OPEN", { reviews: {} }),
      cand("OPEN2", { reviews: { [CHECKS[0]]: "needs_follow_up", [CHECKS[1]]: "confirmed" } }),
    ]);
    expect(r.best?.symbol).toBe("READY");
    expect(r.withheld).toEqual({ unresolvedEvidence: 2, declined: 1, outOfHorizon: 0, duplicateSymbol: 0 });
  });

  it("returns no recommendation rather than a weak one when nothing is ready", () => {
    const r = selectBestPlays([cand("OPEN", { reviews: {} })]);
    expect(r.best).toBeNull();
    expect(r.alternatives).toEqual([]);
    expect(r.withheld.unresolvedEvidence).toBe(1);
  });

  it("filters by horizon and counts the ones it set aside", () => {
    const r = selectBestPlays([cand("SWING"), cand("DAY", { holdingPeriod: "intraday" })], { horizon: "swing" });
    expect(r.best?.symbol).toBe("SWING");
    expect(r.withheld.outOfHorizon).toBe(1);
  });
});

describe("one name is one opportunity, however many runs researched it", () => {
  it("keeps only the highest-ranked instance of a repeated symbol", () => {
    const r = selectBestPlays([
      cand("PWR", { runId: 690001, rankScore: 29.3 }),
      cand("PWR", { runId: 660001, rankScore: 28.1 }),
      cand("PWR", { runId: 630001, rankScore: 27.0 }),
      cand("MYRG", { rankScore: 12 }),
      cand("ACM", { rankScore: 11 }),
    ]);
    expect(r.best?.symbol).toBe("PWR");
    expect(r.best?.runId).toBe(690001);
    expect(r.alternatives.map(a => a.symbol)).toEqual(["MYRG", "ACM"]);
    expect(r.withheld.duplicateSymbol).toBe(2);
  });

  it("matches symbols case-insensitively", () => {
    const r = selectBestPlays([cand("pwr", { rankScore: 9 }), cand("PWR", { rankScore: 8 })]);
    expect(r.alternatives).toEqual([]);
    expect(r.withheld.duplicateSymbol).toBe(1);
  });
});

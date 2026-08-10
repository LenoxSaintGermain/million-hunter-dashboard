import { describe, it, expect } from "vitest";
import { scoreThesisFit, matchExposureNodes, checkExclusions, assignRole, dimensionsFor } from "./score";
import type { ThesisGraph } from "./thesisGraph";
import type { SecurityFact } from "../../drizzle/schema";

const fact = (p: Partial<SecurityFact>): SecurityFact =>
  ({
    id: 1, symbol: "NVDA", factKey: "x", valueNum: null, valueText: null, unit: "none",
    basis: "verified", assumption: null, providerId: "edgar", sourceName: "SEC EDGAR",
    sourceUrl: "https://sec.gov", asOf: null, fetchedAt: 1, expiresAt: null, ...p,
  }) as SecurityFact;

const GRAPH: ThesisGraph = {
  beliefs: ["Inference demand compounds"],
  seek: ["Picks and shovels"],
  avoid: [],
  horizons: ["12-36 months"],
  sectors: ["Semiconductors"],
  exclusions: ["pre-revenue"],
  portfolioRules: {},
  behavior: {},
  exposureTree: [],
  confidenceNotes: [],
  suggestedName: "AI Infra",
};

const NODES = ["Datacenter expansion", "Power management", "Uranium", "Networking"];

const WELL_COVERED = [
  fact({ factKey: "revenue_ttm", valueNum: 1.2e9, unit: "usd" }),
  fact({ factKey: "pe_ratio", valueNum: 22, unit: "x" }),
  fact({ factKey: "price_to_sales", valueNum: 6, unit: "x" }),
  fact({ factKey: "adv_usd_30d", valueNum: 80e6, unit: "usd", basis: "modeled", assumption: "30d mean" }),
  fact({ factKey: "last_price", valueNum: 140, unit: "usd" }),
  fact({ factKey: "market_cap", valueNum: 30e9, unit: "usd" }),
  fact({ factKey: "volatility_30d", valueNum: 0.28, unit: "ratio", basis: "modeled", assumption: "annualised" }),
  fact({ factKey: "sector", valueText: "Semiconductors" }),
  fact({ factKey: "entity_name", valueText: "Datacenter expansion and power management components" }),
];

describe("matchExposureNodes", () => {
  it("matches node labels appearing in sourced text facts", () => {
    expect(matchExposureNodes(WELL_COVERED, NODES)).toEqual(
      expect.arrayContaining(["Datacenter expansion", "Power management"]),
    );
  });

  it("ignores unknown facts as evidence of anything", () => {
    const unknowns = [fact({ factKey: "entity_name", basis: "unknown", valueText: null })];
    expect(matchExposureNodes(unknowns, NODES)).toEqual([]);
  });

  it("skips very short labels that would match noise", () => {
    expect(matchExposureNodes(WELL_COVERED, ["AI", "up"])).toEqual([]);
  });
});

describe("checkExclusions — exclusions are hard stops", () => {
  it("catches an excluded characteristic stated in the facts", () => {
    const facts = [...WELL_COVERED, fact({ factKey: "profile", valueText: "A pre-revenue developer" })];
    expect(checkExclusions(facts, GRAPH)).toMatch(/Excluded by the thesis: "pre-revenue"/);
  });

  it("returns null when nothing is excluded", () => {
    expect(checkExclusions(WELL_COVERED, GRAPH)).toBeNull();
  });
});

describe("scoreThesisFit", () => {
  it("scores a well-covered, well-matched name highly with full confidence", () => {
    const r = scoreThesisFit({ symbol: "NVDA", facts: WELL_COVERED, graph: GRAPH, nodeLabels: NODES });
    expect(r.confidenceScore).toBe(1);
    expect(r.compositeScore).toBeGreaterThan(70);
    expect(r.gatesPass).toBe(true);
    expect(r.matchedNodes.length).toBeGreaterThanOrEqual(2);
    expect(r.strengths.join(" ")).toMatch(/Expresses 2 thesis node/);
  });

  it("discounts rank when the evidence is thin, and says so", () => {
    const thin = [fact({ factKey: "last_price", valueNum: 140, unit: "usd" })];
    const r = scoreThesisFit({ symbol: "XYZ", facts: thin, graph: GRAPH, nodeLabels: NODES });
    expect(r.confidenceScore).toBeLessThan(0.5);
    expect(r.rankScore).toBeLessThan(r.compositeScore);
    expect(r.risks.join(" ")).toMatch(/rests on thin evidence/);
    expect(r.verifyFields.length).toBeGreaterThan(0);
  });

  it("zeroes a name the thesis excludes, whatever else it scores", () => {
    const facts = [...WELL_COVERED, fact({ factKey: "profile", valueText: "pre-revenue" })];
    const r = scoreThesisFit({ symbol: "BAD", facts, graph: GRAPH, nodeLabels: NODES });
    expect(r.hardStopFailed).toMatch(/pre-revenue/);
    expect(r.compositeScore).toBe(0);
    expect(r.rankScore).toBe(0);
  });

  it("flags an asserted thesis link that no fact supports", () => {
    const noNodes = WELL_COVERED.filter((f) => f.factKey !== "entity_name");
    const r = scoreThesisFit({ symbol: "MEH", facts: noNodes, graph: GRAPH, nodeLabels: NODES });
    expect(r.matchedNodes).toEqual([]);
    expect(r.risks.join(" ")).toMatch(/asserted, not evidenced/);
  });

  it("does not reward a missing valuation multiple as though it were cheap", () => {
    const withPe = scoreThesisFit({ symbol: "A", facts: WELL_COVERED, graph: GRAPH, nodeLabels: NODES });
    const noPe = scoreThesisFit({
      symbol: "A", graph: GRAPH, nodeLabels: NODES,
      facts: WELL_COVERED.filter((f) => f.factKey !== "pe_ratio"),
    });
    const dimC = (r: typeof withPe) => r.dimensions.find((d) => d.key === "C")!.score;
    expect(dimC(noPe)).toBeLessThan(dimC(withPe));
    expect(noPe.verifyFields.join(" ")).toMatch(/Price \/ earnings/);
  });

  it("uses the investor's stated liquidity floor as the tradability gate", () => {
    const strict: ThesisGraph = { ...GRAPH, portfolioRules: { minAvgDailyVolumeUsd: 500e6 } };
    expect(dimensionsFor(strict).find((d) => d.key === "D")!.gate).toBe(6);
    const r = scoreThesisFit({ symbol: "NVDA", facts: WELL_COVERED, graph: strict, nodeLabels: NODES });
    // $80M ADV is below a $500M floor — the D gate must fail.
    expect(r.gatesPass).toBe(false);
    expect(r.risks.join(" ")).toMatch(/Gate not met on D/);
  });

  it("leaves D ungated when the investor stated no liquidity rule", () => {
    expect(dimensionsFor(GRAPH).find((d) => d.key === "D")!.gate).toBeUndefined();
  });
});

describe("assignRole", () => {
  const base = scoreThesisFit({ symbol: "NVDA", facts: WELL_COVERED, graph: GRAPH, nodeLabels: NODES });
  const empty = { intended: new Set<string>(), held: new Set<string>() };

  it("treats a name the investor already planned as core", () => {
    expect(assignRole(base, { ...empty, intended: new Set(["NVDA"]) })).toBe("core");
  });

  it("keeps a two-node match as complementary rather than promoting it", () => {
    expect(assignRole(base, empty)).toBe("complementary");
  });

  it("calls a single-node match an alternative expression", () => {
    const one = { ...base, matchedNodes: ["Uranium"] };
    expect(assignRole(one, empty)).toBe("alternative_expression");
  });

  it("drops a no-node name to remainder", () => {
    expect(assignRole({ ...base, matchedNodes: [] }, empty)).toBe("remainder");
  });

  it("promotes a strongly-matched, well-evidenced name to core", () => {
    const strong = { ...base, matchedNodes: ["a", "b", "c"], confidenceScore: 0.9, gatesPass: true };
    expect(assignRole(strong, empty)).toBe("core");
  });
});

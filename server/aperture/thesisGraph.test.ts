/**
 * Thesis Graph compiler — unit tests.
 *
 * The compiler calls Gemini, so we test the pure structural helpers that do NOT
 * require a live API key: flattenExposureTree, the ThesisGraph type shape, and
 * the looseJsonParse fallback that the compiler relies on.
 */
import { describe, it, expect } from "vitest";
import { compileThesisWithGenerator, flattenExposureTree, parseCompilerResponse, resolveRunGraph, validateGraphForPersistence, type ThesisGraph } from "./thesisGraph";

describe("flattenExposureTree", () => {
  it("returns an empty array for an empty tree", () => {
    expect(flattenExposureTree([])).toEqual([]);
  });

  it("flattens a single root node with no children", () => {
    const tree = [{ label: "AI adoption" }];
    const flat = flattenExposureTree(tree);
    expect(flat).toHaveLength(1);
    expect(flat[0].label).toBe("AI adoption");
    expect(flat[0].depth).toBe(0);
    expect(flat[0].path).toBe("AI adoption");
  });

  it("flattens a two-level tree with correct depth and path", () => {
    const tree = [
      {
        label: "AI adoption",
        children: [
          { label: "inference demand" },
          { label: "datacenter expansion" },
        ],
      },
    ];
    const flat = flattenExposureTree(tree);
    expect(flat).toHaveLength(3);
    const root = flat.find((n) => n.depth === 0)!;
    const children = flat.filter((n) => n.depth === 1);
    expect(root.path).toBe("AI adoption");
    expect(children.map((c) => c.path).sort()).toEqual([
      "AI adoption / datacenter expansion",
      "AI adoption / inference demand",
    ]);
  });

  it("flattens a three-level tree with correct paths", () => {
    const tree = [
      {
        label: "power",
        children: [
          {
            label: "nuclear",
            children: [{ label: "uranium" }],
          },
        ],
      },
    ];
    const flat = flattenExposureTree(tree);
    expect(flat).toHaveLength(3);
    const leaf = flat.find((n) => n.label === "uranium")!;
    expect(leaf.depth).toBe(2);
    expect(leaf.path).toBe("power / nuclear / uranium");
  });

  it("handles multiple root nodes", () => {
    const tree = [
      { label: "power" },
      { label: "cooling" },
      { label: "networking" },
    ];
    const flat = flattenExposureTree(tree);
    expect(flat).toHaveLength(3);
    expect(flat.every((n) => n.depth === 0)).toBe(true);
  });
});

describe("ThesisGraph structural contract", () => {
  it("portfolioRules fields are all optional — a graph with no rules is valid", () => {
    const graph: ThesisGraph = {
      beliefs: ["AI infrastructure is the dominant capital cycle"],
      seek: ["data center power"],
      avoid: ["consumer AI"],
      horizons: ["3-5 years"],
      sectors: ["utilities", "industrials"],
      exclusions: [],
      portfolioRules: {},
      behavior: {},
      exposureTree: [],
      confidenceNotes: [],
      suggestedName: "AI Infrastructure Cycle",
    };
    // No portfolio rules invented — all optional fields absent
    expect(graph.portfolioRules.maxSingleNamePct).toBeUndefined();
    expect(graph.portfolioRules.reservePct).toBeUndefined();
    expect(graph.portfolioRules.minAvgDailyVolumeUsd).toBeUndefined();
  });

  it("confidenceNotes is required and must be an array", () => {
    const graph: ThesisGraph = {
      beliefs: [],
      seek: [],
      avoid: [],
      horizons: [],
      sectors: [],
      exclusions: [],
      portfolioRules: {},
      behavior: {},
      exposureTree: [],
      confidenceNotes: ["Assumed 'infrastructure' means physical layer, not software"],
      suggestedName: "Test",
    };
    expect(Array.isArray(graph.confidenceNotes)).toBe(true);
    expect(graph.confidenceNotes).toHaveLength(1);
  });
});

describe("Capital compiler response recovery", () => {
  const graph = {
    beliefs: ["GLP-1 adoption may create event-driven dislocations"],
    seek: ["liquid catalyst-backed expressions"],
    avoid: [],
    exposureTree: [{ label: "GLP-1 adoption" }],
    confidenceNotes: [],
    suggestedName: "GLP-1 event research",
  };

  it("parses JSON delivered through a candidate-part response wrapper", () => {
    expect(parseCompilerResponse({
      candidates: [{ content: { parts: [{ text: JSON.stringify(graph) }] } }],
    })).toEqual(graph);
  });

  it("unwraps a JSON-string response instead of normalizing it as an empty graph", () => {
    expect(parseCompilerResponse({ text: JSON.stringify(JSON.stringify(graph)) })).toEqual(graph);
  });

  it("unwraps common structured response envelopes", () => {
    expect(parseCompilerResponse({ text: JSON.stringify({ output: graph }) })).toEqual(graph);
  });

  it("retries a contaminated exposure map and persists only the clean response", async () => {
    const contaminated = {
      ...graph,
      exposureTree: [{
        label: "Russell 2000 ETF Shares (Direct Expression). Wait, I Need To Format This As The Schema Dictates. Let's Do It Cleanly.",
      }],
    };
    const clean = { ...graph, exposureTree: [{ label: "Russell 2000 ETF shares" }] };
    const retries: boolean[] = [];

    const result = await compileThesisWithGenerator(
      "Small-cap shares may confirm the post-benchmark rates thesis after observable gates pass.",
      async (retry) => {
        retries.push(retry);
        return { text: JSON.stringify(retry ? clean : contaminated) };
      },
    );

    expect(retries).toEqual([false, true]);
    expect(result.exposureTree).toEqual(clean.exposureTree);
  });
});

describe("Capital compiler persistence boundary", () => {
  it("rejects short provider self-correction even when it fits the column", () => {
    const malformed = {
      beliefs: ["Post-benchmark rates may support duration"],
      seek: ["liquid share expressions"],
      avoid: [],
      horizons: ["intraday"],
      sectors: [],
      exclusions: [],
      portfolioRules: {},
      behavior: {},
      exposureTree: [{
        label: "Russell 2000 ETF Shares (Direct Expression). Wait, I Need To Format This As The Schema Dictates. Let's Do It Cleanly.",
      }],
      confidenceNotes: [],
      suggestedName: "Post-Benchmark Small-Cap Confirmation",
    } satisfies ThesisGraph;

    expect(() => validateGraphForPersistence(malformed)).toThrow(
      "The thesis service returned an invalid exposure map",
    );
  });

  it("rejects provider commentary that cannot fit an exposure-node label", () => {
    const malformed = {
      beliefs: ["Post-benchmark rates may support duration"],
      seek: ["liquid share expressions"],
      avoid: [],
      horizons: ["intraday"],
      sectors: [],
      exclusions: [],
      portfolioRules: {},
      behavior: {},
      exposureTree: [{
        label: "Macro Catalyst: payroll benchmark revision. (Note: Condensed to fit schema depth). Let's expand properly below: Wait, I need to format this as the schema dictates. Let's do it cleanly.",
      }],
      confidenceNotes: [],
      suggestedName: "Post-Benchmark Small-Cap Confirmation",
    } satisfies ThesisGraph;

    expect(() => validateGraphForPersistence(malformed)).toThrow(
      "The thesis service returned an invalid exposure map",
    );
  });
});

describe("Decision Run projection recovery", () => {
  const clean = {
    beliefs: ["Post-benchmark rates may support small caps"],
    seek: ["IWM only after observable intraday gates pass"],
    avoid: ["missing or contradictory tape evidence"],
    horizons: ["intraday"],
    sectors: [],
    exclusions: [],
    portfolioRules: { minAvgDailyVolumeUsd: 20_000_000 },
    behavior: {},
    exposureTree: [{ label: "US small-cap equities", children: [{ label: "IWM ETF shares" }] }],
    researchSymbols: ["IWM"],
    evidenceRequirements: ["IWM above VWAP"],
    invalidationConditions: ["Tape evidence is missing or contradictory"],
    instrumentPreference: "shares" as const,
    confidenceNotes: [],
    suggestedName: "Post-Benchmark Small-Cap Confirmation",
  } satisfies ThesisGraph;

  it("uses a valid stored projection without invoking the compiler", async () => {
    let calls = 0;
    const result = await resolveRunGraph(clean, "A complete operator thesis sentence for testing.", async () => {
      calls += 1;
      return clean;
    });
    expect(result).toEqual({ graph: clean, recovered: false });
    expect(calls).toBe(0);
  });

  it("re-projects unchanged thesis text when a historical graph is malformed", async () => {
    const malformed = {
      ...clean,
      exposureTree: [{ label: "IWM shares. Wait, I need to format this as the schema dictates." }],
    };
    const seen: string[] = [];
    const thesisText = "Paper-only IWM research after the named observable gates pass.";
    const result = await resolveRunGraph(malformed, thesisText, async (text) => {
      seen.push(text);
      return clean;
    });
    expect(result).toEqual({ graph: clean, recovered: true });
    expect(seen).toEqual([thesisText]);
  });

  it("fails closed when the replacement projection is also malformed", async () => {
    const malformed = {
      ...clean,
      exposureTree: [{ label: "IWM shares. Wait, I need to format this as the schema dictates." }],
    };
    await expect(resolveRunGraph(malformed, "A complete operator thesis sentence for testing.", async () => malformed))
      .rejects.toThrow("invalid exposure map");
  });
});

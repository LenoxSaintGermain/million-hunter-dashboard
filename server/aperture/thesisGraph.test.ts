/**
 * Thesis Graph compiler — unit tests.
 *
 * The compiler calls Gemini, so we test the pure structural helpers that do NOT
 * require a live API key: flattenExposureTree, the ThesisGraph type shape, and
 * the looseJsonParse fallback that the compiler relies on.
 */
import { describe, it, expect } from "vitest";
import { flattenExposureTree, parseCompilerResponse, type ThesisGraph } from "./thesisGraph";

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
});

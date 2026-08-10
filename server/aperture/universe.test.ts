import { describe, it, expect } from "vitest";
import { discoverUniverse, looksLikeTicker, thesisSummary } from "./universe";

const NODES = [
  { label: "AI adoption", depth: 0 },
  { label: "Datacenter expansion", depth: 1 },
  { label: "Power management", depth: 2 },
  { label: "Uranium", depth: 3 },
];

const cited = (rows: unknown) => async () => ({
  content: JSON.stringify(rows),
  citations: ["https://example.com/source"],
});

describe("looksLikeTicker", () => {
  it("accepts real ticker shapes", () => {
    for (const t of ["NVDA", "F", "BRK.B", "XLU"]) expect(looksLikeTicker(t)).toBe(true);
  });

  it("rejects prose, empties and over-long strings", () => {
    for (const t of ["not a ticker", "", "TOOLONGSYM", 42, null, undefined]) {
      expect(looksLikeTicker(t as unknown)).toBe(false);
    }
  });
});

describe("thesisSummary", () => {
  it("compresses beliefs and goals into one line", () => {
    expect(thesisSummary(["inference compounds"], ["picks and shovels"]))
      .toBe("believes inference compounds. seeking picks and shovels");
  });

  it("says so plainly when there is nothing to summarise", () => {
    expect(thesisSummary([], [])).toBe("(no thesis detail supplied)");
  });
});

describe("discoverUniverse", () => {
  it("queries the deepest nodes first — that is where the non-obvious names are", async () => {
    const asked: string[] = [];
    await discoverUniverse(NODES, "x", new Set(), {
      maxNodes: 2,
      research: async (node) => {
        asked.push(node);
        return { content: "[]", citations: ["https://x"] };
      },
    });
    expect(asked).toEqual(["Uranium", "Power management"]);
  });

  it("collects cited symbols and records which node produced each", async () => {
    const r = await discoverUniverse([NODES[3]], "x", new Set(), {
      research: cited([{ symbol: "CCJ", name: "Cameco", rationale: "Mines uranium" }]),
    });
    expect(r.discovered).toHaveLength(1);
    expect(r.discovered[0]).toMatchObject({ symbol: "CCJ", name: "Cameco", nodeLabel: "Uranium" });
    expect(r.discovered[0].citations).toEqual(["https://example.com/source"]);
  });

  // The rule that keeps invented tickers out of the ledger.
  it("DISCARDS a whole node's results when the source returned no citations", async () => {
    const r = await discoverUniverse([NODES[3]], "x", new Set(), {
      research: async () => ({ content: JSON.stringify([{ symbol: "FAKE", name: "Invented Co" }]), citations: [] }),
    });
    expect(r.discovered).toHaveLength(0);
    expect(r.nodesFailed[0].reason).toMatch(/no citations/);
    expect(r.droppedNote).toMatch(/discarded for returning no citations/);
  });

  it("drops entries that are not plausible tickers", async () => {
    const r = await discoverUniverse([NODES[3]], "x", new Set(), {
      research: cited([
        { symbol: "CCJ", name: "Cameco" },
        { symbol: "several uranium miners", name: "junk" },
        { name: "no symbol at all" },
      ]),
    });
    expect(r.discovered.map((d) => d.symbol)).toEqual(["CCJ"]);
  });

  it("excludes what the investor already holds or planned, and counts it", async () => {
    const r = await discoverUniverse([NODES[3]], "x", new Set(["CCJ"]), {
      research: cited([{ symbol: "CCJ" }, { symbol: "UEC" }]),
    });
    expect(r.discovered.map((d) => d.symbol)).toEqual(["UEC"]);
    expect(r.excludedKnown).toEqual(["CCJ"]);
    expect(r.droppedNote).toMatch(/1 already held or planned/);
  });

  it("dedupes a symbol surfaced by two different nodes", async () => {
    const r = await discoverUniverse(NODES.slice(2), "x", new Set(), {
      research: cited([{ symbol: "ETN" }]),
    });
    expect(r.discovered.map((d) => d.symbol)).toEqual(["ETN"]);
  });

  // No silent caps.
  it("reports unqueried nodes rather than pretending it covered everything", async () => {
    const r = await discoverUniverse(NODES, "x", new Set(), { maxNodes: 1, research: cited([]) });
    expect(r.nodesQueried).toHaveLength(1);
    expect(r.droppedNote).toMatch(/3 exposure node\(s\) not queried \(cap of 1\)/);
  });

  it("reports symbol-list truncation", async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ symbol: `AA${String.fromCharCode(65 + i)}` }));
    const r = await discoverUniverse([NODES[3]], "x", new Set(), { maxSymbols: 3, research: cited(many) });
    expect(r.discovered).toHaveLength(3);
    expect(r.droppedNote).toMatch(/truncated at 3/);
  });

  it("says nothing was dropped when nothing was", async () => {
    const r = await discoverUniverse([NODES[3]], "x", new Set(), { research: cited([{ symbol: "CCJ" }]) });
    expect(r.droppedNote).toBeNull();
  });

  it("survives a node whose research call throws, and names it", async () => {
    let n = 0;
    const r = await discoverUniverse(NODES.slice(2), "x", new Set(), {
      research: async (node) => {
        if (n++ === 0) throw new Error("sonar 503");
        return { content: JSON.stringify([{ symbol: "ETN" }]), citations: ["https://x"] };
      },
    });
    expect(r.discovered.map((d) => d.symbol)).toEqual(["ETN"]);
    expect(r.nodesFailed[0]).toMatchObject({ node: "Uranium", reason: expect.stringMatching(/sonar 503/) });
  });

  it("handles unparseable and non-list output without losing the run", async () => {
    const r = await discoverUniverse(NODES.slice(2), "x", new Set(), {
      research: async (node) =>
        node === "Uranium"
          ? { content: "sorry, I can't help with that", citations: ["https://x"] }
          : { content: JSON.stringify({ not: "a list" }), citations: ["https://x"] },
    });
    expect(r.discovered).toHaveLength(0);
    expect(r.droppedNote).toMatch(/returned unusable output/);
    expect(r.nodesFailed).toHaveLength(2);
  });
});

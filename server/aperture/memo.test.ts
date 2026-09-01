import { describe, it, expect } from "vitest";
import { buildFactLedgerFallbackMemo, generateMemo, buildMemoPrompt, coerceMemo, citationsFrom, parseMemoResponse } from "./memo";
import { normalizeGraph, flattenExposureTree, optionalNum, type ThesisGraph } from "./thesisGraph";
import type { SecurityFact } from "../../drizzle/schema";

const fact = (p: Partial<SecurityFact>): SecurityFact =>
  ({
    id: 1, symbol: "NVDA", factKey: "x", valueNum: null, valueText: null, unit: "none",
    basis: "verified", assumption: null, providerId: "edgar", sourceName: "SEC EDGAR",
    sourceUrl: "https://sec.gov/x", asOf: null, fetchedAt: 1, expiresAt: null, ...p,
  }) as SecurityFact;

const FACTS = [
  fact({ factKey: "revenue_ttm", valueNum: 1_234_567_890, unit: "usd" }),
  fact({ factKey: "pe_ratio", valueNum: 31.2, unit: "x", providerId: "fmp", sourceUrl: "https://fmp.com/x" }),
  fact({ factKey: "fcf_ttm", basis: "unknown", valueNum: null, sourceUrl: null }),
];

const GRAPH: ThesisGraph = {
  beliefs: ["Inference demand compounds faster than training demand"],
  seek: ["Picks and shovels"], avoid: ["Pre-revenue AI wrappers"],
  horizons: ["12-36 months"], sectors: ["Semiconductors"], exclusions: [],
  portfolioRules: {}, behavior: {}, exposureTree: [], confidenceNotes: [], suggestedName: "AI Infra",
};

describe("buildMemoPrompt", () => {
  it("hands over the ledger and names the explicit gaps", () => {
    const p = buildMemoPrompt("NVDA", FACTS, GRAPH, ["VRT"]);
    expect(p).toMatch(/revenue_ttm: 1234567890 usd/);
    expect(p).toMatch(/EXPLICIT GAPS \(a source was consulted and stated nothing\): fcf_ttm/);
    expect(p).toMatch(/CURRENT HOLDINGS: VRT/);
    expect(p).toMatch(/THE ONLY NUMBERS THAT EXIST ARE THE ONES IN THE FACT LEDGER/);
  });

  it("says so plainly when nothing is held", () => {
    expect(buildMemoPrompt("NVDA", FACTS, GRAPH, [])).toMatch(/CURRENT HOLDINGS: \(none on record\)/);
  });
});

describe("generateMemo", () => {
  const goodMemo = JSON.stringify({
    thesisFit: "Revenue of $1.23B against a thesis of inference-driven demand.",
    whyNow: "Trades at 31x earnings.",
    catalyst: "Datacenter buildout raises demand for its parts.",
    whatWouldInvalidate: "Inference demand growth falling below datacenter capex growth.",
    relationToPortfolio: "Overlaps existing semiconductor exposure.",
    whyThisDeservesCapital: "Direct expression of the stated belief.",
    risks: ["Customer concentration"], downsideScenario: "Multiple compresses.",
    unknowns: ["Free cash flow — no source stated it"], researchConfidence: "medium",
  });

  it("returns a memo when every figure traces to the ledger", async () => {
    const r = await generateMemo("NVDA", FACTS, GRAPH, [], { generate: async () => goodMemo });
    expect(r.status).toBe("ok");
    expect(r.memo!.thesisFit).toMatch(/1\.23B/);
    expect(r.validation!.ok).toBe(true);
  });

  it("collects citations from the ledger's sources", async () => {
    const r = await generateMemo("NVDA", FACTS, GRAPH, [], { generate: async () => goodMemo });
    expect(r.citations).toEqual(expect.arrayContaining(["https://sec.gov/x", "https://fmp.com/x"]));
  });

  // The whole point of the module.
  it("REJECTS a memo with an invented figure, and does not return it", async () => {
    const bad = JSON.stringify({
      ...JSON.parse(goodMemo),
      catalyst: "Management guided to $2.9B next year.",
    });
    const r = await generateMemo("NVDA", FACTS, GRAPH, [], { generate: async () => bad, retryOnReject: false });
    expect(r.status).toBe("rejected");
    expect(r.memo).toBeNull();
    expect(r.rejectReason).toMatch(/\$2\.9B/);
  });

  it("retries once with the offending figures named, and accepts a clean rewrite", async () => {
    let call = 0;
    const generate = async (prompt: string) => {
      call++;
      if (call === 1) return JSON.stringify({ ...JSON.parse(goodMemo), catalyst: "Guided to $2.9B." });
      expect(prompt).toMatch(/YOUR PREVIOUS ATTEMPT WAS REJECTED/);
      expect(prompt).toMatch(/\$2\.9B/);
      return goodMemo;
    };
    const r = await generateMemo("NVDA", FACTS, GRAPH, [], { generate });
    expect(call).toBe(2);
    expect(r.status).toBe("ok");
  });

  it("falls back to a validated ledger-only memo when the retry repeats an invented figure", async () => {
    const generate = async () => JSON.stringify({ ...JSON.parse(goodMemo), catalyst: "Guided to $2.9B." });
    const r = await generateMemo("NVDA", FACTS, GRAPH, [], { generate });
    expect(r.status).toBe("ok");
    expect(r.memo?.generationBasis).toBe("fact_ledger_fallback");
    expect(r.memo?.catalyst).toMatch(/No validated catalyst conclusion/i);
    expect(r.validation?.ok).toBe(true);
  });

  it("skips rather than writing a memo of hedges when nothing is sourced", async () => {
    const onlyUnknowns = [fact({ factKey: "revenue_ttm", basis: "unknown", valueNum: null })];
    let called = false;
    const r = await generateMemo("XYZ", onlyUnknowns, GRAPH, [], { generate: async () => { called = true; return goodMemo; } });
    expect(r.status).toBe("skipped");
    expect(called).toBe(false); // did not even spend the call
    expect(r.rejectReason).toMatch(/No sourced facts/);
  });

  it("falls back to a validated ledger-only record when generation fails", async () => {
    const r = await generateMemo("NVDA", FACTS, GRAPH, [], { generate: async () => { throw new Error("503 upstream"); } });
    expect(r.status).toBe("ok");
    expect(r.memo?.generationBasis).toBe("fact_ledger_fallback");
    expect(r.validation?.ok).toBe(true);
    expect(r.rejectReason).toMatch(/503 upstream/);
  });

  it("falls back instead of leaving the operator waiting past the model deadline", async () => {
    const r = await generateMemo("NVDA", FACTS, GRAPH, [], {
      generate: async () => new Promise(() => undefined),
      modelDeadlineMs: 5,
    });
    expect(r.status).toBe("ok");
    expect(r.memo?.generationBasis).toBe("fact_ledger_fallback");
    expect(r.rejectReason).toMatch(/deadline exceeded/);
  });

  it("rejects unparseable output", async () => {
    const r = await generateMemo("NVDA", FACTS, GRAPH, [], { generate: async () => "not json at all", retryOnReject: false });
    expect(r.status).toBe("rejected");
    expect(r.rejectReason).toMatch(/parseable JSON/);
  });

  it("retries malformed output once and accepts a valid fact-only JSON rewrite", async () => {
    let call = 0;
    const r = await generateMemo("NVDA", FACTS, GRAPH, [], {
      generate: async (prompt) => {
        call++;
        if (call === 1) return "I cannot provide JSON today.";
        expect(prompt).toMatch(/not parseable JSON/);
        return goodMemo;
      },
    });
    expect(call).toBe(2);
    expect(r.status).toBe("ok");
  });

  it("recovers valid memo JSON delivered through a candidate-part response wrapper", async () => {
    const r = await generateMemo("NVDA", FACTS, GRAPH, [], {
      generate: async () => ({ candidates: [{ content: { parts: [{ text: goodMemo }] } }] }),
    });
    expect(r.status).toBe("ok");
  });

  it("returns a validated, transparent ledger-only memo if malformed output survives the retry", async () => {
    const r = await generateMemo("NVDA", FACTS, GRAPH, [], { generate: async () => "not structured output" });
    expect(r.status).toBe("ok");
    expect(r.memo?.generationBasis).toBe("fact_ledger_fallback");
    expect(r.validation?.ok).toBe(true);
  });
});

describe("parseMemoResponse", () => {
  it("unwraps quoted JSON and common output envelopes", () => {
    const raw = { thesisFit: "Ledger-only analysis", whatWouldInvalidate: "A falsifiable condition", risks: [], unknowns: [], researchConfidence: "low" };
    expect(parseMemoResponse({ text: JSON.stringify(JSON.stringify(raw)) })).toEqual(raw);
    expect(parseMemoResponse({ text: JSON.stringify({ output: raw }) })).toEqual(raw);
  });
});

describe("coerceMemo", () => {
  it("defaults an unrecognised confidence to low, never high", () => {
    expect(coerceMemo({ researchConfidence: "extremely high" }).researchConfidence).toBe("low");
    expect(coerceMemo({}).researchConfidence).toBe("low");
    expect(coerceMemo({ researchConfidence: "HIGH" }).researchConfidence).toBe("high");
  });

  it("does not invent content for missing sections", () => {
    const m = coerceMemo({ thesisFit: "  x  " });
    expect(m.thesisFit).toBe("x");
    expect(m.catalyst).toBe("");
    expect(m.risks).toEqual([]);
  });
});

describe("buildFactLedgerFallbackMemo", () => {
  it("does not introduce a paper-allocation conclusion", () => {
    const memo = buildFactLedgerFallbackMemo("NVDA", FACTS, GRAPH, []);
    expect(memo.generationBasis).toBe("fact_ledger_fallback");
    expect(memo.whyThisDeservesCapital).toMatch(/does not support a paper-allocation conclusion/i);
  });
});

describe("thesis graph normalisation", () => {
  it("omits a portfolio rule the investor never stated", () => {
    const g = normalizeGraph({ beliefs: ["x"], portfolioRules: { maxSingleNamePct: "8" } });
    expect(g.portfolioRules.maxSingleNamePct).toBe(8);
    expect(g.portfolioRules).not.toHaveProperty("reservePct");
    expect(g.portfolioRules).not.toHaveProperty("maxCorrelatedClusterPct");
  });

  it("parses model numeric strings, including formatted ones", () => {
    expect(optionalNum("5000000")).toBe(5_000_000);
    expect(optionalNum("$5,000,000")).toBe(5_000_000);
    expect(optionalNum("8")).toBe(8);
  });

  it("returns undefined — not zero — for junk or absent values", () => {
    expect(optionalNum("")).toBeUndefined();
    expect(optionalNum(null)).toBeUndefined();
    expect(optionalNum("not a number")).toBeUndefined();
  });

  it("drops malformed tree nodes rather than emitting blank labels", () => {
    const g = normalizeGraph({
      beliefs: ["x"],
      exposureTree: [
        { label: "AI adoption", children: [{ label: "" }, { label: "Power", children: [{ label: "Uranium" }] }] },
        { notALabel: true },
      ],
    });
    expect(g.exposureTree).toHaveLength(1);
    expect(g.exposureTree[0].children).toHaveLength(1);
    expect(g.exposureTree[0].children![0].label).toBe("Power");
  });

  it("names an unnamed thesis rather than leaving it blank", () => {
    expect(normalizeGraph({ beliefs: ["x"] }).suggestedName).toBe("Untitled thesis");
  });
});

describe("flattenExposureTree", () => {
  it("produces depth and a readable path for every node", () => {
    const rows = flattenExposureTree([
      { label: "AI adoption", children: [{ label: "Power", children: [{ label: "Uranium" }] }] },
    ]);
    expect(rows.map((r) => `${r.depth}:${r.path}`)).toEqual([
      "0:AI adoption",
      "1:AI adoption / Power",
      "2:AI adoption / Power / Uranium",
    ]);
    expect(rows[2].parentPath).toBe("AI adoption / Power");
    expect(rows[0].parentPath).toBeNull();
  });

  it("handles an empty tree", () => {
    expect(flattenExposureTree([])).toEqual([]);
  });
});

describe("citationsFrom", () => {
  it("dedupes and skips facts with no source url", () => {
    expect(citationsFrom(FACTS).length).toBe(2);
  });
});

import { describe, it, expect } from "vitest";
import { extractClaims, matchesFact, toleranceFor, validateMemoNumbers, allowedValues, flattenText } from "./memoValidator";
import { assertFactWritable, FactContractError, factsToPromptBlock, freshestPerKey, normSymbol, type Fact } from "./facts";
import type { SecurityFact } from "../../drizzle/schema";

/** Minimal SecurityFact row builder — only the fields the validator reads. */
const fact = (p: Partial<SecurityFact>): SecurityFact =>
  ({
    id: 1, symbol: "NVDA", factKey: "x", valueNum: null, valueText: null, unit: "none",
    basis: "verified", assumption: null, providerId: "test", sourceName: "Test",
    sourceUrl: "https://example.com", asOf: null, fetchedAt: 1, expiresAt: null,
    ...p,
  }) as SecurityFact;

describe("extractClaims — what counts as a financial claim", () => {
  it("catches currency, magnitudes, percents and multiples", () => {
    const raws = extractClaims("Revenue was $1.2B, up 44%, trading at 31x on $4,500,000 of FCF")
      .map((c) => c.raw);
    expect(raws).toEqual(expect.arrayContaining(["$1.2B", "44%", "31x", "$4,500,000"]));
  });

  it("reads magnitude words as well as suffixes", () => {
    expect(extractClaims("about 4.2 billion")[0].candidates[0].value).toBe(4.2e9);
    expect(extractClaims("about 900K")[0].candidates[0].value).toBe(900_000);
  });

  it("does not read the 't' of an ordinal as 'trillion'", () => {
    expect(extractClaims("ranked 7th out of 40")).toHaveLength(0);
    expect(extractClaims("the 3rd and 21st names")).toHaveLength(0);
  });

  it("ignores prose numbers so real memos are not rejected for English", () => {
    expect(extractClaims("three catalysts, 2 of its 5 segments, ranked 7th")).toHaveLength(0);
  });

  it("ignores plausible years", () => {
    expect(extractClaims("the 2019 filing and the 2026 guidance")).toHaveLength(0);
  });

  it("still catches a bare number of financial size", () => {
    expect(extractClaims("shipped 18,000 units")[0].candidates[0].value).toBe(18_000);
  });

  it("offers both readings of a percent, since ledgers store either", () => {
    expect(extractClaims("margin of 44%")[0].candidates).toEqual([
      { value: 44, tolerance: 0.5 },
      { value: 0.44, tolerance: 0.005 },
    ]);
  });
});

describe("toleranceFor — precision comes from how the number was written", () => {
  it("widens for a coarsely written number and tightens for a precise one", () => {
    expect(toleranceFor("31", 1)).toBe(0.5);
    expect(toleranceFor("31.0", 1)).toBe(0.05);
    expect(toleranceFor("1.23", 1e9)).toBeCloseTo(5e6);
  });
});

describe("matchesFact — tolerant of honest rounding, not of invention", () => {
  it("accepts a rounded rendering of a precise fact", () => {
    expect(matchesFact(1.23e9, 1_234_567_890, 5e6)).toBe(true);
    expect(matchesFact(31, 31.2, 0.5)).toBe(true);
  });

  it("rejects a figure that is merely nearby", () => {
    expect(matchesFact(1.5e9, 1_234_567_890, 5e7)).toBe(false);
    expect(matchesFact(52, 44, 0.5)).toBe(false);
  });

  it("holds a precisely written claim to a precise standard", () => {
    // "31.0x" asserts a tenth; a 31.2 fact does not support it.
    expect(matchesFact(31.0, 31.2, 0.05)).toBe(false);
  });
});

describe("validateMemoNumbers", () => {
  const facts = [
    fact({ factKey: "revenue_ttm", valueNum: 1_234_567_890, unit: "usd" }),
    fact({ factKey: "gross_margin", valueNum: 0.44, unit: "ratio" }),
    fact({ factKey: "pe_ratio", valueNum: 31.2, unit: "x" }),
  ];

  it("passes a memo whose every figure traces to the ledger", () => {
    const memo = {
      thesis_fit: "Revenue of $1.23B with a 44% gross margin.",
      valuation: "It trades at roughly 31x earnings.",
    };
    const r = validateMemoNumbers(memo, facts);
    expect(r.ok).toBe(true);
    expect(r.offenders).toHaveLength(0);
    expect(r.reason).toBeNull();
  });

  // ── The case this whole module exists for. ────────────────────────────────
  it("REJECTS a memo containing a figure no source supports", () => {
    const memo = {
      thesis_fit: "Revenue of $1.23B with a 44% gross margin.",
      catalyst: "Management guided to $2.9B next year.", // never sourced
    };
    const r = validateMemoNumbers(memo, facts);
    expect(r.ok).toBe(false);
    expect(r.offenders.map((o) => o.raw)).toContain("$2.9B");
    expect(r.reason).toMatch(/do not trace to a sourced fact/);
    expect(r.reason).toMatch(/\$2\.9B/);
  });

  it("does not let an `unknown` fact back a number", () => {
    const withUnknown = [...facts, fact({ factKey: "fcf_ttm", basis: "unknown", valueNum: null })];
    const r = validateMemoNumbers({ s: "Free cash flow was $800M." }, withUnknown);
    expect(r.ok).toBe(false);
  });

  it("accepts numbers stated inside a textual fact", () => {
    const withText = [fact({ factKey: "guidance", valueText: "guided to $2.9B for FY27" })];
    expect(validateMemoNumbers({ s: "Management guided to $2.9B." }, withText).ok).toBe(true);
  });

  it("rejects everything numeric when the ledger is empty", () => {
    const r = validateMemoNumbers({ s: "Revenue of $1.2B." }, []);
    expect(r.ok).toBe(false);
    expect(r.offenders).toHaveLength(1);
  });

  it("passes a memo that makes no numeric claims at all", () => {
    const r = validateMemoNumbers({ s: "No source states current margins; this remains unverified." }, []);
    expect(r.ok).toBe(true);
  });

  it("reads modeled facts as legitimate backing", () => {
    const modeled = [fact({ factKey: "yield_on_cost", valueNum: 0.082, unit: "ratio", basis: "modeled", assumption: "6.5% exit cap" })];
    expect(validateMemoNumbers({ s: "Yield on cost of 8.2%." }, modeled).ok).toBe(true);
  });

  it("flattens nested memo structures so no section escapes checking", () => {
    const memo = { sections: [{ body: "Buried claim: $9.9B." }] };
    expect(flattenText(memo)).toMatch(/9\.9B/);
    expect(validateMemoNumbers(memo, facts).ok).toBe(false);
  });
});

describe("allowedValues", () => {
  it("exposes both readings of a ratio", () => {
    const vals = allowedValues([fact({ valueNum: 0.44, unit: "ratio" })]);
    expect(vals).toContain(0.44);
    expect(vals).toContain(44);
  });
});

describe("assertFactWritable — the write-time gate", () => {
  const base: Fact = { factKey: "revenue_ttm", valueNum: 1e9, unit: "usd", basis: "verified", providerId: "edgar", sourceName: "SEC EDGAR" };

  it("accepts a sourced verified fact", () => {
    expect(() => assertFactWritable("NVDA", base)).not.toThrow();
  });

  it("refuses a verified fact with no source", () => {
    expect(() => assertFactWritable("NVDA", { ...base, sourceName: null, sourceUrl: null }))
      .toThrow(FactContractError);
  });

  it("refuses a modeled fact with no assumption recorded", () => {
    expect(() => assertFactWritable("NVDA", { ...base, basis: "modeled" }))
      .toThrow(/assumption/i);
  });

  it("accepts a modeled fact that declares its assumption", () => {
    expect(() => assertFactWritable("NVDA", { ...base, basis: "modeled", assumption: "street consensus margin" }))
      .not.toThrow();
  });

  it("refuses an `unknown` fact that smuggles in a value", () => {
    expect(() => assertFactWritable("NVDA", { ...base, basis: "unknown" }))
      .toThrow(/must carry NO value/);
  });

  it("refuses a valued basis with nothing in it", () => {
    expect(() => assertFactWritable("NVDA", { ...base, valueNum: null }))
      .toThrow(/needs a value/);
  });
});

describe("ledger helpers", () => {
  it("normalises symbols", () => {
    expect(normSymbol(" nvda ")).toBe("NVDA");
  });

  it("keeps only the freshest row per fact key", () => {
    const rows = [
      fact({ id: 1, factKey: "pe_ratio", valueNum: 30, fetchedAt: 100 }),
      fact({ id: 2, factKey: "pe_ratio", valueNum: 31, fetchedAt: 200 }),
      fact({ id: 3, symbol: "AMD", factKey: "pe_ratio", valueNum: 40, fetchedAt: 50 }),
    ];
    const fresh = freshestPerKey(rows);
    expect(fresh).toHaveLength(2);
    expect(fresh.find((r) => r.symbol === "NVDA")!.valueNum).toBe(31);
  });

  it("renders modeled assumptions and unknown gaps into the prompt block", () => {
    const block = factsToPromptBlock([
      fact({ factKey: "pe_ratio", valueNum: 31.2, unit: "x", sourceName: "FMP" }),
      fact({ factKey: "rehab_cost", valueNum: 100, basis: "modeled", assumption: "$180/SF" }),
      fact({ factKey: "fcf_ttm", basis: "unknown", valueNum: null }),
    ]);
    expect(block).toMatch(/pe_ratio: 31.2 x \(FMP\)/);
    expect(block).toMatch(/MODELED: \$180\/SF/);
    expect(block).toMatch(/fcf_ttm: UNKNOWN — no source states this/);
  });
});

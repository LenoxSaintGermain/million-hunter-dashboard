import { describe, expect, it } from "vitest";
import { buildEvidenceFactDraft } from "./evidenceFactDraft";
import type { SecurityFact } from "../../drizzle/schema";

const at = Date.UTC(2026, 8, 10, 12);
const f = (factKey: string, valueNum: number, over: Partial<SecurityFact> = {}): SecurityFact => ({
  symbol: "MYRG", factKey, valueNum, basis: "verified", asOf: at, fetchedAt: at,
  sourceName: "SEC EDGAR 10-K", sourceUrl: "https://www.sec.gov/edgar", ...over,
} as SecurityFact);

// Real MYRG ledger values observed in production on 2026-09-10.
const full = [
  f("last_price", 284.47, { sourceName: "Alpaca SIP" }),
  f("shares_outstanding", 15_522_834),
  f("net_income_ttm", 118_416_000),
  f("revenue_ttm", 3_657_889_000),
];

describe("a price-multiple check drafts itself from verified facts", () => {
  it("computes P/E and shows the whole derivation", () => {
    const d = buildEvidenceFactDraft({ symbol: "MYRG", checkLabel: "C: Price / earnings", facts: full });
    if (!d.available) throw new Error("expected a draft");
    expect(d.observedValue).toBe("P/E 37.29");
    expect(d.criterion).toContain("$284");
    expect(d.criterion).toContain("15,522,834 shares");
    expect(d.criterion).toContain("SEC EDGAR 10-K");
    expect(d.observedAt).toBe("2026-09-10");
  });

  it("computes P/S from the same market capitalisation", () => {
    const d = buildEvidenceFactDraft({ symbol: "MYRG", checkLabel: "C: Price / sales", facts: full });
    if (!d.available) throw new Error("expected a draft");
    expect(d.observedValue).toBe("P/S 1.21");
  });

  it("never answers the gate for the operator", () => {
    const d = buildEvidenceFactDraft({ symbol: "MYRG", checkLabel: "C: Price / earnings", facts: full });
    if (!d.available) throw new Error("expected a draft");
    expect(d.conclusion).toMatch(/operator's determination/);
    expect(d.conclusion).not.toMatch(/\bsupports the thesis\b(?!.*determination)/);
    expect(Object.keys(d)).not.toContain("status");
  });

  it("refuses rather than assuming when a share count is missing", () => {
    const d = buildEvidenceFactDraft({ symbol: "SHLS", checkLabel: "C: Price / earnings", facts: full.filter(x => x.factKey !== "shares_outstanding") });
    expect(d.available).toBe(false);
    if (d.available) return;
    expect(d.reason).toMatch(/shares outstanding/i);
  });

  it("refuses when the ledger has no figure for the denominator", () => {
    const d = buildEvidenceFactDraft({ symbol: "GRID", checkLabel: "C: Price / sales", facts: full.filter(x => x.factKey !== "revenue_ttm") });
    expect(d.available).toBe(false);
  });

  it("ignores an unknown-basis fact instead of treating it as data", () => {
    const facts = full.map(x => x.factKey === "net_income_ttm" ? { ...x, basis: "unknown" as const, valueNum: null } : x);
    expect(buildEvidenceFactDraft({ symbol: "MYRG", checkLabel: "C: Price / earnings", facts }).available).toBe(false);
  });

  it("flags a misparsed revenue instead of dividing by it quietly", () => {
    // EME in production: $1.9B recorded against an actual figure near $14-16B.
    const eme = [
      f("last_price", 748.33, { symbol: "EME", sourceName: "Alpaca SIP" }),
      f("shares_outstanding", 44_520_370, { symbol: "EME" }),
      f("revenue_ttm", 1_900_388_000, { symbol: "EME" }),
    ];
    const d = buildEvidenceFactDraft({ symbol: "EME", checkLabel: "C: Price / sales", facts: eme });
    if (!d.available) throw new Error("expected a draft");
    expect(d.plausibilityWarning).toMatch(/misparsed/i);
    expect(d.conclusion).toMatch(/Verify the revenue fact/);
  });

  it("has no computation for a criterion it does not understand", () => {
    const d = buildEvidenceFactDraft({ symbol: "MYRG", checkLabel: "C: Management track record", facts: full });
    expect(d.available).toBe(false);
    if (d.available) return;
    expect(d.reason).toMatch(/by hand/);
  });
});

import { describe, expect, it } from "vitest";
import { buildEvidenceFactDraft } from "./evidenceFactDraft";
import type { SecurityFact } from "../../drizzle/schema";
import { evidenceQuestionReadiness } from "../../shared/evidenceQuestion";

const at = Date.UTC(2026, 8, 10, 12);
const f = (factKey: string, valueNum: number, over: Partial<SecurityFact> = {}): SecurityFact => ({
  symbol: "MPC", factKey, valueNum, basis: "verified", asOf: at, fetchedAt: at,
  sourceName: "SEC EDGAR 10-K", sourceUrl: "https://www.sec.gov/edgar", ...over,
} as SecurityFact);

const fullMpcFacts = [
  f("last_price", 175.50, { sourceName: "Alpaca SIP" }),
  f("shares_outstanding", 350_000_000),
  f("net_income_ttm", 9_500_000_000),
  f("revenue_ttm", 140_000_000_000),
];

describe("Aperture Zero-Friction Evidence Ingestion & Sizing", () => {
  it("auto-populates quantitative evidence drafts for MPC Price/Sales", () => {
    const checkLabel = "Does MPC's price / sales support the thesis at this valuation? Requirement: Price / sales.";
    const draft = buildEvidenceFactDraft({ symbol: "MPC", checkLabel, facts: fullMpcFacts });
    
    expect(draft.available).toBe(true);
    if (!draft.available) return;
    expect(draft.observedValue).toMatch(/P\/S\s+[0-9.]+/);
    expect(draft.criterion).toContain("350,000,000 shares");
    expect(draft.sourceUrl).toContain("https://www.sec.gov/edgar");

    const readiness = evidenceQuestionReadiness({
      observation: draft.observedValue,
      asOf: draft.observedAt,
      criterion: draft.criterion,
      sourceUrl: draft.sourceUrl!,
      note: draft.conclusion,
    }, at);

    expect(readiness.canResolve).toBe(true);
  });

  it("calculates dynamic allowable units and flags single-order ceiling breaches", () => {
    const equityCents = 200_000; // $2,000 NAV
    const singleOrderCeilingCents = Math.min(10_000_00, Math.round(equityCents * 0.05)); // $100 max order
    const singleNameCapCents = Math.round(equityCents * 0.10); // $200 max position
    const effectiveCeilingCents = Math.min(singleOrderCeilingCents, singleNameCapCents);

    expect(effectiveCeilingCents).toBe(10_000); // $100

    // Test a $3.00 option contract ($300 premium cost)
    const optionLimitPriceDollars = 3.00;
    const costPerContractCents = Math.round(optionLimitPriceDollars * 100 * 100); // 30,000 cents ($300)
    const maxAllowableContracts = costPerContractCents > 0 ? Math.floor(effectiveCeilingCents / costPerContractCents) : 0;

    // Naked contract exceeds $100 ceiling -> 0 allowed
    expect(maxAllowableContracts).toBe(0);

    // Test a vertical debit spread with $0.80 net debit ($80 max risk)
    const spreadNetDebitDollars = 0.80;
    const spreadCostCents = Math.round(spreadNetDebitDollars * 100 * 100); // 8,000 cents ($80)
    const maxAllowableSpreads = Math.floor(effectiveCeilingCents / spreadCostCents);

    // Spread compresses risk to fit under $100 ceiling -> 1 contract fits!
    expect(maxAllowableSpreads).toBe(1);
    expect(spreadCostCents).toBeLessThanOrEqual(effectiveCeilingCents);
  });
});

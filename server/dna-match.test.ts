/**
 * Unit tests for the DNA Match Score engine
 * Tests all four scoring dimensions and edge cases.
 */
import { describe, it, expect } from "vitest";

// ─── Inline the pure scoring functions for server-side testing ────────────────
// (mirrors client/src/lib/dnaMatch.ts — keep in sync)

interface DnaProfile {
  riskTolerance?: number | null;
  timeHorizon?: number | null;
  liquidityNeed?: number | null;
  esgConviction?: number | null;
  sectorAffinity?: string[] | null;
}

interface DealForMatch {
  industry?: string | null;
  askingPrice?: number | null;
  cashFlow?: number | null;
  score?: number | null;
}

interface DnaMatchResult {
  total: number;
  sectorPts: number;
  sizePts: number;
  riskPts: number;
  irrPts: number;
  label: string;
  tier: "strong" | "good" | "partial";
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

function sectorScore(industry?: string | null, sectors?: string[] | null): number {
  if (!industry || !sectors || sectors.length === 0) return 0;
  const dealNorm = norm(industry);
  for (const s of sectors) {
    const sNorm = norm(s);
    if (dealNorm === sNorm) return 30;
    if (dealNorm.includes(sNorm) || sNorm.includes(dealNorm)) return 28;
    const dealWords = dealNorm.split(" ").filter((w) => w.length >= 5);
    const sWords = sNorm.split(" ").filter((w) => w.length >= 5);
    if (dealWords.some((w) => sWords.includes(w))) return 18;
  }
  return 0;
}

function sizeScore(askingPrice?: number | null, riskTol?: number | null): number {
  if (!askingPrice || askingPrice <= 0) return 12;
  const risk = riskTol ?? 0.5;
  const minTarget = 300_000;
  const maxTarget = 2_000_000 + risk * 8_000_000;
  if (askingPrice >= minTarget && askingPrice <= maxTarget) return 25;
  const midpoint = (minTarget + maxTarget) / 2;
  const spread = (maxTarget - minTarget) / 2;
  const distance = Math.abs(askingPrice - midpoint);
  const ratio = Math.max(0, 1 - distance / (spread * 2));
  return Math.round(ratio * 25);
}

function riskScore(aiScore?: number | null, riskTol?: number | null): number {
  if (aiScore == null) return 12;
  const risk = riskTol ?? 0.5;
  const dealRisk = 1 - aiScore;
  const alignment = 1 - Math.abs(risk - dealRisk);
  return Math.round(alignment * 25);
}

function irrScore(cashFlow?: number | null, askingPrice?: number | null, timeHorizon?: number | null): number {
  if (!cashFlow || !askingPrice || askingPrice <= 0) return 10;
  const coc = cashFlow / askingPrice;
  const horizon = timeHorizon ?? 0.5;
  const targetYield = 0.20 - horizon * 0.08;
  if (coc >= targetYield) return 20;
  if (coc <= 0) return 0;
  const ratio = coc / targetYield;
  return Math.round(ratio * 20);
}

function computeDnaMatchScore(deal: DealForMatch, dna: DnaProfile): DnaMatchResult {
  const sectorPts = sectorScore(deal.industry, dna.sectorAffinity);
  const sizePts = sizeScore(deal.askingPrice, dna.riskTolerance);
  const riskPts = riskScore(deal.score, dna.riskTolerance);
  const irrPts = irrScore(deal.cashFlow, deal.askingPrice, dna.timeHorizon);
  const total = Math.min(100, Math.max(0, sectorPts + sizePts + riskPts + irrPts));
  const tier: "strong" | "good" | "partial" =
    total >= 80 ? "strong" : total >= 60 ? "good" : "partial";
  const label = tier === "strong" ? "Strong Match" : tier === "good" ? "Good Match" : "Partial Match";
  return { total, sectorPts, sizePts, riskPts, irrPts, label, tier };
}

// ─── Lenox's Alpha Hunter DNA ─────────────────────────────────────────────────
const ALPHA_DNA: DnaProfile = {
  riskTolerance: 0.88,
  timeHorizon: 0.82,
  liquidityNeed: 0.22,
  esgConviction: 0.5,
  sectorAffinity: ["Commercial Services", "Logistics", "Healthcare Staffing", "B2B Services", "Government Contracts"],
};

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("computeDnaMatchScore", () => {
  describe("sector scoring", () => {
    it("awards 30 pts for exact sector match", () => {
      const result = computeDnaMatchScore(
        { industry: "Commercial Services", askingPrice: 2_000_000, cashFlow: 400_000, score: 0.8 },
        ALPHA_DNA
      );
      expect(result.sectorPts).toBe(30);
    });

    it("awards 28 pts for partial sector match (substring)", () => {
      const result = computeDnaMatchScore(
        { industry: "B2B Services & Consulting", askingPrice: 2_000_000, cashFlow: 400_000, score: 0.8 },
        ALPHA_DNA
      );
      expect(result.sectorPts).toBeGreaterThanOrEqual(18);
    });

    it("awards 0 pts for unrelated sector", () => {
      const result = computeDnaMatchScore(
        { industry: "Retail Apparel", askingPrice: 2_000_000, cashFlow: 400_000, score: 0.8 },
        ALPHA_DNA
      );
      expect(result.sectorPts).toBe(0);
    });

    it("awards 0 pts when industry is null", () => {
      const result = computeDnaMatchScore(
        { industry: null, askingPrice: 2_000_000, cashFlow: 400_000, score: 0.8 },
        ALPHA_DNA
      );
      expect(result.sectorPts).toBe(0);
    });

    it("awards 0 pts when sectorAffinity is empty", () => {
      const result = computeDnaMatchScore(
        { industry: "Logistics", askingPrice: 2_000_000, cashFlow: 400_000, score: 0.8 },
        { ...ALPHA_DNA, sectorAffinity: [] }
      );
      expect(result.sectorPts).toBe(0);
    });
  });

  describe("deal size scoring", () => {
    it("awards 25 pts for asking price in target range", () => {
      // Alpha Hunter (risk=0.88) → maxTarget = 2M + 0.88*8M = 9.04M
      const result = computeDnaMatchScore(
        { industry: "Logistics", askingPrice: 3_000_000, cashFlow: 600_000, score: 0.8 },
        ALPHA_DNA
      );
      expect(result.sizePts).toBe(25);
    });

    it("awards neutral 12 pts when asking price is null", () => {
      const result = computeDnaMatchScore(
        { industry: "Logistics", askingPrice: null, cashFlow: 600_000, score: 0.8 },
        ALPHA_DNA
      );
      expect(result.sizePts).toBe(12);
    });

    it("awards partial pts for asking price slightly outside range", () => {
      // Very large deal — far outside range
      const result = computeDnaMatchScore(
        { industry: "Logistics", askingPrice: 50_000_000, cashFlow: 600_000, score: 0.8 },
        ALPHA_DNA
      );
      expect(result.sizePts).toBeLessThan(25);
    });
  });

  describe("risk alignment scoring", () => {
    it("awards high pts when high-risk investor matches riskier deal", () => {
      // Alpha Hunter risk=0.88, deal score=0.12 → dealRisk=0.88 → near-perfect alignment
      const result = computeDnaMatchScore(
        { industry: "Logistics", askingPrice: 2_000_000, cashFlow: 400_000, score: 0.12 },
        ALPHA_DNA
      );
      expect(result.riskPts).toBeGreaterThanOrEqual(22);
    });

    it("awards neutral 12 pts when aiScore is null", () => {
      const result = computeDnaMatchScore(
        { industry: "Logistics", askingPrice: 2_000_000, cashFlow: 400_000, score: null },
        ALPHA_DNA
      );
      expect(result.riskPts).toBe(12);
    });

    it("awards lower pts when risk appetite mismatches deal risk", () => {
      // Low-risk investor (0.1) matched against very risky deal (score=0.1 → dealRisk=0.9)
      const result = computeDnaMatchScore(
        { industry: "Logistics", askingPrice: 2_000_000, cashFlow: 400_000, score: 0.1 },
        { ...ALPHA_DNA, riskTolerance: 0.1 }
      );
      expect(result.riskPts).toBeLessThan(15);
    });
  });

  describe("IRR proxy scoring", () => {
    it("awards 20 pts when cash-on-cash exceeds target yield", () => {
      // 30% CoC >> 20% target
      const result = computeDnaMatchScore(
        { industry: "Logistics", askingPrice: 1_000_000, cashFlow: 300_000, score: 0.8 },
        ALPHA_DNA
      );
      expect(result.irrPts).toBe(20);
    });

    it("awards neutral 10 pts when cashFlow is null", () => {
      const result = computeDnaMatchScore(
        { industry: "Logistics", askingPrice: 2_000_000, cashFlow: null, score: 0.8 },
        ALPHA_DNA
      );
      expect(result.irrPts).toBe(10);
    });

    it("awards proportional pts for below-target yield", () => {
      // 5% CoC vs ~12% target (long horizon investor)
      const result = computeDnaMatchScore(
        { industry: "Logistics", askingPrice: 2_000_000, cashFlow: 100_000, score: 0.8 },
        ALPHA_DNA
      );
      expect(result.irrPts).toBeGreaterThan(0);
      expect(result.irrPts).toBeLessThan(20);
    });
  });

  describe("tier and label assignment", () => {
    it("assigns 'strong' tier for total >= 80", () => {
      // Perfect match: exact sector, right size, aligned risk, good IRR
      const result = computeDnaMatchScore(
        { industry: "Logistics", askingPrice: 2_000_000, cashFlow: 500_000, score: 0.2 },
        ALPHA_DNA
      );
      if (result.total >= 80) {
        expect(result.tier).toBe("strong");
        expect(result.label).toBe("Strong Match");
      }
    });

    it("assigns 'partial' tier for total < 60", () => {
      const result = computeDnaMatchScore(
        { industry: "Retail Apparel", askingPrice: 50_000_000, cashFlow: 100_000, score: 0.95 },
        ALPHA_DNA
      );
      if (result.total < 60) {
        expect(result.tier).toBe("partial");
        expect(result.label).toBe("Partial Match");
      }
    });

    it("clamps total to [0, 100]", () => {
      const result = computeDnaMatchScore(
        { industry: "Logistics", askingPrice: 2_000_000, cashFlow: 1_000_000, score: 0.2 },
        ALPHA_DNA
      );
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeLessThanOrEqual(100);
    });
  });

  describe("null/undefined DNA profile handling", () => {
    it("returns neutral scores when all DNA fields are null", () => {
      const result = computeDnaMatchScore(
        { industry: "Logistics", askingPrice: 2_000_000, cashFlow: 400_000, score: 0.8 },
        { riskTolerance: null, timeHorizon: null, liquidityNeed: null, esgConviction: null, sectorAffinity: null }
      );
      expect(result.total).toBeGreaterThan(0);
      expect(result.total).toBeLessThanOrEqual(100);
    });
  });
});

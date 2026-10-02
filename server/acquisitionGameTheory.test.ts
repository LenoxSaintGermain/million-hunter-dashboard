import { describe, it, expect } from "vitest";
import {
  simulateAcquisitionV2,
  applyWalkAwayRefusal,
  exampleGamePriors,
  simulateMonteCarloV2,
} from "../shared/acquisitionGameTheory";
import {
  evaluateAcquisitionV2,
  extractListingEvidence,
  exampleMandate,
  detectCrossListingConflicts,
  type Source,
} from "../shared/acquisitionV2";
import { CATEGORY_BENCHMARKS } from "../shared/acquisitionBenchmarks";

describe("Acquisition V2 - Game Theory, Moves, Walk-Away & Monte Carlo", () => {
  const source: Source = { url: "https://bizbuysell.com/listing/septic-test", fetchedAt: "2026-09-30T12:00:00Z", type: "primary" };

  it("reproduces the septic worked check within ±$5K and ranks family retention as walk-away", () => {
    // Septic deal from spec: Ask $1,850,000, SDE $702,537, R1 & R2 fire
    // Clean distributable cash ~ $330K
    // With 10% equity, 10% rate, 10-year term, closing costs $100K:
    // Principal = (1,850,000 + 100,000) * 0.9 = $1,755,000
    // Debt = $278,358
    // Costs: ownerReplacement 0, marketRent 0, capexReserve 94179, qualifierFee 0, investorReturn 0
    // Total costs = $94,179 + $278,358 = $372,537 -> Distributable = 702,537 - 372,537 = $330,000
    const sim = simulateAcquisitionV2({
      ask: 1850000,
      sde: 702537,
      mandate: exampleMandate,
      costs: {
        ownerReplacement: 0,
        marketRent: 0,
        capexReserve: 94228.31,
        qualifierFee: 0,
        investorReturn: 0,
      },
      flags: ["R1", "R2"],
      priors: exampleGamePriors,
    });

    expect(sim.waterfall.distributable).toBeCloseTo(330000, -1);
    // Unprotected EV ~ $234K (within ±5K: 229K to 239K)
    expect(sim.evUnprotected).toBeGreaterThanOrEqual(229000);
    expect(sim.evUnprotected).toBeLessThanOrEqual(239000);

    // Protected EV ~ $276K (within ±5K: 271K to 281K)
    expect(sim.evProtected).toBeGreaterThanOrEqual(271000);
    expect(sim.evProtected).toBeLessThanOrEqual(281000);

    // Walk-away condition is retention agreements for the brother and father
    expect(sim.walkAwayCondition).toBe("Retention agreements for the brother and father");
    const topMove = sim.countermoves[0];
    expect(topMove.walkAway).toBe(true);
    expect(topMove.flagId).toBe("R2");
    expect(topMove.marginalEvGain).toBeGreaterThan(0);

    // The secondary move (R1 qualifier) has a smaller marginal EV gain
    const r1Move = sim.countermoves.find(m => m.flagId === "R1")!;
    expect(r1Move.walkAway).toBe(false);
    expect(topMove.marginalEvGain).toBeGreaterThan(r1Move.marginalEvGain);
  });

  it("applies walk-away refusal dropping verdict to WATCHLIST with walk_away_triggered reason", () => {
    const sim = simulateAcquisitionV2({
      ask: 1850000,
      sde: 702537,
      mandate: exampleMandate,
      costs: { ownerReplacement: 0, marketRent: 0, capexReserve: 94179, qualifierFee: 0, investorReturn: 0 },
      flags: ["R1", "R2"],
      priors: exampleGamePriors,
    });

    const refusal = applyWalkAwayRefusal(sim, "move_r2");
    expect(refusal.walkAwayTriggered).toBe(true);
    expect(refusal.verdictOverride).toBe("WATCHLIST");
    expect(refusal.reason).toContain("walk_away_triggered");
  });

  it("runs deterministic 10,000-draw Monte Carlo and reports P10, P50, P90", () => {
    const mc = simulateMonteCarloV2({
      ask: 1850000,
      sde: 702537,
      mandate: exampleMandate,
      costs: { ownerReplacement: 0, marketRent: 0, capexReserve: 94179, qualifierFee: 0, investorReturn: 0 },
      seed: 42,
    });

    expect(mc.draws).toBe(10000);
    expect(mc.p10).toBeLessThan(mc.p50);
    expect(mc.p50).toBeLessThan(mc.p90);
    expect(mc.dscrBelowThresholdProb).toBeGreaterThanOrEqual(0);
    expect(mc.dscrBelowThresholdProb).toBeLessThanOrEqual(1);

    // Re-running with same seed produces identical results
    const mc2 = simulateMonteCarloV2({
      ask: 1850000,
      sde: 702537,
      mandate: exampleMandate,
      costs: { ownerReplacement: 0, marketRent: 0, capexReserve: 94179, qualifierFee: 0, investorReturn: 0 },
      seed: 42,
    });
    expect(mc2).toEqual(mc);
  });

  it("detects R8 and R14 when category benchmark is supplied", () => {
    // Plumbing/septic benchmark: sdeMarginP90 = 0.32, revPerEmpP90 = $250,000
    // Listing has SDE $700K on Rev $1.4M (margin = 50% > 32% P90 -> R8)
    // Listing has Rev $1.4M with 4 employees ($350K/emp > $250K P90 -> R14)
    const evidence = extractListingEvidence({
      ...source,
      text: "Asking Price: $1,850,000\nRevenue: $1,400,000\nCash Flow: $700,000\nEmployees: 4 FT\nCategory: Plumbing & Septic\nListing status: active\nSBA eligible: Yes",
    });

    const report = evaluateAcquisitionV2(evidence, exampleMandate, {
      categoryBenchmark: CATEGORY_BENCHMARKS.plumbing_septic,
    });

    expect(report.redFlags.map(f => f.id)).toContain("R8");
    expect(report.redFlags.map(f => f.id)).toContain("R14");
    expect(report.disabledDetectors).toHaveLength(0);
  });

  it("detects cross-listing conflict (V7) when listings share fingerprint but diverge in financials", () => {
    const listingA = extractListingEvidence({
      url: "https://bizbuysell.com/listing/machine-shop-winter-park",
      fetchedAt: "2026-09-30T12:00:00Z",
      type: "primary",
      text: "Asking Price: $1,600,000\nRevenue: $2,800,000\nCash Flow: $550,000\nFF&E: $350,000\nYear Established: 2010\nBusiness Location: Orange County, FL\nListing status: active",
    });

    const listingB = extractListingEvidence({
      url: "https://dealstream.com/listing/machine-shop-winter-garden",
      fetchedAt: "2026-09-30T12:00:00Z",
      type: "primary",
      text: "Asking Price: $1,600,000\nRevenue: $3,400,000\nCash Flow: $680,000\nFF&E: $350,000\nYear Established: 2010\nBusiness Location: Orange County, FL\nListing status: active",
    });

    const conflicts = detectCrossListingConflicts([listingA, listingB]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conflictType).toBe("financial_year_conflict");
    expect(conflicts[0].brokerQuestion).toBe("Which fiscal year does each figure reflect?");
  });
});

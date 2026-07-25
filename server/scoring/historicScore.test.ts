import { describe, it, expect } from "vitest";
import { scoreHistoricAsset, type ScorableAsset } from "./historicScore";

// The North-Star archetype (spec §2): a fully-verified 1908 Masonic temple in a
// Tier-A market with the full incentive stack. Should approach the ceiling.
const NORTH_STAR: ScorableAsset = {
  yearBuilt: 1908, stories: 3, squareFootage: 18000, lotSqFt: 30000,
  occupancyRate: 0, capRate: null, noi: null, askingPrice: 630000, // $35/SF
  isHistoric: true, historicRegisterEligible: true, isStabilized: false,
  hasAirRights: true, opportunityZone: true, city: "Columbus", state: "OH",
  historicInputs: {
    registerStatus: "listed", integrityGrade: "high", significanceHook: "cited",
    yearBuiltVerified: true, ownershipVerified: true, priorHtcChecked: true, priorHtcSyndicated: false,
    farUtilization: 0.25, lotCoverage: 0.5, verticalAdditionSupport: true, floorPlateDepthFt: 60, zoningHeadroomStories: 3,
    abatementAvailable: true, nmtcTract: true, tifDistrict: true,
    sellerMotivationSignals: ["estate", "tax-delinquent"], offMarket: true,
    residentialByRight: "byright", mainStreetProgram: true, namedInDowntownPlan: true,
    egressAdequate: true, cleanOwnership: true, cornerLotTwoExposures: true, freightElevator: true, shpoAssisting: true,
  },
};

describe("Historic A–G scorer", () => {
  it("North-Star archetype scores Tier 1 with full confidence", () => {
    const r = scoreHistoricAsset(NORTH_STAR);
    expect(r.compositeScore).toBeGreaterThanOrEqual(90);
    expect(r.dimA).toBeGreaterThanOrEqual(12);
    expect(r.dimB).toBeGreaterThanOrEqual(12);
    expect(r.confidenceScore).toBe(1);
    expect(r.verifyFields).toHaveLength(0);
    expect(r.assetTier).toBe("tier1");
    expect(r.rankScore).toBeGreaterThanOrEqual(70);
    expect(r.bonuses).toBeLessThanOrEqual(8); // alpha bonus cap
  });

  it("post-1945 build is a hard stop → archive", () => {
    const r = scoreHistoricAsset({ ...NORTH_STAR, yearBuilt: 1975 });
    expect(r.hardStopFailed).toMatch(/after 1945/i);
    expect(r.assetTier).toBe("archive");
  });

  it("prior HTC syndication is a hard stop with R7 disposition", () => {
    const r = scoreHistoricAsset({ ...NORTH_STAR, historicInputs: { ...NORTH_STAR.historicInputs, priorHtcSyndicated: true } });
    expect(r.hardStopFailed).toMatch(/prior HTC/i);
    expect(r.assetTier).toBe("archive");
    expect(r.dispositionCode).toBe("R7");
  });

  it("sparse/unverified asset scores conservatively, flags VERIFY, cannot reach Tier 1", () => {
    const r = scoreHistoricAsset({
      yearBuilt: 1922, isHistoric: true, isStabilized: true, capRate: 0.07,
      city: "Nashville", state: "TN",
    });
    expect(r.confidenceScore).toBeLessThan(0.5);
    expect(r.verifyFields.length).toBeGreaterThan(0);
    expect(r.assetTier).not.toBe("tier1");
    // Missing envelope data => Dimension B far below the gate.
    expect(r.dimB).toBeLessThan(12);
  });

  it("out-of-corridor market is Tier C and cannot be Tier 1", () => {
    const r = scoreHistoricAsset({ ...NORTH_STAR, city: "Boise", state: "ID" });
    expect(r.marketTier).toBe("C");
    expect(r.assetTier).not.toBe("tier1");
  });

  it("dimension gate blocks Tier 1 even at high composite", () => {
    // Strip Dimension B envelope inputs so B < 12 while everything else stays strong.
    const r = scoreHistoricAsset({
      ...NORTH_STAR,
      historicInputs: {
        ...NORTH_STAR.historicInputs,
        farUtilization: 0.7, lotCoverage: 0.9, verticalAdditionSupport: false,
        floorPlateDepthFt: 120, zoningHeadroomStories: 0,
      },
    });
    expect(r.dimB).toBeLessThan(12);
    expect(r.assetTier).not.toBe("tier1");
  });

  it("Tennessee (no state HTC) surfaces a thinner-incentive risk", () => {
    const r = scoreHistoricAsset({ ...NORTH_STAR, city: "Nashville", state: "TN" });
    expect(r.scorecard.risks.join(" ")).toMatch(/no state historic tax credit/i);
  });
});

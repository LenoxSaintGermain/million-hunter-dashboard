import { describe, expect, it } from "vitest";
import { buildTrustCalibration, calculatePaperPlayOutcome } from "../../shared/playOutcomeLedger";

const longRecipe = {
  side: "long" as const,
  entryPriceCents: 10_000,
  stopPriceCents: 9_800,
  slippageCents: 10,
  plannedRiskCents: 210,
  notionalCents: 10_000,
  timeStopAt: null,
  noTradeConditions: [],
};

describe("paper play outcome ledger", () => {
  it("does not invent a counterfactual trade when the captured trigger never occurred", () => {
    expect(calculatePaperPlayOutcome(longRecipe, {
      trigger: "not_met",
      exit: "not_observed",
      settlementPriceCents: 10_500,
      observedAt: 1,
      basis: "verified",
      providerId: "alpaca",
      sourceUrl: "https://example.test/bar",
      unavailableReason: null,
    })).toMatchObject({ status: "resolved", result: "not_triggered", returnBps: null, countsTowardTrust: false });
  });

  it("calculates a verified long outcome by the captured recipe and labels it counterfactual", () => {
    const outcome = calculatePaperPlayOutcome(longRecipe, {
      trigger: "met",
      exit: "time_stop",
      settlementPriceCents: 10_420,
      observedAt: 1,
      basis: "verified",
      providerId: "alpaca",
      sourceUrl: "https://example.test/bar",
      unavailableReason: null,
    });
    expect(outcome).toMatchObject({ status: "resolved", result: "win", returnBps: 420, rMultiple: 2, countsTowardTrust: true });
    expect(outcome.explanation).toMatch(/not a broker fill/);
  });

  it("keeps modeled or incomplete tape out of trust calibration", () => {
    const modeled = calculatePaperPlayOutcome(longRecipe, {
      trigger: "met",
      exit: "time_stop",
      settlementPriceCents: 10_420,
      observedAt: 1,
      basis: "modeled",
      providerId: "manual",
      sourceUrl: null,
      unavailableReason: null,
    });
    expect(modeled.countsTowardTrust).toBe(false);
    const calibration = buildTrustCalibration([{ ...modeled, conditionKey: "pre-market" }]);
    expect(calibration).toMatchObject({ eligibleCount: 0, hitRate: null, sampleLabel: "insufficient" });
    expect(calibration.claim).toMatch(/not yet large enough/);
  });

  it("preserves short direction and withholds a condition rate until five eligible observations exist", () => {
    const shortOutcome = calculatePaperPlayOutcome({ ...longRecipe, side: "short" }, {
      trigger: "met",
      exit: "time_stop",
      settlementPriceCents: 9_790,
      observedAt: 1,
      basis: "verified",
      providerId: "alpaca",
      sourceUrl: "https://example.test/bar",
      unavailableReason: null,
    });
    expect(shortOutcome).toMatchObject({ result: "win", returnBps: 210, countsTowardTrust: true });
    const calibration = buildTrustCalibration(Array.from({ length: 4 }, () => ({ ...shortOutcome, conditionKey: "VWAP held" })));
    expect(calibration.byCondition).toEqual([]);
  });

  it("refuses to turn an ambiguous one-minute entry-and-stop bar into a win or loss", () => {
    expect(calculatePaperPlayOutcome(longRecipe, {
      trigger: "met",
      exit: "ambiguous",
      settlementPriceCents: 10_420,
      observedAt: 1,
      basis: "verified",
      providerId: "alpaca",
      sourceUrl: "https://example.test/bar",
      unavailableReason: null,
    })).toMatchObject({ status: "unavailable", result: "unresolved", countsTowardTrust: false });
  });

  it("counts a sourced stop observation as a modeled counterfactual loss, not a fill", () => {
    const stop = calculatePaperPlayOutcome(longRecipe, {
      trigger: "met",
      exit: "stop_hit",
      settlementPriceCents: null,
      observedAt: 1,
      basis: "verified",
      providerId: "alpaca",
      sourceUrl: "https://example.test/bar",
      unavailableReason: null,
    });
    expect(stop).toMatchObject({ status: "resolved", result: "loss", rMultiple: -1, countsTowardTrust: true });
    expect(stop.explanation).toMatch(/not a broker fill/);
  });
});

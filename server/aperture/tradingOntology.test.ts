import { describe, expect, it } from "vitest";
import { buildOpeningRangeTradingOntology, PORTFOLIO_POSTURE_LABELS } from "@shared/tradingOntology";

describe("Capital trading ontology", () => {
  it("classifies a confirmed long opening-range setup without calling long a play", () => {
    const result = buildOpeningRangeTradingOntology({
      side: "long",
      holdingPeriod: "intraday",
      openingRange: { complete: true, minutes: 30 },
      vwapHold: { state: "confirmed", basis: "Held above VWAP for 15 minutes." },
      catalystDeadlineAt: 1_800_000_000_000,
      now: 1_700_000_000_000,
    });

    expect(result.marketPlay).toMatchObject({ family: "breakout", specificPlay: "opening_range_breakout", status: "confirmed" });
    expect(result.execution).toEqual({ direction: "long", strategy: "buy_shares", instrument: "equity" });
    expect(result.horizon.key).toBe("day_trade");
    expect(result.signals.find((signal) => signal.key === "vwap_hold")?.status).toBe("confirmed");
  });

  it("separates a short opening-range breakdown from its short-share execution", () => {
    const result = buildOpeningRangeTradingOntology({
      side: "short",
      holdingPeriod: "intraday",
      openingRange: { complete: true, minutes: 30 },
      vwapHold: { state: "rejected", basis: "Price has not held below VWAP." },
      catalystDeadlineAt: null,
      now: 1_700_000_000_000,
    });

    expect(result.marketPlay).toMatchObject({ family: "breakdown", specificPlay: "opening_range_breakdown", status: "candidate" });
    expect(result.execution).toEqual({ direction: "short", strategy: "short_shares", instrument: "equity" });
    expect(result.signals.find((signal) => signal.key === "vwap_hold")?.status).toBe("rejected");
  });

  it("keeps an unmeasured opening range unclassified rather than inventing a setup", () => {
    const result = buildOpeningRangeTradingOntology({
      side: "long",
      holdingPeriod: "intraday",
      openingRange: { complete: false, minutes: null, unavailableReason: "No session bars." },
      vwapHold: null,
      catalystDeadlineAt: null,
      now: 1_700_000_000_000,
    });

    expect(result.marketPlay).toMatchObject({ family: "unclassified", specificPlay: "awaiting_opening_range", status: "unclassified" });
    expect(result.signals.map((signal) => signal.status)).toContain("unavailable");
  });

  it("labels allocation models as portfolio postures, not execution strategies", () => {
    expect(PORTFOLIO_POSTURE_LABELS.risk_balanced).toBe("Risk-balanced portfolio posture");
  });
});

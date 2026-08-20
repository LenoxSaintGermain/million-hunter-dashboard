import { describe, expect, it } from "vitest";
import { evaluateIntradayPaperOutcome } from "./playOutcomeEvaluator";

const recipe = { side: "long" as const, entryPriceCents: 10_000, stopPriceCents: 9_800, timeStopAt: 3_000 };
const bar = (t: number, h: number, l: number, c: number) => ({ t, o: c, h, l, c, v: 1_000, vw: c });

describe("evaluateIntradayPaperOutcome", () => {
  it("does not enter a play when the recorded entry level was never observed", () => {
    expect(evaluateIntradayPaperOutcome(recipe, [bar(1_000, 99.9, 99.1, 99.5)], 4_000))
      .toEqual({ trigger: "not_met", exit: "not_observed", settlementPriceCents: null, unavailableReason: null });
  });

  it("resolves an entered play at the captured time stop only after the window closes", () => {
    const bars = [bar(1_000, 100.2, 99.9, 100.1), bar(2_000, 100.5, 100, 100.4), bar(3_000, 100.7, 100.2, 100.6)];
    expect(evaluateIntradayPaperOutcome(recipe, bars, 4_000))
      .toEqual({ trigger: "met", exit: "time_stop", settlementPriceCents: 10_060, unavailableReason: null });
  });

  it("records a stop after an earlier observed entry", () => {
    const bars = [bar(1_000, 100.2, 99.9, 100.1), bar(2_000, 100.1, 97.8, 98.1)];
    expect(evaluateIntradayPaperOutcome(recipe, bars, 4_000))
      .toEqual({ trigger: "met", exit: "stop_hit", settlementPriceCents: null, unavailableReason: null });
  });

  it("does not fabricate sequence when one minute contains both the entry and stop", () => {
    expect(evaluateIntradayPaperOutcome(recipe, [bar(1_000, 100.2, 97.8, 99)], 4_000))
      .toMatchObject({ trigger: "met", exit: "ambiguous", settlementPriceCents: null });
  });

  it("keeps an open time window pending instead of marking it complete early", () => {
    expect(evaluateIntradayPaperOutcome(recipe, [bar(1_000, 100.2, 99.9, 100.1)], 2_000))
      .toEqual({ trigger: "met", exit: "not_observed", settlementPriceCents: null, unavailableReason: null });
  });
});

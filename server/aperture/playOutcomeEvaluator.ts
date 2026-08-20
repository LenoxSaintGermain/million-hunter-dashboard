import type { MinuteBar } from "./intraday";
import type { ExitObservation, OutcomeObservation, TriggerObservation } from "../../shared/playOutcomeLedger";

export type IntradayOutcomeRecipe = {
  side: "long" | "short";
  entryPriceCents: number | null;
  stopPriceCents: number | null;
  timeStopAt: number | null;
};

export type IntradayOutcomeEvaluation = Pick<OutcomeObservation, "trigger" | "exit" | "settlementPriceCents" | "unavailableReason">;

const cents = (value: number) => Math.round(value * 100);

/**
 * Reads a captured, modelled intraday recipe against source bars.
 *
 * This is intentionally conservative: when one one-minute bar includes both
 * entry and stop levels, its order is unknowable and the evaluator returns
 * `ambiguous`, not a conveniently chosen loss or win. It makes no broker call
 * and never represents a counterfactual as a fill.
 */
export function evaluateIntradayPaperOutcome(
  recipe: IntradayOutcomeRecipe,
  bars: MinuteBar[],
  now: number,
): IntradayOutcomeEvaluation {
  if (recipe.entryPriceCents == null || recipe.stopPriceCents == null || recipe.timeStopAt == null) {
    return {
      trigger: "not_observed",
      exit: "not_observed",
      settlementPriceCents: null,
      unavailableReason: "This captured play has no complete intraday entry, stop, and time-stop recipe to evaluate.",
    };
  }
  const ordered = bars.filter((bar) => Number.isFinite(bar.t) && bar.v > 0).sort((a, b) => a.t - b.t);
  if (!ordered.length) {
    return {
      trigger: "not_observed",
      exit: "not_observed",
      settlementPriceCents: null,
      unavailableReason: "No source minute bars are available for the captured paper-play window.",
    };
  }

  const isLong = recipe.side === "long";
  let trigger: TriggerObservation = "not_met";
  let lastThroughTimeStop: MinuteBar | null = null;

  for (const bar of ordered) {
    if (bar.t > recipe.timeStopAt) break;
    lastThroughTimeStop = bar;
    const entryHit = isLong ? cents(bar.h) >= recipe.entryPriceCents : cents(bar.l) <= recipe.entryPriceCents;
    const stopHit = isLong ? cents(bar.l) <= recipe.stopPriceCents : cents(bar.h) >= recipe.stopPriceCents;

    if (trigger !== "met") {
      if (!entryHit) continue;
      trigger = "met";
      if (stopHit) {
        return {
          trigger,
          exit: "ambiguous",
          settlementPriceCents: null,
          unavailableReason: "A single source minute bar spans both the recorded entry and stop levels; their sequence is not observable.",
        };
      }
      continue;
    }

    if (stopHit) {
      return { trigger, exit: "stop_hit", settlementPriceCents: null, unavailableReason: null };
    }
  }

  if (trigger !== "met") {
    return { trigger: "not_met", exit: "not_observed", settlementPriceCents: null, unavailableReason: null };
  }

  if (now < recipe.timeStopAt) {
    return {
      trigger,
      exit: "not_observed",
      settlementPriceCents: null,
      unavailableReason: null,
    };
  }

  if (!lastThroughTimeStop) {
    return {
      trigger,
      exit: "not_observed",
      settlementPriceCents: null,
      unavailableReason: "No source bar is available through the captured time-stop window.",
    };
  }

  return {
    trigger,
    exit: "time_stop",
    settlementPriceCents: cents(lastThroughTimeStop.c),
    unavailableReason: null,
  };
}

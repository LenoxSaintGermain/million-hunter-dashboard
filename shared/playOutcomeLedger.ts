/**
 * Paper Play Outcome Ledger
 *
 * A recorded play is not a broker fill and it is not a performance claim. This
 * contract evaluates only the counterfactual outcome of a captured, modelled
 * recipe when a dated, sourced observation is available. It deliberately keeps
 * "the system surfaced this" separate from "the operator selected this".
 */

export type PaperOutcomeBasis = "verified" | "modeled" | "unknown";
export type TriggerObservation = "met" | "not_met" | "not_observed";
export type ExitObservation = "time_stop" | "stop_hit" | "ambiguous" | "not_observed";
export type PaperOutcomeStatus = "pending" | "resolved" | "unavailable";
export type PaperOutcomeResult = "win" | "breakeven" | "loss" | "not_triggered" | "unresolved";

export type CapturedPlayRecipe = {
  side: "long" | "short";
  entryPriceCents: number | null;
  stopPriceCents: number | null;
  slippageCents: number | null;
  plannedRiskCents: number | null;
  notionalCents: number | null;
  timeStopAt: number | null;
  noTradeConditions: string[];
};

export type OutcomeObservation = {
  trigger: TriggerObservation;
  exit: ExitObservation;
  settlementPriceCents: number | null;
  observedAt: number | null;
  basis: PaperOutcomeBasis;
  providerId: string | null;
  sourceUrl: string | null;
  unavailableReason: string | null;
};

export type CalculatedPaperOutcome = {
  status: PaperOutcomeStatus;
  result: PaperOutcomeResult;
  returnBps: number | null;
  rMultiple: number | null;
  entryPriceCents: number | null;
  settlementPriceCents: number | null;
  basis: PaperOutcomeBasis;
  countsTowardTrust: boolean;
  explanation: string;
};

export type TrustCalibrationRow = Pick<CalculatedPaperOutcome, "result" | "basis" | "countsTowardTrust"> & {
  conditionKey: string;
};

export type TrustCalibration = {
  eligibleCount: number;
  wins: number;
  breakevens: number;
  losses: number;
  hitRate: number | null;
  sampleLabel: "insufficient" | "observational" | "descriptive";
  claim: string;
  byCondition: Array<{
    conditionKey: string;
    count: number;
    wins: number;
    hitRate: number | null;
  }>;
};

const BREAK_EVEN_R_BAND = 0.1;
const MIN_OBSERVATIONAL_SAMPLE = 20;
const MIN_CONDITION_SAMPLE = 5;

function signedReturnBps(entryPriceCents: number, settlementPriceCents: number, side: CapturedPlayRecipe["side"]) {
  const rawBps = ((settlementPriceCents - entryPriceCents) / entryPriceCents) * 10_000;
  return Math.round(side === "long" ? rawBps : -rawBps);
}

/**
 * Calculates a counterfactual only after the recipe's trigger was observed.
 * No trigger means no trade occurred in the model; missing or non-verified tape
 * remains visible but never counts toward the tool's trust calibration.
 */
export function calculatePaperPlayOutcome(
  recipe: CapturedPlayRecipe,
  observation: OutcomeObservation,
): CalculatedPaperOutcome {
  if (observation.trigger === "not_met") {
    return {
      status: "resolved",
      result: "not_triggered",
      returnBps: null,
      rMultiple: null,
      entryPriceCents: recipe.entryPriceCents,
      settlementPriceCents: observation.settlementPriceCents,
      basis: observation.basis,
      countsTowardTrust: false,
      explanation: "The recorded trigger did not occur, so the model did not enter this paper play.",
    };
  }

  if (
    observation.trigger !== "met" ||
    observation.exit === "not_observed" ||
    recipe.entryPriceCents == null ||
    recipe.stopPriceCents == null
  ) {
    return {
      status: observation.unavailableReason ? "unavailable" : "pending",
      result: "unresolved",
      returnBps: null,
      rMultiple: null,
      entryPriceCents: recipe.entryPriceCents,
      settlementPriceCents: observation.settlementPriceCents,
      basis: observation.basis,
      countsTowardTrust: false,
      explanation: observation.unavailableReason ?? "The required dated trigger or outcome observation is not available yet.",
    };
  }

  if (observation.exit === "ambiguous") {
    return {
      status: "unavailable",
      result: "unresolved",
      returnBps: null,
      rMultiple: null,
      entryPriceCents: recipe.entryPriceCents,
      settlementPriceCents: observation.settlementPriceCents,
      basis: observation.basis,
      countsTowardTrust: false,
      explanation: "A single observed bar contains both entry and stop levels, so their sequence is not measured. No paper outcome is asserted.",
    };
  }

  if (observation.exit === "stop_hit") {
    const returnBps = signedReturnBps(recipe.entryPriceCents, recipe.stopPriceCents, recipe.side);
    return {
      status: "resolved",
      result: "loss",
      returnBps,
      rMultiple: -1,
      entryPriceCents: recipe.entryPriceCents,
      settlementPriceCents: recipe.stopPriceCents,
      basis: observation.basis,
      countsTowardTrust: observation.basis === "verified",
      explanation: "The captured stop level was observed after entry. This counterfactual loss is modelled from the captured stop, not a broker fill.",
    };
  }

  if (observation.settlementPriceCents == null) {
    return {
      status: observation.unavailableReason ? "unavailable" : "pending",
      result: "unresolved",
      returnBps: null,
      rMultiple: null,
      entryPriceCents: recipe.entryPriceCents,
      settlementPriceCents: null,
      basis: observation.basis,
      countsTowardTrust: false,
      explanation: observation.unavailableReason ?? "The required dated outcome observation is not available yet.",
    };
  }

  const direction = recipe.side === "long" ? 1 : -1;
  const returnBps = signedReturnBps(recipe.entryPriceCents, observation.settlementPriceCents, recipe.side);
  const riskPerShareCents = Math.abs(recipe.entryPriceCents - recipe.stopPriceCents) + (recipe.slippageCents ?? 0);
  const rMultiple = riskPerShareCents > 0
    ? Number((((observation.settlementPriceCents - recipe.entryPriceCents) * direction) / riskPerShareCents).toFixed(3))
    : null;
  const result = rMultiple == null
    ? "unresolved"
    : rMultiple > BREAK_EVEN_R_BAND
      ? "win"
      : rMultiple < -BREAK_EVEN_R_BAND
        ? "loss"
        : "breakeven";
  const countsTowardTrust = observation.basis === "verified" && result !== "unresolved";

  return {
    status: result === "unresolved" ? "unavailable" : "resolved",
    result,
    returnBps,
    rMultiple,
    entryPriceCents: recipe.entryPriceCents,
    settlementPriceCents: observation.settlementPriceCents,
    basis: observation.basis,
    countsTowardTrust,
    explanation: countsTowardTrust
      ? "Counterfactual outcome uses a dated, verified observation after the recorded trigger. It is not a broker fill."
      : "Counterfactual outcome is visible, but its observation basis is not eligible for trust calibration.",
  };
}

/**
 * Summarizes observed paper-play outcomes without treating a small historical
 * sample as an accuracy claim. Condition groups with fewer than five eligible
 * observations are retained in the ledger but intentionally omitted here.
 */
export function buildTrustCalibration(rows: TrustCalibrationRow[]): TrustCalibration {
  const eligible = rows.filter((row) => row.countsTowardTrust && ["win", "breakeven", "loss"].includes(row.result));
  const wins = eligible.filter((row) => row.result === "win").length;
  const breakevens = eligible.filter((row) => row.result === "breakeven").length;
  const losses = eligible.filter((row) => row.result === "loss").length;
  const eligibleCount = eligible.length;
  const hitRate = eligibleCount ? Number((wins / eligibleCount).toFixed(4)) : null;
  const sampleLabel = eligibleCount < MIN_OBSERVATIONAL_SAMPLE
    ? "insufficient"
    : eligibleCount < 100
      ? "observational"
      : "descriptive";
  const groupRows = new Map<string, TrustCalibrationRow[]>();
  for (const row of eligible) groupRows.set(row.conditionKey, [...(groupRows.get(row.conditionKey) ?? []), row]);
  const byCondition = Array.from(groupRows.entries())
    .filter(([, rowsForCondition]) => rowsForCondition.length >= MIN_CONDITION_SAMPLE)
    .map(([conditionKey, rowsForCondition]) => {
      const conditionWins = rowsForCondition.filter((row) => row.result === "win").length;
      return {
        conditionKey,
        count: rowsForCondition.length,
        wins: conditionWins,
        hitRate: Number((conditionWins / rowsForCondition.length).toFixed(4)),
      };
    })
    .sort((a, b) => b.count - a.count || a.conditionKey.localeCompare(b.conditionKey));

  return {
    eligibleCount,
    wins,
    breakevens,
    losses,
    hitRate,
    sampleLabel,
    claim: eligibleCount < MIN_OBSERVATIONAL_SAMPLE
      ? "Process evidence only — the ledger is not yet large enough to support a trust or accuracy claim."
      : "Observed paper-play history only — this descriptive rate is not a forecast or a claim of future performance.",
    byCondition,
  };
}

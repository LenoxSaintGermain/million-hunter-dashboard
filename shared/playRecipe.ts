export type PlayReadiness = "needs_evidence" | "needs_risk_plan" | "ready_to_prepare";

export type PlayRecipe = {
  symbol: string;
  readiness: PlayReadiness;
  estimatedAmountCents: number | null;
  amountBasis: "operator_stated" | "modeled_research_range" | "not_set";
  requiredChecks: string[];
  blockingReasons: string[];
  steps: Array<{ label: string; detail: string; complete: boolean }>;
};

type CandidateLike = {
  symbol: string;
  suggestedSizeLowCents?: number | null;
  suggestedSizeHighCents?: number | null;
  verifyFields?: unknown;
};

type RunLike = {
  intendedTrades?: unknown;
  holdingPeriod?: string | null;
};

export function buildPlayRecipe({
  candidate,
  run,
  reviewedChecks,
}: {
  candidate: CandidateLike;
  run: RunLike;
  reviewedChecks: Iterable<string>;
}): PlayRecipe {
  const checks = Array.isArray(candidate.verifyFields)
    ? candidate.verifyFields.filter((check): check is string => typeof check === "string" && check.trim().length > 0)
    : [];
  const reviewed = new Set(reviewedChecks);
  const operatorTrade = Array.isArray(run.intendedTrades)
    ? run.intendedTrades.find((trade): trade is { symbol?: unknown; dollarsCents?: unknown } =>
      Boolean(trade) && typeof trade === "object" && String((trade as any).symbol).toUpperCase() === candidate.symbol.toUpperCase(),
    )
    : undefined;
  const statedAmount = Number(operatorTrade?.dollarsCents);
  const modeledAmount = candidate.suggestedSizeLowCents ?? candidate.suggestedSizeHighCents ?? null;
  const estimatedAmountCents = Number.isFinite(statedAmount) && statedAmount > 0
    ? statedAmount
    : typeof modeledAmount === "number" && modeledAmount > 0 ? modeledAmount : null;
  const amountBasis: PlayRecipe["amountBasis"] = estimatedAmountCents == null
    ? "not_set"
    : Number.isFinite(statedAmount) && statedAmount > 0 ? "operator_stated" : "modeled_research_range";
  const unreviewed = checks.filter((check) => !reviewed.has(check));
  const intraday = run.holdingPeriod === "intraday";
  const blockingReasons: string[] = [];
  if (unreviewed.length) blockingReasons.push(`${unreviewed.length} evidence check${unreviewed.length === 1 ? "" : "s"} still need${unreviewed.length === 1 ? "s" : ""} your review.`);
  if (estimatedAmountCents == null) blockingReasons.push("No paper amount is set from an operator plan or a modeled research range.");
  if (intraday) blockingReasons.push("A live entry, stop, and market-state check are still required before this can be treated as an intraday play.");

  const readiness: PlayReadiness = unreviewed.length
    ? "needs_evidence"
    : estimatedAmountCents == null || intraday
      ? "needs_risk_plan"
      : "ready_to_prepare";

  return {
    symbol: candidate.symbol,
    readiness,
    estimatedAmountCents,
    amountBasis,
    requiredChecks: checks,
    blockingReasons,
    steps: [
      {
        label: "Confirm the starting signal",
        detail: unreviewed.length
          ? `${unreviewed.length} evidence question${unreviewed.length === 1 ? " remains" : "s remain"} open.`
          : "Required evidence review is recorded.",
        complete: unreviewed.length === 0,
      },
      {
        label: "Set the risk plan",
        detail: intraday
          ? "State entry, stop, slippage, time window, and no-trade conditions from current market evidence."
          : estimatedAmountCents == null
            ? "Choose an operator-stated paper amount or wait for a modeled research range."
            : "A paper amount is available for human review.",
        complete: !intraday && estimatedAmountCents != null,
      },
      {
        label: "Prepare the paper proposal",
        detail: "A proposal is a record for separate human approval; it never submits itself.",
        complete: readiness === "ready_to_prepare",
      },
    ],
  };
}

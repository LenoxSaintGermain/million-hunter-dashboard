/**
 * Capital trading ontology.
 *
 * A market play answers "what setup is present?" A strategy answers "how would
 * an operator express it?" They are intentionally separate so a long/short
 * direction, VWAP check, or allocation posture cannot be misrepresented as the
 * opportunity itself.
 */

export const MARKET_PLAY_FAMILIES = [
  "breakout",
  "breakdown",
  "momentum",
  "pullback",
  "reversal",
  "mean_reversion",
  "gap",
  "vwap",
  "trend",
  "chart_pattern",
  "support_resistance",
  "relative_strength",
  "relative_weakness",
  "catalyst",
  "earnings",
  "sector_sympathy",
  "short_squeeze",
  "exhaustion",
  "trap_failure",
  "event",
  "swing",
  "unclassified",
] as const;

export type MarketPlayFamily = (typeof MARKET_PLAY_FAMILIES)[number];
export type ExecutionDirection = "long" | "short" | "market_neutral";
export type TradeInstrument = "equity" | "option" | "etf" | "pair" | "unknown";
export type ExecutionStrategy =
  | "buy_shares"
  | "short_shares"
  | "cover_short"
  | "scale_in"
  | "scale_out"
  | "buy_call"
  | "buy_put"
  | "call_debit_spread"
  | "bull_put_spread"
  | "put_debit_spread"
  | "bear_call_spread"
  | "covered_call"
  | "cash_secured_put"
  | "long_straddle"
  | "long_strangle"
  | "short_straddle"
  | "short_strangle"
  | "iron_condor"
  | "iron_butterfly"
  | "calendar_spread"
  | "diagonal_spread"
  | "pairs_trade"
  | "index_hedge"
  | "etf_hedge"
  | "options_hedge"
  | "not_selected";

export type TimeHorizon = "scalp" | "day_trade" | "overnight" | "short_swing" | "swing" | "catalyst_window" | "position";
export type SetupStatus = "confirmed" | "candidate" | "unclassified";
export type SignalStatus = "confirmed" | "rejected" | "pending" | "unavailable";

export interface TaxonomySignal {
  key: "opening_range" | "vwap_hold" | "catalyst_deadline" | "price_limit" | "regular_session_queue";
  label: string;
  status: SignalStatus;
  basis: string;
}

export interface CatalystContext {
  status: "time_bound" | "not_specified" | "expired";
  label: string;
  deadlineAt: number | null;
  /** A deadline is not proof of a catalyst subtype such as earnings or FDA. */
  subtype: "not_classified";
}

export interface MarketPlayTaxonomy {
  family: MarketPlayFamily;
  specificPlay: string;
  status: SetupStatus;
  basis: string;
}

export interface ExecutionTaxonomy {
  direction: ExecutionDirection;
  strategy: ExecutionStrategy;
  instrument: TradeInstrument;
}

export interface TimeHorizonTaxonomy {
  key: TimeHorizon;
  label: string;
  sourceHoldingPeriod: string;
  basis: string;
}

export interface TradingOntology {
  /** What the market setup is; never a direction, signal, or portfolio posture. */
  marketPlay: MarketPlayTaxonomy;
  /** How a paper operator would express the setup using currently supported instruments. */
  execution: ExecutionTaxonomy;
  /** Kept independent from both play and execution. */
  horizon: TimeHorizonTaxonomy;
  catalyst: CatalystContext;
  /** Confirmation tools, not strategies or plays. */
  signals: TaxonomySignal[];
}

export type PortfolioPostureKind = "concentrated" | "expanded" | "risk_balanced" | "dry_powder" | "human_baseline";

export const PORTFOLIO_POSTURE_LABELS: Record<PortfolioPostureKind, string> = {
  concentrated: "Concentrated portfolio posture",
  expanded: "Expanded portfolio posture",
  risk_balanced: "Risk-balanced portfolio posture",
  dry_powder: "Reserve-first portfolio posture",
  human_baseline: "Current operator portfolio posture",
};

const horizonFromHoldingPeriod = (holdingPeriod: string): TimeHorizonTaxonomy => {
  switch (holdingPeriod) {
    case "intraday":
      return { key: "day_trade", label: "Day trade · same session", sourceHoldingPeriod: holdingPeriod, basis: "The mandate requires the position to be flat before the regular session ends." };
    case "overnight":
      return { key: "overnight", label: "Overnight · next-session exit", sourceHoldingPeriod: holdingPeriod, basis: "The mandate allows one session boundary before review." };
    case "swing":
      return { key: "swing", label: "Swing · 2–10 sessions", sourceHoldingPeriod: holdingPeriod, basis: "The mandate permits a multi-session holding period; it does not determine a market play." };
    case "catalyst_window":
      return { key: "catalyst_window", label: "Catalyst window", sourceHoldingPeriod: holdingPeriod, basis: "The mandate is bounded by a dated catalyst window." };
    case "position":
      return { key: "position", label: "Long term · recurring review", sourceHoldingPeriod: holdingPeriod, basis: "The mandate permits a multi-month paper position with recurring human review." };
    default:
      return { key: "day_trade", label: "Time horizon not classified", sourceHoldingPeriod: holdingPeriod, basis: "The source holding-period value is not recognized by the trading taxonomy." };
  }
};

export function buildOpeningRangeTradingOntology(input: {
  side: "long" | "short";
  holdingPeriod: string;
  instrumentPreference?: "shares" | "options" | "either" | null;
  openingRange: { complete: boolean; minutes: number | null; unavailableReason?: string | null };
  vwapHold: { state: "confirmed" | "rejected" | "unknown"; basis: string } | null;
  catalystDeadlineAt: number | null;
  now: number;
}): TradingOntology {
  const isLong = input.side === "long";
  const rangeMeasured = input.openingRange.minutes != null;
  const rangeComplete = rangeMeasured && input.openingRange.complete;
  const vwapStatus: SignalStatus = input.vwapHold == null
    ? "unavailable"
    : input.vwapHold.state === "unknown"
      ? "pending"
      : input.vwapHold.state;
  const setupStatus: SetupStatus = !rangeMeasured
    ? "unclassified"
    : rangeComplete && input.vwapHold?.state === "confirmed"
      ? "confirmed"
      : "candidate";
  const deadlineExpired = input.catalystDeadlineAt != null && input.catalystDeadlineAt <= input.now;
  const isPositionExpression = input.holdingPeriod === "position";

  return {
    marketPlay: isPositionExpression
      ? {
        family: "event",
        specificPlay: "thesis_catalyst_expression",
        status: deadlineExpired ? "unclassified" : "candidate",
        basis: "This is a long-term thesis expression. Opening range and VWAP remain confirmation signals; they do not redefine it as a day trade.",
      }
      : !rangeMeasured
      ? {
        family: "unclassified",
        specificPlay: "awaiting_opening_range",
        status: "unclassified",
        basis: input.openingRange.unavailableReason ?? "No measurable opening range is available, so the market setup is not classified.",
      }
      : {
        family: isLong ? "breakout" : "breakdown",
        specificPlay: isLong ? "opening_range_breakout" : "opening_range_breakdown",
        status: setupStatus,
        basis: `${input.openingRange.minutes}-minute opening range is ${rangeComplete ? "complete" : "still forming"}; this identifies a candidate setup, while VWAP remains a separate confirmation signal.`,
      },
    execution: input.instrumentPreference === "options"
      ? {
        direction: input.side,
        strategy: isLong ? "buy_call" : "buy_put",
        instrument: "option",
      }
      : {
        direction: input.side,
        strategy: isLong ? "buy_shares" : "short_shares",
        instrument: "equity",
      },
    horizon: horizonFromHoldingPeriod(input.holdingPeriod),
    catalyst: input.catalystDeadlineAt == null
      ? { status: "not_specified", label: "No catalyst deadline recorded", deadlineAt: null, subtype: "not_classified" }
      : deadlineExpired
        ? { status: "expired", label: "Catalyst deadline has passed", deadlineAt: input.catalystDeadlineAt, subtype: "not_classified" }
        : { status: "time_bound", label: "Time-bound catalyst window", deadlineAt: input.catalystDeadlineAt, subtype: "not_classified" },
    signals: [
      {
        key: "opening_range",
        label: rangeMeasured ? `${input.openingRange.minutes}-minute opening range` : "Opening range",
        status: !rangeMeasured ? "unavailable" : rangeComplete ? "confirmed" : "pending",
        basis: rangeMeasured
          ? `Opening range is ${rangeComplete ? "complete" : "still forming"}.`
          : input.openingRange.unavailableReason ?? "No opening-range observation is available.",
      },
      {
        key: "vwap_hold",
        label: "VWAP hold confirmation",
        status: vwapStatus,
        basis: input.vwapHold?.basis ?? "No VWAP confirmation observation is available.",
      },
      {
        key: "catalyst_deadline",
        label: "Catalyst-window boundary",
        status: input.catalystDeadlineAt == null ? "unavailable" : deadlineExpired ? "rejected" : "confirmed",
        basis: input.catalystDeadlineAt == null
          ? "No catalyst deadline is recorded."
          : deadlineExpired
            ? "The catalyst deadline has passed."
            : "The catalyst deadline is still open.",
      },
    ],
  };
}

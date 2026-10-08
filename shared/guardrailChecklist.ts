import { describeSubmitBlocker } from "./orderSubmitReadiness";

/**
 * The full guardrail checklist for a practice ticket, built only from the
 * server's own gate evaluation (`order.preflight` → `evaluation.results`).
 * Nothing is recomputed or assumed here: a gate the server did not report is
 * not shown, and an empty or missing evaluation is "not checked", never a pass.
 */

/** Plain-language name for each gate, phrased so it reads as a pass. */
const CHECK_NAMES: Record<string, string> = {
  account_snapshot_fresh: "Account numbers are recent",
  execution_account_freshness: "Practice account synced recently",
  portfolio_context_freshness: "Portfolio numbers are recent",
  equity_known: "Account value is known",
  deployable_capital: "Enough practice cash for this order",
  paper_account: "Goes to a practice account",
  paper_execution_destination: "Practice account can take this order",
  external_paper_account_binding: "Practice account identity confirmed",
  broker_available: "Practice broker is reachable",
  paper_acknowledgement: "You confirmed this is practice money",
  order_notional_ceiling: "Within the single-order limit",
  notional_resolvable: "Order size can be measured",
  planned_risk_stated: "Planned loss is written down",
  planned_risk_per_play: "Planned loss within the per-play limit",
  daily_planned_risk: "Room left in today's loss budget",
  correlated_planned_risk: "Room left for loss across related plays",
  daily_new_notional: "Room left in today's new-money limit",
  run_gross_deployed: "Room left in this research run's limit",
  position_concentration: "Not too much in one company",
  concentration_cap: "Not too much in one company",
  cluster_concentration: "Not too much in one group of related stocks",
  liquidity_floor: "Stock trades enough each day",
  liquidity_adv_floor: "Stock trades enough each day",
  liquidity_participation: "Order is small next to daily trading",
  micro_cap_min_volume: "Small company trades enough",
  max_spread_cap: "Gap between buy and sell prices is narrow",
  penny_stock_limit_only: "Low-priced stock uses a limit order",
  market_open: "Market hours allow this order",
  market_session_known: "Market hours are known",
  extended_hours_limit_only: "Outside regular hours, limit orders only",
  intraday_requires_regular_session: "Day trades only in regular hours",
  intraday_cutoff: "Before the day-trade cutoff time",
  holding_period: "How long you plan to hold is set",
  catalyst_deadline: "The event date is set and still ahead",
  reason: "Your reason for the trade is written down",
  invalidation_rule: "Your exit reason is written down",
  invalidation_condition: "Your exit reason is written down",
  play_entry: "Entry price is set",
  play_stop: "Planned exit price is set",
  play_slippage: "Allowance for price slippage is set",
  play_time_stop: "A time to review and close is set",
  play_no_trade_condition: "When not to trade is written down",
  instrument_identity: "The exact stock or contract is identified",
  order_intent: "Order type is allowed",
  option_expiration_window: "Option expires inside the allowed window",
  option_limit_day_only: "Option order is a limit order for today",
  long_option_buy_only: "Option order direction is allowed",
  long_option_sell_only: "Option order direction is allowed",
  decision_binding: "Ticket still matches your saved plan",
};

function plainName(key: string): string {
  if (CHECK_NAMES[key]) return CHECK_NAMES[key];
  const words = key.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Order check";
}

export type GuardrailCheckRow = {
  key: string;
  passed: boolean;
  /** Plain name of the check (pass phrasing). */
  name: string;
  /** For a failed check: what is wrong, in plain words. */
  problem: string | null;
  /** The server's own detail string, verbatim. */
  detail: string;
  /** For a failed check: what you can do. Never an automatic action. */
  remedy: string | null;
};

export type GuardrailChecklist =
  | { state: "not_checked"; rows: []; passed: 0; total: 0 }
  | { state: "ready" | "blocked"; rows: GuardrailCheckRow[]; passed: number; total: number };

export function buildGuardrailChecklist(
  evaluation: { passed: boolean; results: ReadonlyArray<{ key: string; passed: boolean; detail: string }> } | null | undefined,
): GuardrailChecklist {
  const results = evaluation?.results ?? [];
  if (!evaluation || results.length === 0) return { state: "not_checked", rows: [], passed: 0, total: 0 };
  const rows: GuardrailCheckRow[] = results.map((result) => {
    if (result.passed) return { key: result.key, passed: true, name: plainName(result.key), problem: null, detail: result.detail, remedy: null };
    const blocker = describeSubmitBlocker(result.key, result.detail);
    return { key: result.key, passed: false, name: plainName(result.key), problem: blocker.title, detail: result.detail, remedy: blocker.remedy === result.detail ? null : blocker.remedy };
  });
  // Failed checks first, otherwise the server's evaluation order.
  const ordered = [...rows.filter((row) => !row.passed), ...rows.filter((row) => row.passed)];
  const passed = rows.filter((row) => row.passed).length;
  return { state: evaluation.passed && passed === rows.length ? "ready" : "blocked", rows: ordered, passed, total: rows.length };
}

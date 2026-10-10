/**
 * Submit readiness for an APPROVED paper order, as the server's own gates see it.
 *
 * The verdict is produced server-side by re-running the exact submit-time gate
 * evaluation (`rerunStoredOrder(..., "submit")` in server/aperture/orderFlow.ts)
 * without writing anything or calling the broker's order endpoint. The UI only
 * renders it: no client recomputes a ceiling or a freshness window, so the
 * button state cannot drift from what `submitOrder` would actually accept.
 *
 * Fail closed: an order with no verdict, or a verdict that could not be
 * computed, is never presented as sendable.
 */

export type OrderSubmitBlocker = {
  /** Gate key from the server evaluation, e.g. `execution_account_freshness`. */
  key: string;
  /** Short human name of the failed gate. */
  title: string;
  /** The server's own detail string for this failure. */
  detail: string;
  /** What the operator can do to clear it. Never an automatic action. */
  remedy: string;
};

export type OrderSubmitReadiness = {
  state: "ready" | "blocked" | "unverified";
  checkedAt: number;
  blockers: OrderSubmitBlocker[];
};

type GatePresentation = { title: string; remedy: string };

const FRESHNESS: GatePresentation = {
  title: "Broker snapshot is stale",
  remedy: "Sync broker snapshot first, then reopen this ticket. Final checks rerun at send time.",
};
const CONCENTRATION: GatePresentation = {
  title: "Over the single-name exposure ceiling",
  remedy: "Review the blocker: trim the existing position or pass on this ticket. The ceiling is not changed here.",
};

const GATE_PRESENTATION: Record<string, GatePresentation> = {
  execution_account_freshness: FRESHNESS,
  portfolio_context_freshness: { ...FRESHNESS, title: "Portfolio context is stale" },
  position_concentration: CONCENTRATION,
  cluster_concentration: { ...CONCENTRATION, title: "Over the cluster exposure ceiling" },
  order_notional_ceiling: {
    title: "Order is larger than the single-order ceiling",
    remedy: "Pass on this ticket and draft a smaller one.",
  },
  paper_account: {
    title: "Destination is not a paper account",
    remedy: "Choose a connected paper account as the destination.",
  },
  paper_execution_destination: {
    title: "Destination cannot take a paper order",
    remedy: "Choose a connected server-side paper account as the destination.",
  },
  external_paper_account_binding: {
    title: "Paper account identity not verified",
    remedy: "Sync broker snapshot so the exact paper destination can be verified.",
  },
  broker_available: {
    title: "Paper broker unavailable",
    remedy: "Check the broker connection on the Accounts page, then retry.",
  },
  planned_risk_per_play: {
    title: "Planned loss is over the per-play limit",
    remedy: "Pass on this ticket and draft one with a smaller size or a tighter stop.",
  },
  daily_planned_risk: {
    title: "Today's planned-loss budget is used up",
    remedy: "Wait for the next session or pass on this ticket.",
  },
  correlated_planned_risk: {
    title: "Correlated planned loss is over its limit",
    remedy: "Review open plays in the same cluster before adding this one.",
  },
  daily_new_notional: {
    title: "Today's new-exposure ceiling is used up",
    remedy: "Wait for the next session or pass on this ticket.",
  },
  run_gross_deployed: {
    title: "This research run's deployment ceiling is used up",
    remedy: "Pass on this ticket or review the run's open orders.",
  },
  market_open: {
    title: "Market session does not allow this order",
    remedy: "Wait for the regular session, or draft a limit DAY order that can queue.",
  },
  market_session_known: {
    title: "Market session could not be determined",
    remedy: "Refresh status and retry.",
  },
  decision_binding: {
    title: "Decision Run changed",
    remedy: "Review the current mission receipt before sending.",
  },
  account_snapshot_fresh: { ...FRESHNESS, title: "Account numbers are out of date" },
  equity_known: {
    title: "Account value is not known yet",
    remedy: "Refresh balances on the Accounts page so the limits can be checked.",
  },
  deployable_capital: {
    title: "Not enough practice cash for this order",
    remedy: "Make the order smaller, or wait until open orders settle.",
  },
  paper_acknowledgement: {
    title: "Practice-money confirmation is missing",
    remedy: "Tick the box that says this is practice money.",
  },
  notional_resolvable: {
    title: "Order size is missing",
    remedy: "Enter an order size (dollars or shares) so the limits can be checked.",
  },
  planned_risk_stated: {
    title: "Planned loss is not written down",
    remedy: "Enter an entry price, an exit price and a size so the planned loss can be measured.",
  },
  concentration_cap: CONCENTRATION,
  liquidity_floor: {
    title: "Stock does not trade enough each day",
    remedy: "Pick a stock with more daily trading, or pass on this one.",
  },
  liquidity_adv_floor: {
    title: "Stock does not trade enough each day",
    remedy: "Pick a stock with more daily trading, or pass on this one.",
  },
  liquidity_participation: {
    title: "Order is too large next to daily trading",
    remedy: "Make the order smaller.",
  },
  micro_cap_min_volume: {
    title: "Small company does not trade enough",
    remedy: "Pick a stock with more daily trading, or pass on this one.",
  },
  max_spread_cap: {
    title: "Gap between buy and sell prices is too wide",
    remedy: "Wait for a narrower gap or pass on this one.",
  },
  penny_stock_limit_only: {
    title: "Low-priced stocks need a limit order",
    remedy: "Switch the order to a limit order with a price.",
  },
  extended_hours_limit_only: {
    title: "Outside regular hours only limit orders are allowed",
    remedy: "Switch to a limit order, or wait for regular hours.",
  },
  intraday_requires_regular_session: {
    title: "Day trades only run in regular hours",
    remedy: "Wait for the regular session, or choose a longer hold.",
  },
  intraday_cutoff: {
    title: "Too late in the day for a day trade",
    remedy: "Wait for the next session, or choose a longer hold.",
  },
  holding_period: {
    title: "How long you plan to hold is not set",
    remedy: "Pick a holding period for this play.",
  },
  catalyst_deadline: {
    title: "The event date is missing or has passed",
    remedy: "Pick a catalyst date that is still ahead.",
  },
  reason: {
    title: "Your reason for the trade is missing",
    remedy: "Write one or two sentences on why you are making this play.",
  },
  invalidation_rule: {
    title: "Your exit reason is missing",
    remedy: "Write what would tell you the idea is wrong.",
  },
  invalidation_condition: {
    title: "Your exit reason is missing",
    remedy: "Write what would tell you the idea is wrong.",
  },
  play_entry: {
    title: "Entry price is not set",
    remedy: "Enter the price you plan to buy at.",
  },
  play_stop: {
    title: "Planned exit price is not set",
    remedy: "Enter the price where you would sell to limit the loss.",
  },
  play_slippage: {
    title: "Allowance for price slippage is not set",
    remedy: "Enter how far the fill price may move from your entry.",
  },
  play_time_stop: {
    title: "A time to review and close is not set",
    remedy: "Pick a future time to review and close the play.",
  },
  play_no_trade_condition: {
    title: "When not to trade is not written down",
    remedy: "Write the condition that would stop you from entering.",
  },
  instrument_identity: {
    title: "The exact stock or contract is not identified",
    remedy: "Check the ticker (and for options, the strike and expiration).",
  },
  order_intent: {
    title: "This order type is not allowed",
    remedy: "Choose a buy to open or a sell to close.",
  },
  option_expiration_window: {
    title: "Option expires outside the allowed window",
    remedy: "Pick an expiration inside the allowed window.",
  },
  option_limit_day_only: {
    title: "Option orders must be limit orders for today",
    remedy: "Switch to a limit order that lasts for the day.",
  },
  long_option_buy_only: {
    title: "Opening an option must be a buy",
    remedy: "Change the order to a buy.",
  },
  long_option_sell_only: {
    title: "Closing an option must be a sell",
    remedy: "Change the order to a sell.",
  },
};

/** Gate keys that have a plain-language title and remedy. */
export const PRESENTED_GATE_KEYS: ReadonlySet<string> = new Set(Object.keys(GATE_PRESENTATION));

const FIELD_LABELS: Record<string, string> = {
  catalystDeadlineAt: "Catalyst deadline",
  timeStopAt: "Close-review time",
  notionalCents: "Order size",
  qty: "Share count",
  limitPriceCents: "Limit price",
  entryPriceCents: "Entry price",
  stopPriceCents: "Exit price",
  plannedRiskCents: "Maximum planned loss",
  reason: "Reason for the trade",
  invalidationCondition: "Exit reason",
  holdingPeriod: "Holding period",
  symbol: "Ticker",
};

function plainField(path: string): string {
  const leaf = path.split(".").filter(Boolean).pop() ?? "";
  if (FIELD_LABELS[leaf]) return FIELD_LABELS[leaf];
  const words = leaf.replace(/Cents$|At$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase().trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "A ticket field";
}

/**
 * Turn the preflight `blocking` list into plain sentences for the screen.
 * Gate failures use their title and remedy; schema errors name the field in
 * plain words. The raw strings stay in logs and receipts only.
 */
export function plainPreflightBlocking(preflight: {
  blocking?: ReadonlyArray<string> | null;
  evaluation?: { results?: ReadonlyArray<{ key: string; passed: boolean; detail: string }> } | null;
  schemaErrors?: ReadonlyArray<string> | null;
} | null | undefined): string[] {
  const failed = (preflight?.evaluation?.results ?? []).filter((r) => !r.passed);
  const schema = new Set(preflight?.schemaErrors ?? []);
  const out: string[] = [];
  for (const line of preflight?.blocking ?? []) {
    const gate = failed.find((r) => r.detail === line);
    let plain: string;
    if (gate) {
      const b = describeSubmitBlocker(gate.key, gate.detail);
      plain = b.remedy === gate.detail ? `${b.title}.` : `${b.title}. ${b.remedy}`;
    } else if (schema.has(line)) {
      plain = `${plainField(line.split(":")[0] ?? "")} needs a valid value.`;
    } else {
      plain = line;
    }
    if (!out.includes(plain)) out.push(plain);
  }
  return out;
}

function humanizeKey(key: string): string {
  const words = key.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Final check";
}

/** Name a failed server gate and say how to clear it. */
export function describeSubmitBlocker(key: string, detail: string): OrderSubmitBlocker {
  const known = GATE_PRESENTATION[key];
  return {
    key,
    title: known?.title ?? humanizeKey(key),
    detail,
    // Never show a raw server detail as advice; it stays in `detail` for logs.
    remedy: known?.remedy ?? "Review this check, then try again.",
  };
}

/** Build a readiness verdict from a server gate evaluation's results. */
export function readinessFromGateResults(
  results: ReadonlyArray<{ key: string; passed: boolean; detail: string }>,
  passed: boolean,
  checkedAt: number,
): OrderSubmitReadiness {
  const blockers = results.filter((result) => !result.passed).map((result) => describeSubmitBlocker(result.key, result.detail));
  if (passed && blockers.length === 0) return { state: "ready", checkedAt, blockers: [] };
  return {
    state: "blocked",
    checkedAt,
    // An evaluation that says "not passed" without a named gate still blocks.
    blockers: blockers.length ? blockers : [describeSubmitBlocker("final_checks", "Final order checks did not pass.")],
  };
}

export function unverifiedReadiness(checkedAt: number, detail = "Final order checks could not be run for this ticket."): OrderSubmitReadiness {
  return {
    state: "unverified",
    checkedAt,
    blockers: [{ key: "final_checks_unavailable", title: "Final checks not verified", detail, remedy: "Refresh status. Send stays off until the checks run." }],
  };
}

/** True only for a verdict the server computed and passed. Missing = not sendable. */
export function canSendApprovedOrder(readiness: OrderSubmitReadiness | null | undefined): boolean {
  return readiness?.state === "ready";
}

/**
 * Blockers the guardrail checklist does not already list (Refs #118 retest).
 * The checklist names every failed server gate ("N to fix"); repeating those
 * here made "See 8 supporting gaps" disagree with "7 to fix". Only schema
 * problems and other non-gate blockers are returned, de-duplicated.
 */
export function preflightBlockersOutsideChecklist(preflight: Parameters<typeof plainPreflightBlocking>[0]): string[] {
  const failedDetails = new Set((preflight?.evaluation?.results ?? []).filter((r) => !r.passed).map((r) => r.detail));
  const extras = (preflight?.blocking ?? []).filter((line) => !failedDetails.has(line));
  return plainPreflightBlocking({ blocking: extras, evaluation: preflight?.evaluation, schemaErrors: preflight?.schemaErrors });
}

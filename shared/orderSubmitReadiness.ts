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
};

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
    remedy: known?.remedy ?? detail,
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

import { MONITORING_FRESHNESS_MS } from "./monitoringState";

export type ExecutionBucketId = "dip_buying" | "swings" | "defined_risk_options";

const EXECUTION_BUCKET_TEMPLATES = [
  {
    id: "dip_buying" as const,
    label: "Dip buying",
    targetLowPct: 30,
    targetHighPct: 40,
    mandate: "Shares near a verified support level",
    actionRule: "Stage entries only after the demand floor and protective stop are recorded.",
  },
  {
    id: "swings" as const,
    label: "Swings",
    targetLowPct: 40,
    targetHighPct: 50,
    mandate: "3–10 session catalyst moves",
    actionRule: "Carry one invalidation level, one review date, and explicit profit milestones.",
  },
  {
    id: "defined_risk_options" as const,
    label: "Defined-risk options",
    targetLowPct: 20,
    targetHighPct: 30,
    mandate: "Directional premium or paper hedges",
    actionRule: "Use a fixed debit and maximum loss. Multi-leg spreads are not supported in this build.",
  },
] as const;

/** Presentation only. The canonical target comes from an underwriting revision. */
export function buildWeeklyExecutionBuckets(targetProfitCents: number) {
  return EXECUTION_BUCKET_TEMPLATES.map((bucket) => ({
    ...bucket,
    targetLowCents: Math.round(targetProfitCents * bucket.targetLowPct / 100),
    targetHighCents: Math.round(targetProfitCents * bucket.targetHighPct / 100),
  }));
}

export type OperatorMonitoringObservation = {
  id: number;
  checkType: "catalyst" | "thesis_invalidation" | "earnings" | "macro" | string;
  finding: string | null;
  flagged: boolean;
  citations: string[];
  checkedAt: number;
};

export type OperatorOrderSummary = {
  id: number;
  runId: number;
  candidateId: number | null;
  symbol: string;
  instrumentType: "shares" | "long_call" | "long_put" | string;
  holdingPeriod: string | null;
  status: string;
  plannedRiskCents: number | null;
  monitoring: OperatorMonitoringObservation[];
  latestSnapshot?: {
    unrealizedPnlCents: number | null;
    priceBasis: "verified" | "modeled" | string;
    snapshotAt: number;
  } | null;
};

export type OperatorAction = {
  state: "action_required" | "hold";
  assetStrategy: string;
  currentState: string;
  immediateAction: string;
  nextActionLabel: string;
  targetRunId: number | null;
  targetCandidateId: number | null;
  lifecycle: "orders" | "monitoring" | null;
  watchFinding: string | null;
  watchSourceUrl: string | null;
  defensiveExpression: string | null;
};

export function executionBucketFor(input: { instrumentType: string; holdingPeriod: string | null }): ExecutionBucketId {
  if (input.instrumentType === "long_call" || input.instrumentType === "long_put") return "defined_risk_options";
  if (["swing", "catalyst_window", "position", "overnight"].includes(input.holdingPeriod ?? "")) return "swings";
  return "dip_buying";
}

const BUCKET_LABEL: Record<ExecutionBucketId, string> = {
  dip_buying: "Dip buy",
  swings: "Swing",
  defined_risk_options: "Defined-risk option",
};

function dollars(cents: number) {
  const sign = cents > 0 ? "+" : cents < 0 ? "−" : "";
  return `${sign}$${Math.round(Math.abs(cents) / 100).toLocaleString("en-US")}`;
}

function citedNegativeFinding(orders: OperatorOrderSummary[], now: number) {
  return orders
    .flatMap((order) => order.monitoring.map((check) => ({ order, check })))
    .filter(({ check }) => check.flagged
      && (check.checkType === "thesis_invalidation" || check.checkType === "macro")
      && check.finding?.trim()
      && check.checkedAt <= now
      && now - check.checkedAt <= MONITORING_FRESHNESS_MS
      && check.citations.some((citation) => /^https?:\/\//i.test(citation)))
    .sort((left, right) => right.check.checkedAt - left.check.checkedAt)[0] ?? null;
}

function defensiveExpression(order: OperatorOrderSummary) {
  if (order.instrumentType === "shares") {
    return "Paper expression to evaluate: long put. Bear spreads are not supported in this build; nothing is created automatically.";
  }
  if (order.instrumentType === "long_call") {
    return "Paper response to evaluate: reduce the open call or review a long put separately. Nothing is created automatically.";
  }
  return "Review whether the existing put still matches the sourced catalyst and recorded maximum loss.";
}

/**
 * Turns durable order and monitoring records into one next action. It never
 * invents a price, return, recommendation, or order transition.
 */
export function buildOperatorAction(input: { chooseCount: number; orders: OperatorOrderSummary[]; now?: number }): OperatorAction {
  const negative = citedNegativeFinding(input.orders, input.now ?? Date.now());
  if (negative) {
    const { order, check } = negative;
    return {
      state: "action_required",
      assetStrategy: `${order.symbol} · ${BUCKET_LABEL[executionBucketFor(order)]}`,
      currentState: "A current, cited monitoring check challenges the recorded thesis.",
      immediateAction: `Review the negative catalyst before changing or adding paper exposure: ${check.finding}`,
      nextActionLabel: `Review ${order.symbol} evidence`,
      targetRunId: order.runId,
      targetCandidateId: order.candidateId,
      lifecycle: "monitoring",
      watchFinding: check.finding,
      watchSourceUrl: check.citations[0] ?? null,
      defensiveExpression: defensiveExpression(order),
    };
  }

  const pending = input.orders.find((order) => order.status === "pending_approval");
  if (pending) return {
    state: "action_required",
    assetStrategy: `${pending.symbol} · ${BUCKET_LABEL[executionBucketFor(pending)]}`,
    currentState: `Paper ticket is waiting for review. Maximum planned loss: ${pending.plannedRiskCents == null ? "not measured" : dollars(-pending.plannedRiskCents)}.`,
    immediateAction: "Confirm the exact instrument, limit, invalidation, and maximum loss. Approval does not submit it.",
    nextActionLabel: `Review ${pending.symbol} ticket`,
    targetRunId: pending.runId,
    targetCandidateId: pending.candidateId,
    lifecycle: "orders",
    watchFinding: null,
    watchSourceUrl: null,
    defensiveExpression: null,
  };

  const approved = input.orders.find((order) => order.status === "approved");
  if (approved) return {
    state: "action_required",
    assetStrategy: `${approved.symbol} · ${BUCKET_LABEL[executionBucketFor(approved)]}`,
    currentState: "Paper ticket is approved but has not been sent to the named paper broker.",
    immediateAction: "Run the final preflight, then explicitly submit or queue the paper order.",
    nextActionLabel: `Submit or queue ${approved.symbol}`,
    targetRunId: approved.runId,
    targetCandidateId: approved.candidateId,
    lifecycle: "orders",
    watchFinding: null,
    watchSourceUrl: null,
    defensiveExpression: null,
  };

  const submitted = input.orders.find((order) => order.status === "submitted");
  if (submitted) return {
    state: "hold",
    assetStrategy: `${submitted.symbol} · ${BUCKET_LABEL[executionBucketFor(submitted)]}`,
    currentState: "The paper broker accepted or queued the order; no fill is asserted yet.",
    immediateAction: "Wait for a mirrored broker fill. Do not create a duplicate ticket.",
    nextActionLabel: `View ${submitted.symbol} order`,
    targetRunId: submitted.runId,
    targetCandidateId: submitted.candidateId,
    lifecycle: "orders",
    watchFinding: null,
    watchSourceUrl: null,
    defensiveExpression: null,
  };

  const filled = input.orders.find((order) => order.status === "filled");
  if (filled) {
    const snapshot = filled.latestSnapshot;
    const verifiedPnl = snapshot?.priceBasis === "verified" && snapshot.unrealizedPnlCents != null
      ? `${dollars(snapshot.unrealizedPnlCents)} unrealized at the last verified mark.`
      : "Current return is not measured from a verified mark.";
    return {
      state: "hold",
      assetStrategy: `${filled.symbol} · ${BUCKET_LABEL[executionBucketFor(filled)]}`,
      currentState: verifiedPnl,
      immediateAction: "Review the recorded invalidation and time milestone before changing the position. No exit is automatic.",
      nextActionLabel: `Review ${filled.symbol} position`,
      targetRunId: filled.runId,
      targetCandidateId: filled.candidateId,
      lifecycle: "monitoring",
      watchFinding: null,
      watchSourceUrl: null,
      defensiveExpression: null,
    };
  }

  return {
    state: input.chooseCount > 0 ? "action_required" : "hold",
    assetStrategy: input.chooseCount > 0 ? `${input.chooseCount} researched play${input.chooseCount === 1 ? "" : "s"}` : "No play requires action",
    currentState: input.chooseCount > 0 ? "Research is ready for an operator choice." : "No ticket or monitored position needs a decision now.",
    immediateAction: input.chooseCount > 0 ? "Choose one play to validate, or record cash." : "Hold. Start a new mission only when there is a new thesis or capital decision.",
    nextActionLabel: input.chooseCount > 0 ? "Choose a play" : "No action due",
    targetRunId: null,
    targetCandidateId: null,
    lifecycle: null,
    watchFinding: null,
    watchSourceUrl: null,
    defensiveExpression: null,
  };
}

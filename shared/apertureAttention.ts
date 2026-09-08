export type ApertureEntryState = "start" | "resume" | "check_in";
export type AttentionReadState = "loading" | "empty" | "stale" | "partial" | "failed" | "complete";

export type AttentionMission = {
  decisionRunId: number;
  revisionId: number;
  state: "incomplete" | "complete";
  title: string;
  updatedAt: number;
};

export type AttentionUnderwriting = {
  decisionRunId: number;
  revisionId: number;
  state: "not_started" | "queued" | "running" | "failed" | "complete";
  updatedAt: number;
  error?: string | null;
};

export type AttentionEvidenceTask = {
  runId: number;
  candidateId: number;
  symbol: string;
  remaining: number;
  finding?: string | null;
  updatedAt: number;
};

export type AttentionOrder = {
  id: number;
  runId: number;
  candidateId: number | null;
  symbol: string;
  status: "pending_approval" | "approved" | "submitted" | "filled" | "rejected" | "cancelled";
  qty: number | null;
  filledQty: number | null;
  brokerOrderId?: string | null;
  dispatchError: string | null;
  updatedAt: number;
};

export type AttentionActivePlay = {
  id: number;
  symbol: string;
  state: "waiting_for_trigger" | "watching" | "open_position";
  detail: string;
  href: string;
  updatedAt: number;
  reviewAt?: number | null;
};

export type AttentionPendingReview = {
  id: number;
  kind: "gate_review" | "play_outcome";
  dueAt: number;
  updatedAt: number;
  title: string;
  href: string;
};

export type AttentionMonitoringFinding = {
  id: number;
  orderId: number;
  runId: number;
  candidateId: number | null;
  symbol: string;
  kind: "invalidation" | "material_change";
  finding: string;
  checkedAt: number;
};

export type ApertureAttentionInput = {
  now: number;
  mission: AttentionMission | null;
  underwriting: AttentionUnderwriting | null;
  evidenceTasks: AttentionEvidenceTask[];
  orders: AttentionOrder[];
  activePlays: AttentionActivePlay[];
  pendingReviews: AttentionPendingReview[];
  monitoringFindings: AttentionMonitoringFinding[];
  checks: {
    state: AttentionReadState;
    asOf: number | null;
    monitoring: "on_demand" | "scheduled";
    error?: string | null;
  };
};

export type ApertureAttentionItem = {
  key: string;
  kind:
    | "status_unavailable"
    | "incomplete_mission"
    | "underwriting_underway"
    | "underwriting_failed"
    | "evidence_missing"
    | "invalidation_evidence"
    | "dispatch_unresolved"
    | "ready_for_paper_review"
    | "approved_not_submitted"
    | "review_due";
  priority: number;
  symbol?: string | null;
  stateLabel: string;
  title: string;
  reason: string;
  consequence: string;
  actionLabel: string;
  href: string;
  updatedAt: number;
  critical: boolean;
};

export type ApertureMotionItem = {
  key: string;
  symbol: string;
  stateLabel: string;
  detail: string;
  href: string;
  updatedAt: number;
};

export type ApertureAttentionBaseline = {
  capturedAt: number;
  items: Array<{ key: string; fingerprint: string }>;
};

export type ApertureAttentionBriefing = {
  entryState: ApertureEntryState;
  primary: ApertureAttentionItem | null;
  otherCritical: ApertureAttentionItem[];
  changed: Array<ApertureAttentionItem | ApertureMotionItem>;
  inMotion: ApertureMotionItem[];
  nextCheckpoint: { title: string; detail: string; at: number | null; href: string | null } | null;
  changeHeading: "Current status" | "Changed since your last review";
  scopeNote: string;
  quiet: boolean;
  quietMessage: string | null;
  baseline: ApertureAttentionBaseline;
  baselineToken: string;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashCanonical(value: unknown): string {
  let hash = 2166136261;
  const text = canonical(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function attentionFingerprint(value: Omit<ApertureAttentionItem, "updatedAt"> | Omit<ApertureMotionItem, "updatedAt">): string {
  // Routine timestamp changes are intentionally excluded from comparison.
  // Freshness is promoted only when it changes eligibility or the visible state.
  return hashCanonical(value);
}

export function attentionBaselineToken(baseline: ApertureAttentionBaseline): string {
  return hashCanonical(baseline.items);
}

function orderHref(order: AttentionOrder) {
  const candidate = order.candidateId == null ? "" : `?candidate=${order.candidateId}`;
  return `/aperture/run/${order.runId}/execute${candidate}`;
}

function evidenceHref(task: AttentionEvidenceTask) {
  return `/aperture/run/${task.runId}?candidate=${task.candidateId}&view=evidence`;
}

function orderMotion(order: AttentionOrder): ApertureMotionItem | null {
  if (order.status !== "submitted" && order.status !== "filled") return null;
  const ordered = Math.abs(order.qty ?? 0);
  const filled = Math.abs(order.filledQty ?? 0);
  const partial = ordered > 0 && filled > 0 && filled < ordered;
  if (partial) return {
    key: `order:${order.id}`,
    symbol: order.symbol,
    stateLabel: "Partially filled",
    detail: `${filled} filled · ${ordered - filled} remaining`,
    href: orderHref(order),
    updatedAt: order.updatedAt,
  };
  if (order.status === "filled") return {
    key: `order:${order.id}`,
    symbol: order.symbol,
    stateLabel: "Open position",
    detail: `${filled || ordered || "Recorded"} filled · review monitoring state`,
    href: `${orderHref(order)}${order.candidateId == null ? "?" : "&"}lifecycle=monitoring`,
    updatedAt: order.updatedAt,
  };
  return {
    key: `order:${order.id}`,
    symbol: order.symbol,
    stateLabel: order.brokerOrderId ? "Paper broker accepted; no fill yet" : "Submitted; broker status pending",
    detail: order.brokerOrderId ? "Accepted order · no fill recorded" : "Reconcile before treating this as accepted",
    href: orderHref(order),
    updatedAt: order.updatedAt,
  };
}

function item(input: Omit<ApertureAttentionItem, "critical">): ApertureAttentionItem {
  return { ...input, critical: input.priority >= 80 };
}

export function deriveApertureAttention(input: ApertureAttentionInput, prior: ApertureAttentionBaseline | null): ApertureAttentionBriefing {
  const hasExistingWork = input.orders.some((order) => ["pending_approval", "approved", "submitted", "filled"].includes(order.status))
    || input.activePlays.length > 0
    || input.pendingReviews.length > 0;
  const needsResume = input.mission?.state === "incomplete"
    || input.underwriting?.state === "not_started"
    || input.underwriting?.state === "queued"
    || input.underwriting?.state === "running"
    || input.underwriting?.state === "failed"
    || input.evidenceTasks.length > 0;
  const entryState: ApertureEntryState = hasExistingWork
    ? "check_in"
    : !input.mission
      ? "start"
      : needsResume
        ? "resume"
        : "check_in";

  const attention: ApertureAttentionItem[] = [];
  if (input.checks.state === "failed") {
    attention.push(item({
      key: "status:failed",
      kind: "status_unavailable",
      priority: 110,
      stateLabel: "Status unavailable",
      title: "Current status could not be verified",
      reason: input.checks.error ?? "A required status source failed.",
      consequence: "An empty result is not treated as an all-clear. Existing records remain unchanged.",
      actionLabel: "Retry status checks",
      href: "/aperture",
      updatedAt: input.now,
    }));
  } else if (input.checks.state === "partial") {
    attention.push(item({
      key: "status:partial",
      kind: "status_unavailable",
      priority: 68,
      stateLabel: "Partially available",
      title: "Some decisions cannot be verified",
      reason: input.checks.error ?? "One or more sources are unavailable.",
      consequence: "Useful unaffected records remain visible; unsupported decisions stay withheld.",
      actionLabel: "Review available status",
      href: "/aperture/plays",
      updatedAt: input.now,
    }));
  }

  if (!input.mission && !hasExistingWork) {
    attention.push(item({
      key: "mission:missing",
      kind: "incomplete_mission",
      priority: 70,
      stateLabel: "Mission needed",
      title: "Set the Capital Mission",
      reason: "No usable persisted mission is available.",
      consequence: "This creates a plan for underwriting. No order is created or submitted.",
      actionLabel: "Start Capital Mission",
      href: "/aperture/mission",
      updatedAt: input.now,
    }));
  } else if (input.mission?.state === "incomplete" && !hasExistingWork) {
    attention.push(item({
      key: `mission:${input.mission.decisionRunId}`,
      kind: "incomplete_mission",
      priority: 70,
      stateLabel: "Mission incomplete",
      title: input.mission.title,
      reason: "Required mission assumptions are still missing.",
      consequence: "Resume the saved draft; a new mission is not required.",
      actionLabel: "Resume mission setup",
      href: `/aperture/decision/${input.mission.decisionRunId}/revision/${input.mission.revisionId}`,
      updatedAt: input.mission.updatedAt,
    }));
  }

  if (input.underwriting?.state === "not_started") {
    attention.push(item({
      key: `underwriting:${input.underwriting.decisionRunId}`,
      kind: "underwriting_underway",
      priority: 65,
      stateLabel: "Mission ready",
      title: "Underwrite the saved mission",
      reason: "The mission assumptions are persisted, but no playbook has been produced.",
      consequence: "Underwriting builds research candidates. It does not create or submit an order.",
      actionLabel: "Underwrite my mission",
      href: `/aperture/decision/${input.underwriting.decisionRunId}/revision/${input.underwriting.revisionId}`,
      updatedAt: input.underwriting.updatedAt,
    }));
  } else if (input.underwriting?.state === "queued" || input.underwriting?.state === "running") {
    attention.push(item({
      key: `underwriting:${input.underwriting.decisionRunId}`,
      kind: "underwriting_underway",
      priority: 65,
      stateLabel: "Underwriting underway",
      title: "The mission analysis is still running",
      reason: "The persisted job has not reached a usable result yet.",
      consequence: "Leaving this view does not restart the job or create an order.",
      actionLabel: "View underwriting progress",
      href: `/aperture/decision/${input.underwriting.decisionRunId}/revision/${input.underwriting.revisionId}/underwrite`,
      updatedAt: input.underwriting.updatedAt,
    }));
  } else if (input.underwriting?.state === "failed") {
    attention.push(item({
      key: `underwriting:${input.underwriting.decisionRunId}`,
      kind: "underwriting_failed",
      priority: 74,
      stateLabel: "Underwriting stopped",
      title: "The mission did not produce a usable playbook",
      reason: input.underwriting.error ?? "The underwriting job failed.",
      consequence: "The last successful result remains the record. No research or order was created.",
      actionLabel: "Review underwriting failure",
      href: `/aperture/decision/${input.underwriting.decisionRunId}/revision/${input.underwriting.revisionId}/underwrite`,
      updatedAt: input.underwriting.updatedAt,
    }));
  }

  for (const task of input.evidenceTasks) {
    attention.push(item({
      key: `evidence:${task.runId}:${task.candidateId}`,
      kind: "evidence_missing",
      priority: 75,
      symbol: task.symbol,
      stateLabel: "Evidence missing",
      title: `${task.symbol} needs ${task.remaining} evidence check${task.remaining === 1 ? "" : "s"}`,
      reason: task.finding ?? "Decision-critical evidence remains unresolved.",
      consequence: "A paper ticket cannot be prepared until these checks are resolved.",
      actionLabel: "Review unresolved evidence",
      href: evidenceHref(task),
      updatedAt: task.updatedAt,
    }));
  }

  for (const finding of input.monitoringFindings) {
    attention.push(item({
      key: `finding:${finding.id}`,
      kind: "invalidation_evidence",
      priority: finding.kind === "invalidation" ? 100 : 92,
      symbol: finding.symbol,
      stateLabel: finding.kind === "invalidation" ? "Invalidation evidence" : "Material change",
      title: `Review what changed for ${finding.symbol}`,
      reason: finding.finding,
      consequence: "This may change whether the recorded play thesis still holds; it does not trigger an automatic exit.",
      actionLabel: "Review what changed",
      href: `/aperture/run/${finding.runId}/execute?candidate=${finding.candidateId ?? ""}&lifecycle=monitoring`,
      updatedAt: finding.checkedAt,
    }));
  }

  for (const order of input.orders) {
    if (order.dispatchError) {
      attention.push(item({
        key: `order:${order.id}:dispatch`,
        kind: "dispatch_unresolved",
        priority: 105,
        symbol: order.symbol,
        stateLabel: "Dispatch unresolved",
        title: `Reconcile ${order.symbol} paper dispatch`,
        reason: order.dispatchError,
        consequence: "Broker acceptance is not confirmed. Do not submit a duplicate order.",
        actionLabel: "Reconcile dispatch",
        href: orderHref(order),
        updatedAt: order.updatedAt,
      }));
    } else if (order.status === "approved") {
      attention.push(item({
        key: `order:${order.id}`,
        kind: "approved_not_submitted",
        priority: 90,
        symbol: order.symbol,
        stateLabel: "Approved · not submitted",
        title: `Submit ${order.symbol} to the named paper broker`,
        reason: "Human approval is recorded, but dispatch has not occurred.",
        consequence: "Preflight must pass before an explicit paper submission.",
        actionLabel: "Run preflight and submit",
        href: orderHref(order),
        updatedAt: order.updatedAt,
      }));
    } else if (order.status === "pending_approval") {
      attention.push(item({
        key: `order:${order.id}`,
        kind: "ready_for_paper_review",
        priority: 85,
        symbol: order.symbol,
        stateLabel: "Ready for paper review",
        title: `Review the exact ${order.symbol} ticket`,
        reason: "A paper proposal exists and is waiting for human review.",
        consequence: "Review does not submit it to the broker.",
        actionLabel: "Review exact ticket",
        href: orderHref(order),
        updatedAt: order.updatedAt,
      }));
    }
  }

  for (const review of input.pendingReviews.filter((candidate) => candidate.dueAt <= input.now)) {
    attention.push(item({
      key: `review:${review.id}`,
      kind: "review_due",
      priority: 80,
      stateLabel: review.kind === "gate_review" ? "Gate review due" : "Outcome review due",
      title: review.title,
      reason: "The recorded review time has arrived.",
      consequence: "This is a human checkpoint, not proof that an automatic check or exit occurred.",
      actionLabel: review.kind === "gate_review" ? "Review the exact gate" : "Review recorded outcome",
      href: review.href,
      updatedAt: review.updatedAt,
    }));
  }

  attention.sort((left, right) => right.priority - left.priority || right.updatedAt - left.updatedAt || left.key.localeCompare(right.key));
  const inMotion = [
    ...input.orders.map(orderMotion).filter((value): value is ApertureMotionItem => value != null),
    ...input.activePlays.map((play): ApertureMotionItem => ({
      key: `play:${play.id}`,
      symbol: play.symbol,
      stateLabel: play.state === "waiting_for_trigger" ? "Entry condition not met" : play.state === "open_position" ? "Open position" : "Watching",
      detail: play.detail,
      href: play.href,
      updatedAt: play.updatedAt,
    })),
  ].sort((left, right) => right.updatedAt - left.updatedAt || left.key.localeCompare(right.key));

  const baselineItems = [...attention, ...inMotion].map((record) => {
    const { updatedAt: _updatedAt, ...material } = record;
    return { key: record.key, fingerprint: attentionFingerprint(material) };
  });
  const baseline: ApertureAttentionBaseline = { capturedAt: input.now, items: baselineItems };
  const baselineToken = attentionBaselineToken(baseline);
  const priorMap = new Map((prior?.items ?? []).map((record) => [record.key, record.fingerprint]));
  const currentByKey = new Map([...attention, ...inMotion].map((record) => [record.key, record]));
  const changed = prior == null
    ? [...attention, ...inMotion]
    : baselineItems.flatMap((record) => priorMap.get(record.key) === record.fingerprint ? [] : [currentByKey.get(record.key)!]);

  const futureReviews = input.pendingReviews.slice().sort((left, right) => left.dueAt - right.dueAt);
  const futurePlays = input.activePlays.filter((play) => play.reviewAt != null).sort((left, right) => (left.reviewAt ?? Infinity) - (right.reviewAt ?? Infinity));
  const nextReview = futureReviews[0];
  const nextPlay = futurePlays[0];
  const nextCheckpoint = nextReview && (!nextPlay || nextReview.dueAt <= (nextPlay.reviewAt ?? Infinity))
    ? { title: nextReview.title, detail: "Recorded human review time", at: nextReview.dueAt, href: nextReview.href }
    : nextPlay
      ? { title: `${nextPlay.symbol} review`, detail: nextPlay.detail, at: nextPlay.reviewAt ?? null, href: nextPlay.href }
      : input.checks.asOf == null
        ? null
        : { title: "Run updated checks", detail: input.checks.monitoring === "on_demand" ? "Monitoring is on demand" : "Scheduled checks are configured", at: null, href: "/aperture/plays" };

  const quiet = attention.length === 0 && input.checks.state === "complete";
  const asOf = input.checks.asOf == null ? "an unverified time" : new Date(input.checks.asOf).toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const scopeNote = input.checks.state === "partial"
    ? `Status is partially available${input.checks.error ? `: ${input.checks.error}` : "."}`
    : input.checks.state === "stale"
      ? `Last successful status is stale as of ${asOf}.`
      : `Checks last completed ${asOf}. Monitoring: ${input.checks.monitoring === "on_demand" ? "On demand" : "Scheduled"}.`;

  return {
    entryState,
    primary: attention[0] ?? null,
    otherCritical: attention.slice(1).filter((candidate) => candidate.critical),
    changed,
    inMotion,
    nextCheckpoint,
    changeHeading: prior == null ? "Current status" : "Changed since your last review",
    scopeNote,
    quiet,
    quietMessage: quiet ? `No new action identified in the checks completed at ${asOf}.` : null,
    baseline,
    baselineToken,
  };
}

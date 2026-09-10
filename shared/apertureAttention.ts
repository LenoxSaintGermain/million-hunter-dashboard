import { monitoringFindingPresentation, type MonitoringInstrumentContext } from "./monitoringState";
import { monitoringFindingHref } from "./monitoringFinding";
import { paperInstrumentDisplayLabel, parseOccOptionSymbol } from "./paperInstrument";

export type ApertureEntryState = "start" | "resume" | "check_in";
export type AttentionReadState = "loading" | "empty" | "stale" | "partial" | "failed" | "complete";

export type AttentionMission = {
  decisionRunId: number;
  revisionId: number;
  state: "incomplete" | "complete";
  lifecycle?: "mission" | "researching" | "conditional" | "eligible" | "cash" | "pending_outcome" | "closed";
  title: string;
  updatedAt: number;
};

export type AttentionUnderwriting = {
  decisionRunId: number;
  revisionId: number;
  state: "not_started" | "queued" | "running" | "failed" | "complete";
  updatedAt: number;
  error?: string | null;
  /** A saved request is not proof that its analysis capability is available. */
  unavailableReason?: string | null;
  outcome?: "plays" | "no_trade" | null;
  resultSummary?: string | null;
  reopenCondition?: string | null;
  selectedPlayId?: string | null;
};

export type AttentionEvidenceTask = {
  runId: number;
  candidateId: number;
  symbol: string;
  remaining: number;
  finding?: string | null;
  updatedAt: number;
};

export type AttentionOrder = MonitoringInstrumentContext & {
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
  checkType?: string;
  citations?: unknown;
  instrument?: MonitoringInstrumentContext | null;
  rationale?: string | null;
};

export type AttentionSourceIssue = {
  source: AttentionStatusSource | "monitoring" | "positions";
  state: "unavailable" | "missing" | "stale";
  label: string;
  impact: string;
  lastSuccessAt: number | null;
  actionLabel: string;
  href: string | null;
  recovery: "refresh_status" | "review_checks" | "inspect_record";
};

export type ApertureAttentionInput = {
  now: number;
  /** Persisted unfinished form; section matches MissionDraftValues.activeSection. */
  draft?: { updatedAt: number; section: 1 | 2 | 3 } | null;
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
    /** Actual monitoring record time, never a mission/order updatedAt. */
    monitoringAsOf?: number | null;
    monitoring: "on_demand" | "scheduled";
    error?: string | null;
    issues?: AttentionSourceIssue[];
  };
};

export type ApertureAttentionItem = {
  key: string;
  kind:
    | "status_unavailable"
    | "incomplete_mission"
    | "underwriting_underway"
    | "underwriting_failed"
    | "underwriting_complete"
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
  deadlineAt?: number | null;
  evidence?: { finding: string; citations: string[]; checkedAt: number; rationale: string | null };
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
  items: Array<{ key: string; fingerprint: string; seenAt?: number }>;
  /** Separate explicit review ledger. Never copied from a client Seen request. */
  monitoringReviews?: import("./monitoringFinding").MonitoringReviewReceipt[];
};

export type ApertureAttentionBriefing = {
  entryState: ApertureEntryState;
  primary: ApertureAttentionItem | null;
  otherCritical: ApertureAttentionItem[];
  otherAttention: ApertureAttentionItem[];
  readState: AttentionReadState;
  changed: Array<ApertureAttentionItem | ApertureMotionItem>;
  inMotion: ApertureMotionItem[];
  nextCheckpoint: { title: string; detail: string; at: number | null; href: string | null } | null;
  changeHeading: "Current status" | "Changed since your last review";
  scopeNote: string;
  monitoringNote: string;
  quiet: boolean;
  quietMessage: string | null;
  baseline: ApertureAttentionBaseline;
  baselineToken: string;
  sourceIssues?: AttentionSourceIssue[];
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

/** Call inside the persistence transaction. Seen is per-item; it never resolves work. */
export function mergeAttentionBaseline(prior: ApertureAttentionBaseline | null, displayed: ApertureAttentionBaseline): ApertureAttentionBaseline {
  const items = new Map((prior?.items ?? []).map((record) => [record.key, { ...record, seenAt: record.seenAt ?? prior!.capturedAt }]));
  for (const record of displayed.items) {
    const previous = items.get(record.key);
    if (!previous || previous.seenAt <= displayed.capturedAt) items.set(record.key, { key: record.key, fingerprint: record.fingerprint, seenAt: displayed.capturedAt });
  }
  return { capturedAt: Math.max(prior?.capturedAt ?? 0, displayed.capturedAt), items: Array.from(items.values()).sort((a, b) => a.key.localeCompare(b.key)), ...(prior?.monitoringReviews ? { monitoringReviews: prior.monitoringReviews } : {}) };
}

/** Select only versions observed in the visible viewport, not merely mounted or collapsed. */
export function displayedAttentionBaseline(briefing: ApertureAttentionBriefing, displayed: ReadonlyMap<string, string>) {
  const snapshot = { ...briefing.baseline, items: briefing.baseline.items.filter((item) => displayed.get(item.key) === item.fingerprint) };
  return { snapshot, token: attentionBaselineToken(snapshot) };
}

/** Stable reading layout. New urgency stays visible without moving the current primary button. */
export function attentionDisclosure(briefing: ApertureAttentionBriefing, primaryKey?: string | null) {
  const tasks = [briefing.primary, ...briefing.otherCritical, ...briefing.otherAttention].filter((value): value is ApertureAttentionItem => value != null);
  const primary = tasks.find((task) => task.key === primaryKey) ?? briefing.primary;
  const otherCritical = tasks.filter((task) => task.key !== primary?.key && task.critical);
  const otherAttention = tasks.filter((task) => task.key !== primary?.key && !task.critical);
  const taskKeys = new Set(tasks.map((task) => task.key));
  const motionKeys = new Set(briefing.inMotion.map((task) => task.key));
  return {
    primary, otherCritical, otherAttention,
    changed: briefing.changed.filter((item) => !taskKeys.has(item.key) && !motionKeys.has(item.key)),
    inMotion: briefing.inMotion,
  };
}

export function canShowQuietBriefing(briefing: ApertureAttentionBriefing | null, loading: boolean, failed: string | null): boolean {
  return !!briefing && briefing.quiet && briefing.primary == null && briefing.readState === "complete" && !loading && !failed;
}

/** Read presentation only. Never changes lifecycle eligibility or acknowledges a finding.
 * Transport retries outrank an old transport error; substantive risk tasks survive
 * either. Context queries cannot hold the recorded-status surface in Loading.
 */
export function arbitrateTodayRead({ briefing, refreshing, failed, failedSources = [], primaryKey }: {
  briefing: ApertureAttentionBriefing | null;
  refreshing: boolean;
  failed: boolean;
  failedSources?: AttentionStatusSource[];
  primaryKey?: string | null;
}) {
  const coreFailed = failed && (!failedSources.length || failedSources.includes("status"));
  const state = refreshing ? briefing ? "refreshing" : "loading"
    : coreFailed ? "failed"
      : !briefing ? "empty"
        : failed ? "partial" : briefing.readState;
  const uncertain = state !== "complete";
  const layout = briefing ? attentionDisclosure(briefing, primaryKey) : null;
  // Availability has one stable notice, never another pseudo-workflow card.
  // A cached absence of work cannot instruct the operator to create a new mission.
  const keep = (task: ApertureAttentionItem) => task.kind !== "status_unavailable"
    && !(uncertain && task.key === "mission:missing");
  const tasks = layout ? [layout.primary, ...layout.otherCritical, ...layout.otherAttention]
    .filter((task): task is ApertureAttentionItem => task != null && keep(task)) : [];
  const primary = tasks[0] ?? null;
  return {
    state,
    busy: refreshing,
    sourceRecoveryMessage: briefing?.sourceIssues?.some(issue => issue.recovery === "review_checks")
      ? "Open the affected play below for new checks. Refresh only reloads saved status."
      : "Some saved records need verification. Retry status; available work stays visible.",
    quiet: state === "complete" && canShowQuietBriefing(briefing, false, null),
    canRecordSeen: !refreshing && !coreFailed && briefing?.readState === "complete",
    layout: layout ? {
      ...layout, primary,
      otherCritical: tasks.slice(1).filter(task => task.critical),
      otherAttention: tasks.slice(1).filter(task => !task.critical),
      changed: layout.changed.filter(task => !("kind" in task) || keep(task)),
    } : null,
  };
}

export type AttentionStatusSource = "status" | "account" | "thesis" | "research" | "trigger" | "underwriting" | "dispatch" | "comparison";

/** Present an authored recovery message, never a database/provider exception. */
export function safeStatusError(source: AttentionStatusSource): string {
  const messages: Record<AttentionStatusSource, string> = {
    status: "Some recorded status is unavailable. Refresh status to retry.",
    account: "Account context is unavailable. Refresh status to retry.",
    thesis: "Thesis context is unavailable. Refresh status to retry.",
    research: "Research records are unavailable. Retry the research queue.",
    trigger: "Trigger evidence is unavailable. Refresh trigger evidence to retry.",
    underwriting: "The saved analysis could not be completed. Open the underwriting task to review recovery options.",
    dispatch: "The broker dispatch receipt could not be verified. Reconcile dispatch before taking another action.",
    comparison: "The comparison request could not be confirmed. Refresh status before retrying to check whether it was recorded.",
  };
  return messages[source] ?? messages.status;
}

export function attentionContextLabel({ value, loading, failed, subject, emptyLabel }: {
  value: string | null | undefined; loading: boolean; failed: boolean; subject: string; emptyLabel: string;
}): string {
  if (value) return failed ? `${value} · refresh failed; last known value` : value;
  if (loading) return `Loading ${subject}…`;
  if (failed) return `${subject[0].toUpperCase()}${subject.slice(1)} unavailable · retry status`;
  return emptyLabel;
}

function orderHref(order: AttentionOrder) {
  const candidate = order.candidateId == null ? "" : `?candidate=${order.candidateId}`;
  return `/aperture/run/${order.runId}/execute${candidate}`;
}

function evidenceHref(task: AttentionEvidenceTask) {
  return `/aperture/run/${task.runId}?candidate=${task.candidateId}&view=evidence`;
}

/** Submission is a local lifecycle state, not a broker acceptance receipt. */
export function isAttentionDispatchUnresolved(order: Pick<AttentionOrder, "status" | "brokerOrderId" | "dispatchError">): boolean {
  return Boolean(order.dispatchError?.trim()) || (order.status === "submitted" && !order.brokerOrderId?.trim());
}

function orderMotion(order: AttentionOrder): ApertureMotionItem | null {
  if (isAttentionDispatchUnresolved(order)) return null;
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
  // A receipt can predate the first displayed baseline; it is not Seen history.
  if (prior?.capturedAt === 0 && prior.items.length === 0) prior = null;
  // A closed plan remains history, not a draft to resume. Exposure is evaluated independently.
  if (input.mission?.lifecycle === "closed") input = { ...input, mission: null, underwriting: null };
  const readState = input.checks.state === "complete" && (input.checks.asOf == null || !Number.isFinite(input.checks.asOf))
    ? "partial" : input.checks.state;
  const hasExistingWork = input.orders.some((order) => ["pending_approval", "approved", "submitted", "filled"].includes(order.status))
    || input.activePlays.length > 0
    || input.pendingReviews.length > 0;
  const needsResume = input.draft != null || input.mission?.state === "incomplete"
    || input.underwriting?.state === "not_started"
    || input.underwriting?.state === "queued"
    || input.underwriting?.state === "running"
    || input.underwriting?.state === "failed"
    || input.evidenceTasks.length > 0;
  const entryState: ApertureEntryState = hasExistingWork
    ? "check_in"
    : !input.mission && !input.draft
      ? "start"
      : needsResume
        ? "resume"
        : "check_in";

  const attention: ApertureAttentionItem[] = [];
  const updates: ApertureAttentionItem[] = [];
  if (readState === "failed") {
    attention.push(item({
      key: "status:failed",
      kind: "status_unavailable",
      priority: 98,
      stateLabel: "Status unavailable",
      title: "Current status could not be verified",
      reason: safeStatusError("status"),
      consequence: "An empty result is not treated as an all-clear. Existing records remain unchanged.",
      actionLabel: "Refresh status",
      href: "/aperture",
      updatedAt: input.now,
    }));
  } else if (readState === "partial") {
    attention.push(item({
      key: "status:partial",
      kind: "status_unavailable",
      priority: 94,
      stateLabel: "Partially available",
      title: "Some decisions cannot be verified",
      reason: safeStatusError("status"),
      consequence: "Useful unaffected records remain visible; unsupported decisions stay withheld.",
      actionLabel: "Refresh status",
      href: "/aperture",
      updatedAt: input.now,
    }));
  } else if (readState !== "complete") {
    const stale = readState === "stale";
    const loading = readState === "loading";
    attention.push(item({
      key: `status:${readState}`, kind: "status_unavailable", priority: stale ? 94 : 68,
      stateLabel: stale ? "Stale status" : loading ? "Loading status" : "Status not measured",
      title: stale ? "The last recorded status needs refreshing" : loading ? "Loading recorded work" : "No verified status is available yet",
      reason: stale ? "Current eligibility cannot be inferred from this older snapshot. Refresh status to retry." : "A usable status snapshot has not been returned. Refresh status to retry.",
      consequence: "Existing work remains unchanged. This is not an all-clear or a new analysis.",
      actionLabel: "Refresh status", href: "/aperture", updatedAt: input.now,
    }));
  }

  if (input.draft) {
    const section = input.draft.section === 1 ? "Thesis & horizon" : input.draft.section === 2 ? "Account & risk" : "Review mission";
    attention.push(item({
      key: "mission:draft", kind: "incomplete_mission", priority: 60,
      stateLabel: "Saved draft", title: `Resume ${section}`,
      reason: "An unfinished mission is saved to your account.",
      consequence: "Return to the saved section without re-entering information. No underwriting or order has been authorized by this draft.",
      actionLabel: "Resume mission setup", href: "/aperture/mission", updatedAt: input.draft.updatedAt,
    }));
  } else if (!input.mission && !hasExistingWork && readState === "complete") {
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

  if (input.underwriting?.unavailableReason) {
    attention.push(item({
      key: `underwriting:${input.underwriting.decisionRunId}`,
      kind: "underwriting_underway", priority: 65,
      stateLabel: "Objective saved · analysis unavailable",
      title: input.mission?.title ?? "Saved capital objective",
      reason: input.underwriting.unavailableReason,
      consequence: "Review the saved request. No research, allocation or order has been created.",
      actionLabel: "Review saved objective",
      href: `/aperture/decision/${input.underwriting.decisionRunId}/revision/${input.underwriting.revisionId}`,
      updatedAt: input.underwriting.updatedAt,
    }));
  } else if (input.underwriting?.state === "not_started") {
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
      reason: safeStatusError("underwriting"),
      consequence: "The last successful result remains the record. No research or order was created.",
      actionLabel: "Review underwriting failure",
      href: `/aperture/decision/${input.underwriting.decisionRunId}/revision/${input.underwriting.revisionId}/underwrite`,
      updatedAt: input.underwriting.updatedAt,
    }));
  } else if (input.underwriting?.state === "complete") {
    const noTrade = input.underwriting.outcome === "no_trade";
    const needsChoice = !noTrade && input.underwriting.selectedPlayId == null;
    (needsChoice ? attention : updates).push(item({
      key: `underwriting:${input.underwriting.decisionRunId}:complete`,
      kind: "underwriting_complete",
      priority: needsChoice ? 72 : 40,
      stateLabel: noTrade ? "Underwriting complete · No trade" : "Underwriting complete · Playbook ready",
      title: noTrade ? "Review the no-trade result" : "Review the underwriting result",
      reason: input.underwriting.resultSummary ?? (noTrade
        ? "No play cleared the recorded evidence and risk constraints."
        : "The saved mission produced a conditional playbook."),
      consequence: noTrade
        ? `${input.underwriting.reopenCondition ?? "Reassess when the recorded condition changes."} No paper ticket was created.`
        : needsChoice ? "Validate a play to enter evidence review. No paper ticket was created." : "A play selection is recorded. Its evidence and ticket status are shown separately.",
      actionLabel: noTrade ? "Review no-trade result" : "Review underwriting result",
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

  const findings = new Map<string, AttentionMonitoringFinding>();
  for (const finding of input.monitoringFindings) {
    const key = `finding:${finding.orderId}:${finding.kind}:${hashCanonical(finding.finding.trim().replace(/\s+/g, " "))}`;
    if (!findings.has(key) || findings.get(key)!.checkedAt < finding.checkedAt) findings.set(key, finding);
  }
  for (const [key, finding] of Array.from(findings.entries())) {
    const order = input.orders.find(order => order.id === finding.orderId);
    const presentation = monitoringFindingPresentation({
      check: { ...finding, flagged: true, citations: finding.citations },
      instrument: finding.instrument ?? order, rationale: finding.rationale, now: input.now,
    });
    attention.push(item({
      key,
      kind: "invalidation_evidence",
      priority: finding.kind === "invalidation" ? 100 : 92,
      symbol: finding.symbol,
      stateLabel: presentation.stateLabel,
      title: `Review ${presentation.label}`,
      reason: presentation.summary,
      consequence: presentation.implication,
      evidence: presentation.evidence,
      actionLabel: presentation.review.state === "unknown" ? "Review unresolved finding" : "Review what changed",
      href: monitoringFindingHref({ ...finding, flagged: true, citations: finding.citations }),
      updatedAt: finding.checkedAt,
    }));
  }

  for (const order of input.orders) {
    if (isAttentionDispatchUnresolved(order)) {
      const recordedFill = order.filledQty != null && Number.isFinite(order.filledQty) && order.filledQty > 0
        ? order.qty != null && Number.isFinite(order.qty) && order.qty >= order.filledQty
          ? ` Recorded quantities: ${order.filledQty} filled · ${order.qty - order.filledQty} remaining.`
          : ` Recorded filled quantity: ${order.filledQty}; remaining quantity needs reconciliation.`
        : "";
      attention.push(item({
        key: `order:${order.id}:dispatch`,
        kind: "dispatch_unresolved",
        priority: 105,
        symbol: order.symbol,
        stateLabel: "Dispatch unresolved",
        title: `Reconcile ${order.symbol} paper dispatch`,
        reason: `${order.dispatchError?.trim() ? safeStatusError("dispatch") : "Submission is recorded, but no broker order ID confirms acceptance. Reconcile the dispatch receipt."}${recordedFill}`,
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
      title: attentionReviewTitle(review.title),
      reason: "The recorded review time has arrived.",
      consequence: "This is a human checkpoint, not proof that an automatic check or exit occurred.",
      actionLabel: review.kind === "gate_review" ? "Review the exact gate" : "Review recorded outcome",
      href: review.href,
      updatedAt: review.updatedAt,
      deadlineAt: review.dueAt,
    }));
  }

  attention.sort((left, right) => right.priority - left.priority || (left.deadlineAt ?? Infinity) - (right.deadlineAt ?? Infinity) || left.key.localeCompare(right.key));
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
  ].sort((left, right) => left.key.localeCompare(right.key));

  const baselineItems = [...attention, ...updates, ...inMotion].map((record) => {
    const { updatedAt: _updatedAt, ...material } = record;
    // New check timestamps alone are not new findings; the full text/source set remains material.
    const comparable = "evidence" in material && material.evidence
      ? { ...material, href: material.href?.replace(/&finding=[^&]+&findingVersion=[^&]+/, ""), evidence: { ...material.evidence, checkedAt: 0 } } : material;
    return { key: record.key, fingerprint: attentionFingerprint(comparable) };
  });
  const baseline: ApertureAttentionBaseline = { capturedAt: input.now, items: baselineItems };
  const baselineToken = attentionBaselineToken(baseline);
  const priorMap = new Map((prior?.items ?? []).map((record) => [record.key, record.fingerprint]));
  const currentByKey = new Map([...attention, ...updates, ...inMotion].map((record) => [record.key, record]));
  const changed = prior == null
    ? [...attention, ...updates, ...inMotion]
    : baselineItems.flatMap((record) => priorMap.get(record.key) === record.fingerprint ? [] : [currentByKey.get(record.key)!]);

  const futureReviews = input.pendingReviews.filter((review) => review.dueAt > input.now).sort((left, right) => left.dueAt - right.dueAt);
  const futurePlays = input.activePlays.filter((play) => play.reviewAt != null && play.reviewAt > input.now).sort((left, right) => (left.reviewAt ?? Infinity) - (right.reviewAt ?? Infinity));
  const nextReview = futureReviews[0];
  const nextPlay = futurePlays[0];
  const noTrade = input.underwriting?.state === "complete" && input.underwriting.outcome === "no_trade" ? input.underwriting : null;
  const noTradeCondition = noTrade?.reopenCondition?.trim();
  const nextCheckpoint = nextReview && (!nextPlay || nextReview.dueAt <= (nextPlay.reviewAt ?? Infinity))
    ? { title: attentionReviewTitle(nextReview.title), detail: "Recorded human review time", at: nextReview.dueAt, href: nextReview.href }
    : nextPlay
      ? { title: `${nextPlay.symbol} review`, detail: nextPlay.detail, at: nextPlay.reviewAt ?? null, href: nextPlay.href }
      : noTrade && noTradeCondition
        ? { title: "Revisit when", detail: noTradeCondition, at: null, href: `/aperture/decision/${noTrade.decisionRunId}/revision/${noTrade.revisionId}/underwrite` }
        : input.checks.asOf == null || inMotion.length === 0
          ? null
          : { title: "Review recorded play status", detail: input.checks.monitoring === "on_demand" ? "On demand · open a play to inspect order status or request its monitoring checks" : "Scheduled checks are configured; a review date alone is not a completed check", at: null, href: "/aperture/plays" };

  const quiet = attention.length === 0 && readState === "complete";
  const time = (at: number | null | undefined) => at == null || !Number.isFinite(at) ? "not available" : new Date(at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const asOf = time(input.checks.asOf);
  const statusNote = readState === "partial"
    ? "Status is partially available. Refresh status to retry unavailable sources."
    : readState === "stale"
      ? `Last successful status is stale as of ${asOf}.`
      : readState === "failed" ? "Status refresh failed; retained records are not a current all-clear."
        : readState === "loading" ? "Loading recorded status."
          : readState === "empty" ? "No verified status snapshot is available."
            : `Status snapshot as of ${asOf}.`;
  const scopeNote = `${statusNote} Monitoring: ${input.checks.monitoring === "on_demand" ? "On demand" : "Scheduled"}. Last recorded monitoring check: ${time(input.checks.monitoringAsOf)}.`;

  return {
    entryState,
    primary: attention[0] ?? null,
    otherCritical: attention.slice(1).filter((candidate) => candidate.critical),
    otherAttention: attention.slice(1).filter((candidate) => !candidate.critical),
    readState,
    changed,
    inMotion,
    nextCheckpoint,
    changeHeading: prior == null ? "Current status" : "Changed since your last review",
    scopeNote,
    monitoringNote: input.checks.monitoring === "on_demand"
      ? "Checks run on demand. Refresh reads saved status only."
      : "Scheduled checks configured. Refresh reads saved status only.",
    quiet,
    quietMessage: quiet ? `Recorded status as of ${asOf}.` : null,
    baseline,
    baselineToken,
    sourceIssues: input.checks.issues ?? [],
  };
}

/** Persisted OCC identity is formatted, not replaced with an inferred instrument. */
export function attentionReviewTitle(title: string): string {
  return title.replace(/\b[A-Z]{1,6}\d{6}[CP]\d{8}\b/g, symbol => {
    const parsed = parseOccOptionSymbol(symbol);
    return parsed ? paperInstrumentDisplayLabel({ symbol, instrumentType: parsed.instrumentType }) : symbol;
  });
}

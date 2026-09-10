import { paperInstrumentDisplayLabel, parseOccOptionSymbol, type PaperInstrumentInput } from "./paperInstrument";

export const MONITORING_FRESHNESS_MS = 24 * 60 * 60 * 1000;
export const UNKNOWN_MONITORING_PREFIX = "UNKNOWN ·";

export type MonitoringReviewState = {
  state: "clear" | "flagged" | "unknown";
  needsReview: boolean;
  nextAction: string;
  reason: string;
};

export type MonitoringObservation = {
  finding: string | null | undefined;
  flagged: boolean;
  citations: unknown;
  checkedAt: number;
};

/** Current review tasks use the newest recorded result per check type. History
 * remains available, including failures; an older success never replaces a newer failure. */
export function partitionMonitoringHistory<T extends MonitoringObservation & { id: number; checkType: string }>(checks: readonly T[], now = Date.now()) {
  const ordered = [...checks].sort((a, b) => b.checkedAt - a.checkedAt || b.id - a.id);
  const seen = new Set<string>();
  const current: T[] = [], history: T[] = [];
  for (const check of ordered) {
    if (seen.has(check.checkType)) history.push(check);
    else { seen.add(check.checkType); current.push(check); }
  }
  const priority = (check: T) => {
    const review = monitoringReviewState(check, now);
    return hasRecordedMonitoringConcern(check) ? 2 : review.needsReview ? 1 : 0;
  };
  // A late-written routine check must not bury the finding that opened this view.
  current.sort((a, b) => priority(b) - priority(a) || b.checkedAt - a.checkedAt || b.id - a.id);
  return { current, history };
}

export type MonitoringInstrumentContext = Pick<PaperInstrumentInput, "symbol" | "instrumentType" | "underlyingSymbol" | "optionExpirationDate" | "optionStrikePriceCents">;

/** Presentation, not sentiment classification. Never infer direction or hedge intent from prose. */
export function monitoringFindingPresentation({ check, instrument, rationale, now = Date.now() }: {
  check: MonitoringObservation & { checkType?: string; symbol?: string };
  instrument?: MonitoringInstrumentContext | null;
  rationale?: string | null;
  now?: number;
}) {
  const parsed = instrument ? parseOccOptionSymbol(instrument.symbol) : null;
  const kind = instrument?.instrumentType ?? parsed?.instrumentType;
  const symbol = instrument?.underlyingSymbol ?? parsed?.underlyingSymbol ?? check.symbol ?? instrument?.symbol ?? "Selected play";
  const label = instrument && kind
    ? paperInstrumentDisplayLabel({ ...instrument, instrumentType: kind })
    : `${symbol} · instrument not recorded`;
  const checkLabel = ({ catalyst: "Catalyst", thesis_invalidation: "Invalidation", earnings: "Earnings", macro: "Market context" } as Record<string, string>)[check.checkType ?? ""] ?? "Monitoring";
  const review = monitoringReviewState(check, now);
  const expression = kind === "long_put" ? "selected put" : kind === "long_call" ? "selected call" : kind === "shares" ? "share position" : "selected play";
  const unresolved = hasRecordedMonitoringConcern(check);
  const stale = !Number.isFinite(check.checkedAt) || now - check.checkedAt > MONITORING_FRESHNESS_MS;
  const stateLabel = unresolved && stale ? "Unresolved finding · stale evidence"
    : review.state === "unknown" ? "Evidence not verified"
      : unresolved ? "Flagged finding · unresolved" : "No flagged change";
  const summary = unresolved && stale ? `${checkLabel} was previously flagged for this ${expression}. Refresh its evidence before relying on it.`
    : review.state === "unknown" ? `${checkLabel} evidence needs verification for this ${expression}.`
    : review.state === "flagged" ? `${checkLabel} check flagged a change for this ${expression}.`
      : `${checkLabel} check recorded no flagged change.`;
  const implication = kind === "long_put"
    ? "Stock outlook alone does not establish whether this put or a recorded hedge rationale still holds. Review the evidence; no automatic exit."
    : kind === "long_call"
      ? "Stock outlook alone does not establish whether this call still fits its recorded rationale. Review the evidence; no automatic exit."
      : "Compare the finding with this play’s recorded rationale and invalidation. Its effect is not verified by the flag alone; no automatic exit.";
  return { label, checkLabel, review, summary, implication, stateLabel,
    evidence: { finding: check.finding ?? "No finding recorded.", citations: validMonitoringCitations(check.citations), checkedAt: check.checkedAt, rationale: rationale?.trim() || null },
  };
}

export function validMonitoringCitations(citations: unknown): string[] {
  // SQL JSON columns can arrive decoded or serialized; neither form changes
  // the original finding record used for version identity.
  if (typeof citations === "string") {
    try { citations = JSON.parse(citations); }
    catch { return []; }
  }
  if (!Array.isArray(citations)) return [];
  return citations.filter((citation): citation is string =>
    typeof citation === "string" && /^https?:\/\//i.test(citation.trim()),
  );
}

/** Freshness does not erase a sourced concern. A provider failure is not a sourced concern. */
export function hasRecordedMonitoringConcern(observation: MonitoringObservation): boolean {
  return observation.flagged && Boolean(observation.finding?.trim())
    && !observation.finding!.trim().startsWith(UNKNOWN_MONITORING_PREFIX)
    && validMonitoringCitations(observation.citations).length > 0;
}

export function monitoringReviewState(
  observation: MonitoringObservation,
  now = Date.now(),
): MonitoringReviewState {
  if (!Number.isFinite(observation.checkedAt) || now - observation.checkedAt > MONITORING_FRESHNESS_MS) {
    return {
      state: "unknown",
      needsReview: true,
      nextAction: "Refresh sourced monitoring evidence",
      reason: hasRecordedMonitoringConcern(observation)
        ? "Monitoring evidence is stale. The previously flagged concern remains unresolved."
        : "Monitoring evidence is stale.",
    };
  }
  if (
    !observation.finding?.trim()
    || observation.finding.trim().startsWith(UNKNOWN_MONITORING_PREFIX)
    || validMonitoringCitations(observation.citations).length === 0
  ) {
    return {
      state: "unknown",
      needsReview: true,
      nextAction: "Refresh sourced monitoring evidence",
      reason: "Monitoring evidence is missing, malformed, or uncited.",
    };
  }
  if (observation.flagged) {
    return {
      state: "flagged",
      needsReview: true,
      nextAction: "Review the monitored finding",
      reason: "A sourced monitoring finding requires operator review.",
    };
  }
  return {
    state: "clear",
    needsReview: false,
    nextAction: "No monitoring review required",
    reason: "The current sourced check did not flag a finding.",
  };
}

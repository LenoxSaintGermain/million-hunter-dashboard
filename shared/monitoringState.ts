export const MONITORING_FRESHNESS_MS = 24 * 60 * 60 * 1000;
export const UNKNOWN_MONITORING_PREFIX = "UNKNOWN ·";

export type MonitoringReviewState = {
  state: "clear" | "flagged" | "unknown";
  needsReview: boolean;
  nextAction: string;
  reason: string;
};

type MonitoringObservation = {
  finding: string | null | undefined;
  flagged: boolean;
  citations: unknown;
  checkedAt: number;
};

export function validMonitoringCitations(citations: unknown): string[] {
  if (!Array.isArray(citations)) return [];
  return citations.filter((citation): citation is string =>
    typeof citation === "string" && /^https?:\/\//i.test(citation.trim()),
  );
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
      reason: "Monitoring evidence is stale.",
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

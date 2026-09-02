export type DeskCandidateState = "ready" | "active" | "expired" | "declined" | "blocked" | "failed";

export type DeskCandidateInput = {
  id: number;
  symbol: string;
  hasActiveOrder: boolean;
  catalystDeadlineAt?: number | null;
  paperStageDeclined: boolean;
  unreviewedChecks: number;
  runFailed: boolean;
};

export type DeskCandidate = DeskCandidateInput & { state: DeskCandidateState };

export type DeskCandidateSummary = {
  total: number;
  ready: number;
  active: number;
  expired: number;
  declined: number;
  blocked: number;
  failed: number;
  actionableCandidateId: number | null;
  actionableSymbol: string | null;
  label: string;
};

export function classifyDeskCandidate(input: DeskCandidateInput, now = Date.now()): DeskCandidate {
  const state: DeskCandidateState = input.hasActiveOrder
    ? "active"
    : input.runFailed
      ? "failed"
      : input.catalystDeadlineAt != null && input.catalystDeadlineAt <= now
        ? "expired"
        : input.paperStageDeclined
          ? "declined"
          : input.unreviewedChecks > 0
            ? "blocked"
            : "ready";
  return { ...input, state };
}

export function summarizeDeskCandidates(candidates: DeskCandidate[]): DeskCandidateSummary {
  const count = (state: DeskCandidateState) => candidates.filter((candidate) => candidate.state === state).length;
  const actionable = candidates.find((candidate) => candidate.state === "ready") ?? null;
  const summary = {
    total: candidates.length,
    ready: count("ready"),
    active: count("active"),
    expired: count("expired"),
    declined: count("declined"),
    blocked: count("blocked"),
    failed: count("failed"),
    actionableCandidateId: actionable?.id ?? null,
    actionableSymbol: actionable?.symbol ?? null,
  };
  const parts = [
    summary.ready ? `${summary.ready} ready` : null,
    summary.active ? `${summary.active} in motion` : null,
    summary.blocked ? `${summary.blocked} need evidence` : null,
    summary.expired ? `${summary.expired} expired` : null,
    summary.declined ? `${summary.declined} cash` : null,
    summary.failed ? `${summary.failed} interrupted` : null,
  ].filter(Boolean);
  return { ...summary, label: parts.join(" · ") || "No candidates" };
}

export function playDeskJourneyLane(summary?: DeskCandidateSummary | null): "choose" | "in_motion_only" | "backlog" {
  if (!summary || summary.total === 0) return "backlog";
  if (summary.ready > 0) return "choose";
  if (summary.active === summary.total) return "in_motion_only";
  return "backlog";
}

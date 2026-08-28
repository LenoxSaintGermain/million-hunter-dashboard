export type RunWorkspaceItem = {
  id: number;
  thesisId: number;
  thesisName?: string | null;
  status: string;
  universeCount?: number | null;
  candidateCount?: number | null;
  droppedNote?: string | null;
  paperStageDeclined?: boolean;
  createdAt: number;
};

export type ResearchJourney = {
  rootId: number;
  thesisId: number;
  thesisName: string;
  runs: RunWorkspaceItem[];
  latest: RunWorkspaceItem;
  symbolsReviewed: number;
  evidenceCandidates: number;
  remainingDeferred: number;
  state: "in_progress" | "needs_attention" | "ready_to_review" | "more_research_available" | "paper_stage_declined";
  nextLabel: string;
};

const parentRunId = (note?: string | null) => {
  const value = note?.match(/Follow-up research from run #(\d+)/i)?.[1];
  return value ? Number(value) : null;
};

const deferredCount = (note?: string | null) => Number(note?.match(/(\d+) symbols deferred/i)?.[1] ?? 0);

/**
 * A follow-up brief is a chapter of one research decision, not another item in a
 * chronological stack. This groups the persisted chain without changing storage.
 */
export function buildResearchJourneys(runs: RunWorkspaceItem[]): ResearchJourney[] {
  const byId = new Map(runs.map((run) => [run.id, run]));
  const recoveredBy = (run: RunWorkspaceItem) => {
    if (run.status !== "failed" || Number(run.candidateCount ?? 0) > 0) return null;
    return runs
      .filter((candidate) => candidate.thesisId === run.thesisId
        && Number(candidate.candidateCount ?? 0) > 0
        && Number(candidate.createdAt) > Number(run.createdAt)
        && Number(candidate.createdAt) - Number(run.createdAt) <= 8 * 60 * 60 * 1_000)
      .sort((left, right) => Number(left.createdAt) - Number(right.createdAt))[0] ?? null;
  };
  const rootFor = (run: RunWorkspaceItem): number => {
    const parentId = parentRunId(run.droppedNote);
    const parent = parentId ? byId.get(parentId) : null;
    if (parent) return rootFor(parent);
    const recovered = recoveredBy(run);
    return recovered ? rootFor(recovered) : run.id;
  };
  const grouped = new Map<number, RunWorkspaceItem[]>();
  for (const run of runs) {
    const rootId = rootFor(run);
    grouped.set(rootId, [...(grouped.get(rootId) ?? []), run]);
  }

  return Array.from(grouped.entries()).map(([rootId, journeyRuns]): ResearchJourney => {
    const ordered = [...journeyRuns].sort((left, right) => Number(left.createdAt) - Number(right.createdAt));
    const latest = ordered.at(-1)!;
    const remainingDeferred = deferredCount(latest.droppedNote);
    const active = ["queued", "compiling", "discovering", "researching", "scoring", "constructing"].includes(latest.status);
    const state: ResearchJourney["state"] = active
      ? "in_progress"
      : latest.status === "failed"
        ? "needs_attention"
        : latest.paperStageDeclined
          ? "paper_stage_declined"
        : remainingDeferred > 0
          ? "more_research_available"
          : "ready_to_review";
    const nextLabel = state === "in_progress"
      ? "View live research"
      : state === "needs_attention"
        ? "Review interruption"
        : state === "paper_stage_declined"
          ? "Review declined paper stage"
        : state === "more_research_available"
          ? `Research next ${Math.min(12, remainingDeferred)} symbols`
          : "Review final decision";
    return {
      rootId,
      thesisId: latest.thesisId,
      thesisName: latest.thesisName ?? `Thesis #${latest.thesisId}`,
      runs: ordered,
      latest,
      symbolsReviewed: ordered.reduce((total, run) => total + (Number(run.candidateCount ?? 0) > 0 ? Number(run.universeCount ?? 0) : 0), 0),
      evidenceCandidates: ordered.reduce((total, run) => total + Number(run.candidateCount ?? 0), 0),
      remainingDeferred,
      state,
      nextLabel,
    };
  }).sort((left, right) => Number(right.latest.createdAt) - Number(left.latest.createdAt));
}

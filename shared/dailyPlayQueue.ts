import type { PlayReadiness } from "./playRecipe";

export type DailyQueueItem<T> = {
  item: T;
  readiness: PlayReadiness;
  catalystDeadlineAt: number | null | undefined;
};

function readinessWeight(readiness: PlayReadiness) {
  return readiness === "ready_to_prepare" ? 0 : readiness === "needs_risk_plan" ? 1 : 2;
}

/**
 * The trader queue is operational ordering, not a prediction: a play that is
 * further through its decision gates appears before one that is blocked, and
 * otherwise the nearest still-live catalyst is considered first. Composite
 * thesis-fit scores intentionally never participate.
 */
export function orderDailyPlayQueue<T extends { readiness: PlayReadiness; catalystDeadlineAt: number | null | undefined }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const readinessDelta = readinessWeight(left.readiness) - readinessWeight(right.readiness);
    if (readinessDelta !== 0) return readinessDelta;
    return (left.catalystDeadlineAt ?? Number.MAX_SAFE_INTEGER) - (right.catalystDeadlineAt ?? Number.MAX_SAFE_INTEGER);
  });
}

export function researchCoverageLabel(score: number | null | undefined, openChecks: number) {
  const scoreLabel = score == null ? "not measured" : `${Math.round(score * 100)}/100`;
  const checkLabel = openChecks === 0
    ? "required checks recorded"
    : `${openChecks} decision-critical check${openChecks === 1 ? "" : "s"} open`;
  return `Research coverage ${scoreLabel} · ${checkLabel}`;
}

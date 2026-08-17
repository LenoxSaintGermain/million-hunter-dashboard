export const ACTIVE_RUN_STATUSES = ["queued", "compiling", "discovering", "researching", "scoring", "constructing"] as const;
// A 45-security, four-pass research universe can legitimately take several
// minutes. Reserve recovery for a true loss of progress rather than a long but
// healthy run; each individual Sonar request remains independently bounded.
export const STALE_RUN_AFTER_MS = 10 * 60_000;
export const INITIAL_BRIEF_MAX_SYMBOLS = 12;
export const INTRADAY_BRIEF_MAX_SYMBOLS = 8;

export type RecoverableRun = {
  status: string;
  startedAt: number | null;
  completedAt?: number | null;
};

/** A run that survives a process restart must become actionable, never invisible. */
export function isRunStale(run: RecoverableRun, now = Date.now()): boolean {
  return ACTIVE_RUN_STATUSES.includes(run.status as typeof ACTIVE_RUN_STATUSES[number])
    && run.startedAt != null
    && !run.completedAt
    && now - Number(run.startedAt) > STALE_RUN_AFTER_MS;
}

/**
 * A first brief should help an operator decide what to inspect next, not launch
 * an unbounded multi-minute research batch. Intraday work leads with the two
 * evidence passes that can change an event-driven decision; macro context is
 * collected separately at the run level.
 */
export function buildBriefResearchPlan<T>(items: T[], holdingPeriod?: string) {
  const intraday = holdingPeriod === "intraday";
  const limit = intraday ? INTRADAY_BRIEF_MAX_SYMBOLS : INITIAL_BRIEF_MAX_SYMBOLS;
  return {
    items: items.slice(0, limit),
    deferredCount: Math.max(0, items.length - limit),
    passes: intraday ? (["catalyst", "technical"] as const) : undefined,
  };
}

/** Calculates the next unseen universe index for a traceable bounded follow-up. */
export function nextFollowUpOffset(run: { droppedNote?: string | null; universeCount?: number | null }) {
  const priorOffset = Number(run.droppedNote?.match(/research offset (\d+)/i)?.[1] ?? 0);
  return priorOffset + Math.max(0, Number(run.universeCount ?? 0));
}

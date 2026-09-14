/** A saved-price comparison, never an execution eligibility or sizing authority. */
export interface CandidateAffordability {
  state: "above_limit" | "within_reference" | "unknown" | "options_required";
  referencePriceCents: number | null;
  ceilingCents: number | null;
  asOf: number | null;
  sourceName: string | null;
  accountAsOf: number | null;
  /**
   * When the reference price is above the ceiling, what would admit one share —
   * stated so the operator is not left to infer it. Arithmetic from the recorded
   * policy and price, never a recommendation to change either. Null otherwise,
   * and null for whichever input is not the binding one.
   */
  requiredEquityCents: number | null;
  requiredCapitalCents: number | null;
}

/**
 * When every candidate in a completed run is priced above the ceiling, the
 * operator is looking at a universe they cannot act on. Saying that once, with
 * the figure that would change it, is the difference between one clear fact and
 * N separate dead ends discovered one candidate at a time.
 *
 * Returns null unless the run is measured AND entirely blocked: a single
 * affordable candidate means there is a path, and this must stay quiet. A run
 * with any unmeasured price is not a proven dead end either.
 */
export function runAffordabilitySummary(
  candidates: ReadonlyArray<{ affordability?: CandidateAffordability | null }>,
  /** What this research actually compared. Only "shares" is a whole-share price. */
  instrumentPreference?: string | null,
): {
  blocked: number; cheapestRequiredEquityCents: number | null; ceilingCents: number | null;
  /** True when the run compared whole shares only, so the instrument preference
   *  is an input the operator controls that this banner has not accounted for. */
  sharesOnly: boolean;
} | null {
  const states = candidates.map((candidate) => candidate.affordability);
  if (!states.length || states.some((value) => value == null)) return null;
  const measured = states as CandidateAffordability[];
  if (!measured.every((value) => value.state === "above_limit")) return null;
  const required = measured
    .map((value) => value.requiredEquityCents)
    .filter((value): value is number => value != null && Number.isFinite(value));
  return {
    blocked: measured.length,
    cheapestRequiredEquityCents: required.length ? Math.min(...required) : null,
    ceilingCents: measured[0]!.ceilingCents,
    sharesOnly: instrumentPreference === "shares",
  };
}

/**
 * Actionable names first, without pretending they are better research.
 *
 * The research-fit order is a judgement about evidence; affordability is a fact
 * about the account. Reordering silently would let a weaker candidate read as
 * the brief lead, so this returns the grouping explicitly and preserves the
 * incoming research order within each group. Callers must label it.
 */
export function orderByActionability<T extends { affordability?: CandidateAffordability | null }>(
  candidates: readonly T[],
): { ordered: T[]; actionable: number; blocked: number; unmeasured: number; reordered: boolean } {
  const rank = (candidate: T) => {
    const state = candidate.affordability?.state;
    if (state === "within_reference") return 0;
    if (state === "above_limit") return 2;
    return 1; // unknown or options_required: not proven either way, so mid.
  };
  const ordered = candidates
    .map((candidate, index) => ({ candidate, index, rank: rank(candidate) }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((entry) => entry.candidate);
  const counts = { actionable: 0, blocked: 0, unmeasured: 0 };
  for (const candidate of candidates) {
    const state = candidate.affordability?.state;
    if (state === "within_reference") counts.actionable += 1;
    else if (state === "above_limit") counts.blocked += 1;
    else counts.unmeasured += 1;
  }
  return {
    ordered, ...counts,
    reordered: ordered.some((candidate, index) => candidate !== candidates[index]),
  };
}

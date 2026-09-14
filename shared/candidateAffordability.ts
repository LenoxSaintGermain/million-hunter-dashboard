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
): { blocked: number; cheapestRequiredEquityCents: number | null; ceilingCents: number | null } | null {
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
  };
}

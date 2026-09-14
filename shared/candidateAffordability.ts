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

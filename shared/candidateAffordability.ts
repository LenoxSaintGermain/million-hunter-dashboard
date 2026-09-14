/** A saved-price comparison, never an execution eligibility or sizing authority. */
export interface CandidateAffordability {
  state: "above_limit" | "within_reference" | "unknown" | "options_required";
  referencePriceCents: number | null;
  ceilingCents: number | null;
  asOf: number | null;
  sourceName: string | null;
  accountAsOf: number | null;
}

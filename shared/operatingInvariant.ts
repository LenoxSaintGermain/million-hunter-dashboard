/**
 * The workspace invariant, stated once.
 *
 * Every attention card used to restate it — "human review; no automatic check
 * or exit", "no automatic exit", "no order is created" — so the same sentence
 * appeared three or four times in one viewport and pushed the decision down.
 * The claim is true and must stay visible, but it is a property of the whole
 * workspace, not of each row.
 */
export const OPERATING_INVARIANT = "All actions require human authorization. Nothing here checks, orders or exits automatically.";

/**
 * Consequences the banner above already covers in full, matched exactly.
 *
 * Exact strings only, never keywords: a new or unknown consequence must keep
 * its own line, and classifying warnings by keyword is how a specific one gets
 * silently swallowed. Adding to this set is a deliberate act — the sentence
 * must say nothing the banner does not already say.
 */
export const ROUTINE_CONSEQUENCES = new Set<string>([
  "This is a human checkpoint, not proof that an automatic check or exit occurred.",
  "Stock outlook alone does not establish whether this put or a recorded hedge rationale still holds. Review the evidence; no automatic exit.",
  "Stock outlook alone does not establish whether this call still fits its recorded rationale. Review the evidence; no automatic exit.",
  "Compare the finding with this play’s recorded rationale and invalidation. Its effect is not verified by the flag alone; no automatic exit.",
]);

/** True when the row may omit its consequence because the banner states it. */
export function coveredByInvariant(consequence: string | null | undefined): boolean {
  return typeof consequence === "string" && ROUTINE_CONSEQUENCES.has(consequence.trim());
}

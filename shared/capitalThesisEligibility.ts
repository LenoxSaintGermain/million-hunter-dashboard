export type CapitalThesisIdentity = {
  templateUsed?: unknown;
};

/**
 * A Capital thesis is identified by its immutable canonical type. Account
 * pointers select among eligible theses; they never grant eligibility.
 */
export function isCapitalThesisEligible(thesis: CapitalThesisIdentity) {
  return thesis.templateUsed === "capital_trade";
}

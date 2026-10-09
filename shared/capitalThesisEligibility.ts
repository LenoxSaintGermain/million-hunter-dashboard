export type CapitalThesisIdentity = {
  templateUsed?: unknown;
};

/**
 * A Capital thesis is identified by its immutable canonical type. Account
 * pointers select among eligible theses; they never grant eligibility.
 */
export function isCapitalThesisEligible(thesis: CapitalThesisIdentity) {
  return isCapitalTemplateId(thesis.templateUsed);
}

/**
 * Canonical Capital thesis types. `capital_weekly_income` (#83) is a Capital
 * thesis with a strategy template; it is eligible everywhere `capital_trade` is.
 */
export const CAPITAL_TEMPLATE_IDS = ["capital_trade", "capital_weekly_income"] as const;
export type CapitalTemplateId = (typeof CAPITAL_TEMPLATE_IDS)[number];

export function isCapitalTemplateId(templateUsed: unknown): templateUsed is CapitalTemplateId {
  return typeof templateUsed === "string" && (CAPITAL_TEMPLATE_IDS as readonly string[]).includes(templateUsed);
}

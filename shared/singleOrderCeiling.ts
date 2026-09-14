/**
 * What a declared capital figure implies for a single order, said at the moment
 * it is declared rather than discovered later.
 *
 * A fresh operator declared $2,000, researched a refiner thesis, and only found
 * out at the evidence stage that the 5% single-name limit capped a single order
 * at $100 — below every candidate in their own universe. The policy was right
 * and clearly explained; it was explained too late to act on.
 *
 * This states the arithmetic consequence of the operator's own number. It is not
 * a recommendation to deploy more, it does not raise anything, and it makes no
 * claim about what any particular name costs.
 *
 * PURE. The ceiling itself is computed server-side from the authoritative
 * mandate — this module only decides what the numbers mean and how to say it,
 * because the objective flow deliberately keeps sizing math off the client.
 */

export interface SingleOrderCeilingPreview {
  /** The lower of the account policy allowance and the declared capital. */
  ceilingCents: number | null;
  /** Which input produced the ceiling. Null when it cannot be computed. */
  binding: "account_policy" | "declared_capital" | "equal" | null;
  policyCeilingCents: number | null;
  policyPctOfEquity: number | null;
  equityCents: number | null;
  declaredCapitalCents: number | null;
  /** Why no ceiling can be stated. Null when one can. */
  unavailableReason: string | null;
}

const finite = (value: number | null | undefined): number | null =>
  value != null && Number.isFinite(value) ? value : null;

export function buildSingleOrderCeilingPreview(input: {
  /** Already computed with the authoritative mandate. */
  policyCeilingCents: number | null;
  policyPctOfEquity: number | null;
  equityCents: number | null;
  declaredCapitalCents: number | null;
}): SingleOrderCeilingPreview {
  const policyCeilingCents = finite(input.policyCeilingCents);
  const declaredCapitalCents = finite(input.declaredCapitalCents);
  const base: SingleOrderCeilingPreview = {
    ceilingCents: null, binding: null,
    policyCeilingCents, policyPctOfEquity: finite(input.policyPctOfEquity),
    equityCents: finite(input.equityCents), declaredCapitalCents,
    unavailableReason: null,
  };

  if (declaredCapitalCents == null || declaredCapitalCents <= 0) {
    return { ...base, unavailableReason: "No capital has been declared yet, so no single-order ceiling can be stated." };
  }
  if (policyCeilingCents == null || policyCeilingCents <= 0) {
    return { ...base, unavailableReason: "The account has no measured equity, so the policy allowance cannot be computed. Sync the account to state a ceiling." };
  }

  const ceilingCents = Math.floor(Math.min(policyCeilingCents, declaredCapitalCents));
  return {
    ...base,
    ceilingCents,
    binding: policyCeilingCents === declaredCapitalCents ? "equal"
      : policyCeilingCents < declaredCapitalCents ? "account_policy" : "declared_capital",
  };
}

const dollars = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * One sentence of consequence, then one of cause. Says what cannot be acted on,
 * never what the operator should do about it.
 */
export function describeSingleOrderCeiling(preview: SingleOrderCeilingPreview): string {
  if (preview.unavailableReason || preview.ceilingCents == null) {
    return preview.unavailableReason ?? "No single-order ceiling can be stated.";
  }
  const cap = `This caps a single order at ${dollars(preview.ceilingCents)}. A name priced above that cannot be taken as a whole share.`;
  if (preview.binding === "declared_capital") {
    return `${cap} Your declared capital is the binding limit here, not account policy.`;
  }
  const pct = preview.policyPctOfEquity != null && preview.equityCents != null
    ? ` ${preview.policyPctOfEquity}% of ${dollars(preview.equityCents)} equity = ${dollars(preview.policyCeilingCents!)} per order.`
    : "";
  return `${cap} Account policy is the binding limit here.${pct}`;
}

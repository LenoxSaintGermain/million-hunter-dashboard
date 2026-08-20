/**
 * Decimal form fields are deliberately parsed at the proposal boundary.  `Number("")`
 * equals zero in JavaScript, which must never manufacture a price level for a paper
 * trade recipe.  Use the positive parser for entry, stop, and risk budget; only
 * slippage can legitimately be zero.
 */
export function dollarsToCents(value: string, options: { allowZero?: boolean } = {}): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const dollars = Number(trimmed);
  const floor = options.allowZero ? 0 : Number.EPSILON;
  if (!Number.isFinite(dollars) || dollars < floor) return null;
  return Math.round(dollars * 100);
}

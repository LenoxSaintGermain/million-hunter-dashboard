/**
 * Mark and basis line for a Play Desk row (Refs #115). Prices keep their
 * cents, option prices name their unit (per share and per 100-share
 * contract), and a missing or zero mark reads "Not measured", never "$0".
 */
const usd = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);

function priced(cents: number | null | undefined, isOption: boolean, multiplier: number): string {
  if (cents == null || !Number.isFinite(cents) || cents <= 0) return "Not measured";
  return isOption ? `${usd(cents)}/sh (${usd(cents * multiplier)}/contract)` : usd(cents);
}

export function markBasisLabel(input: { lastPriceCents?: number | null; avgCostCents?: number | null; isOption: boolean; contractMultiplier?: number | null }): string {
  const multiplier = input.contractMultiplier && input.contractMultiplier > 0 ? input.contractMultiplier : 100;
  return `Mark ${priced(input.lastPriceCents, input.isOption, multiplier)} · Basis ${priced(input.avgCostCents, input.isOption, multiplier)}`;
}

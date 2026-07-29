/**
 * Nominal-price guard, shared by the scorer and every display surface.
 *
 * Auction and placeholder listings carry headline prices like $1 or $100. The
 * scorer already refuses to compute a basis ratio from them; without this the
 * UI would still print "ASKING $1" as though it were a real acquisition basis,
 * so the model and the screen would disagree in public.
 */
export const NOMINAL_PRICE_FLOOR = 50_000;

export function isNominalPrice(price: number | null | undefined): boolean {
  return price != null && price > 0 && price < NOMINAL_PRICE_FLOOR;
}

/** Money formatter used across dossier, cards, and the public share card. */
export function fmtMoneyRaw(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
  return `$${Math.round(n)}`;
}

/**
 * How an asking price should read.
 *  - no price          → "Unpriced"
 *  - nominal/auction   → "Auction · $1 opening" (never presented as a basis)
 *  - real price        → formatted money
 */
export function formatAskingPrice(price: number | null | undefined): {
  display: string;
  nominal: boolean;
  hint?: string;
} {
  if (price == null || price === 0) {
    return { display: "Unpriced", nominal: false, hint: "No asking price on record" };
  }
  if (isNominalPrice(price)) {
    return {
      display: "Auction",
      nominal: true,
      hint: `Opening bid ${fmtMoneyRaw(price)} — nominal, not an acquisition basis`,
    };
  }
  return { display: fmtMoneyRaw(price), nominal: false };
}

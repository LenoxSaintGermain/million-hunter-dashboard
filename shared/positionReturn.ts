/**
 * Mark-to-market return for one open position.
 *
 * The only input this module trusts is a broker-reported mark: quantity, average
 * entry cost, current price and market value, each carrying the timestamp and
 * source under which the broker asserted them. Nothing here estimates a price,
 * carries one forward, or substitutes a fill price for a current one. When an
 * input is missing the function refuses and says which one — a return figure in
 * a trading surface is worth less than nothing if the operator cannot tell
 * whether it was measured or inferred.
 *
 * The arithmetic never multiplies by a contract multiplier. `marketValueCents /
 * lastPriceCents` already equals quantity times whatever multiplier the contract
 * actually carries, so cost basis can be derived without assuming 100 shares per
 * option — an assumption that is wrong for every adjusted contract.
 */

/** How long a connected broker mark counts as current. Matches the
 *  `execution_account_freshness` gate in server/aperture/orderFlow.ts. */
export const MARK_FRESHNESS_MS = 15 * 60_000;

export interface PositionMark {
  qty: number | null;
  avgCostCents: number | null;
  lastPriceCents: number | null;
  marketValueCents: number | null;
  /** A price with no timestamp and no source is not a fact. Both are required. */
  priceAsOf: number | null;
  priceSource: string | null;
}

export interface MeasuredPositionReturn {
  measured: true;
  /** Unrealized profit or loss at the recorded mark, in cents. */
  pnlCents: number;
  /** Return on cost basis, in percent. Null when cost basis is zero. */
  returnPct: number | null;
  costBasisCents: number;
  marketValueCents: number;
  markAsOf: number;
  markSource: string;
  /** True when the mark is older than MARK_FRESHNESS_MS. The figure is still
   *  shown — it was really measured — but it is not current. */
  stale: boolean;
}

export interface UnmeasuredPositionReturn {
  measured: false;
  /** Plain-language statement of what is missing. Shown to the operator. */
  reason: string;
}

export type PositionReturn = MeasuredPositionReturn | UnmeasuredPositionReturn;

const finite = (value: number | null | undefined): number | null =>
  value != null && Number.isFinite(value) ? value : null;

export function computePositionReturn(mark: PositionMark | null | undefined, now: number): PositionReturn {
  if (!mark) return { measured: false, reason: "No open position is recorded at the broker for this play." };

  const qty = finite(mark.qty);
  if (qty === 0) return { measured: false, reason: "The broker reports no remaining quantity in this position." };

  const asOf = finite(mark.priceAsOf);
  const source = mark.priceSource?.trim();
  if (asOf == null || !source) {
    return { measured: false, reason: "The recorded price carries no timestamp or source, so it is not a fact." };
  }

  const marketValueCents = finite(mark.marketValueCents);
  const lastPriceCents = finite(mark.lastPriceCents);
  const avgCostCents = finite(mark.avgCostCents);
  if (marketValueCents == null) return { measured: false, reason: "The broker did not report a market value for this position." };
  if (lastPriceCents == null || lastPriceCents === 0) return { measured: false, reason: "The broker did not report a current price, so no mark can be taken." };
  if (avgCostCents == null) return { measured: false, reason: "No entry cost is recorded for this position, so return cannot be measured." };

  // marketValue / lastPrice === quantity × contract multiplier, whatever that
  // multiplier is. Deriving cost basis through it keeps options, adjusted
  // contracts and shares on one code path with no multiplier assumed.
  const costBasisCents = Math.round((marketValueCents / lastPriceCents) * avgCostCents);
  const pnlCents = Math.round(marketValueCents - costBasisCents);

  return {
    measured: true,
    pnlCents,
    returnPct: costBasisCents === 0 ? null : (pnlCents / Math.abs(costBasisCents)) * 100,
    costBasisCents,
    marketValueCents,
    markAsOf: asOf,
    markSource: source,
    stale: now - asOf > MARK_FRESHNESS_MS,
  };
}

export interface DeskReturnInput {
  status: string;
  latestMark?: PositionMark | null;
  /** True when the marks read itself failed. Distinguishes "we could not look"
   *  from "the broker reports no position", which mean opposite things. */
  markSourceUnavailable?: boolean;
}

/**
 * Return for one desk row. An order with no recorded fill has nothing to mark,
 * and saying so is not the same as saying the position is flat.
 */
export function deskOrderReturn(order: DeskReturnInput, now: number): PositionReturn {
  if (order.markSourceUnavailable) {
    return { measured: false, reason: "Broker position marks are unavailable, so return cannot be shown." };
  }
  if (order.status !== "filled") {
    return { measured: false, reason: "No fill is recorded, so there is nothing to mark." };
  }
  return computePositionReturn(order.latestMark ?? null, now);
}

/** Signed money, e.g. `+$41.00` / `−$12.50`. The sign is carried by the prefix
 *  so the figure reads correctly without colour. */
export const formatSignedCents = (cents: number): string =>
  `${cents > 0 ? "+" : cents < 0 ? "−" : ""}$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const signedDollars = formatSignedCents;

/** Headline figure, e.g. `+$41.00`. Callers render the refusal reason instead
 *  when the return is not measured. */
export function formatReturnAmount(result: MeasuredPositionReturn): string {
  return signedDollars(result.pnlCents);
}

/** Percent beside the headline, e.g. `+7.9%`. Null when cost basis is zero. */
export function formatReturnPercent(result: MeasuredPositionReturn): string | null {
  if (result.returnPct == null) return null;
  const pct = result.returnPct;
  return `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct).toFixed(1)}%`;
}

/** Provenance line. Every displayed figure states when and from where. */
export function formatMarkProvenance(result: MeasuredPositionReturn, locale?: string): string {
  const at = new Date(result.markAsOf).toLocaleString(locale ?? "en-US", { dateStyle: "medium", timeStyle: "short" });
  return `${result.stale ? "Stale mark" : "Mark"} ${at} · ${result.markSource}`;
}

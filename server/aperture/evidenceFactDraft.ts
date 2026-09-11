import type { SecurityFact } from "../../drizzle/schema";

/**
 * Every number a price-multiple check needs is already a verified fact in the
 * ledger, yet the evidence form asked the operator to retype all of it — five
 * fields per check, twenty checks on a ten-candidate run. This drafts the
 * source record from those facts instead.
 *
 * It drafts evidence; it never answers the gate. The verdict stays a human
 * action, and a draft is refused outright when an input is missing rather than
 * filled with an assumption.
 */

export type EvidenceDraft = {
  available: true;
  criterionKey: "price_earnings" | "price_sales";
  observedValue: string;
  observedAt: string;
  criterion: string;
  sourceUrl: string | null;
  conclusion: string;
  /** Set when the inputs disagree with each other badly enough to distrust. */
  plausibilityWarning: string | null;
};
export type EvidenceDraftUnavailable = { available: false; reason: string };

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function pick(facts: SecurityFact[], key: string) {
  return facts.find(f => f.factKey === key && f.basis !== "unknown" && f.valueNum != null) ?? null;
}

function criterionOf(checkLabel: string): EvidenceDraft["criterionKey"] | null {
  const t = checkLabel.toLowerCase();
  if (/price\s*\/\s*earnings|p\/e\b/.test(t)) return "price_earnings";
  if (/price\s*\/\s*sales|p\/s\b/.test(t)) return "price_sales";
  return null;
}

/**
 * A recorded revenue far below the market capitalisation it is divided into
 * produces a plausible-looking multiple from a misparsed filing. Two such facts
 * were found in production on 2026-09-10. Flag rather than silently divide.
 */
function impliedRevenueLooksWrong(marketCapUsd: number, revenueUsd: number) {
  return revenueUsd > 0 && marketCapUsd / revenueUsd > 10;
}

export function buildEvidenceFactDraft(args: {
  symbol: string;
  checkLabel: string;
  facts: SecurityFact[];
  now?: number;
}): EvidenceDraft | EvidenceDraftUnavailable {
  const { symbol, checkLabel, facts } = args;
  const criterionKey = criterionOf(checkLabel);
  if (!criterionKey) return { available: false, reason: `No ledger computation is defined for "${checkLabel}". Record this evidence by hand.` };

  const price = pick(facts, "last_price");
  const shares = pick(facts, "shares_outstanding");
  if (!price) return { available: false, reason: `No unexpired last price is recorded for ${symbol}, so no market capitalisation can be derived.` };
  if (!shares) return { available: false, reason: `No shares outstanding fact is recorded for ${symbol}, so no market capitalisation can be derived.` };

  const marketCap = price.valueNum! * shares.valueNum!;
  const denomKey = criterionKey === "price_earnings" ? "net_income_ttm" : "revenue_ttm";
  const denomLabel = criterionKey === "price_earnings" ? "net income TTM" : "revenue TTM";
  const denom = pick(facts, denomKey);
  if (!denom) return { available: false, reason: `No ${denomLabel} fact is recorded for ${symbol}. This check cannot be computed from the ledger.` };
  if (denom.valueNum! <= 0) return { available: false, reason: `Recorded ${denomLabel} for ${symbol} is not positive, so this multiple is not meaningful.` };

  const ratio = marketCap / denom.valueNum!;
  const label = criterionKey === "price_earnings" ? "P/E" : "P/S";
  const sourceName = denom.sourceName ?? denom.providerId ?? "recorded source";
  const warning = criterionKey === "price_sales" && impliedRevenueLooksWrong(marketCap, denom.valueNum!)
    ? `The recorded revenue of ${money(denom.valueNum!)} implies a ${label} of ${ratio.toFixed(2)}, which is far outside a normal range and suggests the filing figure was misparsed. Verify the revenue fact before answering this gate.`
    : null;

  return {
    available: true,
    criterionKey,
    observedValue: `${label} ${ratio.toFixed(2)}`,
    observedAt: isoDay(price.asOf ?? price.fetchedAt ?? args.now ?? Date.now()),
    criterion: `Computed from the fact ledger, not read from a sourced ${label} fact. Market cap = last price ${money(price.valueNum!)} x ${Math.round(shares.valueNum!).toLocaleString("en-US")} shares = ${money(marketCap)}; divided by ${denomLabel} ${money(denom.valueNum!)} (${sourceName}).`,
    sourceUrl: denom.sourceUrl ?? price.sourceUrl ?? null,
    conclusion: warning
      ?? `Price is ${price.basis} as of ${isoDay(price.asOf ?? price.fetchedAt ?? Date.now())}; ${denomLabel} is ${denom.basis}${denom.asOf ? ` as of ${isoDay(denom.asOf)}` : ""}. This records the computation and its inputs only. Whether ${ratio.toFixed(2)}x supports the thesis at this valuation is the operator's determination on this gate.`,
    plausibilityWarning: warning,
  };
}

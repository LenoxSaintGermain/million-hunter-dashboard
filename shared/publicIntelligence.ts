/** Empty is a validated success, never a failure. Cache hits preserve timestamps.
 * fetchedAt: last successful fetch; attemptedAt: latest upstream attempt.
 * FX data.date is the reference-rate date. Stale empty data is not a current finding.
 */
export interface FeedResult<T> {
  status: "ok" | "empty" | "unavailable" | "stale";
  data: T | null;
  source: string;
  sourceUrl: string;
  fetchedAt: string | null;
  attemptedAt: string;
  message: string | null;
}
export interface MacroOddMarket {
  id: string; question: string; slug: string;
  probabilityPct: number | null; outcomeLabel: string | null;
  outcomes: string[]; prices: string[]; volume: number | null;
  endDate?: string; url: string;
  /** Provider flags; null means unknown. Explicitly closed/inactive markets are excluded. */
  active: boolean | null; closed: boolean | null;
}
export interface MacroOddEvent { id: string; title: string; slug: string; category: string; markets: MacroOddMarket[] }
export interface TrademarkRecord {
  serialNumber: string; wordMark: string; statusCode: string | null; statusLabel: string | null;
  ownerName: string | null; goodsServices: string | null; filingDate: string | null;
}
export interface FederalContractor { recipientName: string; uei: string | null; duns: string | null; recipientLevel: string | null }
export interface SecCompanyMatch { cik: string; ticker: string; title: string }
export interface FxRatesResult { base: string; date: string; rates: Record<string, number> }

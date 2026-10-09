/**
 * Broad-index ETFs exempt from the Weekly Income earnings blackout.
 *
 * Why: a fund that holds dozens to thousands of companies does not report
 * earnings itself, so "skip if the earnings date is unknown" would skip these
 * funds forever. Single stocks keep the skip-if-unknown rule.
 *
 * The rule for being on this list (owner-reviewable, keep it short and explicit):
 * - tracks a broad US equity index of at least 30 large companies;
 * - is not a sector, thematic, leveraged, inverse, single-country or bond fund;
 * - has deep, listed options (the screen still requires weekly expirations,
 *   OPRA quotes and every liquidity filter; being listed here only lifts the
 *   earnings rule).
 *
 * The ex-dividend blackout still applies to every fund on this list, and an
 * unknown ex-dividend date excludes the fund (same fail-closed rule as before).
 * Residual risk, stated: a very large holding (e.g. a top Nasdaq-100 name)
 * reporting during the week can still move the fund.
 */
export type IndexEtfExemption = { symbol: string; index: string; holdings: string };

export const WI_EARNINGS_EXEMPT_INDEX_ETFS: readonly IndexEtfExemption[] = Object.freeze([
  { symbol: "SPY", index: "S&P 500", holdings: "about 500 large US companies" },
  { symbol: "IVV", index: "S&P 500", holdings: "about 500 large US companies" },
  { symbol: "VOO", index: "S&P 500", holdings: "about 500 large US companies" },
  { symbol: "VTI", index: "CRSP US Total Market Index", holdings: "thousands of US companies" },
  { symbol: "QQQ", index: "Nasdaq-100", holdings: "about 100 large Nasdaq-listed companies" },
  { symbol: "IWM", index: "Russell 2000", holdings: "about 2,000 smaller US companies" },
  { symbol: "DIA", index: "Dow Jones Industrial Average", holdings: "30 large US companies" },
]);

export function earningsExemptIndexEtf(symbol: string): IndexEtfExemption | null {
  const upper = symbol.trim().toUpperCase();
  return WI_EARNINGS_EXEMPT_INDEX_ETFS.find((etf) => etf.symbol === upper) ?? null;
}

/** Quick Play one-liner: why this fund is allowed without an earnings date. */
export function indexEtfAllowedNote(etf: IndexEtfExemption): string {
  return `${etf.symbol} is a fund that tracks the ${etf.index} (${etf.holdings}). Funds don't report earnings, so the earnings rule doesn't apply; the dividend-date rule still does.`;
}

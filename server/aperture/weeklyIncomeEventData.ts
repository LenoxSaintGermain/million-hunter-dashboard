/**
 * Weekly Income event data (#84/#85): read-only GETs for the screen.
 *
 * - Earnings (single stocks): Benzinga's calendar, only when the deploy already
 *   has BENZINGA_API_KEY. Queried forward from the entry date and sorted
 *   ascending, so the record is the *next* report rather than the latest past
 *   one. No key, or a failed call, means unknown (the name is skipped).
 * - Ex-dividend (allowlisted index ETFs): Alpaca corporate-action cash
 *   dividends, using the Alpaca market-data credentials the screen already uses.
 *
 * Nothing here writes, places orders, or reads secrets beyond the existing env.
 */
import { httpJson } from "./providers/types";
import { alpacaDataHeaders } from "./providers/marketData";
import type { CorporateActionDividend, EarningsRecord } from "./weeklyIncomeEventWindows";

type FetchJson = <T = any>(url: string, opts?: { timeoutMs?: number; headers?: Record<string, string> }) => Promise<T | null>;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** Days ahead to look for the next report. A name with nothing scheduled in this range stays "unknown". */
export const EARNINGS_LOOKAHEAD_DAYS = 120;

export function benzingaConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.BENZINGA_API_KEY);
}

export async function fetchUpcomingEarnings(
  symbol: string,
  fromDateEt: string,
  deps: { fetchJson?: FetchJson; apiKey?: string | undefined; timeoutMs?: number } = {},
): Promise<EarningsRecord[] | null> {
  const key = "apiKey" in deps ? deps.apiKey : process.env.BENZINGA_API_KEY;
  if (!key || !DATE.test(fromDateEt)) return null;
  const fetchJson = deps.fetchJson ?? httpJson;
  const upper = symbol.toUpperCase();
  const url = "https://api.benzinga.com/api/v2.1/calendar/earnings"
    + `?token=${encodeURIComponent(key)}`
    + `&parameters[tickers]=${encodeURIComponent(upper)}`
    + `&parameters[date_from]=${fromDateEt}`
    + `&parameters[date_to]=${addDays(fromDateEt, EARNINGS_LOOKAHEAD_DAYS)}`
    + "&parameters[date_sort]=date:asc&pagesize=10";
  const data = await fetchJson<{ earnings?: Array<{ date?: string; ticker?: string; time?: string }> }>(url, { timeoutMs: deps.timeoutMs ?? 10_000 });
  if (data == null) return null;
  return (data.earnings ?? [])
    .filter((row) => typeof row.date === "string" && DATE.test(row.date) && row.date >= fromDateEt && (!row.ticker || row.ticker.toUpperCase() === upper))
    .map((row) => ({ symbol: upper, date: row.date!, timing: "unknown" as const, source: "benzinga" as const, sourceUrl: `https://www.benzinga.com/quote/${encodeURIComponent(upper)}`, recordedAt: null }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Cash dividends for one symbol whose process date falls in [start, end]. Null when unreadable. */
export async function fetchCashDividends(
  symbol: string,
  startDate: string,
  endDate: string,
  deps: { fetchJson?: FetchJson; headers?: Record<string, string> | null; timeoutMs?: number } = {},
): Promise<CorporateActionDividend[] | null> {
  const headers = "headers" in deps ? deps.headers : alpacaDataHeaders();
  if (!headers) return null;
  const fetchJson = deps.fetchJson ?? httpJson;
  const out: CorporateActionDividend[] = [];
  let token: string | null = null;
  for (let page = 0; page < 3; page++) {
    const url: string = "https://data.alpaca.markets/v1/corporate-actions"
      + `?symbols=${encodeURIComponent(symbol.toUpperCase())}&types=cash_dividend&start=${startDate}&end=${endDate}&limit=1000&sort=asc`
      + (token ? `&page_token=${encodeURIComponent(token)}` : "");
    const data: { corporate_actions?: { cash_dividends?: CorporateActionDividend[] }; next_page_token?: string | null } | null = await fetchJson(url, { timeoutMs: deps.timeoutMs ?? 10_000, headers });
    if (data == null) return null;
    out.push(...(data.corporate_actions?.cash_dividends ?? []));
    token = data.next_page_token ?? null;
    if (!token) return out;
  }
  return null; // more pages than expected: don't guess
}

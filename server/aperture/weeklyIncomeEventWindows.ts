/**
 * Weekly Income earnings and ex-dividend window blackouts (#85).
 *
 * A short-premium position must not span an earnings report, and a covered
 * call (P3) must not span an ex-dividend date (early-assignment risk; Alpaca
 * paper does not simulate dividends). Pure: callers pass the records they
 * have. Unknown dates and dates outside the maintained calendar fail closed.
 *
 * Macro-event blackouts reuse #13's calendar once it exists; until then no
 * macro tagging is attempted here (documented, not faked).
 */
import { CALENDAR_HORIZON, isMarketHoliday } from "./marketSession";
import type { Fact } from "./facts";
import { earningsExemptIndexEtf, indexEtfAllowedNote } from "../../shared/weeklyIncome/indexEtfs";

export type WiStructure = "P1" | "P2" | "P3";

export type EarningsRecord = {
  symbol: string;
  /** Report date, YYYY-MM-DD (ET). */
  date: string;
  timing?: "before_open" | "after_close" | "unknown";
  /** Operator-entered record first (#10), then the Benzinga fact. */
  source: "operator" | "benzinga";
  sourceUrl?: string | null;
  recordedBy?: string | null;
  recordedAt?: number | null;
};

export type ExDividendRecord = { symbol: string; date: string; source: "operator" | "alpaca" | "benzinga"; sourceUrl?: string | null };

export type EventWindowInput = {
  symbol: string;
  structure: WiStructure;
  entryDateEt: string;
  expirationDateEt: string;
  /** `null` means the source could not be read at all. */
  earnings: EarningsRecord[] | null;
  exDividends: ExDividendRecord[] | null;
  earningsWindowSessionsAfter: number;
  exDividendBlackoutCalls: boolean;
  /** Why the ex-dividend date is unknown, when `exDividends` is null (Strategist detail). */
  exDividendUnknownDetail?: string | null;
};

export type EventExclusionCode = "earnings_in_window" | "earnings_unknown" | "ex_dividend_in_window" | "ex_dividend_unknown" | "calendar_outside_horizon" | "invalid_dates";

export type EventExclusion = {
  code: EventExclusionCode;
  /** Strategist wording: exact and short. */
  detail: string;
  /** Quick Play wording: plain English, one or two sentences. */
  plain: string;
  source?: { name: string; url?: string | null; recordedBy?: string | null; recordedAt?: number | null } | null;
};

export type EventWindowResult = {
  eligible: boolean;
  /** Earnings window [entry, expiration + N sessions]. */
  earningsWindow: { from: string; to: string } | null;
  nextEarnings: EarningsRecord | null;
  exclusions: EventExclusion[];
  /** Quick Play note when a rule is lifted for this symbol (broad-index ETF earnings exemption). */
  allowedBecause?: string | null;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const toUtc = (date: string) => Date.parse(`${date}T12:00:00Z`);
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function isTradingDay(date: string): boolean {
  const weekday = new Date(toUtc(date)).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !isMarketHoliday(date);
}

const insideHorizon = (date: string) => date >= CALENDAR_HORIZON.from && date <= CALENDAR_HORIZON.to;

/** The date `sessions` trading sessions after `date`, or null if the calendar can't say. */
export function addTradingSessions(date: string, sessions: number): string | null {
  if (!DATE.test(date) || !insideHorizon(date)) return null;
  let cursor = toUtc(date);
  let remaining = sessions;
  while (remaining > 0) {
    cursor += DAY_MS;
    const probe = fromUtc(cursor);
    if (!insideHorizon(probe)) return null;
    if (isTradingDay(probe)) remaining--;
  }
  return fromUtc(cursor);
}

const prettyDate = (date: string) => new Date(toUtc(date)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export function evaluateEventWindow(input: EventWindowInput): EventWindowResult {
  const { symbol, structure, entryDateEt, expirationDateEt } = input;
  const exclusions: EventExclusion[] = [];
  if (!DATE.test(entryDateEt) || !DATE.test(expirationDateEt) || expirationDateEt < entryDateEt) {
    return { eligible: false, earningsWindow: null, nextEarnings: null, exclusions: [{ code: "invalid_dates", detail: "Entry or expiration date is invalid.", plain: "The trade dates don't make sense, so it's skipped." }] };
  }
  const windowEnd = addTradingSessions(expirationDateEt, input.earningsWindowSessionsAfter);
  if (!insideHorizon(entryDateEt) || windowEnd == null) {
    return {
      eligible: false, earningsWindow: null, nextEarnings: null,
      exclusions: [{ code: "calendar_outside_horizon", detail: `Window reaches outside the maintained market calendar (${CALENDAR_HORIZON.from}..${CALENDAR_HORIZON.to}).`, plain: "The market calendar doesn't cover these dates yet, so no new trades are allowed." }],
    };
  }
  const earningsWindow = { from: entryDateEt, to: windowEnd };

  // Broad-index ETFs (explicit allowlist) don't report earnings: the earnings
  // rule is lifted for them, and the ex-dividend rule applies instead (below).
  const indexEtf = earningsExemptIndexEtf(symbol);
  // Earnings: the next report on or after entry. Unknown excludes the name.
  const upcoming = (input.earnings ?? [])
    .filter((record) => record.symbol.toUpperCase() === symbol.toUpperCase() && DATE.test(record.date) && record.date >= entryDateEt)
    .sort((a, b) => (a.date === b.date ? (a.source === "operator" ? -1 : 1) : a.date < b.date ? -1 : 1));
  const nextEarnings = upcoming[0] ?? null;
  const sourceOf = (record: EarningsRecord) => ({ name: record.source === "operator" ? "Operator-entered" : "Benzinga", url: record.sourceUrl ?? null, recordedBy: record.recordedBy ?? null, recordedAt: record.recordedAt ?? null });
  if (indexEtf) {
    // no earnings check for an allowlisted index fund
  } else if (!nextEarnings) {
    exclusions.push({
      code: "earnings_unknown",
      detail: input.earnings == null ? "Earnings source unavailable; next report date unknown." : "No upcoming earnings date on record.",
      plain: `We don't know when ${symbol} next reports results, so we skip it. Surprise moves around a report can be large.`,
      source: null,
    });
  } else if (nextEarnings.date <= windowEnd) {
    exclusions.push({
      code: "earnings_in_window",
      detail: `Earnings ${nextEarnings.date} falls inside ${earningsWindow.from}..${earningsWindow.to} (expiration + ${input.earningsWindowSessionsAfter} session${input.earningsWindowSessionsAfter === 1 ? "" : "s"}).`,
      plain: `${symbol} reports results on ${prettyDate(nextEarnings.date)}, before this trade would end. Prices can jump on results day, so we skip it.`,
      source: sourceOf(nextEarnings),
    });
  }

  // Ex-dividend: allowlisted index funds (any structure), unknown excludes.
  if (indexEtf) {
    const exDivs = input.exDividends;
    const hit = (exDivs ?? []).find((record) => record.symbol.toUpperCase() === symbol.toUpperCase() && record.date >= entryDateEt && record.date <= expirationDateEt);
    if (exDivs == null) {
      exclusions.push({ code: "ex_dividend_unknown", detail: input.exDividendUnknownDetail ?? "Ex-dividend source unavailable.", plain: `We can't confirm ${symbol}'s next dividend date, so we skip it this week.` });
    } else if (hit) {
      exclusions.push({ code: "ex_dividend_in_window", detail: `Ex-dividend ${hit.date} falls inside ${entryDateEt}..${expirationDateEt}.`, plain: `${symbol} has a dividend cutoff on ${prettyDate(hit.date)}, during this trade. The fund's price drops by the dividend that day, so we skip it.`, source: { name: hit.source, url: hit.sourceUrl ?? null } });
    }
  }

  // Ex-dividend: covered calls only (P3).
  if (!indexEtf && structure === "P3" && input.exDividendBlackoutCalls) {
    const exDivs = input.exDividends;
    const hit = (exDivs ?? []).find((record) => record.symbol.toUpperCase() === symbol.toUpperCase() && record.date >= entryDateEt && record.date <= expirationDateEt);
    if (exDivs == null) {
      exclusions.push({ code: "ex_dividend_unknown", detail: "Ex-dividend source unavailable.", plain: `We can't confirm ${symbol}'s dividend dates, so we won't sell a call on it this week.` });
    } else if (hit) {
      exclusions.push({ code: "ex_dividend_in_window", detail: `Ex-dividend ${hit.date} falls inside ${entryDateEt}..${expirationDateEt}.`, plain: `${symbol} has a dividend cutoff on ${prettyDate(hit.date)}. Calls can be exercised early around it, so we skip it.`, source: { name: hit.source, url: hit.sourceUrl ?? null } });
    }
  }

  const eligible = exclusions.length === 0;
  return { eligible, earningsWindow, nextEarnings: indexEtf ? null : nextEarnings, exclusions, allowedBecause: indexEtf && eligible ? indexEtfAllowedNote(indexEtf) : null };
}

export type CorporateActionDividend = { symbol: string; ex_date: string; special?: boolean | null };

/**
 * Adapter: Alpaca corporate-action cash dividends → ex-dividend records for one
 * trade window, or null (unknown) with a reason. Alpaca says new dividends can
 * appear late, so "nothing announced" counts as known only when the fund's own
 * history puts the next expected ex-date clearly outside the window.
 */
export function exDividendRecordsFromCorporateActions(
  symbol: string,
  dividends: CorporateActionDividend[] | null,
  window: { entryDateEt: string; expirationDateEt: string },
): { records: ExDividendRecord[] | null; unknownDetail: string | null } {
  if (dividends == null) return { records: null, unknownDetail: "Ex-dividend source unavailable (Alpaca corporate actions not readable)." };
  const upper = symbol.toUpperCase();
  const regular = dividends
    .filter((d) => d.symbol?.toUpperCase() === upper && DATE.test(d.ex_date ?? "") && !d.special)
    .map((d) => d.ex_date)
    .sort();
  const unique = Array.from(new Set(regular));
  const records: ExDividendRecord[] = unique.map((date) => ({ symbol: upper, date, source: "alpaca", sourceUrl: null }));
  if (unique.some((date) => date >= window.entryDateEt && date <= window.expirationDateEt)) return { records, unknownDetail: null };
  const history = unique.filter((date) => date < window.entryDateEt);
  if (history.length < 2) return { records: null, unknownDetail: "Not enough dividend history to know when the next ex-dividend date falls." };
  const recent = history.slice(-5);
  const gaps = recent.slice(1).map((date, i) => Math.round((toUtc(date) - toUtc(recent[i])) / DAY_MS)).sort((a, b) => a - b);
  const cadence = gaps[Math.floor(gaps.length / 2)];
  // An announced ex-date after the window means the next one is known and outside it.
  if (unique.some((date) => date > window.expirationDateEt)) return { records, unknownDetail: null };
  const expected = toUtc(history[history.length - 1]) + cadence * DAY_MS;
  const tolerance = Math.max(5, Math.round(cadence * 0.1)) * DAY_MS;
  const from = fromUtc(expected - tolerance);
  const to = fromUtc(expected + tolerance);
  if (to < window.entryDateEt) return { records: null, unknownDetail: `Expected ex-dividend around ${fromUtc(expected)} has no record yet; dividend data may be late.` };
  if (from <= window.expirationDateEt) return { records: null, unknownDetail: `Next ex-dividend expected around ${fromUtc(expected)} (every ~${cadence} days) but not announced yet.` };
  return { records, unknownDetail: null };
}

/** Adapter: the existing Benzinga `next_earnings_date` fact as an earnings record. Unknown stays unknown. */
export function earningsRecordFromFact(symbol: string, fact: Pick<Fact, "factKey" | "valueText" | "basis" | "sourceUrl" | "asOf"> | null | undefined): EarningsRecord | null {
  if (!fact || fact.factKey !== "next_earnings_date" || fact.basis !== "verified" || !fact.valueText || !DATE.test(fact.valueText.slice(0, 10))) return null;
  return { symbol: symbol.toUpperCase(), date: fact.valueText.slice(0, 10), timing: "unknown", source: "benzinga", sourceUrl: fact.sourceUrl ?? null, recordedAt: fact.asOf ?? null };
}

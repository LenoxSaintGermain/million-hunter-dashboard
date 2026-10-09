/**
 * Weekly Income income-option screen (#84). Pure: it ranks put credit spread
 * pairs from chain rows the caller already fetched. It cannot create an order,
 * a proposal or a ticket.
 *
 * Every filter reports pass/fail with a reason. Missing inputs are "Not
 * measured" and make the contract ineligible; nothing is defaulted to pass.
 */
import type { OptionContractResult, OptionMarketSnapshotResult } from "./brokers/types";
import type { EventWindowResult } from "./weeklyIncomeEventWindows";
import type { WeeklyIncomeParameters } from "../../shared/strategyTemplates/weeklyIncome";
import { putCreditSpreadRisk, formatUsdCents, formatStrike } from "../../shared/weeklyIncome/spreadMath";
import { buildGuidedSpreadExplainer, type GuidedSpreadExplainer } from "../../shared/weeklyIncome/guided";
import { wiCopy } from "../../shared/weeklyIncome/copy";

export type ChainRow = { contract: OptionContractResult; market: OptionMarketSnapshotResult | null };
export type FilterCheck = { name: string; pass: boolean; detail: string };

export type ScreenUnderlying = {
  symbol: string;
  priceCents: number | null;
  /** 30-day average dollar volume from the market-data fact (proxy for the 20-day rule; labelled). */
  advUsd: number | null;
};

export type ScreenExpiration = { date: string; dte: number; rows: ChainRow[]; events: EventWindowResult };

export type LegView = {
  symbol: string;
  strikeCents: number;
  bidCents: number | null;
  askCents: number | null;
  midCents: number | null;
  spreadPct: number | null;
  delta: number | null;
  openInterest: number | null;
  dailyVolume: number | null;
  impliedVolatility: number | null;
  feed: "opra" | "indicative" | null;
  quoteAgeSeconds: number | null;
  checks: FilterCheck[];
  pass: boolean;
};

export type SpreadCandidate = {
  underlying: string;
  expiration: string;
  dte: number;
  short: LegView;
  long: LegView;
  widthCents: number;
  creditCents: number;
  creditPctOfWidth: number;
  maxLossPerContractCents: number;
  creditToMaxLoss: number;
  contracts: number | null;
  maxLossTotalCents: number | null;
  pctOfEquity: number | null;
  sizing: string;
  structureChecks: FilterCheck[];
  /** False outside the regular session: prices are from the last session. */
  entryEligible: boolean;
  previewReason: string | null;
  /** Quick Play note when a rule was lifted for this underlying (broad-index ETF earnings exemption). */
  allowedBecause: string | null;
  guided: GuidedSpreadExplainer | null;
};

export type ScreenSkip = { symbol: string; plain: string; detail: string; source?: { name: string; url?: string | null; recordedBy?: string | null; recordedAt?: number | null } | null };

export type ScreenResult = { candidates: SpreadCandidate[]; skipped: ScreenSkip[]; legsChecked: number };

export type ScreenContext = {
  params: WeeklyIncomeParameters;
  now: number;
  regularSession: boolean;
  /** Measured equity in cents; null blocks sizing ("Not measured"). */
  equityCents: number | null;
  timeExitLabel: (expiration: string) => string;
  expirationLabel: (expiration: string) => string;
};

const pct = (value: number) => Number(value.toFixed(2));

export function widthForPrice(priceCents: number, tiers: WeeklyIncomeParameters["spread_width_tiers"]): number {
  const dollars = priceCents / 100;
  return Math.round((dollars < 50 ? tiers.under50 : dollars <= 150 ? tiers.from50to150 : tiers.above150) * 100);
}

export function evaluateLeg(row: ChainRow, role: "short" | "long", ctx: ScreenContext): LegView {
  const { params: p } = ctx;
  const m = row.market;
  const checks: FilterCheck[] = [];
  const midCents = m ? Math.round((m.bidPriceCents + m.askPriceCents) / 2) : null;
  const spreadCents = m ? m.askPriceCents - m.bidPriceCents : null;
  const spreadPct = m && midCents && midCents > 0 ? pct(((m.askPriceCents - m.bidPriceCents) / midCents) * 100) : null;
  const quoteAgeSeconds = m ? Math.round((ctx.now - m.quoteAt) / 1000) : null;
  if (!m) {
    checks.push({ name: "quote", pass: false, detail: "Not measured: quote" });
  } else {
    checks.push(m.feed === "opra"
      ? { name: "feed", pass: true, detail: "OPRA quote" }
      : { name: "feed", pass: false, detail: "Indicative quote (modified, delayed trades), not eligible" });
    if (ctx.regularSession) {
      checks.push({ name: "quote_age", pass: quoteAgeSeconds != null && quoteAgeSeconds >= 0 && quoteAgeSeconds <= p.max_quote_age_seconds, detail: `Quote ${quoteAgeSeconds}s old (max ${p.max_quote_age_seconds}s)` });
    }
    checks.push({ name: "bid_ask", pass: m.bidPriceCents > 0 && m.askPriceCents >= m.bidPriceCents, detail: `Bid ${formatUsdCents(m.bidPriceCents)} / ask ${formatUsdCents(m.askPriceCents)}` });
    // Width ≤ max(pct of mid, floor). Compare in hundredths of a cent to keep 10.0% vs 10.1% exact.
    const allowed = Math.max((midCents ?? 0) * p.max_bid_ask_pct_of_mid / 100, Math.round(p.max_bid_ask_usd_floor * 100));
    checks.push({ name: "spread_width", pass: spreadCents != null && spreadCents <= allowed + 1e-9, detail: `Bid/ask ${spreadPct ?? "?"}% of mid (max ${p.max_bid_ask_pct_of_mid}% or ${formatUsdCents(Math.round(p.max_bid_ask_usd_floor * 100))})` });
    checks.push({ name: "volume", pass: m.dailyVolume >= p.min_option_daily_volume, detail: `Volume ${m.dailyVolume} (min ${p.min_option_daily_volume})` });
    checks.push(m.impliedVolatility > 0 ? { name: "iv", pass: true, detail: `IV ${pct(m.impliedVolatility * 100)}%` } : { name: "iv", pass: false, detail: "Not measured: implied volatility" });
  }
  const minOi = role === "short" ? p.min_open_interest_short : p.min_open_interest_long;
  const oi = row.contract.openInterest;
  checks.push(oi == null ? { name: "open_interest", pass: false, detail: "Not measured: open interest" } : { name: "open_interest", pass: oi >= minOi, detail: `Open interest ${oi} (min ${minOi})` });
  const delta = m?.delta ?? null;
  if (role === "short") {
    if (delta == null) checks.push({ name: "delta", pass: false, detail: "Not measured: delta" });
    else {
      const abs = Math.abs(delta);
      checks.push({ name: "delta", pass: abs >= p.short_delta_min - 1e-9 && abs <= p.short_delta_max + 1e-9, detail: `Delta ${abs.toFixed(2)} (range ${p.short_delta_min.toFixed(2)}–${p.short_delta_max.toFixed(2)})` });
    }
  }
  return {
    symbol: row.contract.symbol,
    strikeCents: row.contract.strikePriceCents,
    bidCents: m?.bidPriceCents ?? null,
    askCents: m?.askPriceCents ?? null,
    midCents,
    spreadPct,
    delta,
    openInterest: oi,
    dailyVolume: m?.dailyVolume ?? null,
    impliedVolatility: m?.impliedVolatility ?? null,
    feed: m?.feed ?? null,
    quoteAgeSeconds,
    checks,
    pass: checks.every((check) => check.pass),
  };
}

const firstFail = (leg: LegView) => leg.checks.find((check) => !check.pass)?.detail ?? "";

export function screenUnderlying(underlying: ScreenUnderlying, expirations: ScreenExpiration[], ctx: ScreenContext): ScreenResult {
  const { params: p } = ctx;
  const skipped: ScreenSkip[] = [];
  const candidates: SpreadCandidate[] = [];
  let legsChecked = 0;
  const sym = underlying.symbol;
  if (underlying.priceCents == null) return { candidates, skipped: [{ symbol: sym, plain: `We couldn't get a current price for ${sym}, so it's skipped.`, detail: "Not measured: underlying price" }], legsChecked };
  if (underlying.priceCents < Math.round(p.min_underlying_price * 100)) skipped.push({ symbol: sym, plain: `${sym} trades below $${p.min_underlying_price} a share, so it's skipped.`, detail: `Price ${formatUsdCents(underlying.priceCents)} < $${p.min_underlying_price}` });
  if (underlying.advUsd == null) skipped.push({ symbol: sym, plain: `We couldn't measure how much ${sym} trades each day, so it's skipped.`, detail: "Not measured: average dollar volume (30-day)" });
  else if (underlying.advUsd < p.min_avg_dollar_volume) skipped.push({ symbol: sym, plain: `Not enough of ${sym} trades each day for this plan, so it's skipped.`, detail: `30-day average dollar volume $${Math.round(underlying.advUsd / 1e6)}M < $${p.min_avg_dollar_volume / 1e6}M` });
  if (!p.structures_enabled.includes("P1")) skipped.push({ symbol: sym, plain: "Floor-protected trades are turned off in this plan.", detail: "structures_enabled excludes P1" });
  if (skipped.length) return { candidates, skipped, legsChecked };
  if (!expirations.length) return { candidates, skipped: [{ symbol: sym, plain: `${sym} has no weekly options ${p.dte_min} to ${p.dte_max} days out, so it's skipped.`, detail: `No expirations in ${p.dte_min}–${p.dte_max} DTE` }], legsChecked };

  const widthCents = widthForPrice(underlying.priceCents, p.spread_width_tiers);
  for (const exp of expirations) {
    if (exp.dte < p.dte_min || exp.dte > p.dte_max) continue;
    if (!exp.events.eligible) {
      for (const exclusion of exp.events.exclusions) skipped.push({ symbol: sym, plain: exclusion.plain, detail: `${exp.date}: ${exclusion.detail}`, source: exclusion.source ?? null });
      continue;
    }
    const puts = exp.rows.filter((row) => row.contract.type === "put" && row.contract.underlyingSymbol === sym && row.contract.expirationDate === exp.date);
    const byStrike = new Map(puts.map((row) => [row.contract.strikePriceCents, row]));
    const nearMisses: string[] = [];
    for (const shortRow of puts) {
      if (shortRow.contract.strikePriceCents >= underlying.priceCents) continue; // out-of-the-money puts only
      legsChecked++;
      const short = evaluateLeg(shortRow, "short", ctx);
      if (!short.pass) { nearMisses.push(`${formatStrike(short.strikeCents / 100)} put: ${firstFail(short)}`); continue; }
      const longRow = byStrike.get(shortRow.contract.strikePriceCents - widthCents);
      if (!longRow) { nearMisses.push(`${formatStrike(short.strikeCents / 100)} put: no floor put ${formatUsdCents(widthCents)} lower`); continue; }
      legsChecked++;
      const long = evaluateLeg(longRow, "long", ctx);
      if (!long.pass) { nearMisses.push(`${formatStrike(long.strikeCents / 100)} floor put: ${firstFail(long)}`); continue; }
      const creditCents = (short.midCents ?? 0) - (long.midCents ?? 0);
      const creditPct = (creditCents / widthCents) * 100;
      const structureChecks: FilterCheck[] = [
        { name: "dte", pass: true, detail: `${exp.dte} days to expiration (range ${p.dte_min}–${p.dte_max})` },
        { name: "credit_pct_of_width", pass: creditPct >= p.min_credit_pct_of_width - 1e-9 && creditPct <= p.max_credit_pct_of_width + 1e-9, detail: `Credit ${pct(creditPct)}% of width (range ${p.min_credit_pct_of_width}–${p.max_credit_pct_of_width}%)` },
      ];
      if (!structureChecks.every((check) => check.pass) || creditCents <= 0) { nearMisses.push(`${formatStrike(short.strikeCents / 100)}/${formatStrike(long.strikeCents / 100)}: ${structureChecks.find((c) => !c.pass)?.detail ?? "no credit"}`); continue; }
      const risk = putCreditSpreadRisk({
        shortStrike: short.strikeCents / 100, longStrike: long.strikeCents / 100, credit: creditCents / 100, contracts: 1,
        slippagePerLegUsd: p.slippage_per_leg_usd, feePerContractUsd: p.fee_allowance_per_contract_usd,
        takeProfitPctOfCredit: p.take_profit_pct_of_credit / 100, stopMultipleOfCredit: p.stop_multiple_of_credit,
      });
      if (!risk.ok) continue;
      let contracts: number | null = null;
      let sizing: string;
      if (ctx.equityCents == null || ctx.equityCents <= 0) {
        sizing = "Not measured: account equity. Size is shown per contract only.";
      } else {
        const capCents = Math.floor(ctx.equityCents * p.max_loss_per_position_pct / 100);
        contracts = Math.floor(capCents / risk.maxLossCents);
        sizing = contracts >= 1
          ? `${contracts} contract${contracts === 1 ? "" : "s"} fit the ${p.max_loss_per_position_pct}% per-position limit (${formatUsdCents(capCents)}).`
          : wiCopy("wi.sizing.skip", { limitName: "per-position loss limit", limitValue: formatUsdCents(capCents) });
        if (contracts < 1) { skipped.push({ symbol: sym, plain: sizing, detail: `Max loss ${formatUsdCents(risk.maxLossCents)} per contract > cap ${formatUsdCents(capCents)}` }); continue; }
      }
      const shown = contracts ?? 1;
      const guided = buildGuidedSpreadExplainer({
        symbol: sym, shortStrike: short.strikeCents / 100, longStrike: long.strikeCents / 100, credit: creditCents / 100, contracts: shown,
        slippagePerLegUsd: p.slippage_per_leg_usd, feePerContractUsd: p.fee_allowance_per_contract_usd,
        takeProfitPctOfCredit: p.take_profit_pct_of_credit / 100, stopMultipleOfCredit: p.stop_multiple_of_credit,
        expirationLabel: ctx.expirationLabel(exp.date), timeExitLabel: ctx.timeExitLabel(exp.date), isExample: false,
      });
      candidates.push({
        underlying: sym, expiration: exp.date, dte: exp.dte, short, long, widthCents, creditCents, creditPctOfWidth: pct(creditPct),
        maxLossPerContractCents: risk.maxLossCents, creditToMaxLoss: pct(risk.creditReceivedCents / risk.maxLossCents),
        contracts, maxLossTotalCents: contracts == null ? null : risk.maxLossCents * contracts,
        pctOfEquity: contracts == null || !ctx.equityCents ? null : pct((risk.maxLossCents * contracts / ctx.equityCents) * 100),
        sizing, structureChecks,
        entryEligible: ctx.regularSession,
        previewReason: ctx.regularSession ? null : "Market closed: these prices are from the last session, so nothing is eligible to enter.",
        allowedBecause: exp.events.allowedBecause ?? null,
        guided: "error" in guided ? null : guided,
      });
    }
    if (!candidates.some((c) => c.expiration === exp.date) && nearMisses.length) {
      skipped.push({ symbol: sym, plain: `No ${sym} trade for ${ctx.expirationLabel(exp.date)} met every rule.`, detail: `${exp.date}: ${nearMisses.slice(0, 3).join("; ")}${nearMisses.length > 3 ? ` (+${nearMisses.length - 3} more)` : ""}` });
    }
  }
  return { candidates, skipped, legsChecked };
}

/** Rank by credit ÷ max loss; tie-break tighter bid/ask, then higher open interest. Never overrides a filter. */
export function rankCandidates(candidates: SpreadCandidate[], limit: number): SpreadCandidate[] {
  return [...candidates].sort((a, b) =>
    b.creditToMaxLoss - a.creditToMaxLoss
    || (a.short.spreadPct ?? 999) - (b.short.spreadPct ?? 999)
    || (b.short.openInterest ?? 0) - (a.short.openInterest ?? 0),
  ).slice(0, limit);
}

/** Weekly expirations with DTE in range: Fridays, or Thursday when Friday is a market holiday. */
export function weeklyExpirationsInRange(entryDateEt: string, dteMin: number, dteMax: number, isHoliday: (date: string) => boolean): Array<{ date: string; dte: number }> {
  const out: Array<{ date: string; dte: number }> = [];
  const start = Date.parse(`${entryDateEt}T12:00:00Z`);
  for (let dte = dteMin; dte <= dteMax; dte++) {
    const date = new Date(start + dte * 86_400_000);
    const iso = date.toISOString().slice(0, 10);
    const weekday = date.getUTCDay();
    if (weekday === 5 && !isHoliday(iso)) out.push({ date: iso, dte });
    if (weekday === 4) {
      const friday = new Date(date.getTime() + 86_400_000).toISOString().slice(0, 10);
      if (isHoliday(friday) && !isHoliday(iso)) out.push({ date: iso, dte });
    }
  }
  return out;
}

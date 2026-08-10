/**
 * Paid providers — built now, dormant until their keys exist.
 *
 *   fmp      — valuation ratios and company profile (sector, industry, market cap)
 *   benzinga — analyst actions and upcoming earnings dates: the catalyst agent's
 *              raw material
 *
 * Neither is required. With no key they report unavailable, the run records the
 * gap, and the UI names the missing capability rather than quietly showing less.
 */
import type { Fact } from "../facts";
import { DAY, httpJson, num, unknownFact, type FetchCtx, type ProviderAdapter } from "./types";

// ── Financial Modeling Prep ──────────────────────────────────────────────────
const FMP_KEYS = ["pe_ratio", "price_to_sales", "market_cap", "sector", "industry", "dividend_per_share", "dividend_yield"];

export const fmpProvider: ProviderAdapter = {
  id: "fmp",
  label: "Financial Modeling Prep (ratios, profile, transcripts)",
  kind: "security",
  requiredEnv: ["FMP_API_KEY"],
  provides: FMP_KEYS,
  homepage: "https://site.financialmodelingprep.com/developer/docs",

  async fetchSecurityFacts(symbol, ctx: FetchCtx): Promise<Fact[]> {
    const key = process.env.FMP_API_KEY;
    const src = { providerId: "fmp", sourceName: "Financial Modeling Prep", sourceUrl: `https://site.financialmodelingprep.com/financial-summary/${encodeURIComponent(symbol)}` };
    const out: Fact[] = [];

    const profile = await httpJson<any[]>(
      `https://financialmodelingprep.com/api/v3/profile/${encodeURIComponent(symbol)}?apikey=${key}`,
      { timeoutMs: ctx.timeoutMs },
    );
    const p = Array.isArray(profile) ? profile[0] : null;

    const push = (factKey: string, valueNum: number | null, unit: any) =>
      out.push(
        valueNum == null
          ? unknownFact(factKey, "fmp", src.sourceName)
          : { factKey, valueNum, unit, basis: "verified" as const, ...src, asOf: ctx.now, ttlMs: DAY },
      );

    push("market_cap", p ? num(p.mktCap) : null, "usd");

    // FMP's `lastDiv` is the trailing dividend PER SHARE in dollars, not a yield.
    // Storing it under a yield key would put a $2.40 dividend into a field the
    // scorer and memos read as 240%. Emit it under its real name, and derive the
    // yield only when there is a price to divide by — labelled `modeled`, since
    // it is a computation over two point-in-time figures rather than a stated one.
    const divPerShare = p ? num(p.lastDiv) : null;
    push("dividend_per_share", divPerShare, "usd");

    const price = p ? num(p.price) : null;
    out.push(
      divPerShare != null && price != null && price > 0
        ? {
            factKey: "dividend_yield",
            valueNum: divPerShare / price,
            unit: "ratio" as const,
            basis: "modeled" as const,
            assumption: `trailing dividend per share ($${divPerShare}) over last price ($${price})`,
            ...src,
            asOf: ctx.now,
            ttlMs: DAY,
          }
        : unknownFact("dividend_yield", "fmp", src.sourceName),
    );

    for (const [factKey, field] of [["sector", "sector"], ["industry", "industry"]] as const) {
      const v = p?.[field];
      out.push(
        v
          ? { factKey, valueText: String(v), basis: "verified" as const, ...src, asOf: ctx.now, ttlMs: 30 * DAY }
          : unknownFact(factKey, "fmp", src.sourceName),
      );
    }

    const ratios = await httpJson<any[]>(
      `https://financialmodelingprep.com/api/v3/ratios-ttm/${encodeURIComponent(symbol)}?apikey=${key}`,
      { timeoutMs: ctx.timeoutMs },
    );
    const r = Array.isArray(ratios) ? ratios[0] : null;
    push("pe_ratio", r ? num(r.peRatioTTM) : null, "x");
    push("price_to_sales", r ? num(r.priceToSalesRatioTTM) : null, "x");

    return out;
  },
};

// ── Benzinga ─────────────────────────────────────────────────────────────────
const BZ_KEYS = ["analyst_rating_latest", "price_target_latest", "next_earnings_date"];

export const benzingaProvider: ProviderAdapter = {
  id: "benzinga",
  label: "Benzinga (analyst actions, earnings calendar)",
  kind: "security",
  requiredEnv: ["BENZINGA_API_KEY"],
  provides: BZ_KEYS,
  homepage: "https://docs.benzinga.com/",

  async fetchSecurityFacts(symbol, ctx: FetchCtx): Promise<Fact[]> {
    const key = process.env.BENZINGA_API_KEY;
    const sourceName = "Benzinga";
    const sourceUrl = `https://www.benzinga.com/quote/${encodeURIComponent(symbol)}`;
    const out: Fact[] = [];

    const ratings = await httpJson<any>(
      `https://api.benzinga.com/api/v2.1/calendar/ratings?token=${key}&parameters[tickers]=${encodeURIComponent(symbol)}&pagesize=1`,
      { timeoutMs: ctx.timeoutMs },
    );
    const rating = ratings?.ratings?.[0];
    out.push(
      rating?.rating_current
        ? {
            factKey: "analyst_rating_latest",
            valueText: `${rating.rating_current} (${rating.analyst ?? "analyst"}, ${rating.date ?? "date unknown"})`,
            basis: "verified",
            providerId: "benzinga",
            sourceName,
            sourceUrl,
            asOf: rating.date ? Date.parse(`${rating.date}T00:00:00Z`) || null : null,
            ttlMs: DAY,
          }
        : unknownFact("analyst_rating_latest", "benzinga", sourceName),
    );

    const pt = rating ? num(rating.pt_current) : null;
    out.push(
      pt == null
        ? unknownFact("price_target_latest", "benzinga", sourceName)
        : {
            factKey: "price_target_latest",
            valueNum: pt,
            unit: "usd",
            basis: "verified",
            providerId: "benzinga",
            sourceName: `${sourceName} — ${rating.analyst ?? "analyst"} price target`,
            sourceUrl,
            asOf: rating.date ? Date.parse(`${rating.date}T00:00:00Z`) || null : null,
            ttlMs: DAY,
          },
    );

    const earnings = await httpJson<any>(
      `https://api.benzinga.com/api/v2.1/calendar/earnings?token=${key}&parameters[tickers]=${encodeURIComponent(symbol)}&pagesize=1`,
      { timeoutMs: ctx.timeoutMs },
    );
    const e = earnings?.earnings?.[0];
    out.push(
      e?.date
        ? {
            factKey: "next_earnings_date",
            valueText: String(e.date),
            basis: "verified",
            providerId: "benzinga",
            sourceName,
            sourceUrl,
            asOf: Date.parse(`${e.date}T00:00:00Z`) || null,
            ttlMs: DAY,
          }
        : unknownFact("next_earnings_date", "benzinga", sourceName),
    );

    return out;
  },
};

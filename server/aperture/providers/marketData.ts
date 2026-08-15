/**
 * Market-data providers: prices, volume, and the liquidity figure that decides
 * whether a thesis-perfect name can actually be sized.
 *
 * Two adapters behind one shape:
 *   alpaca  — free IEX tier. Real, but IEX-only and delayed; every price it
 *             writes says so in its source name, because a delayed print
 *             presented as a live quote is a lie of omission.
 *   polygon — full-market consolidated quotes when a key exists.
 *
 * ADV is computed from daily bars rather than taken on faith, and is labelled
 * `modeled` with the window stated: it is an average, not a fact about today.
 */
import type { Fact } from "../facts";
import { DAY, httpJson, num, unknownFact, type FetchCtx, type ProviderAdapter } from "./types";

const KEYS = ["last_price", "adv_usd_30d", "volatility_30d"];

function alpacaCredentials() {
  return {
    key: process.env.ALPACA_PAPER_KEY ?? process.env.ALPACA_API_KEY_ID ?? "",
    secret: process.env.ALPACA_PAPER_SECRET ?? process.env.ALPACA_API_SECRET_KEY ?? "",
  };
}

function missingAlpacaCredentials(): string[] {
  const credentials = alpacaCredentials();
  const missing: string[] = [];
  if (!credentials.key) missing.push("ALPACA_PAPER_KEY (or ALPACA_API_KEY_ID)");
  if (!credentials.secret) missing.push("ALPACA_PAPER_SECRET (or ALPACA_API_SECRET_KEY)");
  return missing;
}

interface Bar { c: number; v: number; t: number }

/** Average daily DOLLAR volume — shares alone say nothing about tradability. */
function advUsd(bars: Bar[]): number | null {
  if (!bars.length) return null;
  const total = bars.reduce((s, b) => s + b.c * b.v, 0);
  return total / bars.length;
}

/** Annualised stdev of daily log returns. */
function volatility(bars: Bar[]): number | null {
  if (bars.length < 10) return null;
  const rets: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    if (bars[i - 1].c > 0 && bars[i].c > 0) rets.push(Math.log(bars[i].c / bars[i - 1].c));
  }
  if (rets.length < 5) return null;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

function barsToFacts(
  bars: Bar[],
  providerId: string,
  sourceName: string,
  sourceUrl: string,
  windowDays: number,
  now: number,
): Fact[] {
  if (!bars.length) return KEYS.map((k) => unknownFact(k, providerId, sourceName));

  const last = bars[bars.length - 1];
  const adv = advUsd(bars);
  const vol = volatility(bars);
  const out: Fact[] = [];

  out.push({
    factKey: "last_price",
    valueNum: last.c,
    unit: "usd",
    basis: "verified",
    providerId,
    sourceName,
    sourceUrl,
    asOf: last.t,
    ttlMs: DAY,
  });

  out.push(
    adv == null
      ? unknownFact("adv_usd_30d", providerId, sourceName)
      : {
          factKey: "adv_usd_30d",
          valueNum: adv,
          unit: "usd",
          basis: "modeled",
          assumption: `mean of close x volume over the last ${bars.length} daily bars (${windowDays}-day window)`,
          providerId,
          sourceName,
          sourceUrl,
          asOf: last.t,
          ttlMs: DAY,
        },
  );

  out.push(
    vol == null
      ? unknownFact("volatility_30d", providerId, sourceName)
      : {
          factKey: "volatility_30d",
          valueNum: vol,
          unit: "ratio",
          basis: "modeled",
          assumption: `annualised stdev of daily log returns over ${bars.length} bars (252 trading days/yr)`,
          providerId,
          sourceName,
          sourceUrl,
          asOf: last.t,
          ttlMs: DAY,
        },
  );

  return out;
}

// ── Alpaca (free IEX tier) ───────────────────────────────────────────────────
export const alpacaDataProvider: ProviderAdapter = {
  id: "alpaca",
  label: "Alpaca market data (free IEX tier — delayed, IEX only)",
  kind: "security",
  requiredEnv: [],
  isAvailable: () => missingAlpacaCredentials().length === 0,
  missingEnv: missingAlpacaCredentials,
  provides: KEYS,
  homepage: "https://alpaca.markets/",

  async fetchSecurityFacts(symbol, ctx: FetchCtx): Promise<Fact[]> {
    const credentials = alpacaCredentials();
    const start = new Date(ctx.now - 45 * DAY).toISOString().slice(0, 10);
    const url =
      `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars` +
      `?timeframe=1Day&start=${start}&limit=45&feed=iex&adjustment=raw`;
    const data = await httpJson<{ bars?: Array<{ c: number; v: number; t: string }> }>(url, {
      timeoutMs: ctx.timeoutMs,
      headers: {
        "APCA-API-KEY-ID": credentials.key,
        "APCA-API-SECRET-KEY": credentials.secret,
      },
    });
    const bars = (data?.bars ?? [])
      .map((b) => ({ c: num(b.c) ?? 0, v: num(b.v) ?? 0, t: Date.parse(b.t) }))
      .filter((b) => b.c > 0);
    return barsToFacts(
      bars,
      "alpaca",
      "Alpaca IEX (delayed, IEX-only feed)",
      `https://app.alpaca.markets/trade/${encodeURIComponent(symbol)}`,
      45,
      ctx.now,
    );
  },
};

// ── Polygon (consolidated tape) ──────────────────────────────────────────────
export const polygonProvider: ProviderAdapter = {
  id: "polygon",
  label: "Polygon (consolidated quotes and bars)",
  kind: "security",
  requiredEnv: ["POLYGON_API_KEY"],
  provides: KEYS,
  homepage: "https://polygon.io/",

  async fetchSecurityFacts(symbol, ctx: FetchCtx): Promise<Fact[]> {
    const from = new Date(ctx.now - 45 * DAY).toISOString().slice(0, 10);
    const to = new Date(ctx.now).toISOString().slice(0, 10);
    const url =
      `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${from}/${to}` +
      `?adjusted=true&sort=asc&limit=120&apiKey=${process.env.POLYGON_API_KEY}`;
    const data = await httpJson<{ results?: Array<{ c: number; v: number; t: number }> }>(url, { timeoutMs: ctx.timeoutMs });
    const bars = (data?.results ?? [])
      .map((b) => ({ c: num(b.c) ?? 0, v: num(b.v) ?? 0, t: b.t }))
      .filter((b) => b.c > 0);
    return barsToFacts(bars, "polygon", "Polygon consolidated tape", `https://polygon.io/quote/${encodeURIComponent(symbol)}`, 45, ctx.now);
  },
};

export const __marketDataInternals = { advUsd, volatility, barsToFacts };

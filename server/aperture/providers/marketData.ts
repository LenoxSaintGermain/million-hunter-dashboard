/**
 * Market-data providers: prices, volume, and the liquidity figure that decides
 * whether a thesis-perfect name can actually be sized.
 *
 * Two adapters behind one shape:
 *   alpaca  — configured Trading API feed. SIP is the default when the
 *             entitlement is available; IEX remains an explicit fallback.
 *             Every fact records the actual feed, because a partial or
 *             delayed print presented as consolidated market data is a lie
 *             of omission.
 *   polygon — full-market consolidated quotes when a key exists.
 *
 * ADV is computed from daily bars rather than taken on faith, and is labelled
 * `modeled` with the window stated: it is an average, not a fact about today.
 */
import type { Fact } from "../facts";
import type { MinuteBar, TapeFeed } from "../intraday";
import { DAY, httpJson, num, unknownFact, type FetchCtx, type ProviderAdapter } from "./types";

// ── Intraday tape ─────────────────────────────────────────────────────────────

/**
 * Which Alpaca feed the intraday endpoints read. Measured 2026-08-18 on the
 * production key, XHB at 10:24 ET:
 *
 *   iex   12,317 shares on the day, ~1 min behind  — real-time, 4.8% of the tape
 *   sip  255,439 shares on the day, 15 min behind  — consolidated, delayed
 *
 * Default is `sip`: for VWAP and an opening range, the whole tape fifteen
 * minutes late beats a twentieth of the tape live. A VWAP built from IEX prints
 * alone is not the number any other participant is looking at.
 *
 * When the account is upgraded to real-time SIP, this changes nothing — the same
 * feed string starts arriving with a sub-minute lag, and every figure already
 * carries its measured `lagMs`, so the surfaces relabel themselves. Set
 * ALPACA_DATA_FEED=iex only to deliberately trade completeness for latency.
 */
export function intradayFeed(): TapeFeed {
  const raw = (process.env.ALPACA_DATA_FEED ?? "sip").trim().toLowerCase();
  return raw === "iex" ? "iex" : raw === "sip" ? "sip" : "unknown";
}

function alpacaFeedSource(feed: TapeFeed): string {
  if (feed === "sip") return "Alpaca SIP (consolidated market data)";
  if (feed === "iex") return "Alpaca IEX (IEX-only market data)";
  return "Alpaca market data (unknown configured feed)";
}

export interface IntradayBarsResult {
  bars: MinuteBar[];
  feed: TapeFeed;
  /** Non-null when no bars could be fetched — never an empty array passed off
   *  as "nothing traded". */
  unavailableReason: string | null;
}

/**
 * One-minute bars from `start` (epoch ms) to now, paging until exhausted.
 * Returns Alpaca's own `vw` per bar untouched — sessionVwap() decides what to
 * do with it, and records when a bar had none.
 */
export async function fetchIntradayBars(
  symbol: string,
  opts: { startMs: number; timeoutMs?: number; feed?: TapeFeed; maxPages?: number },
): Promise<IntradayBarsResult> {
  const feed = opts.feed ?? intradayFeed();
  const missing = missingAlpacaCredentials();
  if (missing.length) {
    return { bars: [], feed, unavailableReason: `Alpaca credentials missing: ${missing.join(", ")}` };
  }
  const credentials = alpacaCredentials();
  const start = new Date(opts.startMs).toISOString();
  const bars: MinuteBar[] = [];
  let token: string | null | undefined = null;
  let pages = 0;
  const maxPages = opts.maxPages ?? 6;

  try {
    do {
      const url: string =
        `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars` +
        `?timeframe=1Min&limit=10000&adjustment=raw&feed=${feed}` +
        `&start=${encodeURIComponent(start)}` +
        (token ? `&page_token=${encodeURIComponent(token)}` : "");
      const data: {
        bars?: Array<{ t: string; o: number; h: number; l: number; c: number; v: number; vw?: number }>;
        next_page_token?: string | null;
      } | null = await httpJson(url, {
        timeoutMs: opts.timeoutMs ?? 10_000,
        headers: {
          "APCA-API-KEY-ID": credentials.key,
          "APCA-API-SECRET-KEY": credentials.secret,
        },
      });
      for (const b of data?.bars ?? []) {
        bars.push({
          t: Date.parse(b.t),
          o: num(b.o) ?? 0,
          h: num(b.h) ?? 0,
          l: num(b.l) ?? 0,
          c: num(b.c) ?? 0,
          v: num(b.v) ?? 0,
          vw: num(b.vw) ?? null,
        });
      }
      token = data?.next_page_token ?? null;
      pages++;
    } while (token && pages < maxPages);
  } catch (e: any) {
    return { bars, feed, unavailableReason: `Alpaca bars request failed: ${e?.message ?? e}` };
  }

  return {
    bars,
    feed,
    unavailableReason: bars.length
      ? null
      : `no ${feed.toUpperCase()} minute bars returned for ${symbol} since ${start}`,
  };
}

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

// ── Alpaca (configured Trading API feed) ─────────────────────────────────────
export const alpacaDataProvider: ProviderAdapter = {
  id: "alpaca",
  label: "Alpaca market data (SIP default; IEX fallback via ALPACA_DATA_FEED)",
  kind: "security",
  requiredEnv: [],
  isAvailable: () => missingAlpacaCredentials().length === 0,
  missingEnv: missingAlpacaCredentials,
  provides: KEYS,
  homepage: "https://alpaca.markets/",

  async fetchSecurityFacts(symbol, ctx: FetchCtx): Promise<Fact[]> {
    const credentials = alpacaCredentials();
    const feed = intradayFeed();
    const start = new Date(ctx.now - 45 * DAY).toISOString().slice(0, 10);
    const url =
      `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars` +
      `?timeframe=1Day&start=${start}&limit=45&feed=${feed}&adjustment=raw`;
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
      alpacaFeedSource(feed),
      `https://app.alpaca.markets/trade/${encodeURIComponent(symbol)}?feed=${feed}`,
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

export const __marketDataInternals = { advUsd, volatility, barsToFacts, intradayFeed, alpacaFeedSource };

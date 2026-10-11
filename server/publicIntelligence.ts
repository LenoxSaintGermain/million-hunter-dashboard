import { z } from "zod";
import { ENV } from "./_core/env";
import { evidenceRepository } from "./evidenceRepository";
import type { FeedResult, MacroOddEvent, TrademarkRecord, FederalContractor, SecCompanyMatch, FxRatesResult } from "../shared/publicIntelligence";
export type { FeedResult, MacroOddMarket, MacroOddEvent, TrademarkRecord, FederalContractor, SecCompanyMatch, FxRatesResult } from "../shared/publicIntelligence";

export const searchInput = z.object({ query: z.string().max(120).trim().min(1), limit: z.number().int().min(1).max(10).default(5) });
export const macroInput = z.object({ tagSlug: z.string().max(48).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).default("economy"), limit: z.number().int().min(1).max(20).default(8) });
const currency = z.string().regex(/^[A-Z]{3}$/);
export const forexInput = z.object({ base: currency.default("USD"), symbols: z.array(currency).min(1).max(12).default(["EUR", "GBP", "JPY", "CAD", "CHF", "AUD"]) }).refine(v => !v.symbols.includes(v.base), "Target currencies must differ from base");
const text = z.string().trim().min(1).max(2000);
const optionalText = z.string().max(16000).nullish();
const id = z.union([text, z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)]).transform(String);
const slug = z.string().min(1).max(256).regex(/^[a-zA-Z0-9_-]+$/);
const finiteNumeric = z.union([z.number(), z.string().regex(/^\d+(?:\.\d+)?$/).transform(Number)]).pipe(z.number().finite().nonnegative());
function encodedArray<T extends z.ZodType>(schema: T) {
  return z.preprocess(v => {
    if (typeof v !== "string") return v;
    try { return JSON.parse(v); } catch { return v; }
  }, schema);
}
const labels = encodedArray(z.array(text).max(100));
const prices = encodedArray(z.array(finiteNumeric.pipe(z.number().max(1))).max(100));
class FeedError extends Error {}
const USER_AGENT = "SignalHunterOS/1.0 (https://thirdsignallab.com; contact@thirdsignallab.com)";
const TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const RETRY_MS = 30_000;

export type FeedProvider = "polymarket" | "markbase" | "usaspending" | "frankfurter";
export interface FeedAccess { reserve(provider: FeedProvider): Promise<void> }
const defaultFeedAccess: FeedAccess = { reserve: provider => evidenceRepository.reserveFeedProvider(provider) };

/** Deadline includes headers AND streamed body, including non-cooperative transports. */
async function fetchJson(url: string, init?: RequestInit, onRateLimit?: (until: Date) => Promise<void>): Promise<unknown> {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new FeedError("Provider request timed out (including response body)."));
      controller.abort();
      void reader?.cancel().catch(() => {});
    }, TIMEOUT_MS);
  });
  try {
    return await Promise.race([deadline, (async () => {
      const res = await fetch(url, { ...init, redirect: "error", signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...init?.headers } });
      if (res.status === 429 && onRateLimit) {
        const value = res.headers.get("retry-after");
        const parsed = value && /^\d+$/.test(value) ? Date.now() + Number(value) * 1000 : Date.parse(value ?? "");
        const until = Math.min(8.64e15, Math.max(Date.now() + 60_000, Number.isFinite(parsed) ? parsed : 0));
        void res.body?.cancel().catch(() => {});
        await onRateLimit(new Date(until));
      }
      if (!res.ok) { void res.body?.cancel().catch(() => {}); throw new FeedError("Provider returned HTTP " + res.status + "."); }
      if (controller.signal.aborted) { void res.body?.cancel().catch(() => {}); throw new FeedError("Provider request timed out."); }
      if (Number(res.headers.get("content-length")) > MAX_BODY_BYTES) {
        void res.body?.cancel().catch(() => {});
        throw new FeedError("Provider response exceeds the size limit.");
      }
      if (!res.body) throw new FeedError("Provider returned no response body.");
      reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8", { fatal: true });
      let bytes = 0;
      let body = "";
      while (true) {
        const chunk = await reader.read();
        if (controller.signal.aborted) throw new FeedError("Provider request timed out.");
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_BODY_BYTES) throw new FeedError("Provider response exceeds the size limit.");
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
      try { return JSON.parse(body); } catch { throw new FeedError("Provider returned invalid JSON."); }
    })()]);
  } finally {
    clearTimeout(timer);
    controller.abort();
    void reader?.cancel().catch(() => {});
  }
}

/** Bounded local caches/coalescing plus durable non-SEC provider reservations.
 * SEC reserves its separate shared budget in its loader. No cache bypass. */
function createFeed<T>(source: string, ttlMs: number, maxStaleMs: number, provider?: FeedProvider) {
  type Entry = { result?: FeedResult<T>; good?: FeedResult<T>; expires: number; pending?: Promise<FeedResult<T>> };
  const cache = new Map<string, Entry>();
  let windowStart = 0;
  let requests = 0;
  let inFlight = 0;
  return async (key: string, sourceUrl: string, load: () => Promise<T>, access: FeedAccess = defaultFeedAccess): Promise<FeedResult<T>> => {
    const now = Date.now();
    let entry = cache.get(key);
    if (entry?.pending) return structuredClone(await entry.pending);
    if (entry?.result && now < entry.expires) return structuredClone(entry.result);
    const attemptedAt = new Date(now).toISOString();
    const failure = (message: string): FeedResult<T> => {
      const good = entry?.good;
      if (good?.fetchedAt && now - Date.parse(good.fetchedAt) <= maxStaleMs) {
        return { ...good, status: "stale", attemptedAt, message: message + " Showing cached data; refresh was unsuccessful." };
      }
      return { status: "unavailable", data: null, source, sourceUrl, fetchedAt: null, attemptedAt, message };
    };
    if (now - windowStart >= 60_000) { windowStart = now; requests = 0; }
    if (inFlight >= 8 || requests >= 60) return failure("Provider request budget exhausted; retry later.");
    if (!entry) {
      if (cache.size >= 128) {
        const evict = Array.from(cache).find(([, v]) => !v.pending)?.[0];
        if (evict === undefined) return failure("Feed is busy; retry later.");
        cache.delete(evict);
      }
      entry = { expires: 0 };
      cache.set(key, entry);
    }
    const current = entry;
    requests++;
    inFlight++;
    current.pending = (async () => {
      try {
        if (provider) {
          try { await access.reserve(provider); }
          catch { throw new FeedError("Provider shared budget or storage is unavailable; no provider request made."); }
        }
        const data = await load();
        const result: FeedResult<T> = { status: Array.isArray(data) && !data.length ? "empty" : "ok", data, source, sourceUrl,
          fetchedAt: new Date().toISOString(), attemptedAt, message: null };
        current.good = result;
        current.result = result;
        current.expires = Date.now() + ttlMs;
        return result;
      } catch (error) {
        const message = error instanceof FeedError ? error.message : error instanceof z.ZodError ? "Provider response did not match the expected schema." : "Provider network or response read failed.";
        const result = failure(message + " Retry after 30 seconds.");
        current.result = result;
        current.expires = Date.now() + RETRY_MS;
        return result;
      } finally { current.pending = undefined; inFlight--; }
    })();
    return structuredClone(await current.pending);
  };
}

const macroFeed = createFeed<MacroOddEvent[]>("Polymarket Gamma", 60_000, 60 * 60_000, "polymarket");
const trademarkFeed = createFeed<TrademarkRecord[]>("Markbase", 5 * 60_000, 24 * 60 * 60_000, "markbase");
const federalFeed = createFeed<FederalContractor[]>("USAspending.gov", 5 * 60_000, 24 * 60 * 60_000, "usaspending");
const secFeed = createFeed<SecCompanyMatch[]>("SEC EDGAR", 24 * 60 * 60_000, 7 * 24 * 60 * 60_000);
const forexFeed = createFeed<FxRatesResult>("Frankfurter / ECB reference rates", 60 * 60_000, 24 * 60 * 60_000, "frankfurter");
const marketSchema = z.object({ id, question: text, slug, outcomes: labels.nullish(), outcomePrices: prices.nullish(), volume: finiteNumeric.nullish(), endDate: optionalText,
  active: z.boolean().nullish(), closed: z.boolean().nullish() });
const eventSchema = z.object({ id, title: text, slug, markets: z.array(marketSchema).max(100) });

export async function getMacroOdds(options?: { tagSlug?: string; limit?: number }, access?: FeedAccess): Promise<FeedResult<MacroOddEvent[]>> {
  const { tagSlug, limit } = macroInput.parse(options ?? {});
  const url = "https://gamma-api.polymarket.com/events?limit=" + limit + "&closed=false&active=true&tag_slug=" + encodeURIComponent(tagSlug);
  return macroFeed(url, url, async () => z.array(eventSchema).max(100).parse(await fetchJson(url)).slice(0, limit).map(ev => ({
    id: ev.id, title: ev.title, slug: ev.slug, category: tagSlug,
    // Active events can contain closed historical markets. Exclude explicitly
    // closed/inactive children, preserving unknown flags rather than inventing
    // active status. Validate BEFORE filtering so malformed flags fail closed.
    markets: ev.markets.filter(m => m.closed !== true && m.active !== false).map(m => {
      const outcomes = m.outcomes ?? [];
      const values = m.outcomePrices ?? [];
      if (values.length && (!outcomes.length || values.length !== outcomes.length)) throw new FeedError("Provider outcomes and prices do not match.");
      return { id: m.id, question: m.question, slug: m.slug, outcomes, prices: values.map(String),
        probabilityPct: values.length ? Math.round(values[0] * 10_000) / 100 : null,
        outcomeLabel: outcomes[0] ?? null, volume: m.volume ?? null, endDate: m.endDate ?? undefined,
        active: m.active ?? null, closed: m.closed ?? null,
        url: "https://polymarket.com/event/" + ev.slug };
    }),
  })).filter(ev => ev.markets.length > 0), access);
}

// Exact inspected raw Markbase fields; do not use _formatted HTML or infer
// legal status from an unverified code table.
const trademarkSchema = z.object({ serial_number: z.string().regex(/^\d{8}$/), word_mark: text,
  status_code: z.string().max(32).nullish(), owner_name: optionalText, goods_services: optionalText, filing_date: optionalText });
export async function searchTrademarks(query: string, limit = 5, access?: FeedAccess): Promise<FeedResult<TrademarkRecord[]>> {
  const input = searchInput.parse({ query, limit });
  const url = "https://markbase.co/api/search?q=" + encodeURIComponent(input.query) + "&limit=" + input.limit;
  return trademarkFeed(url, url, async () => {
    const data = z.object({ hits: z.array(trademarkSchema).max(100) }).parse(await fetchJson(url));
    return data.hits.slice(0, input.limit).map(hit => ({ serialNumber: hit.serial_number, wordMark: hit.word_mark,
      statusCode: hit.status_code ?? null, statusLabel: null, ownerName: hit.owner_name ?? null,
      goodsServices: hit.goods_services ?? null, filingDate: hit.filing_date ?? null }));
  }, access);
}

export async function searchFederalContractors(query: string, limit = 5, access?: FeedAccess): Promise<FeedResult<FederalContractor[]>> {
  const input = searchInput.parse({ query, limit });
  const url = "https://api.usaspending.gov/api/v2/autocomplete/recipient/";
  return federalFeed(JSON.stringify(input), "https://www.usaspending.gov/search", async () => {
    const data = z.object({ results: z.array(z.object({ recipient_name: text,
      uei: optionalText, duns: optionalText, recipient_level: optionalText })).max(100) }).parse(await fetchJson(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ search_text: input.query, limit: input.limit }),
    }));
    return data.results.slice(0, input.limit).map(r => ({ recipientName: r.recipient_name, uei: r.uei ?? null, duns: r.duns ?? null, recipientLevel: r.recipient_level ?? null }));
  }, access);
}

export interface SecIndexAccess {
  reserve: () => Promise<void>;
  cooldown: (until: Date) => Promise<void>;
}
export async function searchSecCompanies(query: string, limit = 5, access: SecIndexAccess = {
  reserve: () => evidenceRepository.reserveSecProviderBudget(),
  cooldown: until => evidenceRepository.setSecCooldown(until),
}): Promise<FeedResult<SecCompanyMatch[]>> {
  const input = searchInput.parse({ query, limit });
  const url = "https://www.sec.gov/files/company_tickers.json";
  // All queries share one index. Refresh failures preserve stale disclosure.
  const result = await secFeed("index", url, async () => {
    if (!ENV.secUserAgent || !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(ENV.secUserAgent)) throw new FeedError("SEC identification is not configured.");
    try { await access.reserve(); }
    catch { throw new FeedError("SEC shared budget or storage is unavailable; no provider request made."); }
    const rows = z.record(z.string().regex(/^\d+$/), z.object({ cik_str: z.number().int().positive().max(9999999999), ticker: text, title: text })).parse(await fetchJson(url, { headers: { "User-Agent": ENV.secUserAgent } }, access.cooldown));
    if (Object.keys(rows).length > 30_000) throw new FeedError("SEC index exceeds the row limit.");
    return Object.values(rows).map(r => ({ cik: String(r.cik_str).padStart(10, "0"), ticker: r.ticker, title: r.title }));
  });
  if (!result.data) return result;
  const q = input.query.toUpperCase();
  const data = [...result.data.filter(r => r.ticker.toUpperCase() === q), ...result.data.filter(r => r.ticker.toUpperCase() !== q && r.title.toUpperCase().includes(q))].slice(0, input.limit);
  return { ...result, data, status: result.status === "stale" ? "stale" : data.length ? "ok" : "empty" };
}

export async function getForexRates(base = "USD", symbols?: string[], access?: FeedAccess): Promise<FeedResult<FxRatesResult>> {
  const input = forexInput.parse({ base, symbols });
  const targets = Array.from(new Set(input.symbols)).sort();
  // Canonical endpoint inspected 2026-10-11; .app redirects here with HTTP 301.
  const url = "https://api.frankfurter.dev/v1/latest?from=" + input.base + "&to=" + encodeURIComponent(targets.join(","));
  return forexFeed(url, url, async () => {
    const data = z.object({ base: currency, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), rates: z.record(currency, z.number().finite().positive()) }).parse(await fetchJson(url));
    const date = new Date(data.date + "T00:00:00Z");
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== data.date || date.getTime() > Date.now()) throw new FeedError("Provider returned an invalid rate date.");
    if (data.base !== input.base || Object.keys(data.rates).length !== targets.length || targets.some(s => data.rates[s] === undefined)) throw new FeedError("Provider currencies do not match the request.");
    return data;
  }, access);
}

export function getBrandFaviconUrl(domainOrHost: string): string {
  const input = z.string().min(1).max(253).parse(domainOrHost).trim();
  const parsed = new URL(/^https?:\/\//i.test(input) ? input : "https://" + input);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.port || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(parsed.hostname)) throw new Error("Invalid public domain");
  return "https://favicon.im/" + parsed.hostname + "?larger=true";
}

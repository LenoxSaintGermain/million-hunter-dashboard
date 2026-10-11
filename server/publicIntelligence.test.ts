import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

let api: typeof import("./publicIntelligence");
let fetchMock: ReturnType<typeof vi.fn>;
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
const market = { id: "m1", question: "Which outcome?", slug: "test-market", outcomes: '["No","Yes"]', outcomePrices: '["0.25","0.75"]' };
const event = { id: "e1", title: "Illustrative test event", slug: "test-event", markets: [market] };
const fx = { base: "USD", date: "2026-10-09", rates: { EUR: 0.9, GBP: 0.8 } };
const sec = { "0": { cik_str: 1234, ticker: "TEST", title: "Test Corporation" } };
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
  fetchMock = vi.fn().mockRejectedValue(new Error("Unexpected mocked fetch"));
  vi.stubGlobal("fetch", fetchMock);
  api = await import("./publicIntelligence");
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("validated feed contracts (no live providers)", () => {
  it("preserves string-encoded odds and the actual first outcome, not default Yes", async () => {
    fetchMock.mockResolvedValueOnce(json([event]));
    const result = await api.getMacroOdds();
    expect(result).toMatchObject({ status: "ok", source: "Polymarket Gamma", fetchedAt: "2026-10-11T12:00:00.000Z", message: null });
    expect(result.data?.[0].markets[0]).toMatchObject({ probabilityPct: 25, outcomeLabel: "No", volume: null, prices: ["0.25", "0.75"] });
  });
  it("keeps missing probabilities and outcomes null without inventing 50 or Yes", async () => {
    fetchMock.mockResolvedValueOnce(json([{ ...event, markets: [{ id: "m1", question: "Unknown odds", slug: "test" }] }]));
    const result = await api.getMacroOdds();
    expect(result.data?.[0].markets[0]).toMatchObject({ probabilityPct: null, outcomeLabel: null, outcomes: [], prices: [] });
  });
  it.each([
    { ...market, id: undefined },
    { ...market, outcomePrices: '["0.5"]' },
    { ...market, outcomes: undefined },
    { ...market, outcomePrices: '["NaN","0.4"]' },
    { ...market, outcomePrices: '[1.1,0]' },
    { ...market, outcomes: "not json" },
  ])("rejects missing identifiers or inconsistent/malformed probabilities %#", async (bad) => {
    fetchMock.mockResolvedValueOnce(json([{ ...event, markets: [bad] }]));
    expect(await api.getMacroOdds()).toMatchObject({ status: "unavailable", data: null, fetchedAt: null });
  });
  it("keeps a real zero probability", async () => {
    fetchMock.mockResolvedValueOnce(json([{ ...event, markets: [{ ...market, outcomePrices: [0, 1] }] }]));
    expect((await api.getMacroOdds()).data?.[0].markets[0].probabilityPct).toBe(0);
  });
  it("excludes closed and inactive nested markets even in an active event", async () => {
    fetchMock.mockResolvedValueOnce(json([{ ...event, active: true, markets: [
      { ...market, id: "closed", closed: true, active: true, outcomePrices: [0, 1], endDate: "2026-06-30T00:00:00Z" },
      { ...market, id: "inactive", active: false },
      { ...market, id: "open", active: true, closed: false, endDate: "2026-12-31T00:00:00Z" },
    ] }]));
    expect((await api.getMacroOdds()).data?.[0].markets).toEqual([expect.objectContaining({ id: "open", active: true, closed: false, endDate: "2026-12-31T00:00:00Z" })]);
  });
  it("returns empty when all nested markets were explicitly closed", async () => {
    fetchMock.mockResolvedValueOnce(json([{ ...event, markets: [{ ...market, closed: true }] }]));
    expect(await api.getMacroOdds()).toMatchObject({ status: "empty", data: [] });
  });
  it.each([{ closed: "false" }, { active: "true" }, { closed: 1 }])("rejects malformed source market flags %#", async flags => {
    fetchMock.mockResolvedValueOnce(json([{ ...event, markets: [{ ...market, ...flags }] }]));
    expect(await api.getMacroOdds()).toMatchObject({ status: "unavailable", data: null });
  });
  it("maps only inspected Markbase fields; unknown code remains unknown", async () => {
    fetchMock.mockResolvedValueOnce(json({ hits: [{ serial_number: "99268951", word_mark: "TEST", status_code: "700", owner_name: null, _formatted: { word_mark: "<em>TEST</em>" } }] }));
    expect((await api.searchTrademarks("Test")).data?.[0]).toEqual({ serialNumber: "99268951", wordMark: "TEST", statusCode: "700", statusLabel: null, ownerName: null, goodsServices: null, filingDate: null });
  });
  it("does not manufacture missing trademark identifiers or names", async () => {
    fetchMock.mockResolvedValueOnce(json({ hits: [{ word_mark: "TEST" }] }));
    expect((await api.searchTrademarks("Test")).status).toBe("unavailable");
  });
  it("preserves absent federal identifiers as null, not an active profile", async () => {
    fetchMock.mockResolvedValueOnce(json({ results: [{ recipient_name: "TEST RECIPIENT", uei: null, duns: null, recipient_level: null }] }));
    const result = await api.searchFederalContractors("Test");
    expect(result.data).toEqual([{ recipientName: "TEST RECIPIENT", uei: null, duns: null, recipientLevel: null }]);
    expect(result.sourceUrl).toBe("https://www.usaspending.gov/search");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.usaspending.gov/api/v2/autocomplete/recipient/");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ search_text: "Test", limit: 5 });
  });
  it("validates SEC entries and pads only a real supplied CIK", async () => {
    fetchMock.mockResolvedValueOnce(json(sec));
    expect((await api.searchSecCompanies("test")).data).toEqual([{ cik: "0000001234", ticker: "TEST", title: "Test Corporation" }]);
    expect((await api.searchSecCompanies("no-match")).status).toBe("empty");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("validates dated FX values and canonicalizes equivalent cache keys", async () => {
    fetchMock.mockResolvedValueOnce(json(fx));
    const first = await api.getForexRates("USD", ["GBP", "EUR"]);
    expect(first).toMatchObject({ status: "ok", data: fx });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.frankfurter.dev/v1/latest?from=USD&to=EUR%2CGBP");
    expect(fetchMock.mock.calls[0][1].redirect).toBe("error");
    expect(await api.getForexRates("USD", ["EUR", "GBP", "EUR"])).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...fx, base: "EUR" },
    { ...fx, rates: { EUR: 0.9 } },
    { ...fx, rates: { EUR: "0.9", GBP: 0.8 } },
    { ...fx, date: "2026-02-30" },
    { ...fx, date: "2027-01-01" },
  ])("rejects FX mismatch/missing/invalid fields %#", async bad => {
    fetchMock.mockResolvedValueOnce(json(bad));
    expect(await api.getForexRates("USD", ["EUR", "GBP"])).toMatchObject({ status: "unavailable", data: null });
  });
  it.each(["macro", "trademark", "federal", "sec"] as const)("distinguishes validated empty %s from schema mismatch", async feed => {
    const call = () => feed === "macro" ? api.getMacroOdds() : feed === "trademark" ? api.searchTrademarks("Test") : feed === "federal" ? api.searchFederalContractors("Test") : api.searchSecCompanies("Test");
    fetchMock.mockResolvedValueOnce(json(feed === "macro" ? [] : feed === "trademark" ? { hits: [] } : feed === "federal" ? { results: [] } : {}));
    expect(await call()).toMatchObject({ status: "empty", data: [], message: null });
  });
  it.each(["macro", "trademark", "federal", "sec"] as const)("rejects invalid %s response envelopes", async feed => {
    fetchMock.mockResolvedValueOnce(json({ error: "bad shape" }));
    const result = await (feed === "macro" ? api.getMacroOdds() : feed === "trademark" ? api.searchTrademarks("Test") : feed === "federal" ? api.searchFederalContractors("Test") : api.searchSecCompanies("Test"));
    expect(result).toMatchObject({ status: "unavailable", data: null });
  });
});

describe("transport limits and cache", () => {
  it.each([403, 429, 500])("discloses HTTP %s and negative-caches failures", async status => {
    fetchMock.mockResolvedValueOnce(new Response("blocked", { status }));
    const first = await api.getMacroOdds();
    expect(first).toMatchObject({ status: "unavailable", data: null, message: "Provider returned HTTP " + status + ". Retry after 30 seconds." });
    expect(await api.getMacroOdds()).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("discloses network failures without leaking raw exception text", async () => {
    fetchMock.mockRejectedValueOnce(new Error("secret provider diagnostic"));
    expect(await api.getMacroOdds()).toMatchObject({ status: "unavailable", message: "Provider network or response read failed. Retry after 30 seconds." });
  });
  it("bounds headers that never arrive", async () => {
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    const result = api.getMacroOdds();
    await vi.advanceTimersByTimeAsync(8001);
    expect(await result).toMatchObject({ status: "unavailable", message: expect.stringContaining("timed out") });
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it("times out and cancels a stalled body after successful headers", async () => {
    const cancel = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("[")); }, cancel })));
    const result = api.getMacroOdds();
    await vi.advanceTimersByTimeAsync(8001);
    expect(await result).toMatchObject({ status: "unavailable", message: expect.stringContaining("timed out") });
    expect(cancel).toHaveBeenCalled();
  });
  it.each([true, false])("bounds body bytes with or without Content-Length (%s)", async declared => {
    fetchMock.mockResolvedValueOnce(new Response("x".repeat(2 * 1024 * 1024 + 1), declared ? { headers: { "Content-Length": String(2 * 1024 * 1024 + 1) } } : undefined));
    expect(await api.getMacroOdds()).toMatchObject({ status: "unavailable", message: expect.stringContaining("size limit") });
  });
  it("rejects malformed JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{"));
    expect(await api.getMacroOdds()).toMatchObject({ status: "unavailable", message: "Provider returned invalid JSON. Retry after 30 seconds." });
  });
  it("coalesces requests and isolates cached values from caller mutation", async () => {
    fetchMock.mockResolvedValueOnce(json([event]));
    const results = await Promise.all(Array.from({ length: 10 }, () => api.getMacroOdds()));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    results[0].data![0].title = "mutated";
    expect((await api.getMacroOdds()).data?.[0].title).toBe(event.title);
  });
  it("discloses stale data, cooldown, then recovers on retry", async () => {
    fetchMock.mockResolvedValueOnce(json([event]));
    const first = await api.getMacroOdds();
    await vi.advanceTimersByTimeAsync(60_001);
    fetchMock.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    const stale = await api.getMacroOdds();
    expect(stale).toMatchObject({ status: "stale", data: first.data, fetchedAt: first.fetchedAt, message: expect.stringContaining("503") });
    expect(stale.attemptedAt).not.toBe(first.attemptedAt);
    expect(await api.getMacroOdds()).toEqual(stale);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_001);
    fetchMock.mockResolvedValueOnce(json([]));
    expect((await api.getMacroOdds()).status).toBe("empty");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it.each(["http", "network", "schema"])("keeps SEC stale on %s refresh failure across search terms", async failure => {
    fetchMock.mockResolvedValueOnce(json(sec));
    const first = await api.searchSecCompanies("TEST");
    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000 + 1);
    if (failure === "network") fetchMock.mockRejectedValueOnce(new Error("offline"));
    else fetchMock.mockResolvedValueOnce(failure === "http" ? new Response("no", { status: 403 }) : json({ "0": { ticker: "TEST" } }));
    expect(await api.searchSecCompanies("TEST")).toMatchObject({ status: "stale", fetchedAt: first.fetchedAt, data: first.data });
    expect(await api.searchSecCompanies("unmatched")).toMatchObject({ status: "stale", data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("does not serve indefinitely stale data", async () => {
    fetchMock.mockResolvedValueOnce(json([event]));
    await api.getMacroOdds();
    await vi.advanceTimersByTimeAsync(60 * 60_000 + 1);
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await api.getMacroOdds()).toMatchObject({ status: "unavailable", data: null, fetchedAt: null });
  });
  it("limits high-cardinality provider requests", async () => {
    fetchMock.mockImplementation(async () => json([]));
    for (let i = 0; i < 60; i++) expect((await api.getMacroOdds({ tagSlug: "tag-" + i })).status).toBe("empty");
    expect(await api.getMacroOdds({ tagSlug: "tag-extra" })).toMatchObject({ status: "unavailable", message: expect.stringContaining("budget") });
    expect(fetchMock).toHaveBeenCalledTimes(60);
  });
  it("rejects invalid inputs before provider access", async () => {
    await expect(api.getMacroOdds({ limit: -1 })).rejects.toThrow();
    await expect(api.getMacroOdds({ limit: 1.5 })).rejects.toThrow();
    await expect(api.getMacroOdds({ tagSlug: "bad&query" })).rejects.toThrow();
    await expect(api.searchTrademarks(" ")).rejects.toThrow();
    await expect(api.searchFederalContractors("x".repeat(121))).rejects.toThrow();
    await expect(api.searchSecCompanies("test", 100)).rejects.toThrow();
    await expect(api.getForexRates("usd")).rejects.toThrow();
    await expect(api.getForexRates("USD", ["USD"])).rejects.toThrow();
    await expect(api.getForexRates("USD", [])).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("constructs favicon URLs only from validated public hosts", () => {
    expect(api.getBrandFaviconUrl("https://apple.com/iphone")).toBe("https://favicon.im/apple.com?larger=true");
    for (const value of ["", "localhost", "https://user:pass@example.com", "127.0.0.1", "javascript:alert(1)"]) expect(() => api.getBrandFaviconUrl(value)).toThrow();
  });
});

describe("real router authentication, role policy and throttling", () => {
  async function caller(role: string | null, id = 1) {
    const { publicIntelligenceRouter } = await import("./routers/publicIntelligenceRouter");
    const { router } = await import("./_core/trpc");
    return router({ publicIntelligence: publicIntelligenceRouter }).createCaller({ user: role ? { id, role, openId: "test-user" } : null } as TrpcContext).publicIntelligence;
  }
  it("rejects anonymous callers before fetch", async () => {
    const client = await caller(null);
    await expect(client.getMacroOdds({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["user", "admin", "investor", "capital_operator"])("allows authenticated %s without broadening existing legacy policy", async role => {
    fetchMock.mockResolvedValueOnce(json([]));
    expect((await (await caller(role)).getMacroOdds({})).status).toBe("empty");
    const { assertLegacyCatalogAccess } = await import("./_core/legacyCatalogAccess");
    if (role !== "admin") expect(() => assertLegacyCatalogAccess("admin.anyOperation", { role })).toThrow();
  });
  it("rejects bounded input violations as BAD_REQUEST", async () => {
    await expect((await caller("user")).searchTrademarks({ query: "  " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("throttles a caller across endpoints and resets after the window", async () => {
    const client = await caller("user");
    for (let i = 0; i < 30; i++) await client.getBrandFaviconUrl({ domain: "example.com" });
    await expect(client.getMacroOdds({})).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_001);
    expect(await client.getBrandFaviconUrl({ domain: "example.com" })).toEqual({ url: "https://favicon.im/example.com?larger=true" });
  });
});

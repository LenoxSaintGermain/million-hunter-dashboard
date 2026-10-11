import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { publicIntelligenceRouter } from "./routers/publicIntelligenceRouter";

let identity = 900000;
function caller(authenticated = true) {
  return publicIntelligenceRouter.createCaller({
    user: authenticated ? { id: ++identity, role: "user" } : null,
    req: {},
    res: {},
  } as TrpcContext);
}
const network = vi.fn(async (url: string | URL | Request) => {
  const address = String(url);
  const body = address.includes("markbase")
    ? { hits: [] }
    : address.includes("usaspending")
      ? { results: [] }
      : address.includes("sec.gov")
        ? {}
        : address.includes("frankfurter")
          ? { base: "USD", date: "2026-01-02", rates: { EUR: 0.9 } }
          : [];
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
});

beforeEach(() => {
  network.mockClear();
  vi.stubGlobal("fetch", network);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Public Intelligence router auth and input boundaries", () => {
  it("rejects anonymous callers on every procedure before network access", async () => {
    const guest = caller(false);
    const requests = [
      guest.getMacroOdds({}),
      guest.searchTrademarks({ query: "Example" }),
      guest.searchFederalContractors({ query: "Example" }),
      guest.searchSecCompanies({ query: "Example" }),
      guest.getForexRates({ base: "USD", symbols: ["EUR"] }),
      guest.getBrandFaviconUrl({ domain: "example.com" }),
    ];
    for (const result of await Promise.allSettled(requests)) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected")
        expect(result.reason.code).toBe("UNAUTHORIZED");
    }
    expect(network).not.toHaveBeenCalled();
  });

  it("allows authenticated non-admin callers and preserves feed envelopes", async () => {
    const user = caller();
    const results = await Promise.all([
      user.getMacroOdds({}),
      user.searchTrademarks({ query: "Router valid trademark" }),
      user.searchFederalContractors({ query: "Router valid recipient" }),
      user.searchSecCompanies({ query: "Router valid SEC" }),
      user.getForexRates({ base: "USD", symbols: ["EUR"] }),
    ]);
    for (const result of results) {
      expect(["ok", "empty"]).toContain(result.status);
      expect(result.source).toBeTruthy();
      expect(result.sourceUrl).toMatch(/^https:\/\//);
      expect(Number.isFinite(Date.parse(result.fetchedAt!))).toBe(true);
      expect(Number.isFinite(Date.parse(result.attemptedAt))).toBe(true);
    }
    await expect(
      user.getBrandFaviconUrl({ domain: "example.com" })
    ).resolves.toEqual({ url: "https://favicon.im/example.com?larger=true" });
  });

  for (const procedure of [
    "searchTrademarks",
    "searchFederalContractors",
    "searchSecCompanies",
  ] as const) {
    it.each(["", "   ", "x".repeat(121)])(
      `${procedure} rejects invalid search text %#`,
      async query => {
        await expect(caller()[procedure]({ query })).rejects.toMatchObject({
          code: "BAD_REQUEST",
        });
        expect(network).not.toHaveBeenCalled();
      }
    );
    it.each([0, -1, 1.5, 11, Infinity, NaN])(
      `${procedure} rejects invalid limit %s`,
      async limit => {
        await expect(
          caller()[procedure]({ query: "Example", limit })
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        expect(network).not.toHaveBeenCalled();
      }
    );
    it(`${procedure} accepts 120 characters and limit endpoints`, async () => {
      for (const limit of [1, 10]) {
        await expect(
          caller()[procedure]({ query: "x".repeat(120), limit })
        ).resolves.toMatchObject({ status: "empty" });
      }
    });
  }

  it("trims search text before passing it upstream", async () => {
    await caller().searchFederalContractors({
      query: "  Router trimmed recipient  ",
    });
    const options = (
      network.mock.calls.at(-1) as unknown as [string, RequestInit]
    )[1];
    expect(JSON.parse(String(options.body)).search_text).toBe(
      "Router trimmed recipient"
    );
  });

  it.each([0, -1, 1.5, 21, Infinity, NaN])(
    "rejects invalid macro limit %s",
    async limit => {
      await expect(caller().getMacroOdds({ limit })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(network).not.toHaveBeenCalled();
    }
  );
  it.each(["", " ", "Economy", "../economy", "a".repeat(49)])(
    "rejects invalid category %s",
    async tagSlug => {
      await expect(caller().getMacroOdds({ tagSlug })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(network).not.toHaveBeenCalled();
    }
  );
  it("accepts bounded macro category and limit endpoints", async () => {
    for (const limit of [1, 20])
      await expect(
        caller().getMacroOdds({ tagSlug: "a".repeat(48), limit })
      ).resolves.toMatchObject({ status: "empty" });
  });

  it.each([
    { base: "usd", symbols: ["EUR"] },
    { base: "US", symbols: ["EUR"] },
    { base: "USD", symbols: [] },
    { base: "USD", symbols: ["eur"] },
    { base: "USD", symbols: ["USD"] },
    { base: "USD", symbols: Array(13).fill("EUR") },
  ])("rejects malformed FX input %#", async input => {
    await expect(caller().getForexRates(input)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(network).not.toHaveBeenCalled();
  });
  it.each([
    "",
    " ",
    "x".repeat(254),
    "localhost",
    "https://user:pass@example.com",
    "https://example.com:8080",
    "javascript:alert(1)",
  ])("rejects malformed favicon domain %#", async domain => {
    await expect(caller().getBrandFaviconUrl({ domain })).rejects.toMatchObject(
      { code: "BAD_REQUEST" }
    );
    expect(network).not.toHaveBeenCalled();
  });

  it("shares the 30-request quota across procedures, isolates users, and resets after a minute", async () => {
    vi.useFakeTimers();
    const user = caller();
    for (let index = 0; index < 30; index++)
      await user.getBrandFaviconUrl({ domain: "example.com" });
    await expect(user.getMacroOdds({})).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    await expect(
      caller().getBrandFaviconUrl({ domain: "example.com" })
    ).resolves.toHaveProperty("url");
    vi.advanceTimersByTime(60_000);
    await expect(
      user.getBrandFaviconUrl({ domain: "example.com" })
    ).resolves.toHaveProperty("url");
    expect(network).not.toHaveBeenCalled();
  });
});

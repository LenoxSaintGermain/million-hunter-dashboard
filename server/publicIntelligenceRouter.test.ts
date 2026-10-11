import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
const sharedAccess = vi.hoisted(() => ({
  caller: vi.fn(async (_ownerId: number) => undefined),
  provider: vi.fn(async (_provider: string) => undefined),
}));
vi.mock("./_core/env", () => ({
  ENV: { secUserAgent: "Synthetic unit test test@example.com" },
}));
vi.mock("./evidenceRepository", () => ({
  evidenceRepository: {
    reserveSecProviderBudget: vi.fn(async () => undefined),
    setSecCooldown: vi.fn(async () => undefined),
    reserveFeedCaller: sharedAccess.caller,
    reserveFeedProvider: sharedAccess.provider,
  },
}));
import {
  publicIntelligenceRouter,
  createPublicIntelligenceRouter,
} from "./routers/publicIntelligenceRouter";
import * as feeds from "./publicIntelligence";

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
  sharedAccess.caller.mockReset().mockResolvedValue(undefined);
  sharedAccess.provider.mockReset().mockResolvedValue(undefined);
  network.mockClear();
  vi.stubGlobal("fetch", network);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Public Intelligence router auth and input boundaries", () => {
  it("forwards general FeedAccess only to non-SEC adapters and preserves the first SEC argument", async () => {
    const empty = {
      status: "empty" as const,
      data: [],
      source: "Synthetic test",
      sourceUrl: "https://example.com",
      fetchedAt: "2026-01-02T00:00:00Z",
      attemptedAt: "2026-01-02T00:00:00Z",
      message: null,
    };
    const macro = vi.spyOn(feeds, "getMacroOdds").mockResolvedValue(empty);
    const trademarks = vi
      .spyOn(feeds, "searchTrademarks")
      .mockResolvedValue(empty);
    const recipients = vi
      .spyOn(feeds, "searchFederalContractors")
      .mockResolvedValue(empty);
    const sec = vi.spyOn(feeds, "searchSecCompanies").mockResolvedValue(empty);
    const fx = vi
      .spyOn(feeds, "getForexRates")
      .mockResolvedValue({
        ...empty,
        status: "ok",
        data: { base: "USD", date: "2026-01-02", rates: { EUR: 0.9 } },
      });
    const secAccess = {
      reserve: vi.fn(async () => undefined),
      cooldown: vi.fn(async (_until: Date) => undefined),
    };
    const feedAccess = {
      reserve: vi.fn(async (_provider: string) => undefined),
    };
    const reserve = vi.fn(async (_ownerId: number) => undefined);
    const user = createPublicIntelligenceRouter(
      secAccess,
      feedAccess,
      reserve
    ).createCaller({
      user: { id: ++identity, role: "user" },
      req: {},
      res: {},
    } as TrpcContext);
    await user.getMacroOdds({ tagSlug: "economy", limit: 2 });
    await user.searchTrademarks({ query: "Example", limit: 2 });
    await user.searchFederalContractors({ query: "Example", limit: 2 });
    await user.searchSecCompanies({ query: "Example", limit: 2 });
    await user.getForexRates({ base: "USD", symbols: ["EUR"] });
    expect(macro).toHaveBeenCalledWith(
      { tagSlug: "economy", limit: 2 },
      feedAccess
    );
    expect(trademarks).toHaveBeenCalledWith("Example", 2, feedAccess);
    expect(recipients).toHaveBeenCalledWith("Example", 2, feedAccess);
    expect(sec).toHaveBeenCalledWith("Example", 2, secAccess);
    expect(fx).toHaveBeenCalledWith("USD", ["EUR"], feedAccess);
    expect(reserve).toHaveBeenCalledTimes(5);
    expect(network).not.toHaveBeenCalled();
  });
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
    expect(sharedAccess.caller).not.toHaveBeenCalled();
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

  it("delegates the 30-request quota across router instances to shared storage", async () => {
    vi.useFakeTimers();
    // Simulated shared storage; production atomicity belongs to repository tests.
    const windows = new Map<number, { start: number; count: number }>();
    const reserve = vi.fn(async (ownerId: number) => {
      let window = windows.get(ownerId);
      if (!window || Date.now() - window.start >= 60_000) {
        window = { start: Date.now(), count: 0 };
        windows.set(ownerId, window);
      }
      if (++window.count > 30) throw { code: "RATE_LIMITED" };
    });
    const context = {
      user: { id: ++identity, role: "user" },
      req: {},
      res: {},
    } as TrpcContext;
    const user = createPublicIntelligenceRouter(
      undefined,
      undefined,
      reserve
    ).createCaller(context);
    const secondInstance = createPublicIntelligenceRouter(
      undefined,
      undefined,
      reserve
    ).createCaller(context);
    for (let index = 0; index < 30; index++)
      await user.getBrandFaviconUrl({ domain: "example.com" });
    await expect(secondInstance.getMacroOdds({})).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    await expect(
      createPublicIntelligenceRouter(undefined, undefined, reserve)
        .createCaller({
          ...context,
          user: { ...context.user!, id: ++identity },
        })
        .getBrandFaviconUrl({ domain: "example.com" })
    ).resolves.toHaveProperty("url");
    vi.advanceTimersByTime(60_000);
    await expect(
      user.getBrandFaviconUrl({ domain: "example.com" })
    ).resolves.toHaveProperty("url");
    expect(network).not.toHaveBeenCalled();
  });

  it.each([
    "RATE_LIMITED",
    "DATABASE_UNAVAILABLE",
    "BUDGET_STATE_INVALID",
    "UNEXPECTED",
  ])("fails closed and sanitizes caller reservation failure %s", async code => {
    sharedAccess.caller.mockRejectedValueOnce(
      Object.assign(new Error("SECRET database connection and SQL"), { code })
    );
    const result = await caller()
      .getMacroOdds({ tagSlug: "reservation-failure" })
      .catch(error => error);
    expect(result.code).toBe(
      code === "RATE_LIMITED" ? "TOO_MANY_REQUESTS" : "INTERNAL_SERVER_ERROR"
    );
    expect(result.message).not.toContain("SECRET");
    expect(network).not.toHaveBeenCalled();
  });

  it("awaits shared reservation before proceeding and uses authenticated owner ID", async () => {
    let release!: () => void;
    sharedAccess.caller.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          release = resolve;
        })
    );
    const user = caller();
    const ownerId = identity;
    let done = false;
    const pending = user
      .getBrandFaviconUrl({ domain: "example.com" })
      .then(result => {
        done = true;
        return result;
      });
    await vi.waitFor(() =>
      expect(sharedAccess.caller).toHaveBeenCalledWith(ownerId)
    );
    expect(done).toBe(false);
    release();
    await expect(pending).resolves.toHaveProperty("url");
  });
});

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apertureRuns, brokerOrders, portfolioAccounts, users } from "../../drizzle/schema";

// #41: the env-backed Alpaca paper rail is the deployment owner's account.
// Two users, one fake DB, one fake broker: nothing here reaches a real broker.
const h = vi.hoisted(() => ({
  account: null as any,
  bound: [] as any[],
  order: null as any,
  accountUserOpenId: null as string | null,
  writes: [] as any[],
  broker: {
    id: "alpaca_paper",
    available: () => true,
    unavailableReason: () => null,
    getAccount: vi.fn(),
    getPositions: vi.fn(),
    submitOrder: vi.fn(),
    getOrder: vi.fn(),
    getOrderByClientOrderId: vi.fn(),
  },
}));

function rows(table: unknown, mode: "limit" | "all"): any[] {
  if (table === users) return [{ openId: h.accountUserOpenId }];
  if (table === portfolioAccounts) return mode === "limit" ? (h.account ? [h.account] : []) : h.bound;
  if (table === brokerOrders) return h.order ? [h.order] : [];
  if (table === apertureRuns) return [{ maxSingleNamePct: null, liquidityFloorAdvUsd: null }];
  return [];
}
const fakeDb = {
  select: () => ({ from: (table: unknown) => ({ where: () => ({
    limit: async () => rows(table, "limit"),
    orderBy: () => ({ limit: async () => rows(table, "limit") }),
    for: async () => rows(table, "limit"),
    then: (resolve: (value: any[]) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(rows(table, "all")).then(resolve, reject),
  }) }) }),
  update: () => ({ set: (value: unknown) => ({ where: async () => { h.writes.push(value); return [{ affectedRows: 1 }]; } }) }),
  delete: () => ({ where: async () => { h.writes.push("delete"); } }),
  insert: () => ({ values: async (value: unknown) => { h.writes.push(value); return [{ insertId: 99 }]; } }),
  transaction: async (fn: (tx: unknown) => unknown) => fn(fakeDb),
};
vi.mock("../db", async (importOriginal) => ({ ...(await importOriginal<typeof import("../db")>()), getDb: async () => fakeDb }));
vi.mock("./brokers/index", async (importOriginal) => ({ ...(await importOriginal<typeof import("./brokers/index")>()), brokerFor: () => h.broker }));
vi.mock("../_core/sdk", async (importOriginal) => {
  const original = await importOriginal<typeof import("../_core/sdk")>();
  return { ...original, sdk: { ...original.sdk, authenticateRequest: async () => ({ isCron: true, taskUid: "task-1" }) } };
});

import { appRouter } from "../routers";
import { envBrokerAccess, OWNER_ONLY_BROKER_MESSAGE } from "./brokers/envBrokerOwner";
import { submitOrder, approveOrder, mirrorFills } from "./orderFlow";
import { syncPaperAccount } from "./paperAccountSync";
import { handlePaperAccountSync } from "./paperAccountSyncScheduled";
import { redactUrlSecrets } from "./providers/types";
import { polygonProvider } from "./providers/marketData";
import { fmpProvider, benzingaProvider } from "./providers/paid";

const OWNER = { id: 1, openId: "owner-open-id", role: "admin" };
const OTHER = { id: 2, openId: "other-open-id", role: "capital_operator" };
const caller = (user: typeof OWNER) => appRouter.createCaller({ user, req: { headers: {} }, res: {} } as any);
const alpacaAccount = (userId: number, externalAccountId: string | null = null) => ({
  id: 10 + userId, userId, label: "Alpaca Paper", brokerId: "alpaca_paper", isPaper: true, externalAccountId,
  syncScheduleTaskUid: "task-1", syncScheduleEnabled: true, lastSyncedAt: null,
});
const brokerSnapshot = { externalAccountId: "PA-OWNER-1", cashCents: 1_000_000, buyingPowerCents: 1_000_000, equityValueCents: 1_000_000,
  optionsApprovedLevel: 0, optionsTradingLevel: 0, optionsBuyingPowerCents: 0, isPaper: true, asOf: Date.now() };
const response = () => {
  const res: any = { code: 200, body: null };
  res.status = (code: number) => { res.code = code; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  return res;
};

let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.stubEnv("OWNER_OPEN_ID", OWNER.openId);
  h.account = null; h.bound = []; h.order = null; h.accountUserOpenId = null; h.writes = [];
  for (const fn of [h.broker.getAccount, h.broker.getPositions, h.broker.submitOrder, h.broker.getOrder, h.broker.getOrderByClientOrderId]) fn.mockReset();
  h.broker.getAccount.mockResolvedValue(brokerSnapshot);
  h.broker.getPositions.mockResolvedValue([]);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("owner-only env-backed Alpaca paper (#41)", () => {
  it("decides on OWNER_OPEN_ID and leaves other rails alone", () => {
    expect(envBrokerAccess(OWNER.openId, "alpaca_paper")).toEqual({ allowed: true });
    expect(envBrokerAccess(OTHER.openId, "alpaca_paper")).toEqual({ allowed: false, reason: "not_owner" });
    expect(envBrokerAccess(null, "alpaca_paper")).toEqual({ allowed: false, reason: "unknown_user" });
    expect(envBrokerAccess(OTHER.openId, "manual")).toEqual({ allowed: true });
    vi.stubEnv("OWNER_OPEN_ID", "");
    expect(envBrokerAccess(OWNER.openId, "alpaca_paper")).toEqual({ allowed: false, reason: "owner_not_configured" });
  });

  it("account.sync: the owner syncs; a second operator is refused before any broker read", async () => {
    h.account = alpacaAccount(OWNER.id, "PA-OWNER-1");
    await expect(caller(OWNER).aperture.account.sync({ id: h.account.id })).resolves.toMatchObject({ synced: 0 });
    expect(h.broker.getAccount).toHaveBeenCalledOnce();

    h.broker.getAccount.mockClear(); h.writes = [];
    h.account = alpacaAccount(OTHER.id);
    await expect(caller(OTHER).aperture.account.sync({ id: h.account.id })).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: OWNER_ONLY_BROKER_MESSAGE });
    expect(h.broker.getAccount).not.toHaveBeenCalled();
    expect(h.writes).toEqual([]);
    expect(warnSpy.mock.calls.flat().join(" ")).toContain("Refused env-backed alpaca_paper for user 2 at account.sync");
  });

  it("configureSyncSchedule: a second operator is refused; the owner passes the gate", async () => {
    h.account = alpacaAccount(OTHER.id);
    await expect(caller(OTHER).aperture.account.configureSyncSchedule({ id: h.account.id, enabled: true })).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: OWNER_ONLY_BROKER_MESSAGE });
    h.account = alpacaAccount(OWNER.id);
    // Past the owner gate, the next check is the owner's own session cookie (absent in this fixture).
    await expect(caller(OWNER).aperture.account.configureSyncSchedule({ id: h.account.id, enabled: true })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(h.writes).toEqual([]);
  });

  it("account.create and the broker list keep the rail away from a second operator", async () => {
    await expect(caller(OTHER).aperture.account.create({ label: "Mine", brokerId: "alpaca_paper", isPaper: true })).rejects.toMatchObject({ message: OWNER_ONLY_BROKER_MESSAGE });
    await expect(caller(OTHER).aperture.account.create({ label: "Ledger", brokerId: "manual", isPaper: true })).resolves.toMatchObject({ id: 99 });
    const otherRail = (await caller(OTHER).aperture.brokers()).find(broker => broker.id === "alpaca_paper");
    expect(otherRail).toMatchObject({ available: false, unavailableReason: OWNER_ONLY_BROKER_MESSAGE });
    const ownerRail = (await caller(OWNER).aperture.brokers()).find(broker => broker.id === "alpaca_paper");
    expect(ownerRail?.unavailableReason).not.toBe(OWNER_ONLY_BROKER_MESSAGE);
  });

  it("order submit and approve: a second operator is refused before evaluation or dispatch", async () => {
    h.account = alpacaAccount(OTHER.id, "PA-OWNER-1");
    h.accountUserOpenId = OTHER.openId;
    const base = { id: 7, userId: OTHER.id, runId: 3, accountId: h.account.id, portfolioContextAccountId: null, candidateId: null,
      symbol: "AAPL", instrumentType: "shares", side: "buy", intent: "open", qty: 1, orderType: "limit", limitPriceCents: 10_000,
      timeInForce: "day", reason: "Paper test order.", entryPriceCents: 10_000, noTradeConditions: [] };
    h.order = { ...base, status: "approved" };
    await expect(submitOrder(7, OTHER.id, "SUBMIT PAPER")).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: OWNER_ONLY_BROKER_MESSAGE });
    h.order = { ...base, status: "pending_approval" };
    await expect(approveOrder(7, OTHER.id, "APPROVE PAPER")).rejects.toMatchObject({ message: OWNER_ONLY_BROKER_MESSAGE });
    expect(h.broker.submitOrder).not.toHaveBeenCalled();
    expect(h.broker.getAccount).not.toHaveBeenCalled();
    expect(h.writes).toEqual([]);

    // The owner's identical order passes the gate (and stops later at the ordinary gates in this fixture).
    h.account = alpacaAccount(OWNER.id, "PA-OWNER-1");
    h.accountUserOpenId = OWNER.openId;
    h.order = { ...base, userId: OWNER.id, accountId: h.account.id, status: "approved" };
    const ownerAttempt = await submitOrder(7, OWNER.id, "SUBMIT PAPER").then(() => null, (error: Error) => error.message);
    expect(ownerAttempt).not.toBe(OWNER_ONLY_BROKER_MESSAGE);
  });

  it("mirrorFills never polls the owner's account for a second operator", async () => {
    h.account = alpacaAccount(OTHER.id, "PA-OWNER-1");
    h.accountUserOpenId = OTHER.openId;
    h.order = { id: 8, userId: OTHER.id, accountId: h.account.id, status: "submitted", brokerOrderId: "b-1" };
    await expect(mirrorFills(OTHER.id)).resolves.toBe(0);
    expect(h.broker.getOrder).not.toHaveBeenCalled();
    // The owner's submitted order is polled as before.
    h.account = alpacaAccount(OWNER.id, "PA-OWNER-1");
    h.accountUserOpenId = OWNER.openId;
    h.order = { ...h.order, userId: OWNER.id, accountId: h.account.id };
    h.broker.getOrder.mockResolvedValue(null);
    await mirrorFills(OWNER.id);
    expect(h.broker.getOrder).toHaveBeenCalledWith("b-1");
  });

  it("scheduled paperAccountSync: a second operator's schedule is refused and recorded; the owner's is not", async () => {
    h.account = alpacaAccount(OTHER.id, "PA-OWNER-1");
    h.accountUserOpenId = OTHER.openId;
    const refused = response();
    await handlePaperAccountSync({ path: "/api/scheduled/capital-paper-account-sync", headers: {} } as any, refused);
    expect(refused.body).toMatchObject({ ok: true, skipped: "owner_only", summary: OWNER_ONLY_BROKER_MESSAGE });
    expect(h.writes).toEqual([expect.objectContaining({ syncScheduleLastResult: `Refused: ${OWNER_ONLY_BROKER_MESSAGE}` })]);
    expect(h.broker.getAccount).not.toHaveBeenCalled();
    await expect(syncPaperAccount(fakeDb as any, h.account)).rejects.toMatchObject({ message: OWNER_ONLY_BROKER_MESSAGE });
    expect(h.broker.getAccount).not.toHaveBeenCalled();

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-11T18:00:00Z")); // Sunday: past the owner gate, the market-session gate skips
    h.account = alpacaAccount(OWNER.id, "PA-OWNER-1");
    h.accountUserOpenId = OWNER.openId;
    h.writes = [];
    const owner = response();
    await handlePaperAccountSync({ path: "/api/scheduled/capital-paper-account-sync", headers: {} } as any, owner);
    expect(owner.body).toMatchObject({ ok: true, skipped: "market_closed" });
  });

  it("fails closed for everyone, with a clear server log line, when OWNER_OPEN_ID is absent", async () => {
    vi.stubEnv("OWNER_OPEN_ID", "");
    h.account = alpacaAccount(OWNER.id, "PA-OWNER-1");
    await expect(caller(OWNER).aperture.account.sync({ id: h.account.id })).rejects.toMatchObject({ message: OWNER_ONLY_BROKER_MESSAGE });
    expect(h.broker.getAccount).not.toHaveBeenCalled();
    expect(errorSpy.mock.calls.flat().join(" ")).toContain("[security] OWNER_OPEN_ID is not set; refusing env-backed alpaca_paper for user 1 at account.sync");
  });
});

describe("global external-account binding (#41)", () => {
  it("refuses to bind an Alpaca account another user already holds", async () => {
    h.account = alpacaAccount(OWNER.id, null);
    h.bound = [{ id: 12, userId: OTHER.id }];
    await expect(caller(OWNER).aperture.account.sync({ id: h.account.id })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("already bound by another user") });
    expect(h.writes).toEqual([]);
  });

  it("keeps an existing (pre-#41) binding syncing and logs the other rows for cleanup", async () => {
    h.account = alpacaAccount(OWNER.id, "PA-OWNER-1");
    h.bound = [{ id: h.account.id, userId: OWNER.id }, { id: 12, userId: OTHER.id }];
    await expect(caller(OWNER).aperture.account.sync({ id: h.account.id })).resolves.toMatchObject({ synced: 0 });
    expect(warnSpy.mock.calls.flat().join(" ")).toContain("is also bound by account row(s) 12");
    expect(warnSpy.mock.calls.flat().join(" ")).not.toContain("PA-OWNER-1");
  });

  it("still refuses a duplicate binding inside the same workspace", async () => {
    h.account = alpacaAccount(OWNER.id, null);
    h.bound = [{ id: 30, userId: OWNER.id }];
    await expect(caller(OWNER).aperture.account.sync({ id: h.account.id })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("in your workspace") });
  });
});

describe("provider keys never appear in logged URLs (#41)", () => {
  it("redacts key-bearing query parameters", () => {
    expect(redactUrlSecrets("https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=fred-secret&file_type=json"))
      .toBe("https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=REDACTED&file_type=json");
    expect(redactUrlSecrets("https://x.test/a?apiKey=p1&apikey=p2&token=p3&access_token=p4&key=p5#frag"))
      .toBe("https://x.test/a?apiKey=REDACTED&apikey=REDACTED&token=REDACTED&access_token=REDACTED&key=REDACTED#frag");
    expect(redactUrlSecrets("https://x.test/a?symbol=AAPL&keyword=x")).toBe("https://x.test/a?symbol=AAPL&keyword=x");
  });

  it("sends Polygon and FMP keys in headers, and logs failed provider URLs redacted", async () => {
    vi.stubEnv("POLYGON_API_KEY", "poly-secret");
    vi.stubEnv("FMP_API_KEY", "fmp-secret");
    vi.stubEnv("BENZINGA_API_KEY", "bz-secret");
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
      calls.push({ url, headers: init.headers });
      return { ok: false, status: 403, json: async () => null };
    }));
    const ctx = { now: Date.UTC(2026, 9, 8, 16), timeoutMs: 1_000 };
    await polygonProvider.fetchSecurityFacts!("AAPL", ctx);
    await fmpProvider.fetchSecurityFacts!("AAPL", ctx);
    await benzingaProvider.fetchSecurityFacts!("AAPL", ctx);
    const polygon = calls.find(call => call.url.includes("api.polygon.io"))!;
    expect(polygon.url).not.toContain("poly-secret");
    expect(polygon.headers.Authorization).toBe("Bearer poly-secret");
    const fmp = calls.filter(call => call.url.includes("financialmodelingprep.com"));
    expect(fmp).toHaveLength(2);
    for (const call of fmp) { expect(call.url).not.toContain("fmp-secret"); expect(call.headers.apikey).toBe("fmp-secret"); }
    const logged = warnSpy.mock.calls.flat().join("\n");
    expect(logged).toContain("[provider] GET https://api.benzinga.com");
    for (const secret of ["poly-secret", "fmp-secret", "bz-secret"]) expect(logged).not.toContain(secret);
  });
});

describe("dead-end key guidance and test lanes (#41)", () => {
  it("no data-key guidance links to /settings", () => {
    const home = readFileSync("client/src/pages/aperture/ApertureHome.tsx", "utf8");
    expect(home).not.toContain('navigate("/settings")');
    expect(home).not.toMatch(/in Settings/);
    expect(home).toContain('NOT_CONNECTED_GUIDANCE = "Not connected · coming soon in Sources"');
  });

  it("keeps api-keys.test.ts out of the default lane and in test:credentials", () => {
    expect(readFileSync("vitest.config.ts", "utf8")).toContain('"server/api-keys.test.ts"');
    expect(readFileSync("vitest.credentials.config.ts", "utf8")).toContain('include: ["server/api-keys.test.ts"]');
    expect(readFileSync("server/api-keys.test.ts", "utf8").match(/it\("/g)).toHaveLength(4);
  });
});

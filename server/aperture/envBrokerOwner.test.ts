import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apertureRuns, brokerOrders, portfolioAccounts, users } from "../../drizzle/schema";

// #41: the env-backed Alpaca paper rail, open to all operators by default (UAT)
// and owner-only when ALPACA_SHARED_KEY_OWNER_ONLY=true (go-live).
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
import { envBrokerAccess, logSharedAlpacaKeyMode, OWNER_ONLY_BROKER_MESSAGE, sharedAlpacaKeyOwnerOnly } from "./brokers/envBrokerOwner";
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

// Both states of the go-live switch. Off (the default) is the UAT behaviour from
// before #41; on is the owner-only behaviour.
describe.each([
  { mode: "off (default, UAT)", flag: undefined as string | undefined, ownerOnly: false },
  { mode: "on (go-live)", flag: "true", ownerOnly: true },
])("ALPACA_SHARED_KEY_OWNER_ONLY $mode", ({ flag, ownerOnly }) => {
  beforeEach(() => {
    if (flag === undefined) delete process.env.ALPACA_SHARED_KEY_OWNER_ONLY;
    else vi.stubEnv("ALPACA_SHARED_KEY_OWNER_ONLY", flag);
  });
  afterEach(() => { delete process.env.ALPACA_SHARED_KEY_OWNER_ONLY; });
  const refusal = { code: "PRECONDITION_FAILED", message: OWNER_ONLY_BROKER_MESSAGE };

  it("decides on the flag and OWNER_OPEN_ID, and leaves other rails alone", () => {
    expect(sharedAlpacaKeyOwnerOnly()).toBe(ownerOnly);
    expect(envBrokerAccess(OWNER.openId, "alpaca_paper")).toEqual({ allowed: true });
    expect(envBrokerAccess(OTHER.openId, "alpaca_paper")).toEqual(ownerOnly ? { allowed: false, reason: "not_owner" } : { allowed: true });
    expect(envBrokerAccess(null, "alpaca_paper")).toEqual(ownerOnly ? { allowed: false, reason: "unknown_user" } : { allowed: true });
    expect(envBrokerAccess(OTHER.openId, "manual")).toEqual({ allowed: true });
    vi.stubEnv("OWNER_OPEN_ID", "");
    expect(envBrokerAccess(OWNER.openId, "alpaca_paper")).toEqual(ownerOnly ? { allowed: false, reason: "owner_not_configured" } : { allowed: true });
  });

  it("logs the mode once at startup", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    logSharedAlpacaKeyMode();
    expect(infoSpy).toHaveBeenCalledOnce();
    expect(infoSpy.mock.calls[0][0]).toBe(ownerOnly
      ? "[alpaca] shared paper key restricted to the deployment owner (ALPACA_SHARED_KEY_OWNER_ONLY on)"
      : "[alpaca] shared paper key open to all operators (ALPACA_SHARED_KEY_OWNER_ONLY off)");
  });

  it(`account.sync: the owner syncs; a second operator is ${ownerOnly ? "refused before any broker read" : "allowed"}`, async () => {
    h.account = alpacaAccount(OWNER.id, "PA-OWNER-1");
    await expect(caller(OWNER).aperture.account.sync({ id: h.account.id })).resolves.toMatchObject({ synced: 0 });
    expect(h.broker.getAccount).toHaveBeenCalledOnce();

    h.broker.getAccount.mockClear(); h.writes = [];
    h.account = alpacaAccount(OTHER.id);
    const other = caller(OTHER).aperture.account.sync({ id: h.account.id });
    if (ownerOnly) {
      await expect(other).rejects.toMatchObject(refusal);
      expect(h.broker.getAccount).not.toHaveBeenCalled();
      expect(h.writes).toEqual([]);
      expect(warnSpy.mock.calls.flat().join(" ")).toContain("Refused env-backed alpaca_paper for user 2 at account.sync");
    } else {
      await expect(other).resolves.toMatchObject({ synced: 0 });
      expect(h.broker.getAccount).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls.flat().join(" ")).not.toContain("[security]");
    }
  });

  it("configureSyncSchedule: the second operator meets the flag's gate; the owner always passes it", async () => {
    h.account = alpacaAccount(OTHER.id);
    // Past the owner gate, the next check is the caller's own session cookie (absent in this fixture).
    await expect(caller(OTHER).aperture.account.configureSyncSchedule({ id: h.account.id, enabled: true }))
      .rejects.toMatchObject(ownerOnly ? refusal : { code: "UNAUTHORIZED" });
    h.account = alpacaAccount(OWNER.id);
    await expect(caller(OWNER).aperture.account.configureSyncSchedule({ id: h.account.id, enabled: true })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(h.writes).toEqual([]);
  });

  it("account.create and the broker list follow the flag for a second operator", async () => {
    vi.stubEnv("ALPACA_PAPER_KEY", "test-key-id");
    vi.stubEnv("ALPACA_PAPER_SECRET", "test-secret");
    const create = caller(OTHER).aperture.account.create({ label: "Mine", brokerId: "alpaca_paper", isPaper: true });
    if (ownerOnly) await expect(create).rejects.toMatchObject({ message: OWNER_ONLY_BROKER_MESSAGE });
    else await expect(create).resolves.toMatchObject({ id: 99 });
    await expect(caller(OTHER).aperture.account.create({ label: "Ledger", brokerId: "manual", isPaper: true })).resolves.toMatchObject({ id: 99 });
    const otherRail = (await caller(OTHER).aperture.brokers()).find(broker => broker.id === "alpaca_paper");
    expect(otherRail).toMatchObject(ownerOnly ? { available: false, unavailableReason: OWNER_ONLY_BROKER_MESSAGE } : { available: true, unavailableReason: null });
    const ownerRail = (await caller(OWNER).aperture.brokers()).find(broker => broker.id === "alpaca_paper");
    expect(ownerRail).toMatchObject({ available: true, unavailableReason: null });
  });

  it("order submit and approve: the gate applies to a second operator only when the flag is on", async () => {
    h.account = alpacaAccount(OTHER.id, "PA-OWNER-1");
    h.accountUserOpenId = OTHER.openId;
    const base = { id: 7, userId: OTHER.id, runId: 3, accountId: h.account.id, portfolioContextAccountId: null, candidateId: null,
      symbol: "AAPL", instrumentType: "shares", side: "buy", intent: "open", qty: 1, orderType: "limit", limitPriceCents: 10_000,
      timeInForce: "day", reason: "Paper test order.", entryPriceCents: 10_000, noTradeConditions: [] };
    const message = (promise: Promise<unknown>) => promise.then(() => null, (error: Error) => error.message);
    h.order = { ...base, status: "approved" };
    const submitted = await message(submitOrder(7, OTHER.id, "SUBMIT PAPER"));
    h.order = { ...base, status: "pending_approval" };
    const approved = await message(approveOrder(7, OTHER.id, "APPROVE PAPER"));
    if (ownerOnly) {
      expect([submitted, approved]).toEqual([OWNER_ONLY_BROKER_MESSAGE, OWNER_ONLY_BROKER_MESSAGE]);
      expect(h.broker.submitOrder).not.toHaveBeenCalled();
      expect(h.broker.getAccount).not.toHaveBeenCalled();
      expect(h.writes).toEqual([]);
    } else {
      // Not refused by the owner gate; it stops later at the ordinary gates in this fixture.
      expect(submitted).not.toBe(OWNER_ONLY_BROKER_MESSAGE);
      expect(approved).not.toBe(OWNER_ONLY_BROKER_MESSAGE);
    }

    // The owner's identical order passes the gate in both modes.
    h.account = alpacaAccount(OWNER.id, "PA-OWNER-1");
    h.accountUserOpenId = OWNER.openId;
    h.order = { ...base, userId: OWNER.id, accountId: h.account.id, status: "approved" };
    expect(await message(submitOrder(7, OWNER.id, "SUBMIT PAPER"))).not.toBe(OWNER_ONLY_BROKER_MESSAGE);
  });

  it(`mirrorFills ${ownerOnly ? "never polls" : "polls"} the shared account for a second operator`, async () => {
    h.account = alpacaAccount(OTHER.id, "PA-OWNER-1");
    h.accountUserOpenId = OTHER.openId;
    h.order = { id: 8, userId: OTHER.id, accountId: h.account.id, status: "submitted", brokerOrderId: "b-1" };
    h.broker.getOrder.mockResolvedValue(null);
    await expect(mirrorFills(OTHER.id)).resolves.toBe(0);
    if (ownerOnly) expect(h.broker.getOrder).not.toHaveBeenCalled();
    else expect(h.broker.getOrder).toHaveBeenCalledWith("b-1");
    // The owner's submitted order is polled in both modes.
    h.broker.getOrder.mockClear();
    h.account = alpacaAccount(OWNER.id, "PA-OWNER-1");
    h.accountUserOpenId = OWNER.openId;
    h.order = { ...h.order, userId: OWNER.id, accountId: h.account.id };
    await mirrorFills(OWNER.id);
    expect(h.broker.getOrder).toHaveBeenCalledWith("b-1");
  });

  it("scheduled paperAccountSync follows the flag for a second operator; the owner's schedule always passes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-11T18:00:00Z")); // Sunday: past the owner gate, the market-session gate skips
    h.account = alpacaAccount(OTHER.id, "PA-OWNER-1");
    h.accountUserOpenId = OTHER.openId;
    const other = response();
    await handlePaperAccountSync({ path: "/api/scheduled/capital-paper-account-sync", headers: {} } as any, other);
    if (ownerOnly) {
      expect(other.body).toMatchObject({ ok: true, skipped: "owner_only", summary: OWNER_ONLY_BROKER_MESSAGE });
      expect(h.writes).toEqual([expect.objectContaining({ syncScheduleLastResult: `Refused: ${OWNER_ONLY_BROKER_MESSAGE}` })]);
      await expect(syncPaperAccount(fakeDb as any, h.account)).rejects.toMatchObject({ message: OWNER_ONLY_BROKER_MESSAGE });
      expect(h.broker.getAccount).not.toHaveBeenCalled();
    } else {
      expect(other.body).toMatchObject({ ok: true, skipped: "market_closed" });
      await expect(syncPaperAccount(fakeDb as any, h.account)).resolves.toMatchObject({ synced: 0, source: "alpaca_paper" });
      expect(h.broker.getAccount).toHaveBeenCalledOnce();
    }

    h.account = alpacaAccount(OWNER.id, "PA-OWNER-1");
    h.accountUserOpenId = OWNER.openId;
    h.writes = [];
    const owner = response();
    await handlePaperAccountSync({ path: "/api/scheduled/capital-paper-account-sync", headers: {} } as any, owner);
    expect(owner.body).toMatchObject({ ok: true, skipped: "market_closed" });
  });

  it(`without OWNER_OPEN_ID: ${ownerOnly ? "fails closed for everyone, with a clear server log line" : "the shared key stays open"}`, async () => {
    vi.stubEnv("OWNER_OPEN_ID", "");
    h.account = alpacaAccount(OWNER.id, "PA-OWNER-1");
    const sync = caller(OWNER).aperture.account.sync({ id: h.account.id });
    if (ownerOnly) {
      await expect(sync).rejects.toMatchObject({ message: OWNER_ONLY_BROKER_MESSAGE });
      expect(h.broker.getAccount).not.toHaveBeenCalled();
      expect(errorSpy.mock.calls.flat().join(" ")).toContain("[security] OWNER_OPEN_ID is not set; refusing env-backed alpaca_paper for user 1 at account.sync");
    } else {
      await expect(sync).resolves.toMatchObject({ synced: 0 });
      expect(errorSpy).not.toHaveBeenCalled();
    }
  });

  it(`${ownerOnly ? "refuses" : "allows"} binding an Alpaca account another user already holds`, async () => {
    h.account = alpacaAccount(OWNER.id, null);
    h.bound = [{ id: 12, userId: OTHER.id }];
    const sync = caller(OWNER).aperture.account.sync({ id: h.account.id });
    if (ownerOnly) {
      await expect(sync).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("already bound by another user") });
      expect(h.writes).toEqual([]);
    } else {
      // UAT testers share one paper account: the second binding is recorded.
      await expect(sync).resolves.toMatchObject({ synced: 0 });
      expect(h.writes).toContainEqual(expect.objectContaining({ externalAccountId: "PA-OWNER-1" }));
    }
  });

  it("keeps an existing binding syncing; only owner-only mode logs the other rows for cleanup", async () => {
    h.account = alpacaAccount(OWNER.id, "PA-OWNER-1");
    h.bound = [{ id: h.account.id, userId: OWNER.id }, { id: 12, userId: OTHER.id }];
    await expect(caller(OWNER).aperture.account.sync({ id: h.account.id })).resolves.toMatchObject({ synced: 0 });
    const logged = warnSpy.mock.calls.flat().join(" ");
    if (ownerOnly) expect(logged).toContain("is also bound by account row(s) 12");
    else expect(logged).not.toContain("is also bound");
    expect(logged).not.toContain("PA-OWNER-1");
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

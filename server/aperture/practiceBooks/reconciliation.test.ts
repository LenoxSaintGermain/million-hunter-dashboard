import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDb, type MemoryDb } from "./memoryDb.testing";

const h = vi.hoisted(() => ({ mem: null as MemoryDb | null }));
vi.mock("../../db", () => ({ getDb: async () => h.mem!.db }));
vi.mock("../facts", () => ({ getFacts: async () => [], freshestPerKey: (rows: unknown) => rows, normSymbol: (s: string) => s.trim().toUpperCase() }));
vi.mock("../liquidityFactRefresh", () => ({ resolveLiquidityFact: async () => null }));
vi.mock("../decisionRunway", async (original) => ({ ...await original<typeof import("../decisionRunway")>(), authorizeDecisionAction: async () => null, queuePaperOutcome: vi.fn() }));
vi.mock("../gates", async (original) => ({ ...await original<typeof import("../gates")>(), evaluateOrderGates: () => ({ passed: true, results: [], failures: [], mandateVersion: "test" }) }));

import { apertureRuns, brokerOrders, portfolioAccounts, positions, uatBookAdjustments, uatHouseBaselines, uatPracticeBooks, users } from "../../../drizzle/schema";
import { appRouter } from "../../routers";
import { alpacaPaperBroker } from "../brokers/index";
import { submitOrder } from "../orderFlow";
import { resetHouseSnapshotCache } from "./houseSnapshot";
import { RECONCILIATION_ACTOR } from "./reconcile";
import { frozenSymbols } from "./repository";
import { createPracticeBook } from "./repository";

const NOW = Date.UTC(2026, 9, 8, 15, 0);
const OWNER = { id: 1, openId: "owner-open-id", role: "admin" } as const;
const A = { id: 2, openId: "tester-a", role: "capital_operator" } as const;
const B = { id: 3, openId: "tester-b", role: "capital_operator" } as const;
const caller = (user: typeof OWNER | typeof A | typeof B) => appRouter.createCaller({ user, req: { headers: {} }, res: {} } as any);
const HOUSE_ID = "PA-HOUSE-0001";

const house = {
  account: { externalAccountId: HOUSE_ID, cashCents: 980_000_000, buyingPowerCents: 1_960_000_000, equityValueCents: 1_000_165_000,
    optionsApprovedLevel: 2, optionsTradingLevel: 2, optionsBuyingPowerCents: 980_000_000, isPaper: true, asOf: NOW },
  positions: [
    { symbol: "NVDA", qty: 15, avgCostCents: 10_000, lastPriceCents: 11_000, marketValueCents: 165_000, assetType: "equity" as const },
    { symbol: "AMD", qty: 3, avgCostCents: 15_000, lastPriceCents: 15_000, marketValueCents: 45_000, assetType: "equity" as const },
    { symbol: "TSLA", qty: 2, avgCostCents: 20_000, lastPriceCents: 20_000, marketValueCents: 40_000, assetType: "equity" as const },
  ],
};
const spies = () => ({
  available: vi.spyOn(alpacaPaperBroker, "available").mockReturnValue(true),
  getAccount: vi.spyOn(alpacaPaperBroker, "getAccount").mockImplementation(async () => ({ ...house.account })),
  getPositions: vi.spyOn(alpacaPaperBroker, "getPositions").mockImplementation(async () => house.positions.map((p) => ({ ...p }))),
  submitOrder: vi.spyOn(alpacaPaperBroker, "submitOrder").mockImplementation(async () => ({ brokerOrderId: "alp-1", status: "accepted", filledQty: 0, filledAvgPriceCents: null, submittedAt: NOW })),
  getOrder: vi.spyOn(alpacaPaperBroker, "getOrder").mockResolvedValue(null),
  getOrderByClientOrderId: vi.spyOn(alpacaPaperBroker, "getOrderByClientOrderId").mockResolvedValue(null),
  getOrders: vi.spyOn(alpacaPaperBroker, "getOrders").mockResolvedValue([]),
});
let broker: ReturnType<typeof spies>;

const baseOrder = (over: Record<string, unknown>) => ({
  runId: 1, candidateId: null, portfolioContextAccountId: null, instrumentType: "shares", intent: "open", orderType: "limit", timeInForce: "day",
  notionalCents: null, contractMultiplier: null, gatedNotionalCents: null, clientOrderId: null, brokerOrderId: null, dispatchError: null,
  filledQty: null, filledAvgPriceCents: null, reason: "Practice test.", invalidationCondition: "Practice invalidation.", noTradeConditions: [],
  createdAt: NOW, updatedAt: NOW, ...over,
});

async function twoBooks() {
  const mem = h.mem!;
  mem.seed(users, { id: OWNER.id, openId: OWNER.openId, role: "admin" }, { id: A.id, openId: A.openId, role: "capital_operator" }, { id: B.id, openId: B.openId, role: "capital_operator" });
  mem.seed(apertureRuns, { id: 10 + A.id, userId: A.id }, { id: 10 + B.id, userId: B.id });
  const row = (userId: number) => mem.seed(portfolioAccounts, { userId, label: "Alpaca Paper", brokerId: "alpaca_paper", isPaper: true, createdAt: NOW, updatedAt: NOW }).at(-1)!;
  const rowA = row(A.id);
  const rowB = row(B.id);
  // Books that already traded were stamped with the house on their first read.
  const { bookId: bookA } = await createPracticeBook(mem.db, { userId: A.id, portfolioAccountId: rowA.id, createdBy: A.id, now: NOW, houseExternalAccountId: HOUSE_ID });
  const { bookId: bookB } = await createPracticeBook(mem.db, { userId: B.id, portfolioAccountId: rowB.id, createdBy: B.id, now: NOW, houseExternalAccountId: HOUSE_ID });
  const fill = (user: { id: number }, accountId: number, bookId: number, symbol: string, qty: number, price: number) => mem.seed(brokerOrders, baseOrder({
    userId: user.id, runId: 10 + user.id, accountId, practiceBookId: bookId, symbol, side: "buy", qty, limitPriceCents: price, status: "filled", filledQty: qty, filledAvgPriceCents: price,
  })).at(-1)!;
  fill(A, rowA.id, bookA, "NVDA", 10, 10_000);
  fill(B, rowB.id, bookB, "NVDA", 5, 10_000);
  fill(A, rowA.id, bookA, "AMD", 3, 15_000);
  fill(B, rowB.id, bookB, "TSLA", 2, 20_000);
  // Each tester syncs first, as the gates require a bound, fresh execution row.
  await caller(A).aperture.account.sync({ id: rowA.id });
  await caller(B).aperture.account.sync({ id: rowB.id });
  return { rowA: { ...rowA, practiceBookId: bookA }, rowB: { ...rowB, practiceBookId: bookB }, bookA, bookB };
}

function approvedOrder(user: { id: number }, accountId: number, bookId: number, over: Record<string, unknown>) {
  return h.mem!.seed(brokerOrders, baseOrder({ userId: user.id, runId: 10 + user.id, accountId, practiceBookId: bookId, status: "approved", ...over })).at(-1)!;
}
const syncedRow = (id: number) => h.mem!.rows(portfolioAccounts).find((row) => row.id === id)!;
const orderRow = (id: number) => h.mem!.rows(brokerOrders).find((row) => row.id === id)!;
const message = (promise: Promise<unknown>) => promise.then(() => null, (error: Error) => error.message);

beforeEach(() => {
  h.mem = createMemoryDb();
  resetHouseSnapshotCache();
  broker = spies();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("OWNER_OPEN_ID", OWNER.openId);
  delete process.env.UAT_PRACTICE_BOOKS;
  delete process.env.ALPACA_SHARED_KEY_OWNER_ONLY;
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); delete process.env.UAT_PRACTICE_BOOKS; delete process.env.ALPACA_SHARED_KEY_OWNER_ONLY; });

const setHouseQty = (symbol: string, qty: number) => {
  house.positions.find((p) => p.symbol === symbol)!.qty = qty;
  resetHouseSnapshotCache();
};
const freezeRows = () => h.mem!.rows(uatBookAdjustments).filter((row) => row.kind === "symbol_freeze" || row.kind === "symbol_unfreeze");
const sellPaused = "Sells of NVDA are paused while the shared practice account is reconciled. Buys are still allowed.";
afterEach(() => { house.positions.find((p) => p.symbol === "NVDA")!.qty = 15; });

describe("owner reconciliation (UAT-E4)", () => {
  it("a house holding 15 NVDA against books of 10 + 5 is balanced, and nothing is frozen", async () => {
    await twoBooks();
    const report = await caller(OWNER).aperture.uat.reconciliation();
    expect(report.symbols.find((line) => line.symbol === "NVDA")).toMatchObject({ houseQty: 15, bookQty: 15, delta: 0, balanced: true, frozen: false });
    expect(report.symbols.every((line) => line.balanced)).toBe(true);
    expect(report.unattributedOrders).toEqual([]);
    expect(report.newlyFrozen).toEqual([]);
    expect(report.houseExternalAccountId).toBe("••••0001");
    expect(report.bookCash).toMatchObject({ activeBookCashCents: (10_000_000 - 145_000) + (10_000_000 - 90_000), withinBuyingPower: true });
    expect(freezeRows()).toEqual([]);
  });

  it("a house holding 16 freezes NVDA sells for every book on the next snapshot; buys stay allowed", async () => {
    const { rowA, rowB, bookA, bookB } = await twoBooks();
    setHouseQty("NVDA", 16);
    const sellB = approvedOrder(B, rowB.id, bookB, { symbol: "NVDA", side: "sell", intent: "close", qty: 1, limitPriceCents: 11_000 });
    expect(await message(submitOrder(sellB.id, B.id, "SUBMIT PAPER", NOW))).toBe(sellPaused);
    // The freeze came from the automatic snapshot reconciliation, with a [uat-recon] reason.
    expect(freezeRows()).toEqual([expect.objectContaining({ bookId: null, kind: "symbol_freeze", symbol: "NVDA", houseExternalAccountId: HOUSE_ID, createdBy: RECONCILIATION_ACTOR, note: expect.stringContaining("House holds 16 NVDA, practice books hold 15") })]);
    const sellA = approvedOrder(A, rowA.id, bookA, { symbol: "NVDA", side: "sell", intent: "close", qty: 1, limitPriceCents: 11_000 });
    expect(await message(submitOrder(sellA.id, A.id, "SUBMIT PAPER", NOW))).toBe(sellPaused);
    expect(broker.submitOrder).not.toHaveBeenCalled();
    const buyA = approvedOrder(A, rowA.id, bookA, { symbol: "NVDA", side: "buy", qty: 1, limitPriceCents: 11_000 });
    await submitOrder(buyA.id, A.id, "SUBMIT PAPER", NOW);
    expect(broker.submitOrder).toHaveBeenCalledOnce();
    // The owner report shows the mismatch; a second run doesn't append a duplicate freeze.
    const report = await caller(OWNER).aperture.uat.reconciliation();
    expect(report.symbols.find((line) => line.symbol === "NVDA")).toMatchObject({ houseQty: 16, bookQty: 15, delta: 1, balanced: false, frozen: true });
    expect(report.balanced).toBe(false);
    expect(freezeRows()).toHaveLength(1);
  });

  it("lists a house order whose client_order_id doesn't start with sh- as unattributed, and freezes that booked symbol", async () => {
    const { bookA } = await twoBooks();
    broker.getOrders.mockResolvedValue([
      { brokerOrderId: "alp-manual", status: "filled", filledQty: 1, filledAvgPriceCents: 20_000, submittedAt: NOW, raw: { client_order_id: "web-7f3a", symbol: "TSLA", side: "sell", qty: "1" } },
      { brokerOrderId: "alp-book", status: "filled", filledQty: 1, filledAvgPriceCents: 11_000, submittedAt: NOW, raw: { client_order_id: `sh-b${bookA}-41`, symbol: "NVDA", side: "buy", qty: "1" } },
      { brokerOrderId: "alp-owner", status: "accepted", filledQty: 0, filledAvgPriceCents: null, submittedAt: NOW, raw: { client_order_id: "sh-paper-9", symbol: "SPY", side: "buy", qty: "1" } },
      { brokerOrderId: "alp-stranger", status: "accepted", filledQty: 0, filledAvgPriceCents: null, submittedAt: NOW, raw: { client_order_id: "sh-b999-1", symbol: "QQQ", side: "buy", qty: "2" } },
    ]);
    const report = await caller(OWNER).aperture.uat.reconciliation();
    expect(broker.getOrders).toHaveBeenCalledWith({ limit: 500 });
    expect(report.unattributedOrders).toEqual([
      expect.objectContaining({ brokerOrderId: "alp-manual", clientOrderId: "web-7f3a", symbol: "TSLA", side: "sell", qty: 1, touchesBookedSymbol: true }),
      expect.objectContaining({ brokerOrderId: "alp-stranger", clientOrderId: "sh-b999-1", symbol: "QQQ", touchesBookedSymbol: false }),
    ]);
    expect(report.newlyFrozen).toEqual(["TSLA"]);
    expect((await frozenSymbols(h.mem!.db, HOUSE_ID)).has("QQQ")).toBe(false);
    expect(report.balanced).toBe(false);
  });

  it("measures cash drift against the house baseline (±$1) and lists booked fills missing at the house", async () => {
    // Baseline before any book traded: the house had the four fills' cash ($2,350) more.
    h.mem!.seed(uatHouseBaselines, { houseExternalAccountId: HOUSE_ID, cashCents: house.account.cashCents + 235_000 + 50, buyingPowerCents: null, equityValueCents: null, positions: [], capturedBy: null, capturedAt: NOW - 1 });
    await twoBooks();
    broker.getOrders.mockResolvedValue([]);
    const report = await caller(OWNER).aperture.uat.reconciliation();
    expect(report.cash).toMatchObject({ bookFlowCents: -235_000, driftCents: -50, withinTolerance: true });
    expect(report.missingAtHouse).toHaveLength(4);
  });

  it("is owner-only: testers get FORBIDDEN for the report, freezes, unfreezes and adjustments", async () => {
    const { bookA } = await twoBooks();
    const tester = caller(A).aperture.uat;
    await expect(tester.reconciliation()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(tester.freezeSymbol({ symbol: "NVDA", note: "testing" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(tester.unfreezeSymbol({ symbol: "NVDA", note: "testing" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(tester.appendAdjustment({ bookId: bookA, kind: "cash_adjustment", cashCents: 1_000_000, note: "free money" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(freezeRows()).toEqual([]);
    expect(h.mem!.rows(uatBookAdjustments).filter((row) => row.kind === "cash_adjustment")).toEqual([]);
  });

  it("an unfreeze writes an audit row with actor and time, after the owner balances the books with an append-only adjustment", async () => {
    const { rowB, bookA, bookB } = await twoBooks();
    setHouseQty("NVDA", 16);
    await caller(OWNER).aperture.uat.reconciliation();
    expect((await frozenSymbols(h.mem!.db, HOUSE_ID)).has("NVDA")).toBe(true);
    await expect(caller(OWNER).aperture.uat.appendAdjustment({ bookId: bookA, kind: "corporate_action", symbol: "NVDA", qty: 1, note: "" })).rejects.toThrow();
    const posted = await caller(OWNER).aperture.uat.appendAdjustment({ bookId: bookA, kind: "corporate_action", symbol: "nvda", qty: 1, priceCents: 0, note: "Manual dashboard buy of 1 NVDA, attributed to book A" });
    expect(h.mem!.rows(uatBookAdjustments).find((row) => row.id === posted.id)).toMatchObject({ bookId: bookA, kind: "corporate_action", symbol: "NVDA", qty: 1, brokerBacked: true, createdBy: OWNER.id, createdAt: NOW, houseExternalAccountId: HOUSE_ID });
    vi.setSystemTime(NOW + 120_000);
    const unfrozen = await caller(OWNER).aperture.uat.unfreezeSymbol({ symbol: "NVDA", note: "Book A now carries the extra share" });
    expect(h.mem!.rows(uatBookAdjustments).find((row) => row.id === unfrozen.id)).toMatchObject({
      bookId: null, kind: "symbol_unfreeze", symbol: "NVDA", houseExternalAccountId: HOUSE_ID, createdBy: OWNER.id, createdAt: NOW + 120_000, note: "Book A now carries the extra share",
    });
    // The freeze row is still there (append-only); the latest row wins.
    expect(freezeRows().map((row) => row.kind)).toEqual(["symbol_freeze", "symbol_unfreeze"]);
    resetHouseSnapshotCache();
    const report = await caller(OWNER).aperture.uat.reconciliation();
    expect(report.symbols.find((line) => line.symbol === "NVDA")).toMatchObject({ houseQty: 16, bookQty: 16, balanced: true, frozen: false });
    const sellB = approvedOrder(B, rowB.id, bookB, { symbol: "NVDA", side: "sell", intent: "close", qty: 1, limitPriceCents: 11_000 });
    await submitOrder(sellB.id, B.id, "SUBMIT PAPER", NOW + 120_000);
    expect(broker.submitOrder).toHaveBeenCalledOnce();
    await expect(caller(OWNER).aperture.uat.unfreezeSymbol({ symbol: "NVDA", note: "again please" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

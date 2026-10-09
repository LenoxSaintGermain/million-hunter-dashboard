import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDb, type MemoryDb } from "./memoryDb.testing";

const h = vi.hoisted(() => ({ mem: null as MemoryDb | null }));
vi.mock("../../db", () => ({ getDb: async () => h.mem!.db }));
vi.mock("../facts", () => ({ getFacts: async () => [], freshestPerKey: (rows: unknown) => rows, normSymbol: (s: string) => s.trim().toUpperCase() }));
vi.mock("../liquidityFactRefresh", () => ({ resolveLiquidityFact: async () => null }));
vi.mock("../decisionRunway", async (original) => ({ ...await original<typeof import("../decisionRunway")>(), authorizeDecisionAction: async () => null, queuePaperOutcome: vi.fn() }));
vi.mock("../gates", async (original) => ({ ...await original<typeof import("../gates")>(), evaluateOrderGates: () => ({ passed: true, results: [], failures: [], mandateVersion: "test" }) }));

import { apertureRuns, brokerOrders, portfolioAccounts, positions, uatBookAdjustments, uatHouseBaselines, uatPracticeBooks, users } from "../../../drizzle/schema";
import { measuredAccountEquityCents } from "../../../shared/playUnderwriting";
import { appRouter } from "../../routers";
import { alpacaPaperBroker, brokerFor } from "../brokers/index";
import { PRACTICE_ACCOUNT_CONFLICT } from "../brokers/practiceBook";
import { createOrder, mirrorFills, submitOrder } from "../orderFlow";
import { readHouseSnapshot, resetHouseSnapshotCache } from "./houseSnapshot";
import { clientOrderIdFor, computeBookLedger, parseClientOrderId, type LedgerOrder } from "./ledger";
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

describe("ledger maths", () => {
  const order = (over: Partial<LedgerOrder>): LedgerOrder => ({
    id: 1, symbol: "NVDA", side: "buy", instrumentType: "shares", contractMultiplier: null, qty: 10, notionalCents: null, orderType: "limit",
    limitPriceCents: 10_000, gatedNotionalCents: null, status: "filled", filledQty: 10, filledAvgPriceCents: 10_000, ...over,
  });
  const mark = (prices: Record<string, number>) => (symbol: string) => prices[symbol] != null ? { priceCents: prices[symbol], source: "house" as const } : null;

  it("counts partial fills in any status: a submitted 3 of 10 and an expired (rejected) 4 of 10", () => {
    const ledger = computeBookLedger({ startingCashCents: 1_000_000, adjustments: [], mark: mark({ NVDA: 11_000 }), orders: [
      order({ id: 1, status: "submitted", filledQty: 3 }),
      order({ id: 2, status: "rejected", filledQty: 4 }),
    ] });
    expect(ledger.positions).toEqual([expect.objectContaining({ symbol: "NVDA", qty: 7, brokerBackedQty: 7, avgCostCents: 10_000 })]);
    expect(ledger.cashCents).toBe(1_000_000 - 70_000);
    // The submitted order still reserves its 7 unfilled shares at the limit.
    expect(ledger.reservedBuyCents).toBe(70_000);
    expect(ledger.buyingPowerCents).toBe(1_000_000 - 140_000);
    expect(ledger.equityValueCents).toBe(1_000_000 - 70_000 + 77_000);
  });

  it("uses average cost for realised P&L, applies the option multiplier, and reports equity unmeasured without a mark", () => {
    const ledger = computeBookLedger({ startingCashCents: 1_000_000, adjustments: [{ kind: "cash_adjustment", symbol: null, qty: null, priceCents: null, cashCents: 500, brokerBacked: false }], mark: mark({ NVDA: 12_000 }), orders: [
      order({ id: 1, qty: 10, filledQty: 10, filledAvgPriceCents: 10_000 }),
      order({ id: 2, qty: 10, filledQty: 10, filledAvgPriceCents: 12_000 }),
      order({ id: 3, side: "sell", qty: 5, filledQty: 5, filledAvgPriceCents: 13_000 }),
      order({ id: 4, symbol: "NVDA261218C00100000", instrumentType: "long_call", contractMultiplier: 100, qty: 1, filledQty: 1, filledAvgPriceCents: 250 }),
    ] });
    expect(ledger.realizedPnlCents).toBe((13_000 - 11_000) * 5);
    expect(ledger.cashCents).toBe(1_000_000 + 500 - 100_000 - 120_000 + 65_000 - 25_000);
    expect(ledger.positions.find((p) => p.symbol === "NVDA")).toMatchObject({ qty: 15, avgCostCents: 11_000, marketValueCents: 180_000 });
    expect(ledger.equityValueCents).toBeNull(); // the option has no mark → "Not measured" (#19)
  });

  it("flags a broker-backed quantity that goes negative", () => {
    const ledger = computeBookLedger({ startingCashCents: 1_000_000, adjustments: [], mark: mark({}), orders: [order({ side: "sell", filledQty: 2 })] });
    expect(ledger.negativeSymbols).toEqual(["NVDA"]);
  });

  it("tags book orders sh-b<book>-<order> within 25 characters and round-trips the tag", () => {
    expect(clientOrderIdFor({ id: 41, practiceBookId: 7 })).toBe("sh-b7-41");
    expect(clientOrderIdFor({ id: 41, practiceBookId: null })).toBe("sh-paper-41");
    expect(clientOrderIdFor({ id: 2_147_483_647, practiceBookId: 2_147_483_647 }).length).toBeLessThanOrEqual(25);
    expect(parseClientOrderId("sh-b7-41")).toEqual({ kind: "book", bookId: 7, orderId: 41 });
    expect(parseClientOrderId("manual-dashboard")).toBeNull();
  });
});

describe("house snapshot", () => {
  it("is single-flight, cached for 60 s, and records the house baseline on the first read", async () => {
    const [first, second] = await Promise.all([readHouseSnapshot(alpacaPaperBroker), readHouseSnapshot(alpacaPaperBroker)]);
    expect(first).toBe(second);
    expect(broker.getAccount).toHaveBeenCalledTimes(1);
    await readHouseSnapshot(alpacaPaperBroker, { now: NOW + 59_000 });
    expect(broker.getAccount).toHaveBeenCalledTimes(1);
    await readHouseSnapshot(alpacaPaperBroker, { now: NOW + 61_000 });
    expect(broker.getAccount).toHaveBeenCalledTimes(2);
    expect(h.mem!.rows(uatHouseBaselines)).toEqual([expect.objectContaining({ houseExternalAccountId: HOUSE_ID, equityValueCents: 1_000_165_000, capturedBy: null })]);
  });
});

describe("two books on one house (mocked house)", () => {
  it("each tester's sync writes only their own book: A sees 10 NVDA, B sees 5; the ceiling basis is the book", async () => {
    const { rowA, rowB } = await twoBooks();
    await caller(A).aperture.account.sync({ id: rowA.id });
    await caller(B).aperture.account.sync({ id: rowB.id });
    const held = (accountId: number) => h.mem!.rows(positions).filter((p) => p.accountId === accountId).map((p) => [p.symbol, p.qty]);
    expect(held(rowA.id)).toEqual([["AMD", 3], ["NVDA", 10]]);
    expect(held(rowB.id)).toEqual([["NVDA", 5], ["TSLA", 2]]);
    // A's book: $100k − $1,000 (NVDA) − $450 (AMD) + marks 10 × $110 + 3 × $150.
    const equityA = 10_000_000 - 100_000 - 45_000 + 110_000 + 45_000;
    expect(syncedRow(rowA.id)).toMatchObject({ cashCents: 10_000_000 - 145_000, equityValueCents: equityA, externalAccountId: HOUSE_ID });
    expect(measuredAccountEquityCents({ equityValueCents: syncedRow(rowA.id).equityValueCents, stalenessMs: 0 }, 4 * 60 * 60_000)).toBe(equityA);
    expect(syncedRow(rowA.id).equityValueCents).not.toBe(house.account.equityValueCents);
    // One house read served both syncs (60 s cache).
    expect(broker.getAccount).toHaveBeenCalledTimes(1);
  });

  it("refuses B's sell of 6 NVDA before any broker call and leaves A's 10 untouched (#76)", async () => {
    const { rowA, rowB, bookB } = await twoBooks();
    const sell = approvedOrder(B, rowB.id, bookB, { symbol: "NVDA", side: "sell", intent: "close", qty: 6, limitPriceCents: 11_000 });
    expect(await message(submitOrder(sell.id, B.id, "SUBMIT PAPER", NOW))).toMatch(/^Practice books are long-only: your book holds 5 NVDA, so a sell of 6 is refused\./);
    expect(broker.submitOrder).not.toHaveBeenCalled();
    expect(orderRow(sell.id)).toMatchObject({ status: "approved", clientOrderId: null });
    await caller(A).aperture.account.sync({ id: rowA.id });
    expect(h.mem!.rows(positions).find((p) => p.accountId === rowA.id && p.symbol === "NVDA")?.qty).toBe(10);
  });

  it("refuses B's sell of a symbol only A holds as long-only, with no broker call (#76)", async () => {
    const { rowB, bookB } = await twoBooks();
    const sell = approvedOrder(B, rowB.id, bookB, { symbol: "AMD", side: "sell", intent: "close", qty: 1, limitPriceCents: 15_000 });
    expect(await message(submitOrder(sell.id, B.id, "SUBMIT PAPER", NOW))).toMatch(/^Practice books are long-only: your book holds 0 AMD/);
    expect(broker.submitOrder).not.toHaveBeenCalled();
  });

  it("refuses B's TSLA sell while A has an open TSLA buy on the house (wash-trade guard)", async () => {
    const { rowA, rowB, bookA, bookB } = await twoBooks();
    h.mem!.seed(brokerOrders, baseOrder({ userId: A.id, accountId: rowA.id, practiceBookId: bookA, symbol: "TSLA", side: "buy", qty: 1, limitPriceCents: 19_000, status: "submitted", clientOrderId: `sh-b${bookA}-99`, brokerOrderId: "alp-open" }));
    const sell = approvedOrder(B, rowB.id, bookB, { symbol: "TSLA", side: "sell", intent: "close", qty: 1, limitPriceCents: 20_000 });
    expect(await message(submitOrder(sell.id, B.id, "SUBMIT PAPER", NOW))).toBe("Another tester has an open buy on TSLA in the shared practice account; try again when it fills or expires.");
    expect(broker.submitOrder).not.toHaveBeenCalled();
  });

  it("dispatches an allowed book order with a sh-b<book>-<order> tag persisted before the broker call", async () => {
    const { rowA, bookA } = await twoBooks();
    const sell = approvedOrder(A, rowA.id, bookA, { symbol: "NVDA", side: "sell", intent: "close", qty: 4, limitPriceCents: 11_000 });
    broker.submitOrder.mockImplementation(async (request) => {
      // Persisted (and the lease taken) before dispatch.
      expect(orderRow(sell.id)).toMatchObject({ status: "submitted", clientOrderId: request.clientOrderId });
      return { brokerOrderId: "alp-7", status: "accepted", filledQty: 0, filledAvgPriceCents: null, submittedAt: NOW };
    });
    await submitOrder(sell.id, A.id, "SUBMIT PAPER", NOW);
    expect(broker.submitOrder).toHaveBeenCalledOnce();
    expect(broker.submitOrder.mock.calls[0][0].clientOrderId).toMatch(/^sh-b\d+-\d+$/);
    expect(broker.submitOrder.mock.calls[0][0].clientOrderId).toBe(`sh-b${bookA}-${sell.id}`);
    expect(orderRow(sell.id)).toMatchObject({ status: "submitted", brokerOrderId: "alp-7" });
  });

  it("refuses GTC, a buy beyond book cash, a buy beyond house buying power, and sells of a frozen symbol (buys stay allowed)", async () => {
    const { rowA, bookA } = await twoBooks();
    const gtc = approvedOrder(A, rowA.id, bookA, { symbol: "NVDA", side: "buy", qty: 1, limitPriceCents: 11_000, timeInForce: "gtc" });
    expect(await message(submitOrder(gtc.id, A.id, "SUBMIT PAPER", NOW))).toMatch(/^Practice books accept day orders only/);
    const big = approvedOrder(A, rowA.id, bookA, { symbol: "NVDA", side: "buy", qty: 1_000, limitPriceCents: 11_000 });
    expect(await message(submitOrder(big.id, A.id, "SUBMIT PAPER", NOW))).toMatch(/^Not enough practice cash: this buy needs \$110,000\.00 and your book has \$98,550\.00 available\./);
    house.account.buyingPowerCents = 50_000;
    resetHouseSnapshotCache();
    const small = approvedOrder(A, rowA.id, bookA, { symbol: "NVDA", side: "buy", qty: 5, limitPriceCents: 11_000 });
    expect(await message(submitOrder(small.id, A.id, "SUBMIT PAPER", NOW))).toMatch(/^The shared practice account doesn't have the buying power/);
    house.account.buyingPowerCents = 1_960_000_000;
    resetHouseSnapshotCache();
    h.mem!.seed(uatBookAdjustments, { bookId: null, kind: "symbol_freeze", symbol: "NVDA", houseExternalAccountId: HOUSE_ID, note: "Σ books ≠ house", createdBy: OWNER.id, createdAt: NOW });
    const frozenSell = approvedOrder(A, rowA.id, bookA, { symbol: "NVDA", side: "sell", intent: "close", qty: 1, limitPriceCents: 11_000 });
    expect(await message(submitOrder(frozenSell.id, A.id, "SUBMIT PAPER", NOW))).toBe("Sells of NVDA are paused while the shared practice account is reconciled. Buys are still allowed.");
    expect(broker.submitOrder).not.toHaveBeenCalled();
    await submitOrder(small.id, A.id, "SUBMIT PAPER", NOW);
    expect(broker.submitOrder).toHaveBeenCalledOnce();
  });

  it("maps an Alpaca wash-trade 403 that slips through to the practice-account overlap copy", async () => {
    const { rowA, bookA } = await twoBooks();
    broker.submitOrder.mockResolvedValue({ brokerOrderId: "", status: "rejected", filledQty: null, filledAvgPriceCents: null, submittedAt: NOW,
      raw: { code: 40310000, message: "potential wash trade detected. use complex orders" } });
    const buy = approvedOrder(A, rowA.id, bookA, { symbol: "NVDA", side: "buy", qty: 1, limitPriceCents: 11_000 });
    await submitOrder(buy.id, A.id, "SUBMIT PAPER", NOW);
    expect(orderRow(buy.id)).toMatchObject({ status: "rejected", rejectionReason: PRACTICE_ACCOUNT_CONFLICT("NVDA") });
  });

  it("mirrorFills reconciles a tagged book order by its client id, and a book never reads another account's order", async () => {
    const { rowA, rowB, bookA } = await twoBooks();
    const open = h.mem!.seed(brokerOrders, baseOrder({ userId: A.id, accountId: rowA.id, practiceBookId: bookA, symbol: "NVDA", side: "buy", qty: 2, limitPriceCents: 11_000, status: "submitted", clientOrderId: `sh-b${bookA}-50`, dispatchError: "lost response" })).at(-1)!;
    broker.getOrderByClientOrderId.mockResolvedValue({ brokerOrderId: "alp-50", status: "filled", filledQty: 2, filledAvgPriceCents: 10_900, submittedAt: NOW });
    expect(await mirrorFills(A.id)).toBe(1);
    expect(broker.getOrderByClientOrderId).toHaveBeenCalledWith(`sh-b${bookA}-50`);
    expect(orderRow(open.id)).toMatchObject({ status: "filled", brokerOrderId: "alp-50", filledQty: 2, dispatchError: null });
    await expect(brokerFor("alpaca_paper", rowB.id, rowB).getOrder("alp-50")).rejects.toThrow("doesn't belong to this practice book");
    expect(broker.getOrder).not.toHaveBeenCalled();
  });

  it("createOrder stamps the execution row's book on the proposal", async () => {
    const { rowA, bookA } = await twoBooks();
    const created = await createOrder({ userId: A.id, accountId: rowA.id, runId: 10 + A.id, symbol: "NVDA", side: "buy", qty: 1, orderType: "limit", limitPriceCents: 11_000,
      timeInForce: "day", reason: "Practice test entry.", invalidationCondition: "Below the practice stop.", holdingPeriod: "swing", paperAcknowledgement: "PAPER", now: NOW } as any);
    expect(orderRow(created.orderId)).toMatchObject({ practiceBookId: bookA, status: "pending_approval" });
  });
});

describe("routing and book creation", () => {
  it("routes only book rows to the practice adapter, and never while books are off or inert", async () => {
    expect(brokerFor("alpaca_paper", 5, { practiceBookId: null })).toBe(alpacaPaperBroker);
    expect(brokerFor("alpaca_paper", 5, { practiceBookId: 9 })).not.toBe(alpacaPaperBroker);
    vi.stubEnv("UAT_PRACTICE_BOOKS", "false");
    expect(brokerFor("alpaca_paper", 5, { practiceBookId: 9 })).toBe(alpacaPaperBroker);
    vi.stubEnv("UAT_PRACTICE_BOOKS", "");
    vi.stubEnv("ALPACA_SHARED_KEY_OWNER_ONLY", "true");
    expect(brokerFor("alpaca_paper", 5, { practiceBookId: 9 })).toBe(alpacaPaperBroker);
  });

  it("account.create opens a $100k book for a tester's Alpaca paper row, but not for the owner or a manual row", async () => {
    const tester = await caller(A).aperture.account.create({ label: "Mine", brokerId: "alpaca_paper", isPaper: true });
    expect(tester).toMatchObject({ practiceBookId: expect.any(Number) });
    const owner = await caller(OWNER).aperture.account.create({ label: "House", brokerId: "alpaca_paper", isPaper: true });
    const manual = await caller(A).aperture.account.create({ label: "Ledger", brokerId: "manual", isPaper: true });
    expect(owner).not.toHaveProperty("practiceBookId");
    expect(manual).not.toHaveProperty("practiceBookId");
    expect(h.mem!.rows(uatPracticeBooks)).toEqual([expect.objectContaining({ userId: A.id, portfolioAccountId: tester.id, startingCashCents: 10_000_000 })]);
  });

  it("the owner's raw row still reads the house unchanged", async () => {
    const [row] = h.mem!.seed(portfolioAccounts, { userId: OWNER.id, label: "UAT house (raw)", brokerId: "alpaca_paper", isPaper: true, createdAt: NOW, updatedAt: NOW });
    await caller(OWNER).aperture.account.sync({ id: row.id });
    expect(syncedRow(row.id)).toMatchObject({ equityValueCents: house.account.equityValueCents, practiceBookId: null });
    expect(h.mem!.rows(positions).filter((p) => p.accountId === row.id)).toHaveLength(3);
  });

  it("convertTesterAccounts turns pre-book tester rows into books, skipping the owner and rows with open orders", async () => {
    h.mem!.seed(users, { id: OWNER.id, openId: OWNER.openId, role: "admin" });
    const rows = h.mem!.seed(portfolioAccounts,
      { userId: OWNER.id, label: "raw", brokerId: "alpaca_paper", isPaper: true, createdAt: NOW, updatedAt: NOW },
      { userId: A.id, label: "a", brokerId: "alpaca_paper", isPaper: true, cashCents: 980_000_000, equityValueCents: 1_000_165_000, lastSyncedAt: NOW, createdAt: NOW, updatedAt: NOW },
      { userId: B.id, label: "b", brokerId: "alpaca_paper", isPaper: true, createdAt: NOW, updatedAt: NOW });
    h.mem!.seed(positions, { accountId: rows[1].id, symbol: "NVDA", qty: 15, createdAt: NOW, updatedAt: NOW });
    h.mem!.seed(brokerOrders, baseOrder({ userId: B.id, accountId: rows[2].id, symbol: "NVDA", side: "buy", qty: 1, status: "submitted" }));
    await expect(caller(A).aperture.uat.convertTesterAccounts()).rejects.toMatchObject({ code: "FORBIDDEN" });
    vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(caller(OWNER).aperture.uat.convertTesterAccounts()).resolves.toEqual({ converted: [rows[1].id], skipped: [{ accountId: rows[2].id, reason: "1 open order(s)" }] });
    expect(syncedRow(rows[1].id)).toMatchObject({ practiceBookId: expect.any(Number), cashCents: null, equityValueCents: null, lastSyncedAt: null });
    expect(h.mem!.rows(positions).filter((p) => p.accountId === rows[1].id)).toEqual([]);
    expect(syncedRow(rows[0].id).practiceBookId).toBeNull();
  });

  it("a converted tester row bound to an old house binds the current house on its first sync (#107)", async () => {
    h.mem!.seed(users, { id: OWNER.id, openId: OWNER.openId, role: "admin" });
    const [row] = h.mem!.seed(portfolioAccounts,
      { userId: A.id, label: "a", brokerId: "alpaca_paper", isPaper: true, externalAccountId: "PA-OLD-HOUSE", equityValueCents: 1_000_165_000, lastSyncedAt: NOW, createdAt: NOW, updatedAt: NOW });
    vi.spyOn(console, "info").mockImplementation(() => {});
    await caller(OWNER).aperture.uat.convertTesterAccounts();
    expect(syncedRow(row.id)).toMatchObject({ externalAccountId: null, practiceBookId: expect.any(Number) });
    resetHouseSnapshotCache();
    await caller(A).aperture.account.sync({ id: row.id });
    expect(syncedRow(row.id)).toMatchObject({ externalAccountId: HOUSE_ID, equityValueCents: 10_000_000 });
  });

  it("compileAndStageBestFit no longer reads the house through alpacaPaperBroker directly", () => {
    const router = readFileSync(path.resolve(import.meta.dirname, "../../apertureRouter.ts"), "utf8");
    expect(router).not.toMatch(/alpacaPaperBroker\.(getAccount|getPositions|submitOrder)\(/);
    expect(router).toContain("brokerFor(executionAccount.brokerId, executionAccount.id, executionAccount).getAccount()");
  });
});

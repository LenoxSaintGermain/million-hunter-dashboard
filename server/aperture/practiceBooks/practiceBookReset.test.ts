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
import { bookAge, PRACTICE_BOOK_COPY } from "../../../client/src/pages/aperture/ApertureAccounts";
import { appRouter } from "../../routers";
import { alpacaPaperBroker, brokerFor } from "../brokers/index";
import { createOrder } from "../orderFlow";
import { resetHouseSnapshotCache } from "./houseSnapshot";
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
  const { bookId: bookA } = await createPracticeBook(mem.db, { userId: A.id, portfolioAccountId: rowA.id, createdBy: A.id, now: NOW });
  const { bookId: bookB } = await createPracticeBook(mem.db, { userId: B.id, portfolioAccountId: rowB.id, createdBy: B.id, now: NOW });
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

const MASKED = "••••0001";
const HOUSE_NUMBERS = [HOUSE_ID, String(house.account.cashCents), String(house.account.buyingPowerCents), String(house.account.equityValueCents)];
const leaks = (value: unknown) => HOUSE_NUMBERS.filter((needle) => JSON.stringify(value).includes(needle));
// A's book after twoBooks(): $100k − $1,000 (NVDA) − $450 (AMD), marked 10 × $110 + 3 × $150.
const EQUITY_A = 10_000_000 - 145_000 + 110_000 + 45_000;
// Mirrors shared/disclosure.ts PROHIBITED_LANGUAGE (not exported).
const PROHIBITED_LANGUAGE = /\b(copy\s*congress|follow\s+smart\s+money|insider|conflict|congressional\s+alpha)\b/i;

describe("tester view of the shared house (UAT-E3)", () => {
  it("account.list carries the book summary and never the house cash, equity, buying power or full account number", async () => {
    const { rowA, bookA } = await twoBooks();
    const list = await caller(A).aperture.account.list();
    expect(leaks(list)).toEqual([]);
    expect(list).toEqual([expect.objectContaining({
      id: rowA.id, externalAccountId: MASKED, equityValueCents: EQUITY_A,
      practiceBook: expect.objectContaining({
        bookId: bookA, generation: 1, status: "active", startingCashCents: 10_000_000, openedAt: NOW,
        equityValueCents: EQUITY_A, pnlSinceStartCents: EQUITY_A - 10_000_000, openOrderCount: 0, heldSymbols: ["AMD", "NVDA"], houseAccount: MASKED,
        resetBlockedReason: expect.stringMatching(/^Close your positions first \(AMD, NVDA\)/),
      }),
    })]);
    // The stored binding is unchanged; only the response is masked.
    expect(syncedRow(rowA.id).externalAccountId).toBe(HOUSE_ID);
  });

  it("account.sync, order.list and the stored order gate details show the house only masked", async () => {
    const { rowA } = await twoBooks();
    const sync = await caller(A).aperture.account.sync({ id: rowA.id });
    expect(leaks(sync)).toEqual([]);
    const created = await createOrder({ userId: A.id, accountId: rowA.id, runId: 10 + A.id, symbol: "NVDA", side: "buy", qty: 1, orderType: "limit", limitPriceCents: 11_000,
      timeInForce: "day", reason: "Practice test entry.", invalidationCondition: "Below the practice stop.", holdingPeriod: "swing", paperAcknowledgement: "PAPER", now: NOW } as any);
    const snapshot = JSON.stringify(orderRow(created.orderId).gateSnapshot);
    expect(snapshot).toContain(`paper destination identity ${MASKED}`);
    expect(snapshot).not.toContain(HOUSE_ID);
    const orders = await caller(A).aperture.order.list({ runId: 10 + A.id });
    expect(orders.length).toBeGreaterThan(0);
    expect(leaks(orders)).toEqual([]);
    expect(orders[0].destinationAccount).toMatchObject({ externalAccountId: MASKED });
  });

  it("the owner's raw house row still shows its full account number", async () => {
    h.mem!.seed(users, { id: OWNER.id, openId: OWNER.openId, role: "admin" });
    const [row] = h.mem!.seed(portfolioAccounts, { userId: OWNER.id, label: "UAT house (raw)", brokerId: "alpaca_paper", isPaper: true, createdAt: NOW, updatedAt: NOW });
    await caller(OWNER).aperture.account.sync({ id: row.id });
    expect(await caller(OWNER).aperture.account.list()).toEqual([expect.objectContaining({ externalAccountId: HOUSE_ID, practiceBook: null })]);
  });
});

describe("practiceBook.reset (UAT-E3)", () => {
  it("is refused server-side while the book holds shares, and while orders are open", async () => {
    const { rowA, rowB, bookB } = await twoBooks();
    await expect(caller(A).aperture.practiceBook.reset({ accountId: rowA.id })).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringMatching(/^Close your positions first \(AMD, NVDA\)/) });
    // B sells everything (filled) but leaves a proposal open.
    h.mem!.seed(brokerOrders,
      baseOrder({ userId: B.id, runId: 10 + B.id, accountId: rowB.id, practiceBookId: bookB, symbol: "NVDA", side: "sell", intent: "close", qty: 5, limitPriceCents: 11_000, status: "filled", filledQty: 5, filledAvgPriceCents: 11_000 }),
      baseOrder({ userId: B.id, runId: 10 + B.id, accountId: rowB.id, practiceBookId: bookB, symbol: "TSLA", side: "sell", intent: "close", qty: 2, limitPriceCents: 20_000, status: "filled", filledQty: 2, filledAvgPriceCents: 20_000 }),
      baseOrder({ userId: B.id, runId: 10 + B.id, accountId: rowB.id, practiceBookId: bookB, symbol: "AMD", side: "buy", qty: 1, limitPriceCents: 15_000, status: "submitted" }),
    );
    await expect(caller(B).aperture.practiceBook.reset({ accountId: rowB.id })).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringMatching(/^Close your positions first: 1 order is still open/) });
    expect(h.mem!.rows(uatPracticeBooks).filter((book) => book.status === "archived")).toEqual([]);
    expect(broker.submitOrder).not.toHaveBeenCalled();
  });

  it("archives a flat book, opens generation 2 with $100k, keeps the old orders, and Today/cockpit/ceiling read the new book", async () => {
    const { rowB, bookB } = await twoBooks();
    const sells = h.mem!.seed(brokerOrders,
      baseOrder({ userId: B.id, runId: 10 + B.id, accountId: rowB.id, practiceBookId: bookB, symbol: "NVDA", side: "sell", intent: "close", qty: 5, limitPriceCents: 11_000, status: "filled", filledQty: 5, filledAvgPriceCents: 11_000 }),
      baseOrder({ userId: B.id, runId: 10 + B.id, accountId: rowB.id, practiceBookId: bookB, symbol: "TSLA", side: "sell", intent: "close", qty: 2, limitPriceCents: 20_000, status: "filled", filledQty: 2, filledAvgPriceCents: 20_000 }),
    ).slice(-2);
    const before = await caller(B).aperture.order.list({ runId: 10 + B.id });
    vi.setSystemTime(NOW + 3 * 86_400_000);
    const result = await caller(B).aperture.practiceBook.reset({ accountId: rowB.id });
    expect(result).toMatchObject({ archivedBookId: bookB, generation: 2, startingCashCents: 10_000_000, measured: true });
    expect(h.mem!.rows(uatPracticeBooks).find((book) => book.id === bookB)).toMatchObject({ status: "archived", archivedAt: NOW + 3 * 86_400_000 });
    expect(h.mem!.rows(uatPracticeBooks).find((book) => book.id === result.bookId)).toMatchObject({ status: "active", generation: 2, startingCashCents: 10_000_000, userId: B.id, portfolioAccountId: rowB.id });
    // The account row now points at the new, measured $100k book.
    expect(syncedRow(rowB.id)).toMatchObject({ practiceBookId: result.bookId, cashCents: 10_000_000, buyingPowerCents: 10_000_000, equityValueCents: 10_000_000, externalAccountId: HOUSE_ID, lastSyncedAt: NOW + 3 * 86_400_000 });
    expect(h.mem!.rows(positions).filter((p) => p.accountId === rowB.id)).toEqual([]);
    expect(measuredAccountEquityCents({ equityValueCents: syncedRow(rowB.id).equityValueCents, stalenessMs: 0 }, 4 * 60 * 60_000)).toBe(10_000_000);
    // History is preserved: every pre-reset order keeps its old book id and still lists.
    expect(h.mem!.rows(brokerOrders).filter((o) => o.userId === B.id).every((o) => o.practiceBookId === bookB)).toBe(true);
    const after = await caller(B).aperture.order.list({ runId: 10 + B.id });
    expect(after.map((o) => o.id).sort()).toEqual(before.map((o) => o.id).sort());
    expect(after.map((o) => o.id)).toEqual(expect.arrayContaining(sells.map((o) => o.id)));
    // The new book starts empty and is fresh in the card.
    const [card] = await caller(B).aperture.account.list();
    expect(card.practiceBook).toMatchObject({ generation: 2, equityValueCents: 10_000_000, pnlSinceStartCents: 0, heldSymbols: [], resetBlockedReason: null });
    // A second reset of the same (now archived) book is refused; the current one may reset again.
    await expect(caller(A).aperture.practiceBook.reset({ accountId: rowB.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("unbinds a book opened on a previous house, even with stranded shares there, so the next sync binds the new house", async () => {
    const { rowA, bookA } = await twoBooks();
    broker.getAccount.mockImplementation(async () => ({ ...house.account, externalAccountId: "PA-HOUSE-0002" }));
    resetHouseSnapshotCache();
    const result = await caller(A).aperture.practiceBook.reset({ accountId: rowA.id });
    expect(result).toMatchObject({ archivedBookId: bookA, generation: 2, measured: false });
    expect(syncedRow(rowA.id)).toMatchObject({ practiceBookId: result.bookId, externalAccountId: null, lastSyncedAt: null, equityValueCents: 10_000_000 });
    await caller(A).aperture.account.sync({ id: rowA.id });
    expect(syncedRow(rowA.id)).toMatchObject({ externalAccountId: "PA-HOUSE-0002", equityValueCents: 10_000_000 });
  });

  it("is refused for another user's account, a row without a book, and while books are off", async () => {
    const { rowA } = await twoBooks();
    await expect(caller(B).aperture.practiceBook.reset({ accountId: rowA.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const [plain] = h.mem!.seed(portfolioAccounts, { userId: A.id, label: "Manual", brokerId: "manual", isPaper: true, createdAt: NOW, updatedAt: NOW });
    await expect(caller(A).aperture.practiceBook.reset({ accountId: plain.id })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    vi.stubEnv("ALPACA_SHARED_KEY_OWNER_ONLY", "true");
    await expect(caller(A).aperture.practiceBook.reset({ accountId: rowA.id })).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "Practice books are off on this deployment." });
  });
});

describe("practice book card copy", () => {
  it("uses the agreed copy, passes the prohibited-language check, and formats book age", () => {
    expect(PRACTICE_BOOK_COPY).toMatchObject({ title: "Your practice book", subtitle: "Alpaca paper fills · shared practice account", source: "Practice book (Alpaca paper fills)" });
    for (const text of Object.values(PRACTICE_BOOK_COPY)) expect(text).not.toMatch(PROHIBITED_LANGUAGE);
    expect(bookAge(NOW, NOW + 3_600_000)).toBe("Opened today");
    expect(bookAge(NOW, NOW + 86_400_000)).toBe("1 day");
    expect(bookAge(NOW, NOW + 9 * 86_400_000)).toBe("9 days");
  });

  it("renders only editorial tokens in the book card (no new raw colours)", () => {
    const source = readFileSync(path.resolve(__dirname, "../../../client/src/pages/aperture/ApertureAccounts.tsx"), "utf8");
    const block = source.slice(source.indexOf("{account.practiceBook && ("), source.indexOf("{/* CSV import */}"));
    expect(block).toContain("var(--sh-surface-2)");
    expect(block).not.toMatch(/#[0-9a-f]{3,6}\b|oklch\(|rgb\(/i);
  });
});

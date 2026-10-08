import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import { brokerOrders, portfolioAccounts, uatPracticeBooks, type PortfolioAccount, type UatPracticeBook } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { freshestPerKey, getFacts } from "../facts";
import { computeBookLedger, parseClientOrderId, reservedCashForOpenBuy, type BookLedger, type LedgerMark, type LedgerOrder } from "../practiceBooks/ledger";
import { readHouseSnapshot, type HouseSnapshot } from "../practiceBooks/houseSnapshot";
import { activeBookForAccount, frozenSymbols, listBookAdjustments, maskAccountNumber } from "../practiceBooks/repository";
import { assertPaperOnly, BrokerUnavailableError, type BrokerAccount, type BrokerAdapter, type BrokerPosition, type OrderRequest, type OrderResult } from "./types";

/**
 * Practice Book adapter (UAT-E2). Returned by brokerFor("alpaca_paper") while
 * UAT_PRACTICE_BOOKS is on. A row with no book delegates every call to the
 * env-key Alpaca paper adapter unchanged. A book row reads and trades its own
 * virtual sub-ledger: numbers come from the book's fills, orders still go to the
 * shared house account (real paper fills), and pre-dispatch guards only ADD
 * refusals. `id` stays "alpaca_paper", so every alpaca_paper check and the #64
 * owner gate still apply.
 */
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export const PRACTICE_ACCOUNT_CONFLICT = (symbol: string) => `Practice-account conflict: another tester has an opposite open order on ${symbol}. Try again when it fills or expires.`;

export class PracticeBookRefusal extends TRPCError {
  constructor(message: string) {
    super({ code: "PRECONDITION_FAILED", message });
  }
}

interface BookContext {
  db: Db;
  row: PortfolioAccount;
  book: UatPracticeBook;
  house: HouseSnapshot;
  orders: LedgerOrder[];
  ledger: BookLedger;
  mark: (symbol: string) => LedgerMark | null;
}

const toLedgerOrder = (order: typeof brokerOrders.$inferSelect): LedgerOrder => ({
  id: order.id, symbol: order.symbol, side: order.side, instrumentType: order.instrumentType, contractMultiplier: order.contractMultiplier,
  qty: order.qty, notionalCents: order.notionalCents, orderType: order.orderType, limitPriceCents: order.limitPriceCents,
  gatedNotionalCents: order.gatedNotionalCents, status: order.status, filledQty: order.filledQty, filledAvgPriceCents: order.filledAvgPriceCents,
});

async function priceFactMarks(symbols: string[]): Promise<Map<string, number>> {
  const marks = new Map<string, number>();
  if (!symbols.length) return marks;
  try {
    for (const fact of freshestPerKey(await getFacts(symbols))) {
      if (fact.factKey === "last_price" && fact.basis !== "unknown" && fact.valueNum != null && !marks.has(fact.symbol.toUpperCase())) {
        marks.set(fact.symbol.toUpperCase(), Math.round(fact.valueNum * 100));
      }
    }
  } catch {
    // An unreadable fact ledger leaves the mark unknown; equity becomes "not measured".
  }
  return marks;
}

async function loadRow(db: Db, accountId: number): Promise<PortfolioAccount> {
  const [row] = await db.select().from(portfolioAccounts).where(eq(portfolioAccounts.id, accountId)).limit(1);
  if (!row) throw new BrokerUnavailableError(`no portfolio account ${accountId}`);
  return row;
}

async function loadBookContext(db: Db, row: PortfolioAccount, houseAdapter: BrokerAdapter): Promise<BookContext> {
  const book = await activeBookForAccount(db, row);
  if (!book) throw new BrokerUnavailableError("This account's practice book could not be found. Ask the owner to review it.");
  const house = await readHouseSnapshot(houseAdapter);
  if (book.houseExternalAccountId && book.houseExternalAccountId !== house.externalAccountId) {
    throw new PracticeBookRefusal(`This practice book was opened on a previous shared practice account (${maskAccountNumber(book.houseExternalAccountId)}). Reset it to start a book on the current one.`);
  }
  if (!book.houseExternalAccountId) {
    await db.update(uatPracticeBooks).set({ houseExternalAccountId: house.externalAccountId, updatedAt: Date.now() })
      .where(eq(uatPracticeBooks.id, book.id));
    book.houseExternalAccountId = house.externalAccountId;
  }
  const orders = (await db.select().from(brokerOrders).where(eq(brokerOrders.practiceBookId, book.id))).map(toLedgerOrder);
  const adjustments = await listBookAdjustments(db, book.id);
  const houseMarks = new Map(house.positions.filter((p) => p.lastPriceCents != null).map((p) => [p.symbol.toUpperCase(), p.lastPriceCents!]));
  const symbols = Array.from(new Set([...orders.map((o) => o.symbol.toUpperCase()), ...adjustments.flatMap((a) => (a.symbol ? [a.symbol.toUpperCase()] : []))]));
  const factMarks = await priceFactMarks(symbols.filter((symbol) => !houseMarks.has(symbol)));
  const mark = (symbol: string): LedgerMark | null => {
    const key = symbol.toUpperCase();
    if (houseMarks.has(key)) return { priceCents: houseMarks.get(key)!, source: "house" };
    if (factMarks.has(key)) return { priceCents: factMarks.get(key)!, source: "price_fact" };
    return null;
  };
  const ledger = computeBookLedger({ startingCashCents: book.startingCashCents, adjustments, orders, mark });
  if (ledger.negativeSymbols.length && book.status === "active") {
    const reason = `Negative practice-book quantity in ${ledger.negativeSymbols.join(", ")}; paused for owner review.`;
    await db.update(uatPracticeBooks).set({ status: "frozen", frozenReason: reason, updatedAt: Date.now() }).where(eq(uatPracticeBooks.id, book.id));
    console.error(`[uat-recon] practice book ${book.id} frozen: ${reason}`);
    book.status = "frozen";
    book.frozenReason = reason;
  }
  return { db, row, book, house, orders, ledger, mark };
}

function bookAccount(ctx: BookContext): BrokerAccount {
  return {
    externalAccountId: ctx.house.externalAccountId,
    cashCents: ctx.ledger.cashCents,
    buyingPowerCents: ctx.ledger.buyingPowerCents,
    equityValueCents: ctx.ledger.equityValueCents,
    optionsApprovedLevel: ctx.house.optionsApprovedLevel,
    optionsTradingLevel: ctx.house.optionsTradingLevel,
    optionsBuyingPowerCents: ctx.ledger.buyingPowerCents,
    isPaper: true,
    asOf: ctx.house.asOf,
  };
}

const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qtyText = (qty: number) => String(Number(qty.toFixed(6)));

/** Pre-dispatch guards, in order. Returns the refusal message, or null when the order may go. */
async function refusalFor(ctx: BookContext, order: OrderRequest, orderId: number | null): Promise<string | null> {
  const { db, book, ledger, house } = ctx;
  const symbol = order.symbol.toUpperCase();
  // (a) the book is active
  if (book.status === "frozen") return `This practice book is paused${book.frozenReason ? `: ${book.frozenReason}` : ""}. Ask the owner to review it.`;
  if (book.status !== "active") return "This practice book is archived. Start a new book to keep trading.";
  // every book order carries this book's tag (stamped at creation, never changed)
  const tag = parseClientOrderId(order.clientOrderId);
  if (!tag || tag.kind !== "book" || tag.bookId !== book.id) return "This order was created outside your current practice book. Create it again from your practice book.";
  // (e) day orders only: the app has no broker cancel, so a GTC order on the shared account would linger
  if (order.timeInForce !== "day") return "Practice books accept day orders only, so nothing lingers on the shared practice account overnight.";
  const others = ctx.orders.filter((o) => o.id !== orderId);
  if (order.side === "sell") {
    // (f) the symbol isn't reconciliation-frozen (sells only; buys stay allowed)
    if ((await frozenSymbols(db, house.externalAccountId)).has(symbol)) return `Sells of ${symbol} are paused while the shared practice account is reconciled. Buys are still allowed.`;
    // (b) own book only, long-only: never beyond broker-backed qty minus open sells
    if (order.qty == null || !(order.qty > 0)) return "Practice-book sells need a share or contract quantity.";
    const held = ledger.positions.find((p) => p.symbol === symbol)?.brokerBackedQty ?? 0;
    const openSells = others.filter((o) => o.side === "sell" && o.status === "submitted" && o.symbol.toUpperCase() === symbol)
      .reduce((sum, o) => sum + Math.max(0, (o.qty ?? 0) - (o.filledQty ?? 0)), 0);
    if (order.qty > held - openSells + 1e-6) {
      return `Practice books are long-only: your book holds ${qtyText(held)} ${symbol}${openSells > 0 ? ` (${qtyText(openSells)} already in open sells)` : ""}, so a sell of ${qtyText(order.qty)} is refused.`;
    }
  } else {
    // (c) cost within book cash (less other open buys) and within house buying power
    const multiplier = order.instrumentType === "long_call" || order.instrumentType === "long_put" ? 100 : 1;
    const price = order.limitPriceCents ?? ctx.mark(symbol)?.priceCents ?? null;
    const cost = order.notionalCents ?? (order.qty != null && price != null ? Math.round(order.qty * price * multiplier) : null);
    if (cost == null) return `The price of ${symbol} isn't known, so this buy can't be checked against your practice cash. Use a limit order.`;
    const reservedByOthers = others.reduce((sum, o) => sum + reservedCashForOpenBuy(o, ctx.mark(o.symbol)?.priceCents ?? null), 0);
    const available = ledger.cashCents - reservedByOthers;
    if (cost > available) return `Not enough practice cash: this buy needs ${usd(cost)} and your book has ${usd(Math.max(0, available))} available.`;
    if (house.buyingPowerCents == null || cost > house.buyingPowerCents) return "The shared practice account doesn't have the buying power for this order right now. Try a smaller order, or ask the owner.";
  }
  // (d) wash-trade: no open opposite-side order on this symbol anywhere on the house
  const opposite = order.side === "buy" ? "sell" : "buy";
  const conflicts = await db.select({ id: brokerOrders.id, accountId: brokerOrders.accountId }).from(brokerOrders).where(and(
    eq(brokerOrders.symbol, symbol), eq(brokerOrders.side, opposite), eq(brokerOrders.status, "submitted"),
    ...(orderId != null ? [ne(brokerOrders.id, orderId)] : []),
  ));
  for (const conflict of conflicts) {
    const account = conflict.accountId === ctx.row.id ? ctx.row : await loadRow(db, conflict.accountId).catch(() => null);
    if (!account || account.brokerId !== "alpaca_paper") continue;
    if (conflict.accountId === ctx.row.id) return `You have an open ${opposite} on ${symbol}. Wait for it to fill or expire before placing a ${order.side}.`;
    return `Another tester has an open ${opposite} on ${symbol} in the shared practice account; try again when it fills or expires.`;
  }
  return null;
}

function isWashTradeRejection(raw: unknown): boolean {
  const text = JSON.stringify(raw ?? "").toLowerCase();
  return text.includes("wash trade") || text.includes("wash_trade");
}

export function practiceAwareAlpaca(accountId: number, house: BrokerAdapter): BrokerAdapter {
  const context = async (): Promise<BookContext | null> => {
    const db = await getDb();
    if (!db) throw new BrokerUnavailableError("database unavailable");
    const row = await loadRow(db, accountId);
    if (row.practiceBookId == null) return null;
    return loadBookContext(db, row, house);
  };
  const assertOrderInAccount = async (where: { brokerOrderId?: string; clientOrderId?: string }) => {
    const db = await getDb();
    if (!db) throw new BrokerUnavailableError("database unavailable");
    const [order] = await db.select({ accountId: brokerOrders.accountId }).from(brokerOrders).where(where.brokerOrderId != null
      ? eq(brokerOrders.brokerOrderId, where.brokerOrderId)
      : eq(brokerOrders.clientOrderId, where.clientOrderId ?? "")).limit(1);
    if (!order || order.accountId !== accountId) throw new PracticeBookRefusal("That order doesn't belong to this practice book.");
  };
  const isBookRow = async () => {
    const db = await getDb();
    if (!db) throw new BrokerUnavailableError("database unavailable");
    return (await loadRow(db, accountId)).practiceBookId != null;
  };

  return {
    id: house.id,
    label: house.label,
    requiredEnv: house.requiredEnv,
    capabilities: house.capabilities,
    available: () => house.available(),
    unavailableReason: () => house.unavailableReason(),

    async getAccount() {
      const ctx = await context();
      return ctx ? bookAccount(ctx) : house.getAccount();
    },

    async getPositions(): Promise<BrokerPosition[]> {
      const ctx = await context();
      if (!ctx) return house.getPositions();
      return ctx.ledger.positions.map((p) => ({
        symbol: p.symbol, qty: p.qty, avgCostCents: p.avgCostCents, lastPriceCents: p.lastPriceCents, marketValueCents: p.marketValueCents, assetType: p.assetType,
      }));
    },

    async assertCanDispatch(order, meta) {
      const ctx = await context();
      if (!ctx) return;
      const refusal = await refusalFor(ctx, order, meta.orderId);
      if (refusal) throw new PracticeBookRefusal(refusal);
    },

    async submitOrder(order: OrderRequest, opts: { isPaper: boolean }): Promise<OrderResult> {
      assertPaperOnly("Alpaca (practice book)", opts.isPaper);
      const ctx = await context();
      if (!ctx) return house.submitOrder(order, opts);
      // Defence in depth: the same guards again at dispatch (another book may have moved since).
      const tag = parseClientOrderId(order.clientOrderId);
      const refusal = await refusalFor(ctx, order, tag?.orderId ?? null);
      if (refusal) return { brokerOrderId: "", status: "rejected", filledQty: null, filledAvgPriceCents: null, submittedAt: Date.now(), raw: { practiceBookRefusal: refusal } };
      const result = await house.submitOrder(order, opts);
      if (result.status === "rejected" && isWashTradeRejection(result.raw)) {
        return { ...result, raw: { ...(typeof result.raw === "object" && result.raw ? result.raw : {}), practiceBookRefusal: PRACTICE_ACCOUNT_CONFLICT(order.symbol.toUpperCase()) } };
      }
      return result;
    },

    async getOrders(opts) {
      if (!(await isBookRow())) return house.getOrders(opts);
      const db = (await getDb())!;
      const own = new Set((await db.select({ clientOrderId: brokerOrders.clientOrderId }).from(brokerOrders)
        .where(eq(brokerOrders.accountId, accountId))).map((o) => o.clientOrderId).filter(Boolean));
      return (await house.getOrders(opts)).filter((o) => own.has((o.raw as any)?.client_order_id));
    },

    async getOrder(brokerOrderId: string) {
      if (await isBookRow()) await assertOrderInAccount({ brokerOrderId });
      return house.getOrder(brokerOrderId);
    },

    async getOrderByClientOrderId(clientOrderId: string) {
      if (await isBookRow()) await assertOrderInAccount({ clientOrderId });
      return house.getOrderByClientOrderId(clientOrderId);
    },

    async getOrderExecutions(input) {
      if (!house.getOrderExecutions) throw new BrokerUnavailableError("execution receipts are unavailable");
      if (await isBookRow()) await assertOrderInAccount({ brokerOrderId: input.brokerOrderId });
      return house.getOrderExecutions.call(house, input);
    },

    // Market data, not account data: unchanged.
    getOptionContract: house.getOptionContract ? (symbol) => house.getOptionContract!.call(house, symbol) : undefined,
    getOptionMarketSnapshot: house.getOptionMarketSnapshot ? (symbol) => house.getOptionMarketSnapshot!.call(house, symbol) : undefined,
    getOptionChain: house.getOptionChain ? (query) => house.getOptionChain!.call(house, query) : undefined,
  };
}

/** Exposed for the owner reconciliation and tests. */
export async function readBookLedger(accountId: number, house: BrokerAdapter): Promise<{ book: UatPracticeBook; ledger: BookLedger; house: HouseSnapshot } | null> {
  const db = await getDb();
  if (!db) throw new BrokerUnavailableError("database unavailable");
  const row = await loadRow(db, accountId);
  if (row.practiceBookId == null) return null;
  const ctx = await loadBookContext(db, row, house);
  return { book: ctx.book, ledger: ctx.ledger, house: ctx.house };
}

import { eq, inArray } from "drizzle-orm";
import { brokerOrders, uatBookAdjustments, uatPracticeBooks, type BrokerOrder, type UatBookAdjustment } from "../../../drizzle/schema";
import type { getDb } from "../../db";
import type { OrderResult } from "../brokers/types";
import type { HouseSnapshot } from "./houseSnapshot";
import { computeBookLedger, orderMultiplier, parseClientOrderId, type LedgerOrder } from "./ledger";
import { appendBookAdjustment, frozenSymbols, houseBaseline, maskAccountNumber } from "./repository";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/**
 * Owner reconciliation (UAT-E4, design §5.6): Σ practice books vs the shared
 * Alpaca house. It never corrects a book. A quantity mismatch, or an
 * unattributed house order on a booked symbol, appends a `symbol_freeze` row
 * that E2's sell guard reads (buys stay allowed). The owner clears it with an
 * audited `symbol_unfreeze`.
 */
export const QTY_TOLERANCE = 1e-6;
export const CASH_TOLERANCE_CENTS = 100;
/** Alpaca's `GET /orders` page limit; a full page means older orders may be missing. */
export const HOUSE_ORDER_PAGE = 500;
/** `created_by` for rows written by the automatic reconciliation (no human actor). */
export const RECONCILIATION_ACTOR = 0;

export interface SymbolLine {
  symbol: string;
  houseQty: number;
  bookQty: number;
  delta: number;
  balanced: boolean;
  frozen: boolean;
  books: { bookId: number; userId: number; status: string; qty: number }[];
}

export interface UnattributedOrder {
  brokerOrderId: string;
  clientOrderId: string | null;
  symbol: string | null;
  side: string | null;
  qty: number | null;
  status: string;
  submittedAt: number;
  touchesBookedSymbol: boolean;
}

export interface ReconciliationReport {
  houseExternalAccountId: string;
  houseAccount: string | null;
  asOf: number;
  balanced: boolean;
  symbols: SymbolLine[];
  cash: { baselineCashCents: number | null; houseCashCents: number | null; bookFlowCents: number; driftCents: number | null; withinTolerance: boolean | null };
  bookCash: { activeBookCashCents: number; houseBuyingPowerCents: number | null; withinBuyingPower: boolean | null };
  /** Null when house orders were not read (the snapshot-refresh run reads no extra endpoint). */
  unattributedOrders: UnattributedOrder[] | null;
  missingAtHouse: { orderId: number; bookId: number; brokerOrderId: string | null; clientOrderId: string | null; symbol: string }[] | null;
  frozenSymbols: { symbol: string; since: number; note: string }[];
  newlyFrozen: string[];
}

export const ledgerOrderFromRow = (order: BrokerOrder): LedgerOrder => ({
  id: order.id, symbol: order.symbol, side: order.side, instrumentType: order.instrumentType, contractMultiplier: order.contractMultiplier,
  qty: order.qty, notionalCents: order.notionalCents, orderType: order.orderType, limitPriceCents: order.limitPriceCents,
  gatedNotionalCents: order.gatedNotionalCents, status: order.status, filledQty: order.filledQty, filledAvgPriceCents: order.filledAvgPriceCents,
});

const rawField = (raw: unknown, key: string): unknown => (raw && typeof raw === "object" ? (raw as Record<string, unknown>)[key] : undefined);
const numberOrNull = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

export async function reconcileHouse(db: Db, house: HouseSnapshot, options: { now: number; actor?: number; houseOrders?: OrderResult[] | null }): Promise<ReconciliationReport> {
  const houseId = house.externalAccountId;
  const books = await db.select().from(uatPracticeBooks).where(eq(uatPracticeBooks.houseExternalAccountId, houseId));
  const bookIds = books.map((book) => book.id);
  const orders = bookIds.length ? await db.select().from(brokerOrders).where(inArray(brokerOrders.practiceBookId, bookIds)) : [];
  const adjustments: UatBookAdjustment[] = bookIds.length ? await db.select().from(uatBookAdjustments).where(inArray(uatBookAdjustments.bookId, bookIds)) : [];

  // (1) per-symbol house qty vs Σ broker-backed qty across active, frozen and archived books.
  const bookQty = new Map<string, SymbolLine["books"]>();
  let activeBookCashCents = 0;
  for (const book of books) {
    const ledger = computeBookLedger({
      startingCashCents: book.startingCashCents,
      adjustments: adjustments.filter((adjustment) => adjustment.bookId === book.id),
      orders: orders.filter((order) => order.practiceBookId === book.id).map(ledgerOrderFromRow),
      mark: () => null,
    });
    if (book.status === "active") activeBookCashCents += ledger.cashCents;
    for (const position of ledger.positions) {
      if (Math.abs(position.brokerBackedQty) <= QTY_TOLERANCE) continue;
      const key = position.symbol.toUpperCase();
      if (!bookQty.has(key)) bookQty.set(key, []);
      bookQty.get(key)!.push({ bookId: book.id, userId: book.userId, status: book.status, qty: position.brokerBackedQty });
    }
  }
  const houseQty = new Map<string, number>();
  for (const position of house.positions) houseQty.set(position.symbol.toUpperCase(), (houseQty.get(position.symbol.toUpperCase()) ?? 0) + position.qty);
  const frozenBefore = await frozenSymbols(db, houseId);
  const symbols: SymbolLine[] = Array.from(new Set([...Array.from(houseQty.keys()), ...Array.from(bookQty.keys())])).sort().map((symbol) => {
    const lines = bookQty.get(symbol) ?? [];
    const booked = lines.reduce((sum, line) => sum + line.qty, 0);
    const held = houseQty.get(symbol) ?? 0;
    const delta = held - booked;
    return { symbol, houseQty: held, bookQty: booked, delta, balanced: Math.abs(delta) <= QTY_TOLERANCE, frozen: frozenBefore.has(symbol), books: lines };
  });

  // (2) house cash change since the baseline vs Σ book fill cash flows (and broker-backed adjustments).
  let bookFlowCents = 0;
  for (const order of orders) {
    const filled = order.filledQty ?? 0;
    if (filled <= 0 || order.filledAvgPriceCents == null) continue;
    const amount = Math.round(filled * order.filledAvgPriceCents * orderMultiplier(order));
    bookFlowCents += order.side === "buy" ? -amount : amount;
  }
  for (const adjustment of adjustments) {
    if (adjustment.brokerBacked && adjustment.kind !== "starting_cash" && adjustment.cashCents != null) bookFlowCents += adjustment.cashCents;
  }
  const baseline = await houseBaseline(db, houseId);
  const driftCents = baseline?.cashCents != null && house.cashCents != null ? house.cashCents - baseline.cashCents - bookFlowCents : null;

  // (3) every house order carries a known sh- tag; (4) every booked fill exists at the house.
  const openOrBooked = new Set([...Array.from(bookQty.keys()), ...orders.filter((order) => order.status === "submitted").map((order) => order.symbol.toUpperCase())]);
  let unattributedOrders: UnattributedOrder[] | null = null;
  let missingAtHouse: ReconciliationReport["missingAtHouse"] = null;
  if (options.houseOrders) {
    const known = new Set(bookIds);
    unattributedOrders = options.houseOrders.flatMap((order) => {
      const clientOrderId = typeof rawField(order.raw, "client_order_id") === "string" ? rawField(order.raw, "client_order_id") as string : null;
      const parsed = parseClientOrderId(clientOrderId);
      if (parsed?.kind === "paper" || (parsed?.kind === "book" && known.has(parsed.bookId))) return [];
      const symbol = typeof rawField(order.raw, "symbol") === "string" ? (rawField(order.raw, "symbol") as string).toUpperCase() : null;
      return [{
        brokerOrderId: order.brokerOrderId, clientOrderId, symbol,
        side: typeof rawField(order.raw, "side") === "string" ? rawField(order.raw, "side") as string : null,
        qty: numberOrNull(rawField(order.raw, "qty")), status: order.status, submittedAt: order.submittedAt,
        touchesBookedSymbol: symbol != null && openOrBooked.has(symbol),
      }];
    });
    const houseIds = new Set(options.houseOrders.map((order) => order.brokerOrderId));
    // A full page may not reach older orders; only check fills inside the window it covers.
    const windowStart = options.houseOrders.length >= HOUSE_ORDER_PAGE ? Math.min(...options.houseOrders.map((order) => order.submittedAt)) : -Infinity;
    missingAtHouse = orders
      .filter((order) => (order.filledQty ?? 0) > 0 && order.updatedAt >= windowStart && (!order.brokerOrderId || !houseIds.has(order.brokerOrderId)))
      .map((order) => ({ orderId: order.id, bookId: order.practiceBookId!, brokerOrderId: order.brokerOrderId, clientOrderId: order.clientOrderId, symbol: order.symbol }));
  }

  // Freeze sells (never auto-correct): qty mismatches and unattributed orders on booked symbols.
  const reasons = new Map<string, string>();
  for (const line of symbols) {
    if (!line.balanced) reasons.set(line.symbol, `House holds ${line.houseQty} ${line.symbol}, practice books hold ${line.bookQty}.`);
  }
  for (const order of unattributedOrders ?? []) {
    if (order.touchesBookedSymbol && order.symbol && !reasons.has(order.symbol)) reasons.set(order.symbol, `Unattributed house order ${order.brokerOrderId} on ${order.symbol} (client id ${order.clientOrderId ?? "none"}).`);
  }
  const newlyFrozen: string[] = [];
  for (const [symbol, reason] of Array.from(reasons.entries())) {
    if (frozenBefore.has(symbol)) continue;
    await appendBookAdjustment(db, {
      bookId: null, kind: "symbol_freeze", symbol, brokerBacked: false, houseExternalAccountId: houseId,
      note: `Sells paused by reconciliation: ${reason}`, createdBy: options.actor ?? RECONCILIATION_ACTOR, createdAt: options.now,
    });
    newlyFrozen.push(symbol);
    console.error(`[uat-recon] froze sells of ${symbol} on house ${maskAccountNumber(houseId)}: ${reason}`);
  }
  if (driftCents != null && Math.abs(driftCents) > CASH_TOLERANCE_CENTS) {
    console.error(`[uat-recon] house ${maskAccountNumber(houseId)} cash drift ${driftCents} cents vs the baseline and book fills`);
  }
  const frozenAfter = newlyFrozen.length ? await frozenSymbols(db, houseId) : frozenBefore;
  for (const line of symbols) line.frozen = frozenAfter.has(line.symbol);

  const withinBuyingPower = house.buyingPowerCents == null ? null : activeBookCashCents <= house.buyingPowerCents;
  const withinTolerance = driftCents == null ? null : Math.abs(driftCents) <= CASH_TOLERANCE_CENTS;
  return {
    houseExternalAccountId: houseId,
    houseAccount: maskAccountNumber(houseId),
    asOf: house.asOf,
    balanced: symbols.every((line) => line.balanced) && withinTolerance !== false && withinBuyingPower !== false
      && !(unattributedOrders?.length) && !(missingAtHouse?.length),
    symbols,
    cash: { baselineCashCents: baseline?.cashCents ?? null, houseCashCents: house.cashCents, bookFlowCents, driftCents, withinTolerance },
    bookCash: { activeBookCashCents, houseBuyingPowerCents: house.buyingPowerCents, withinBuyingPower },
    unattributedOrders,
    missingAtHouse,
    frozenSymbols: Array.from(frozenAfter.entries()).map(([symbol, info]) => ({ symbol, since: info.since, note: info.note })).sort((a, b) => a.symbol.localeCompare(b.symbol)),
    newlyFrozen,
  };
}

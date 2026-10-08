/**
 * Practice-book ledger maths (pure). A book's numbers come from its own fills,
 * never from the shared house account:
 *
 *   cash        = starting cash + Σ cash adjustments − Σ buy fills + Σ sell fills
 *   qty[s]      = Σ buy filled qty − Σ sell filled qty (+ adjustments)
 *   avgCost[s]  = average cost on buys; realised P&L on sells = (sell − avgCost) × qty × multiplier
 *   equity      = cash + Σ qty × mark × multiplier   (null if any held mark is unknown: "Not measured", #19)
 *   buyingPower = max(0, cash − cash reserved by open buys)
 *
 * Fills count from every order row with filled_qty > 0 in ANY status: Alpaca
 * paper partially fills ~10% of eligible orders, and canceled/expired orders keep
 * their filled_qty while mapping to our "rejected" (brokers/index.ts toOrderResult).
 * No fees and no dividends: Alpaca paper simulates neither.
 */

export interface LedgerOrder {
  id: number;
  symbol: string;
  side: "buy" | "sell";
  instrumentType: "shares" | "long_call" | "long_put" | null;
  contractMultiplier: number | null;
  qty: number | null;
  notionalCents: number | null;
  orderType: "market" | "limit";
  limitPriceCents: number | null;
  gatedNotionalCents: number | null;
  status: string;
  filledQty: number | null;
  filledAvgPriceCents: number | null;
}

export interface LedgerAdjustment {
  kind: string;
  symbol: string | null;
  qty: number | null;
  priceCents: number | null;
  cashCents: number | null;
  brokerBacked: boolean;
}

export interface LedgerMark {
  priceCents: number;
  source: "house" | "price_fact";
}

export interface LedgerPosition {
  symbol: string;
  /** Broker-backed plus virtual (scenario seed) quantity. */
  qty: number;
  /** Shares that really exist at the house for this book; the only sellable quantity. */
  brokerBackedQty: number;
  avgCostCents: number | null;
  multiplier: number;
  assetType: "equity" | "option";
  lastPriceCents: number | null;
  markSource: LedgerMark["source"] | null;
  marketValueCents: number | null;
  unrealizedPnlCents: number | null;
}

export interface BookLedger {
  cashCents: number;
  reservedBuyCents: number;
  buyingPowerCents: number;
  equityValueCents: number | null;
  realizedPnlCents: number;
  unrealizedPnlCents: number | null;
  positions: LedgerPosition[];
  /** Remaining (unfilled) quantity on open sells, by symbol. */
  openSellQty: Record<string, number>;
  /** Symbols whose broker-backed quantity went negative: the book must be frozen. */
  negativeSymbols: string[];
}

/** Statuses whose remaining quantity is still working at the broker. */
export const OPEN_AT_BROKER_STATUSES = ["submitted"] as const;
const QTY_EPSILON = 1e-6;

export function orderMultiplier(order: Pick<LedgerOrder, "instrumentType" | "contractMultiplier">): number {
  if (!order.instrumentType || order.instrumentType === "shares") return 1;
  return order.contractMultiplier ?? 100;
}

function isOpen(order: LedgerOrder): boolean {
  return (OPEN_AT_BROKER_STATUSES as readonly string[]).includes(order.status);
}

/** Cash an open buy can still consume: remaining qty × limit (or best known price), or remaining notional. */
export function reservedCashForOpenBuy(order: LedgerOrder, markCents: number | null): number {
  if (order.side !== "buy" || !isOpen(order)) return 0;
  const multiplier = orderMultiplier(order);
  const filledQty = Math.max(0, order.filledQty ?? 0);
  if (order.qty != null && order.qty > 0) {
    const remaining = Math.max(0, order.qty - filledQty);
    const price = order.limitPriceCents ?? markCents ?? (order.gatedNotionalCents != null ? order.gatedNotionalCents / (order.qty * multiplier) : null);
    // Unknown price: reserve the whole stated notional so nothing is double-spent.
    if (price == null) return Math.max(0, order.gatedNotionalCents ?? 0);
    return Math.round(remaining * price * multiplier);
  }
  if (order.notionalCents != null) {
    const spent = filledQty * (order.filledAvgPriceCents ?? 0) * multiplier;
    return Math.max(0, Math.round(order.notionalCents - spent));
  }
  return 0;
}

export function computeBookLedger(input: {
  startingCashCents: number;
  adjustments: LedgerAdjustment[];
  orders: LedgerOrder[];
  mark: (symbol: string) => LedgerMark | null;
}): BookLedger {
  let cash = input.startingCashCents;
  let realized = 0;
  type Lot = { qty: number; brokerBackedQty: number; cost: number; multiplier: number; assetType: "equity" | "option" };
  const lots = new Map<string, Lot>();
  const lot = (symbol: string, multiplier = 1, assetType: Lot["assetType"] = "equity") => {
    if (!lots.has(symbol)) lots.set(symbol, { qty: 0, brokerBackedQty: 0, cost: 0, multiplier, assetType });
    return lots.get(symbol)!;
  };

  for (const adjustment of input.adjustments) {
    if (adjustment.kind === "starting_cash") continue; // audit copy of startingCashCents
    if (adjustment.cashCents != null) cash += adjustment.cashCents;
    if (adjustment.symbol && adjustment.qty != null && adjustment.qty !== 0) {
      const position = lot(adjustment.symbol.toUpperCase());
      position.qty += adjustment.qty;
      if (adjustment.brokerBacked) position.brokerBackedQty += adjustment.qty;
      position.cost += adjustment.qty * (adjustment.priceCents ?? 0);
    }
  }

  const openSellQty: Record<string, number> = {};
  const ordered = [...input.orders].sort((a, b) => a.id - b.id);
  for (const order of ordered) {
    const symbol = order.symbol.toUpperCase();
    const multiplier = orderMultiplier(order);
    const filled = Math.max(0, order.filledQty ?? 0);
    if (order.side === "sell" && isOpen(order) && order.qty != null) {
      openSellQty[symbol] = (openSellQty[symbol] ?? 0) + Math.max(0, order.qty - filled);
    }
    if (filled <= 0 || order.filledAvgPriceCents == null) continue;
    const position = lot(symbol, multiplier, multiplier === 1 ? "equity" : "option");
    const value = filled * order.filledAvgPriceCents * multiplier;
    if (order.side === "buy") {
      cash -= value;
      position.qty += filled;
      position.brokerBackedQty += filled;
      position.cost += filled * order.filledAvgPriceCents;
    } else {
      const avg = position.qty > QTY_EPSILON ? position.cost / position.qty : order.filledAvgPriceCents;
      cash += value;
      realized += (order.filledAvgPriceCents - avg) * filled * multiplier;
      position.cost -= avg * filled;
      position.qty -= filled;
      position.brokerBackedQty -= filled;
    }
  }

  const positions: LedgerPosition[] = [];
  const negativeSymbols: string[] = [];
  let holdingsValue = 0;
  let unrealized = 0;
  let measured = true;
  for (const [symbol, position] of Array.from(lots.entries())) {
    if (position.brokerBackedQty < -QTY_EPSILON) negativeSymbols.push(symbol);
    if (Math.abs(position.qty) <= QTY_EPSILON) continue;
    const avgCostCents = Math.round(position.cost / position.qty);
    const mark = input.mark(symbol);
    const marketValueCents = mark ? Math.round(position.qty * mark.priceCents * position.multiplier) : null;
    const unrealizedPnlCents = mark ? Math.round((mark.priceCents - position.cost / position.qty) * position.qty * position.multiplier) : null;
    if (marketValueCents == null) measured = false;
    else { holdingsValue += marketValueCents; unrealized += unrealizedPnlCents ?? 0; }
    positions.push({
      symbol, qty: position.qty, brokerBackedQty: Math.max(0, position.brokerBackedQty), avgCostCents, multiplier: position.multiplier, assetType: position.assetType,
      lastPriceCents: mark?.priceCents ?? null, markSource: mark?.source ?? null, marketValueCents, unrealizedPnlCents,
    });
  }

  const cashCents = Math.round(cash);
  const reservedBuyCents = ordered.reduce((sum, order) => sum + reservedCashForOpenBuy(order, input.mark(order.symbol.toUpperCase())?.priceCents ?? null), 0);
  return {
    cashCents,
    reservedBuyCents,
    buyingPowerCents: Math.max(0, cashCents - reservedBuyCents),
    equityValueCents: measured ? cashCents + holdingsValue : null,
    realizedPnlCents: Math.round(realized),
    unrealizedPnlCents: measured ? unrealized : null,
    positions: positions.sort((a, b) => a.symbol.localeCompare(b.symbol)),
    openSellQty,
    negativeSymbols,
  };
}

/** Client order id for an order: sh-b<book>-<order> for book orders (≤ 25 chars), else sh-paper-<order>. */
export function clientOrderIdFor(order: { id: number; practiceBookId?: number | null }): string {
  return order.practiceBookId != null ? `sh-b${order.practiceBookId}-${order.id}` : `sh-paper-${order.id}`;
}

export function parseClientOrderId(clientOrderId: string | null | undefined): { kind: "book"; bookId: number; orderId: number } | { kind: "paper"; orderId: number } | null {
  if (!clientOrderId) return null;
  const book = /^sh-b(\d+)-(\d+)$/.exec(clientOrderId);
  if (book) return { kind: "book", bookId: Number(book[1]), orderId: Number(book[2]) };
  const paper = /^sh-paper-(\d+)$/.exec(clientOrderId);
  if (paper) return { kind: "paper", orderId: Number(paper[1]) };
  return null;
}

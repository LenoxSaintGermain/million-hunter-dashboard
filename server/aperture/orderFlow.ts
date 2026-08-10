/**
 * Order flow — approve → submit → mirror fills.
 *
 * Design contract:
 *   1. A human must approve before anything is submitted. There is no auto-submit.
 *   2. assertPaperOnly() is called at the adapter layer — this module trusts it.
 *   3. Fill mirroring is a read-back, not an assumption. A market order that comes
 *      back `accepted` (not yet `filled`) is polled until terminal.
 *   4. Every state transition is written to broker_orders before the broker call
 *      and again after, so a crash mid-flight leaves an auditable record.
 *   5. positionSnapshots are written after every fill so P&L can be computed later.
 */
import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  brokerOrders, positionSnapshots, portfolioAccounts, positions as positionsTable,
  type BrokerOrder,
} from "../../drizzle/schema";
import { brokerFor } from "./brokers/index";
import type { OrderRequest } from "./brokers/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateOrderInput {
  runId: number;
  candidateId?: number;
  accountId: number;
  userId: number;
  symbol: string;
  side: "buy" | "sell";
  qty?: number;
  notionalCents?: number;
  orderType?: "market" | "limit";
  limitPriceCents?: number;
  timeInForce?: "day" | "gtc";
}

// ── Create (pending_approval) ─────────────────────────────────────────────────

export async function createOrder(input: CreateOrderInput): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("database unavailable");
  const now = Date.now();
  const [result] = await db.insert(brokerOrders).values({
    runId: input.runId,
    candidateId: input.candidateId ?? null,
    accountId: input.accountId,
    userId: input.userId,
    symbol: input.symbol.toUpperCase(),
    side: input.side,
    qty: input.qty ?? null,
    notionalCents: input.notionalCents ?? null,
    orderType: input.orderType ?? "market",
    limitPriceCents: input.limitPriceCents ?? null,
    timeInForce: input.timeInForce ?? "day",
    status: "pending_approval",
    createdAt: now,
    updatedAt: now,
  });
  return (result as any).insertId as number;
}

// ── Approve ───────────────────────────────────────────────────────────────────

export async function approveOrder(orderId: number, userId: number): Promise<BrokerOrder> {
  const db = await getDb();
  if (!db) throw new Error("database unavailable");
  const rows = await db.select().from(brokerOrders)
    .where(and(eq(brokerOrders.id, orderId), eq(brokerOrders.userId, userId)))
    .limit(1);
  const order = rows[0];
  if (!order) throw new Error("order not found");
  if (order.status !== "pending_approval") throw new Error(`cannot approve an order in status ${order.status}`);

  const now = Date.now();
  await db.update(brokerOrders).set({ status: "approved", approvedAt: now, updatedAt: now })
    .where(eq(brokerOrders.id, orderId));
  return { ...order, status: "approved", approvedAt: now, updatedAt: now };
}

// ── Reject ────────────────────────────────────────────────────────────────────

export async function rejectOrder(orderId: number, userId: number, reason?: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("database unavailable");
  const rows = await db.select().from(brokerOrders)
    .where(and(eq(brokerOrders.id, orderId), eq(brokerOrders.userId, userId)))
    .limit(1);
  const order = rows[0];
  if (!order) throw new Error("order not found");
  if (!["pending_approval", "approved"].includes(order.status)) {
    throw new Error(`cannot reject an order in status ${order.status}`);
  }
  const now = Date.now();
  await db.update(brokerOrders).set({
    status: "rejected",
    rejectionReason: reason ?? "rejected by operator",
    updatedAt: now,
  }).where(eq(brokerOrders.id, orderId));
}

// ── Submit ────────────────────────────────────────────────────────────────────

/**
 * Submit an approved order to the broker.
 * Writes `submitted` before the broker call and updates with the result after.
 * Returns the updated order row.
 */
export async function submitOrder(orderId: number, userId: number): Promise<BrokerOrder> {
  const db = await getDb();
  if (!db) throw new Error("database unavailable");

  const rows = await db.select().from(brokerOrders)
    .where(and(eq(brokerOrders.id, orderId), eq(brokerOrders.userId, userId)))
    .limit(1);
  const order = rows[0];
  if (!order) throw new Error("order not found");
  if (order.status !== "approved") throw new Error(`order must be approved before submission (current: ${order.status})`);

  // Load the account to get the broker rail and isPaper flag
  const acctRows = await db.select().from(portfolioAccounts)
    .where(eq(portfolioAccounts.id, order.accountId)).limit(1);
  const account = acctRows[0];
  if (!account) throw new Error("account not found");

  const broker = brokerFor(account.brokerId, account.id);
  if (!broker.available()) {
    throw new Error(broker.unavailableReason() ?? `broker ${account.brokerId} is not configured`);
  }

  const now = Date.now();
  // Mark as submitted before the broker call — if we crash, the record shows intent
  await db.update(brokerOrders).set({ status: "submitted", submittedAt: now, updatedAt: now })
    .where(eq(brokerOrders.id, orderId));

  const req: OrderRequest = {
    symbol: order.symbol,
    side: order.side,
    qty: order.qty ?? undefined,
    notionalCents: order.notionalCents ?? undefined,
    type: order.orderType,
    limitPriceCents: order.limitPriceCents ?? undefined,
    timeInForce: order.timeInForce,
  };

  let result;
  try {
    result = await broker.submitOrder(req, { isPaper: account.isPaper });
  } catch (e: any) {
    // Submission failed — record the rejection
    await db.update(brokerOrders).set({
      status: "rejected",
      rejectionReason: e?.message ?? String(e),
      updatedAt: Date.now(),
    }).where(eq(brokerOrders.id, orderId));
    throw e;
  }

  // Update with broker result
  const newStatus = result.status === "filled" ? "filled" :
    result.status === "rejected" ? "rejected" : "submitted";
  const updates: Partial<BrokerOrder> = {
    status: newStatus as any,
    brokerOrderId: result.brokerOrderId || null,
    filledQty: result.filledQty ?? null,
    filledAvgPriceCents: result.filledAvgPriceCents ?? null,
    updatedAt: Date.now(),
  };
  if (newStatus === "filled") updates.filledAt = Date.now();

  await db.update(brokerOrders).set(updates).where(eq(brokerOrders.id, orderId));

  // If filled immediately, write a position snapshot
  if (newStatus === "filled" && result.filledQty && result.filledAvgPriceCents) {
    await writePositionSnapshot(order.accountId, order.runId, order.symbol, result.filledQty, result.filledAvgPriceCents);
  }

  const updated = await db.select().from(brokerOrders).where(eq(brokerOrders.id, orderId)).limit(1);
  return updated[0]!;
}

// ── Fill mirror ───────────────────────────────────────────────────────────────

/**
 * Poll the broker for fill status on all submitted (not yet terminal) orders.
 * Called by the monitoring heartbeat — not by user action.
 * Returns the number of orders updated.
 */
export async function mirrorFills(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Find all submitted orders for this user
  const pending = await db.select().from(brokerOrders)
    .where(and(eq(brokerOrders.userId, userId), eq(brokerOrders.status, "submitted")));
  if (!pending.length) return 0;

  let updated = 0;
  for (const order of pending) {
    if (!order.brokerOrderId) continue;
    const acctRows = await db.select().from(portfolioAccounts)
      .where(eq(portfolioAccounts.id, order.accountId)).limit(1);
    const account = acctRows[0];
    if (!account) continue;

    const broker = brokerFor(account.brokerId, account.id);
    if (!broker.available()) continue;

    try {
      const result = await broker.getOrder(order.brokerOrderId);
      if (!result) continue;
      if (result.status === order.status) continue; // no change

      const newStatus = result.status === "filled" ? "filled" :
        result.status === "rejected" ? "rejected" : "submitted";
      const now = Date.now();
      await db.update(brokerOrders).set({
        status: newStatus as any,
        filledQty: result.filledQty ?? order.filledQty,
        filledAvgPriceCents: result.filledAvgPriceCents ?? order.filledAvgPriceCents,
        filledAt: newStatus === "filled" ? now : order.filledAt,
        updatedAt: now,
      }).where(eq(brokerOrders.id, order.id));

      if (newStatus === "filled" && result.filledQty && result.filledAvgPriceCents) {
        await writePositionSnapshot(order.accountId, order.runId, order.symbol, result.filledQty, result.filledAvgPriceCents);
      }
      updated++;
    } catch {
      // Non-fatal — log and continue
      console.warn(`[orderFlow] fill mirror failed for order ${order.id}`);
    }
  }
  return updated;
}

// ── Position snapshot ─────────────────────────────────────────────────────────

async function writePositionSnapshot(
  accountId: number,
  runId: number | null | undefined,
  symbol: string,
  filledQty: number,
  filledAvgPriceCents: number,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const now = Date.now();
  await db.insert(positionSnapshots).values({
    accountId,
    runId: runId ?? null,
    symbol,
    qty: filledQty,
    avgCostCents: filledAvgPriceCents,
    lastPriceCents: filledAvgPriceCents, // best we have at fill time
    marketValueCents: Math.round(filledQty * filledAvgPriceCents),
    unrealizedPnlCents: 0, // zero at entry
    priceBasis: "verified",
    snapshotAt: now,
    createdAt: now,
  });
}

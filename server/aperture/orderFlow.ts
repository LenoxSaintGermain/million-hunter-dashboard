/**
 * Order flow — gate → approve → submit → mirror fills.
 *
 * Design contract:
 *   1. A human must approve before anything is submitted. There is no auto-submit.
 *   2. assertPaperOnly() is called at the adapter layer — this module trusts it.
 *   3. Fill mirroring is a read-back, not an assumption. A market order that comes
 *      back `accepted` (not yet `filled`) is polled until terminal.
 *   4. Every state transition is written to broker_orders before the broker call
 *      and again after, so a crash mid-flight leaves an auditable record.
 *   5. positionSnapshots are written after every fill so P&L can be computed later.
 *   6. THE RISK GATES LIVE HERE, not in the tRPC input schema. The router's zod
 *      only checks that required fields are present, so the client gets a
 *      field-level error instead of a 500. This layer is the wall: it is the only
 *      place holding the account, the positions and the fact ledger at once, and
 *      createOrder is reachable from the scheduler and future batch paths that
 *      never touch the router. Anything that reaches the broker passes through here.
 *
 * A blocked order is PERSISTED as `rejected` with the full gate evaluation in
 * `gateSnapshot`, then throws. A ceiling breach is a decision worth keeping —
 * "what did we try to do and what stopped it" is exactly what the pilot needs to
 * answer, and a thrown error with no row answers nothing.
 */
import { eq, and, inArray, gte } from "drizzle-orm";
import { getDb } from "../db";
import {
  apertureDecisionRuns, brokerOrders, positionSnapshots, portfolioAccounts, positions as positionsTable,
  type BrokerOrder,
} from "../../drizzle/schema";
import { brokerFor } from "./brokers/index";
import type { OrderRequest } from "./brokers/types";
import { getFacts, freshestPerKey, normSymbol } from "./facts";
import { marketSession, startOfEtDay, type SessionState } from "./marketSession";
import {
  evaluateOrderGates,
  plannedRiskCentsFor,
  resolveOrderIntent,
  type OrderIntent,
  type ResolvedIntent,
  gateFailureMessage,
  type GateEvaluation,
  type NotionalBasis,
  type OrderAccountState,
} from "./gates";
import { CURRENT_MANDATE, effectiveMandate, type HoldingPeriod, type Mandate } from "./mandate";
import {
  authorizeDecisionAction,
  DecisionRunwayBlockedError,
  queuePaperOutcome,
  type DecisionAuthorizationSnapshot,
  type PaperDecisionAction,
} from "./decisionRunway";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateOrderInput {
  runId: number;
  candidateId?: number;
  accountId: number;
  userId: number;
  symbol: string;
  side: "buy" | "sell";
  /** Opens or closes exposure. Inferred from the held position when absent. */
  intent?: OrderIntent | null;
  qty?: number;
  notionalCents?: number;
  orderType?: "market" | "limit";
  limitPriceCents?: number;
  timeInForce?: "day" | "gtc";
  // ── Risk-gate fields. None of these are optional in practice: an order that
  // omits one is blocked by the gate, not silently accepted with a null. ──
  /** Why this trade. Boilerplate ("n/a", "see memo") is rejected. */
  reason?: string | null;
  /** What would make it wrong. Boilerplate is rejected. */
  invalidationCondition?: string | null;
  invalidationPriceCents?: number | null;
  entryPriceCents?: number | null;
  stopPriceCents?: number | null;
  slippageCents?: number | null;
  timeStopAt?: number | null;
  noTradeConditions?: string[] | null;
  holdingPeriod?: HoldingPeriod | string | null;
  catalystDeadlineAt?: number | null;
  /** Must be the literal "PAPER". */
  paperAcknowledgement?: string | null;
  /** Tightening-only overrides from the thesis. Never loosens the mandate. */
  portfolioRules?: Parameters<typeof effectiveMandate>[1];
  /** Injected in tests. Production uses the real clock. */
  now?: number;
}

/**
 * Orders that still count against a ceiling: anything not rejected or cancelled.
 * Exported so the cockpit's headroom rail counts exactly the same rows the gates
 * count — a rail built on a different status set would quietly disagree.
 */
export const LIVE_ORDER_STATUSES = ["pending_approval", "approved", "submitted", "filled"] as const;

/** Thrown when an order fails the mandate. Carries the full evaluation. */
export class OrderGateError extends Error {
  readonly evaluation: GateEvaluation;
  readonly orderId: number | null;
  constructor(evaluation: GateEvaluation, orderId: number | null) {
    super(`order blocked by the mandate: ${gateFailureMessage(evaluation)}`);
    this.name = "OrderGateError";
    this.evaluation = evaluation;
    this.orderId = orderId;
  }
}

/**
 * Serialize an order transition with the authoritative Decision Run head.
 * Cash/conditional revisions update the same row, so the first committed lock
 * defines whether the paper action or the blocking decision happened first.
 */
async function lockCurrentDecisionRevision(tx: any, authorization: DecisionAuthorizationSnapshot | null) {
  if (authorization?.source !== "authoritative" || authorization.decisionRunId == null || authorization.revisionId == null) return;
  const [head] = await tx.select({ currentRevisionId: apertureDecisionRuns.currentRevisionId })
    .from(apertureDecisionRuns)
    .where(eq(apertureDecisionRuns.id, authorization.decisionRunId))
    .for("update")
    .limit(1);
  if (!head || head.currentRevisionId !== authorization.revisionId) {
    throw new DecisionRunwayBlockedError(
      "Decision Runway changed before this action could be recorded. Review the current cash or conditional receipt.",
      "DECISION_BINDING_MISMATCH",
    );
  }
}

// ── Gate evaluation (shared by create and preflight) ──────────────────────────

/**
 * Everything the gates saw, and what they concluded — without any write.
 *
 * `createOrder` and `preflightOrder` BOTH go through this. That is the whole
 * point of the extraction: an order ticket that shows gates live as the operator
 * types is only useful if its verdict is the verdict. Two evaluators with the
 * same intent would drift on the first change to either, and a preflight that
 * says "pass" where create says "fail" trains the operator to ignore the rail.
 */
export interface OrderEvaluation {
  evaluation: GateEvaluation;
  /** What the order does to exposure, and how that was established. */
  resolvedIntent: ResolvedIntent;
  session: SessionState;
  mandate: Mandate;
  accountState: OrderAccountState;
  gatedNotionalCents: number | null;
  notionalBasis: NotionalBasis;
  symbol: string;
  orderType: "market" | "limit";
  timeInForce: "day" | "gtc";
  now: number;
  account: { id: number; isPaper: boolean; equityValueCents: number | null; cashCents: number | null };
  /** Exact authoritative binding when the proposal originated in Decision Runway. */
  decisionAuthorization: DecisionAuthorizationSnapshot | null;
}

async function evaluateOrder(input: CreateOrderInput, action: Extract<PaperDecisionAction, "preflight" | "create_proposal">): Promise<OrderEvaluation> {
  const db = await getDb();
  if (!db) throw new Error("database unavailable");

  const now = input.now ?? Date.now();
  const symbol = normSymbol(input.symbol);
  const orderType = input.orderType ?? "market";
  const timeInForce = input.timeInForce ?? "day";

  const acctRows = await db.select().from(portfolioAccounts)
    .where(eq(portfolioAccounts.id, input.accountId)).limit(1);
  const account = acctRows[0];
  if (!account) throw new Error("account not found");

  const mandate: Mandate = effectiveMandate(CURRENT_MANDATE, input.portfolioRules);
  const session = marketSession(now);
  const accountState = await loadOrderAccountState({
    db, account, symbol, runId: input.runId, userId: input.userId, now,
  });

  const { gatedNotionalCents, notionalBasis } = await resolveNotional({
    symbol, qty: input.qty, notionalCents: input.notionalCents, limitPriceCents: input.limitPriceCents,
  });

  // The same resolver the gates use, on the same inputs, so the intent stored on
  // the row cannot differ from the one the ceilings were applied under.
  const resolvedIntent = resolveOrderIntent({
    side: input.side,
    statedIntent: input.intent,
    positionQty: accountState.positionQty,
    qty: input.qty,
  });

  const decisionAuthorization = await authorizeDecisionAction({
    action,
    userId: input.userId,
    runId: input.runId,
    accountId: input.accountId,
    intent: resolvedIntent.intent,
  });

  const evaluation = evaluateOrderGates({
    input: {
      symbol,
      side: input.side,
      orderType,
      timeInForce,
      intent: input.intent ?? null,
      holdingPeriod: input.holdingPeriod ?? "",
      reason: input.reason,
      invalidationCondition: input.invalidationCondition,
      catalystDeadlineAt: input.catalystDeadlineAt ?? null,
      qty: input.qty ?? null,
      entryPriceCents: input.entryPriceCents ?? null,
      stopPriceCents: input.stopPriceCents ?? null,
      slippageCents: input.slippageCents ?? null,
      timeStopAt: input.timeStopAt ?? null,
      noTradeConditions: input.noTradeConditions ?? [],
      paperAcknowledgement: input.paperAcknowledgement,
      gatedNotionalCents,
      notionalBasis,
    },
    account: accountState,
    session,
    mandate,
    now,
  });

  return {
    evaluation, resolvedIntent, session, mandate, accountState,
    gatedNotionalCents, notionalBasis,
    symbol, orderType, timeInForce, now, account, decisionAuthorization,
  };
}

/**
 * Evaluate the gates and return the verdict. Writes NOTHING and never reaches
 * the broker — no row, no status transition, no submission. Same code path as
 * createOrder's evaluation, by construction.
 */
export async function preflightOrder(input: CreateOrderInput): Promise<OrderEvaluation> {
  return evaluateOrder(input, "preflight");
}

// ── Create (gate → pending_approval) ──────────────────────────────────────────

export async function createOrder(input: CreateOrderInput): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("database unavailable");

  const {
    evaluation, resolvedIntent, session, gatedNotionalCents, symbol, orderType, timeInForce, now, decisionAuthorization,
  } = await evaluateOrder(input, "create_proposal");

  const holdingPeriod = isStoredHoldingPeriod(input.holdingPeriod) ? input.holdingPeriod : null;
  // Same helper the planned-loss gates decide on, so the number persisted on the
  // row and the number that gated it can never be two different figures. Stored
  // for every holding period that states a stop, not just intraday.
  const plannedRiskCents = plannedRiskCentsFor(input);
  const base = {
    runId: input.runId,
    candidateId: input.candidateId ?? null,
    accountId: input.accountId,
    userId: input.userId,
    decisionRunId: decisionAuthorization?.decisionRunId ?? null,
    decisionRevisionId: decisionAuthorization?.revisionId ?? null,
    symbol,
    side: input.side,
    intent: resolvedIntent.intent,
    qty: input.qty ?? null,
    notionalCents: input.notionalCents ?? null,
    orderType,
    limitPriceCents: input.limitPriceCents ?? null,
    timeInForce,
    reason: input.reason ?? null,
    invalidationCondition: input.invalidationCondition ?? null,
    invalidationPriceCents: input.invalidationPriceCents ?? null,
    entryPriceCents: input.entryPriceCents ?? null,
    stopPriceCents: input.stopPriceCents ?? null,
    slippageCents: input.slippageCents ?? null,
    plannedRiskCents,
    timeStopAt: input.timeStopAt ?? null,
    noTradeConditions: (input.noTradeConditions ?? []).map((condition) => condition.trim()).filter(Boolean),
    holdingPeriod,
    catalystDeadlineAt: input.catalystDeadlineAt ?? null,
    marketSession: session.session,
    sessionBasis: session.basis.slice(0, 200),
    gatedNotionalCents,
    mandateVersion: evaluation.mandateVersion,
    gateSnapshot: evaluation as unknown as Record<string, unknown>,
    createdAt: now,
    updatedAt: now,
  };

  if (!evaluation.passed) {
    // Recorded, not swallowed. The attempt and the ceiling that stopped it both
    // belong in the audit trail.
    const [blocked] = await db.insert(brokerOrders).values({
      ...base,
      status: "rejected",
      rejectionReason: gateFailureMessage(evaluation),
      paperAckAt: null,
    });
    throw new OrderGateError(evaluation, ((blocked as any)?.insertId as number) ?? null);
  }

  return db.transaction(async (tx) => {
    await lockCurrentDecisionRevision(tx, decisionAuthorization);
    const [result] = await tx.insert(brokerOrders).values({
      ...base,
      status: "pending_approval",
      paperAckAt: now,
    });
    return (result as any).insertId as number;
  });
}

const STORED_HOLDING_PERIODS = ["intraday", "overnight", "swing", "catalyst_window"] as const;
function isStoredHoldingPeriod(v: unknown): v is HoldingPeriod {
  return typeof v === "string" && (STORED_HOLDING_PERIODS as readonly string[]).includes(v);
}

/**
 * Resolve the notional the ceilings are checked against.
 * A qty order has no stated notional, so it is derived from the limit price or
 * the freshest priced fact — and the derivation is recorded, never hidden. With
 * neither, the basis is "unknown" and the gate fails closed.
 */
async function resolveNotional(args: {
  symbol: string;
  qty?: number;
  notionalCents?: number;
  limitPriceCents?: number;
}): Promise<{ gatedNotionalCents: number | null; notionalBasis: NotionalBasis }> {
  if (args.notionalCents != null && args.notionalCents > 0) {
    return { gatedNotionalCents: Math.round(args.notionalCents), notionalBasis: "stated" };
  }
  if (args.qty != null && args.qty > 0) {
    if (args.limitPriceCents != null && args.limitPriceCents > 0) {
      return {
        gatedNotionalCents: Math.round(args.qty * args.limitPriceCents),
        notionalBasis: "derived_from_last_price",
      };
    }
    const priceCents = await lastPriceCents(args.symbol);
    if (priceCents != null) {
      return { gatedNotionalCents: Math.round(args.qty * priceCents), notionalBasis: "derived_from_last_price" };
    }
  }
  return { gatedNotionalCents: null, notionalBasis: "unknown" };
}

async function lastPriceCents(symbol: string): Promise<number | null> {
  const rows = freshestPerKey(await getFacts(symbol));
  const f = rows.find((r) => r.factKey === "last_price" && r.basis !== "unknown" && r.valueNum != null);
  return f?.valueNum != null ? Math.round(f.valueNum * 100) : null;
}

/**
 * Everything the ceilings measure against, read once. Sector comes from the fact
 * ledger — when no source states it, the name is its own cluster and the gate
 * records that treatment rather than pretending the cluster is empty.
 */
async function loadOrderAccountState(args: {
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  account: { id: number; isPaper: boolean; equityValueCents: number | null; cashCents: number | null };
  symbol: string;
  runId: number;
  userId: number;
  now: number;
}): Promise<OrderAccountState> {
  const { db, account, symbol, runId, userId, now } = args;

  const held = await db.select().from(positionsTable).where(eq(positionsTable.accountId, account.id));
  const ownRows = held.filter((p) => normSymbol(p.symbol) === symbol);
  const positionValueCents = ownRows.reduce((s, p) => s + (p.marketValueCents ?? 0), 0);
  // Signed: positive long, negative short, zero flat. This is what decides
  // whether a sell closes a position or opens a short — see resolveOrderIntent.
  const positionQty = ownRows.reduce((s, p) => s + (p.qty ?? 0), 0);

  // Sector for the order symbol and for everything held, from the fact ledger.
  const heldSymbols = Array.from(new Set(held.map((p) => normSymbol(p.symbol))));
  const factSymbols = Array.from(new Set([symbol, ...heldSymbols]));
  const factRows = factSymbols.length ? await getFacts(factSymbols) : [];
  const sectorBySymbol = new Map<string, string>();
  for (const f of factRows) {
    if (f.factKey !== "sector" || f.basis === "unknown" || !f.valueText) continue;
    const s = normSymbol(f.symbol);
    if (!sectorBySymbol.has(s)) sectorBySymbol.set(s, f.valueText);
  }

  const orderSector = sectorBySymbol.get(symbol) ?? null;
  const clusterValueCents = orderSector
    ? held
        .filter((p) => sectorBySymbol.get(normSymbol(p.symbol)) === orderSector)
        .reduce((s, p) => s + (p.marketValueCents ?? 0), 0)
    : positionValueCents;

  const advRow = freshestPerKey(factRows.filter((f) => normSymbol(f.symbol) === symbol))
    .find((f) => f.factKey === "adv_usd_30d" && f.basis !== "unknown" && f.valueNum != null);

  const LIVE = LIVE_ORDER_STATUSES;
  const dayStart = startOfEtDay(now) ?? now - 86_400_000;

  const todayRows = await db.select({
    gated: brokerOrders.gatedNotionalCents,
    notional: brokerOrders.notionalCents,
    side: brokerOrders.side,
    symbol: brokerOrders.symbol,
    plannedRisk: brokerOrders.plannedRiskCents,
  }).from(brokerOrders).where(and(
    eq(brokerOrders.userId, userId),
    gte(brokerOrders.createdAt, dayStart),
    inArray(brokerOrders.status, [...LIVE]),
  ));

  const runRows = await db.select({
    gated: brokerOrders.gatedNotionalCents,
    notional: brokerOrders.notionalCents,
    side: brokerOrders.side,
  }).from(brokerOrders).where(and(
    eq(brokerOrders.runId, runId),
    eq(brokerOrders.userId, userId),
    inArray(brokerOrders.status, [...LIVE]),
  ));

  const sumBuys = (rows: Array<{ gated: number | null; notional: number | null; side: string }>) =>
    rows.filter((r) => r.side === "buy").reduce((s, r) => s + (r.gated ?? r.notional ?? 0), 0);

  // Planned loss already committed today, and the slice of it that shares this
  // symbol's cluster. Orders with no stated planned loss contribute 0 here —
  // they were gated on notional instead, and the gate says so in its notes
  // rather than inventing a risk figure for them.
  const plannedRiskTodayCents = todayRows.reduce((s, r) => s + (r.plannedRisk ?? 0), 0);
  const clusterPlannedRiskCents = todayRows.reduce((s, r) => {
    const sym = normSymbol(r.symbol);
    const sameCluster = orderSector
      ? sectorBySymbol.get(sym) === orderSector
      : sym === symbol;
    return sameCluster ? s + (r.plannedRisk ?? 0) : s;
  }, 0);

  return {
    isPaper: account.isPaper === true,
    // Equity, not cash: a ceiling measured against cash shrinks as you deploy.
    equityCents: account.equityValueCents ?? null,
    positionQty,
    positionValueCents,
    clusterValueCents,
    clusterLabel: orderSector ?? `${symbol} (unclassified)`,
    sectorKnown: orderSector != null,
    plannedRiskTodayCents,
    clusterPlannedRiskCents,
    newNotionalTodayCents: sumBuys(todayRows),
    runGrossDeployedCents: sumBuys(runRows),
    advUsd: advRow?.valueNum ?? null,
  };
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
  await db.transaction(async (tx) => {
    const authorization = await authorizeDecisionAction({
      action: "approve",
      userId,
      runId: order.runId,
      accountId: order.accountId,
      intent: order.intent,
      decisionRunId: order.decisionRunId,
      decisionRevisionId: order.decisionRevisionId,
    });
    await lockCurrentDecisionRevision(tx, authorization);
    const update = await tx.update(brokerOrders).set({ status: "approved", approvedAt: now, updatedAt: now })
      .where(and(eq(brokerOrders.id, orderId), eq(brokerOrders.status, "pending_approval")));
    if (!update[0].affectedRows) throw new Error("order changed before approval could be recorded");
  });
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

  const decisionAuthorization = await authorizeDecisionAction({
    action: "submit",
    userId,
    runId: order.runId,
    accountId: order.accountId,
    intent: order.intent,
    decisionRunId: order.decisionRunId,
    decisionRevisionId: order.decisionRevisionId,
  });

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
  const clientOrderId = order.clientOrderId ?? `sh-paper-${order.id}`;
  // Mark as submitted at the serialized authorization point, before the broker
  // call. Cash recorded first blocks this transition. Until the broker response
  // persists an external order id (or a rejection), this row is also the durable
  // dispatch lease that prevents a new Decision Run revision from overtaking it.
  await db.transaction(async (tx) => {
    await lockCurrentDecisionRevision(tx, decisionAuthorization);
    const update = await tx.update(brokerOrders).set({ status: "submitted", clientOrderId, dispatchError: null, submittedAt: now, updatedAt: now })
      .where(and(eq(brokerOrders.id, orderId), eq(brokerOrders.status, "approved")));
    if (!update[0].affectedRows) throw new Error("order changed before submission could be authorized");
  });

  const req: OrderRequest = {
    clientOrderId,
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
    // Transport failures are ambiguous: Alpaca may have accepted the stable
    // client order id before the response was lost. Keep the dispatch lease
    // until mirrorFills reconciles that id; never invite an unsafe resubmit.
    await db.update(brokerOrders).set({
      status: "submitted",
      dispatchError: e?.message ?? String(e),
      updatedAt: Date.now(),
    }).where(eq(brokerOrders.id, orderId));
    throw new Error("Paper dispatch outcome is unknown. The order remains locked for broker reconciliation; do not resubmit it.");
  }

  // Update with broker result
  const newStatus = result.status === "filled" ? "filled" :
    result.status === "rejected" ? "rejected" : "submitted";
  const updates: Partial<BrokerOrder> = {
    status: newStatus as any,
    brokerOrderId: result.brokerOrderId || null,
    dispatchError: null,
    filledQty: result.filledQty ?? null,
    filledAvgPriceCents: result.filledAvgPriceCents ?? null,
    updatedAt: Date.now(),
  };
  if (newStatus === "filled") updates.filledAt = Date.now();

  await db.update(brokerOrders).set(updates).where(eq(brokerOrders.id, orderId));

  if (decisionAuthorization?.source === "authoritative" && decisionAuthorization.decisionRunId != null && decisionAuthorization.revisionId != null) {
    await queuePaperOutcome({
      userId,
      decisionRunId: decisionAuthorization.decisionRunId,
      revisionId: decisionAuthorization.revisionId,
      orderId,
      holdingPeriod: isStoredHoldingPeriod(order.holdingPeriod) ? order.holdingPeriod : null,
      catalystDeadlineAt: order.catalystDeadlineAt,
    });
  }

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
    const acctRows = await db.select().from(portfolioAccounts)
      .where(eq(portfolioAccounts.id, order.accountId)).limit(1);
    const account = acctRows[0];
    if (!account) continue;

    const broker = brokerFor(account.brokerId, account.id);
    if (!broker.available()) continue;

    try {
      const result = order.brokerOrderId
        ? await broker.getOrder(order.brokerOrderId)
        : order.clientOrderId
          ? await broker.getOrderByClientOrderId(order.clientOrderId)
          : null;
      if (!result) continue;

      const newStatus = result.status === "filled" ? "filled" :
        result.status === "rejected" ? "rejected" : "submitted";
      if (newStatus === order.status && (result.brokerOrderId || null) === order.brokerOrderId && !order.dispatchError) continue;
      const now = Date.now();
      await db.update(brokerOrders).set({
        status: newStatus as any,
        brokerOrderId: result.brokerOrderId || order.brokerOrderId,
        dispatchError: null,
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

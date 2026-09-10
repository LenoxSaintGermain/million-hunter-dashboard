import { createHash } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { brokerOrders, portfolioAccounts } from "../../drizzle/schema";
import { apertureCapitalEvents as events, apertureCapitalClaims as claims, type ApertureCapitalEvent, type ApertureCapitalClaim } from "../../drizzle/apertureCapitalLedgerSchema";
import { capitalLedgerReceiptSchema, type CapitalLedgerReceipt } from "../../shared/capitalStrategy";
import type { getDb } from "../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
/** Caller owns commit/rollback. Never pass the root DB or start a nested transaction. */
export type CapitalLedgerTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** DB-only operations with stable identities. Drizzle finishes rollback before
 * rejecting transaction(). Retry only known snapshot/deadlock conflicts, never
 * connection loss or unknown commit outcomes. No broker/provider work here. */
export async function withCapitalLedgerTransaction<T>(db: Db, operation: (tx: CapitalLedgerTransaction) => Promise<T>): Promise<T> {
  if (typeof (db as any).rollback === "function") throw new Error("Capital transaction requires the root database");
  for (let attempt = 0; ; attempt++) {
    try { return await db.transaction(operation); }
    catch (error) {
      let cause: any = error, retryable = false;
      const visited = new Set<unknown>();
      while (cause && !visited.has(cause)) {
        visited.add(cause);
        if (["ER_CHECKREAD", "ER_LOCK_DEADLOCK"].includes(cause.code)) { retryable = true; break; }
        cause = cause.cause;
      }
      if (!retryable || attempt >= 2) throw error;
    }
  }
}
type Code = "INVALID_INPUT" | "ACCOUNT_UNAVAILABLE" | "ACCOUNT_BINDING_CHANGED" | "EVENT_MISSING" | "SOURCE_CONFLICT" | "CLAIM_CONFLICT" | "SOURCE_PROOF_MISSING" | "CAPACITY_EXCEEDED" | "INVALID_TRANSITION" | "LEDGER_INTEGRITY";
export class CapitalLedgerError extends Error {
  constructor(readonly code: Code) { super(`Capital ledger: ${code}`); this.name = "CapitalLedgerError"; }
}
const fail = (code: Code): never => { throw new CapitalLedgerError(code); };
const owner = z.number().int().positive().safe();
const key = z.string().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9:._/-]*$/);
const cents = z.number().int().nonnegative().safe();
const sourceKind = z.enum(["operator_declared_excess", "reconciled_available_funds", "realized_gains", "returned_principal", "hypothetical_future_proceeds"]);
const targetSchema = z.object({ accountId: owner, capitalEventId: key }).strict();
const eventSchema = z.object({ accountId: owner, sourceId: key, sourceKey: key, capitalEventId: key,
  sourceKind, currency: z.literal("USD"), amountCents: cents.nullable(),
}).strict().refine(value => value.sourceKind !== "operator_declared_excess" || (value.amountCents != null && value.amountCents > 0));
const claimSchema = targetSchema.extend({ allocationId: key, amountCents: cents.positive() }).strict();
const stateSchema = z.enum(["pending", "committed", "consumed", "released"]);
const transitionSchema = targetSchema.extend({ allocationId: key, expectedState: stateSchema, nextState: stateSchema }).strict();
export type CapitalEventInput = z.infer<typeof eventSchema>;
export type CapitalClaimInput = z.infer<typeof claimSchema>;

/** One immutable allocation identity per actual paper proposal, never per retry. */
export function paperOrderAllocationId(orderId: number) {
  return `paper-order:${parse(owner, orderId)}`;
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  return result.success ? result.data : fail("INVALID_INPUT");
}
function duplicate(error: unknown): boolean {
  const e = error as { code?: string; errno?: number; cause?: unknown } | null;
  return e?.code === "ER_DUP_ENTRY" || e?.errno === 1062 || Boolean(e?.cause && e.cause !== error && duplicate(e.cause));
}
function clock() { return parse(cents, Date.now()); }

async function accountLock(tx: CapitalLedgerTransaction, userId: number, accountId: number) {
  parse(owner, userId);
  if (typeof tx.rollback !== "function") fail("INVALID_INPUT");
  // All methods lock in the same order: account -> event -> claims. The account
  // lock also serializes a not-yet-created source and prevents binding changes.
  const [account] = await tx.select().from(portfolioAccounts).where(and(eq(portfolioAccounts.id, accountId), eq(portfolioAccounts.userId, userId))).for("update").limit(1);
  if (!account || account.id !== accountId || account.userId !== userId || !account.isPaper || !account.label.trim()) return fail("ACCOUNT_UNAVAILABLE");
  return account;
}
type Account = Awaited<ReturnType<typeof accountLock>>;
function checkEvent(event: ApertureCapitalEvent, account: Account, now: number) {
  if (event.userId !== account.userId || event.accountId !== account.id) fail("LEDGER_INTEGRITY");
  if (event.brokerId !== account.brokerId || event.externalAccountId !== account.externalAccountId) fail("ACCOUNT_BINDING_CHANGED");
  if (!key.safeParse(event.sourceId).success || !key.safeParse(event.sourceKey).success || !key.safeParse(event.capitalEventId).success
    || !event.accountLabel.trim() || event.currency !== "USD" || !sourceKind.safeParse(event.sourceKind).success
    || !cents.safeParse(event.createdAt).success || event.createdAt > now
    || (event.amountCents != null && !cents.safeParse(event.amountCents).success)
    || event.proofBasis !== (event.sourceKind === "operator_declared_excess" ? "operator_declared" : "unknown")
    || (event.proofBasis === "operator_declared" && !(event.amountCents != null && event.amountCents > 0))) fail("LEDGER_INTEGRITY");
}
async function eventLock(tx: CapitalLedgerTransaction, userId: number, target: z.infer<typeof targetSchema>, account: Account) {
  const [event] = await tx.select().from(events).where(and(eq(events.userId, userId), eq(events.accountId, target.accountId), eq(events.capitalEventId, target.capitalEventId))).for("update").limit(1);
  if (event) {
    if (event.capitalEventId !== target.capitalEventId) fail("LEDGER_INTEGRITY");
    checkEvent(event, account, clock());
  }
  return event ?? null;
}
async function claimRows(tx: CapitalLedgerTransaction, event: ApertureCapitalEvent) {
  // Locking reads see the previous committer, even under REPEATABLE READ. No
  // pagination: a checked-empty receipt requires checking the complete event.
  const rows = await tx.select().from(claims).where(eq(claims.eventId, event.id)).orderBy(claims.id).for("update");
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.userId !== event.userId || row.accountId !== event.accountId || row.eventId !== event.id
      || !key.safeParse(row.allocationId).success || seen.has(row.allocationId)
      || !cents.positive().safeParse(row.amountCents).success || !stateSchema.safeParse(row.state).success
      || (row.state === "pending" ? row.previousState != null : !allowedTransition(row.previousState, row.state))
      || !cents.safeParse(row.createdAt).success || !cents.safeParse(row.updatedAt).success
      || row.updatedAt < row.createdAt || row.createdAt < event.createdAt || row.updatedAt > clock()) fail("LEDGER_INTEGRITY");
    seen.add(row.allocationId);
  }
  return rows;
}
function usedAmount(rows: ApertureCapitalClaim[]) {
  const used = rows.filter(row => row.state !== "released").reduce((sum, row) => sum + BigInt(row.amountCents), BigInt(0));
  if (used > BigInt(Number.MAX_SAFE_INTEGER)) fail("LEDGER_INTEGRITY");
  return Number(used);
}
function checkedUsage(event: ApertureCapitalEvent, rows: ApertureCapitalClaim[]) {
  const used = usedAmount(rows);
  if (event.proofBasis === "unknown" && rows.length > 0
    || event.proofBasis === "operator_declared" && used > event.amountCents!) fail("LEDGER_INTEGRITY");
  return used;
}
function allowedTransition(from: string | null, to: string) {
  return from === "pending" && ["committed", "released"].includes(to)
    || from === "committed" && ["consumed", "released"].includes(to);
}

/** Server-only registration. Kind never upgrades provenance to verified funds.
 * sourceKey must come from one stable owned declaration/origin record. This
 * module cannot recognize the same real-world money behind fabricated IDs. */
export async function recordCapitalEvent(tx: CapitalLedgerTransaction, userId: number, raw: unknown) {
  const input = parse(eventSchema, raw);
  const account = await accountLock(tx, userId, input.accountId);
  const existing = await tx.select().from(events).where(and(eq(events.userId, userId), or(
    eq(events.sourceKey, input.sourceKey), eq(events.sourceId, input.sourceId), eq(events.capitalEventId, input.capitalEventId),
  ))).for("update");
  if (existing.length) {
    const event = existing[0];
    if (existing.length !== 1 || event.accountId !== input.accountId || event.sourceId !== input.sourceId
      || event.sourceKey !== input.sourceKey || event.capitalEventId !== input.capitalEventId
      || event.sourceKind !== input.sourceKind || event.amountCents !== input.amountCents || event.currency !== input.currency) fail("SOURCE_CONFLICT");
    checkEvent(event, account, clock());
    return { event, duplicate: true };
  }
  const values = { ...input, userId, accountLabel: account.label, brokerId: account.brokerId, externalAccountId: account.externalAccountId,
    proofBasis: input.sourceKind === "operator_declared_excess" ? "operator_declared" as const : "unknown" as const, createdAt: clock() };
  try {
    const [inserted] = await tx.insert(events).values(values);
    return { event: { ...values, id: Number(inserted.insertId) }, duplicate: false };
  } catch (error) { if (duplicate(error)) fail("SOURCE_CONFLICT"); throw error; }
}

/** Internal earmark only. Integrator must call within the authoritative proposal
 * transaction; committing a standalone claim does not create/approve an order. */
export async function claimCapital(tx: CapitalLedgerTransaction, userId: number, raw: unknown) {
  const input = parse(claimSchema, raw);
  const account = await accountLock(tx, userId, input.accountId);
  const event = await eventLock(tx, userId, input, account) ?? fail("EVENT_MISSING");
  const rows = await claimRows(tx, event);
  const used = checkedUsage(event, rows);
  const [existing] = await tx.select().from(claims).where(and(eq(claims.userId, userId), eq(claims.allocationId, input.allocationId))).for("update").limit(1);
  if (existing) {
    if (existing.userId !== userId || existing.eventId !== event.id || existing.accountId !== input.accountId
      || existing.allocationId !== input.allocationId || existing.amountCents !== input.amountCents
      || !rows.some(row => row.id === existing.id)) fail("CLAIM_CONFLICT");
    return { claim: existing, duplicate: true }; // Released retries stay released.
  }
  const declaredAmount = event.amountCents;
  if (event.proofBasis !== "operator_declared" || declaredAmount == null) return fail("SOURCE_PROOF_MISSING");
  if (BigInt(used) + BigInt(input.amountCents) > BigInt(declaredAmount)) fail("CAPACITY_EXCEEDED");
  const now = clock();
  const values = { userId, accountId: input.accountId, eventId: event.id, allocationId: input.allocationId,
    amountCents: input.amountCents, state: "pending" as const, previousState: null, createdAt: now, updatedAt: now };
  try {
    const [inserted] = await tx.insert(claims).values(values);
    return { claim: { ...values, id: Number(inserted.insertId) }, duplicate: false };
  } catch (error) { if (duplicate(error)) fail("CLAIM_CONFLICT"); throw error; }
}

/** No implicit expiry or recycling of consumed money. A release is a deliberate
 * service-level transition, not a broker cancellation or a position close. */
export async function transitionCapitalClaim(tx: CapitalLedgerTransaction, userId: number, raw: unknown) {
  const input = parse(transitionSchema, raw);
  const account = await accountLock(tx, userId, input.accountId);
  const event = await eventLock(tx, userId, input, account) ?? fail("EVENT_MISSING");
  const rows = await claimRows(tx, event);
  checkedUsage(event, rows);
  const row = rows.find(item => item.allocationId === input.allocationId) ?? fail("CLAIM_CONFLICT");
  if (!allowedTransition(input.expectedState, input.nextState)) fail("INVALID_TRANSITION");
  if (row.state === input.nextState && row.previousState === input.expectedState) return { claim: row, duplicate: true };
  if (row.state !== input.expectedState) fail("INVALID_TRANSITION");
  const updatedAt = clock();
  const previousState = input.expectedState as "pending" | "committed";
  const [updated] = await tx.update(claims).set({ state: input.nextState, previousState, updatedAt }).where(and(
    eq(claims.id, row.id), eq(claims.userId, userId), eq(claims.eventId, event.id), eq(claims.state, input.expectedState),
  ));
  if (updated.affectedRows !== 1) fail("CLAIM_CONFLICT");
  return { claim: { ...row, state: input.nextState, previousState, updatedAt }, duplicate: false };
}

/** Current, complete claims snapshot only: no caller-supplied asOf and no
 * historical reconstruction. A missing event or failed read is never empty proof.
 * A complete receipt verifies ledger coverage, NOT event cash/gain provenance. */
export async function readCapitalLedger(tx: CapitalLedgerTransaction, userId: number, raw: unknown): Promise<
  { status: "missing"; event: null; receipt: null } |
  { status: "complete"; event: ApertureCapitalEvent; receipt: CapitalLedgerReceipt }
> {
  const input = parse(targetSchema, raw);
  const account = await accountLock(tx, userId, input.accountId);
  const event = await eventLock(tx, userId, input, account);
  if (!event) return { status: "missing", event: null, receipt: null };
  const rows = await claimRows(tx, event);
  checkedUsage(event, rows);
  const contents = { status: "complete" as const, sourceId: event.sourceId, accountId: String(event.accountId), capitalEventId: event.capitalEventId,
    asOf: clock(), allocationClaims: rows.map(row => ({ allocationId: row.allocationId, capitalEventId: event.capitalEventId, amountCents: row.amountCents, state: row.state })),
    // Coverage is for this exact source, not all account events. Owner-global
    // unique source/key/event indexes prevent duplicate registration; unrelated
    // sources and idempotent retries are not extra occurrences of this event.
    observedCapitalEventIds: [event.capitalEventId] };
  const receiptId = createHash("sha256").update(JSON.stringify([userId, event.id, contents])).digest("hex");
  return { status: "complete", event, receipt: capitalLedgerReceiptSchema.parse({ receiptId, ...contents }) };
}

/** Reconcile an EXISTING order-bound claim. No order/source/claim creation and
 * no broker calls. Caller owns the transaction: account -> event -> claims ->
 * order lock order must also be used by the eventual order-transition caller.
 * Partial terminal fills conservatively consume the whole earmark; releasing
 * an unused remainder requires a separate execution-cost reconciliation. */
export async function reconcilePaperOrderClaim(tx: CapitalLedgerTransaction, userId: number, orderId: number) {
  parse(owner, userId); parse(owner, orderId);
  if (typeof tx.rollback !== "function") fail("INVALID_INPUT");
  const [initial] = await tx.select().from(brokerOrders).where(and(eq(brokerOrders.id, orderId), eq(brokerOrders.userId, userId))).limit(1);
  if (!initial) return fail("CLAIM_CONFLICT");
  const account = await accountLock(tx, userId, initial.accountId);
  const allocationId = paperOrderAllocationId(orderId);
  const [binding] = await tx.select().from(claims).where(and(eq(claims.userId, userId), eq(claims.allocationId, allocationId))).limit(1);
  if (!binding) return { status: "not_bound" as const };
  if (binding.accountId !== account.id) return fail("CLAIM_CONFLICT");
  const [source] = await tx.select().from(events).where(and(eq(events.id, binding.eventId), eq(events.userId, userId), eq(events.accountId, account.id))).limit(1);
  if (!source) return fail("EVENT_MISSING");
  const target = { accountId: account.id, capitalEventId: source.capitalEventId };
  const event = await eventLock(tx, userId, target, account) ?? fail("EVENT_MISSING");
  const rows = await claimRows(tx, event);
  checkedUsage(event, rows);
  let claim = rows.find(row => row.id === binding.id && row.allocationId === allocationId) ?? fail("CLAIM_CONFLICT");
  const [order] = await tx.select().from(brokerOrders).where(and(eq(brokerOrders.id, orderId), eq(brokerOrders.userId, userId))).for("update").limit(1);
  if (!order || order.accountId !== account.id || order.intent !== "open" || order.side !== "buy") return fail("CLAIM_CONFLICT");
  const terminal = order.status === "rejected" || order.status === "cancelled";
  const qtyValid = order.filledQty != null && Number.isFinite(order.filledQty) && order.filledQty >= 0
    && (order.qty == null || order.filledQty <= order.qty);
  const hasFill = qtyValid && order.filledQty! > 0;
  const dispatched = order.submittedAt != null || order.submitConfirmedAt != null
    || order.clientOrderId != null || order.brokerOrderId != null || Boolean(order.dispatchError);
  const untouched = !dispatched && order.filledAt == null && (order.filledQty == null || order.filledQty === 0);
  const zeroConfirmed = terminal && (untouched || (qtyValid && order.filledQty === 0 && order.brokerOrderId && !order.dispatchError));
  let next: ApertureCapitalClaim["state"] = claim.state;
  let needsReconciliation = false;
  if (claim.state === "consumed") return { status: "bound" as const, state: claim.state, changed: false,
    needsReconciliation: !hasFill || !order.brokerOrderId || Boolean(order.dispatchError) || !(order.status === "filled" || terminal) };
  if (claim.state === "released") {
    if (!zeroConfirmed) return fail("LEDGER_INTEGRITY");
    return { status: "bound" as const, state: claim.state, changed: false, needsReconciliation: false };
  }
  if (order.status === "submitted") { next = "committed"; needsReconciliation = Boolean(order.dispatchError) || !order.brokerOrderId; }
  else if ((order.status === "filled" || terminal) && hasFill && order.brokerOrderId && !order.dispatchError) next = "consumed";
  else if (zeroConfirmed) next = "released";
  else if (["pending_approval", "approved"].includes(order.status) && untouched && claim.state === "pending") next = "pending";
  else { next = dispatched ? "committed" : claim.state; needsReconciliation = true; }
  const original = claim.state;
  // Existing ledger permits pending -> committed -> consumed, not shortcuts.
  if (next === "consumed" && claim.state === "pending") {
    claim = (await transitionCapitalClaim(tx, userId, { ...target, allocationId, expectedState: "pending", nextState: "committed" })).claim;
  }
  if (next !== claim.state) claim = (await transitionCapitalClaim(tx, userId, { ...target, allocationId, expectedState: claim.state, nextState: next })).claim;
  return { status: "bound" as const, state: claim.state, changed: original !== claim.state, needsReconciliation };
}

/** Actual lifecycle mutations use one transaction for order + existing claim.
 * Acquire the allocation locks BEFORE the order write, then reconcile its new
 * state before committing. Callbacks must be DB-only and safe after rollback. */
export async function withPaperOrderClaimTransaction<T>(db: Db, userId: number, orderId: number,
  operation: (tx: CapitalLedgerTransaction) => Promise<T>) {
  return withCapitalLedgerTransaction(db, async tx => {
    await reconcilePaperOrderClaim(tx, userId, orderId);
    const result = await operation(tx);
    await reconcilePaperOrderClaim(tx, userId, orderId);
    return result;
  });
}

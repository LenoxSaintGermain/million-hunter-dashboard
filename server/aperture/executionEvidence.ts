import { createHash } from "node:crypto";
import { and, desc, eq, isNotNull, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { apertureCandidates, apertureRuns, brokerOrders, portfolioAccounts, apertureExecutionEvidence as evidence } from "../../drizzle/schema";
import { parsePersistedJson } from "../../shared/persistedJson";
import type { getDb } from "../db";
import { brokerFor } from "./brokers";
import { orderExecutionReceiptSchema, type OrderExecutionReceipt } from "./brokers/orderExecutions";
import { reconcileClosingExecutions } from "./executionReconciliation";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type ReadDb = Pick<Db, "select">;
const id = z.number().int().positive().safe();
export const executionEvidenceInput = z.object({ accountId: id, runId: id, candidateId: id, orderId: id }).strict();
export const refreshExecutionEvidenceInput = executionEvidenceInput.extend({ requestId: z.string().uuid() }).strict();
export const executionSourcesInput = z.object({ beforeId: id.optional() }).strict();
type Selection = z.infer<typeof executionEvidenceInput>;
type Row = typeof evidence.$inferSelect;
const fail = (message: string): never => { throw new TRPCError({ code: "PRECONDITION_FAILED", message }); };
/** Owned recorded closing orders only. Listing is not fill/profit verification. */
export async function listExecutionSources(db: ReadDb, userId: number, raw: z.infer<typeof executionSourcesInput>) {
  id.parse(userId);
  const input = executionSourcesInput.parse(raw);
  const rows = await db.select({ accountId: brokerOrders.accountId, runId: apertureRuns.id,
    candidateId: apertureCandidates.id, orderId: brokerOrders.id, accountLabel: portfolioAccounts.label,
    symbol: brokerOrders.symbol, instrumentType: brokerOrders.instrumentType, underlyingSymbol: brokerOrders.underlyingSymbol,
    optionExpirationDate: brokerOrders.optionExpirationDate, optionStrikePriceCents: brokerOrders.optionStrikePriceCents,
    status: brokerOrders.status, recordedAt: brokerOrders.updatedAt,
  }).from(brokerOrders)
    .innerJoin(portfolioAccounts, eq(portfolioAccounts.id, brokerOrders.accountId))
    .innerJoin(apertureRuns, eq(apertureRuns.id, brokerOrders.runId))
    .innerJoin(apertureCandidates, and(eq(apertureCandidates.id, brokerOrders.candidateId), eq(apertureCandidates.runId, brokerOrders.runId)))
    .where(and(eq(brokerOrders.userId, userId), eq(portfolioAccounts.userId, userId), eq(apertureRuns.userId, userId),
      eq(portfolioAccounts.isPaper, true), eq(portfolioAccounts.brokerId, "alpaca_paper"), isNotNull(portfolioAccounts.externalAccountId),
      isNotNull(brokerOrders.brokerOrderId), eq(brokerOrders.intent, "close"), eq(brokerOrders.side, "sell"),
      input.beforeId ? lt(brokerOrders.id, input.beforeId) : undefined))
    .orderBy(desc(brokerOrders.id)).limit(51);
  return { sources: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].orderId : null, gainsVerified: false as const };
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  return value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
}
const hash = (row: Omit<Row, "id" | "recordHash">) => createHash("sha256").update(JSON.stringify(canonical(row))).digest("hex");
async function source(db: ReadDb, userId: number, selection: Selection) {
  id.parse(userId);
  const [row] = await db.select({ order: brokerOrders, account: portfolioAccounts }).from(brokerOrders)
    .innerJoin(portfolioAccounts, eq(portfolioAccounts.id, brokerOrders.accountId))
    .innerJoin(apertureRuns, eq(apertureRuns.id, brokerOrders.runId))
    .innerJoin(apertureCandidates, and(eq(apertureCandidates.id, brokerOrders.candidateId), eq(apertureCandidates.runId, brokerOrders.runId)))
    .where(and(eq(brokerOrders.id, selection.orderId), eq(brokerOrders.accountId, selection.accountId),
      eq(brokerOrders.runId, selection.runId), eq(brokerOrders.candidateId, selection.candidateId),
      eq(brokerOrders.userId, userId), eq(portfolioAccounts.userId, userId), eq(apertureRuns.userId, userId))).limit(1);
  if (!row || !row.account.isPaper || row.account.brokerId !== "alpaca_paper" || !row.account.externalAccountId
    || !row.order.brokerOrderId || row.order.intent !== "close" || row.order.side !== "sell") {
    return fail("Select the exact recorded closing order in its bound Alpaca Paper account.");
  }
  return row;
}
function checked(row: Row, userId: number, selection: Selection, binding: Awaited<ReturnType<typeof source>>, now: number) {
  if (row.userId !== userId || Object.entries(selection).some(([key, value]) => row[key as keyof Selection] !== value)
    || row.externalAccountId !== binding.account.externalAccountId || row.brokerOrderId !== binding.order.brokerOrderId
    || row.createdAt > now || row.createdAt <= 0) fail("Execution evidence binding changed. Reconcile this source before using it.");
  const receipt = row.receipt == null ? null : orderExecutionReceiptSchema.parse(parsePersistedJson(row.receipt));
  const { id: _id, recordHash, ...payload } = { ...row, receipt };
  if (row.state === "pending") {
    if (receipt || recordHash || row.completedAt || row.failureCode) fail("Execution evidence state is inconsistent.");
  } else if (!row.completedAt || row.completedAt < row.createdAt || row.completedAt > now || recordHash !== hash(payload)
    || (row.state === "complete" ? !receipt || row.failureCode !== null : receipt !== null || !["execution_read_failed", "execution_abandoned"].includes(row.failureCode ?? ""))) {
    fail("Execution evidence integrity could not be verified.");
  }
  if (receipt && (receipt.externalAccountId !== row.externalAccountId || receipt.brokerOrderId !== row.brokerOrderId
    || receipt.observedAt < row.createdAt || receipt.observedAt > row.completedAt!)) fail("Execution observation is outside its bound refresh.");
  return { id: row.id, requestId: row.requestId, state: row.state, createdAt: row.createdAt,
    completedAt: row.completedAt, failureCode: row.failureCode, receipt };
}

/** No HTTP or writes: failed refreshes retain the last successful evidence. */
export async function readExecutionEvidence(db: ReadDb, userId: number, raw: Selection) {
  const selection = executionEvidenceInput.parse(raw), binding = await source(db, userId, selection);
  const where = and(eq(evidence.userId, userId), eq(evidence.orderId, selection.orderId));
  const [latest] = await db.select().from(evidence).where(where).orderBy(desc(evidence.id)).limit(1);
  const [successful] = await db.select().from(evidence).where(and(where, eq(evidence.state, "complete"))).orderBy(desc(evidence.id)).limit(1);
  const now = Date.now();
  const lastSuccessful = successful ? checked(successful, userId, selection, binding, now) : null;
  return { latest: latest ? checked(latest, userId, selection, binding, now) : null,
    lastSuccessful, reconciliation: reconcileClosingExecutions(lastSuccessful?.receipt ?? null, binding.order),
    gainsVerified: false as const, availableCapitalCents: null };
}

type Provider = (input: { brokerOrderId: string; expectedExternalAccountId: string }) => Promise<OrderExecutionReceipt>;
/** Discards acceptance of a pending provider response, not the broker order or
 * the network request. Exact owner/request matching makes repeated clicks safe. */
export async function abandonExecutionEvidence(db: Db, userId: number, raw: z.infer<typeof refreshExecutionEvidenceInput>) {
  const { requestId, ...selection } = refreshExecutionEvidenceInput.parse(raw);
  await db.transaction(async tx => {
    await tx.select().from(portfolioAccounts).where(and(eq(portfolioAccounts.id, selection.accountId), eq(portfolioAccounts.userId, userId))).for("update");
    const binding = await source(tx, userId, selection);
    const [row] = await tx.select().from(evidence).where(and(eq(evidence.userId, userId), eq(evidence.requestId, requestId))).limit(1);
    if (!row) return fail("The exact refresh was not found. Check saved status before acting.");
    checked(row, userId, selection, binding, Date.now());
    if (row.state !== "pending") return;
    const { id: _id, recordHash: _hash, ...original } = row;
    const discarded = { ...original, state: "failed" as const, receipt: null, failureCode: "execution_abandoned", completedAt: Date.now() };
    await tx.update(evidence).set({ ...discarded, recordHash: hash(discarded) })
      .where(and(eq(evidence.id, row.id), eq(evidence.userId, userId), eq(evidence.state, "pending")));
  });
  return readExecutionEvidence(db, userId, selection);
}
/** Explicit authorized refresh. A repeated request only reads its saved attempt.
 * Provider I/O stays outside transactions. Finalization cannot alter an order. */
export async function refreshExecutionEvidence(db: Db, userId: number, raw: z.infer<typeof refreshExecutionEvidenceInput>, provider?: Provider) {
  const { requestId, ...selection } = refreshExecutionEvidenceInput.parse(raw);
  const initial = await db.transaction(async tx => {
    await tx.select().from(portfolioAccounts).where(and(eq(portfolioAccounts.id, selection.accountId), eq(portfolioAccounts.userId, userId))).for("update");
    const binding = await source(tx, userId, selection);
    const [existing] = await tx.select().from(evidence).where(and(eq(evidence.userId, userId), eq(evidence.requestId, requestId))).limit(1);
    if (existing) { checked(existing, userId, selection, binding, Date.now()); return { row: existing, created: false }; }
    const [pending] = await tx.select().from(evidence).where(and(eq(evidence.userId, userId), eq(evidence.orderId, selection.orderId), eq(evidence.state, "pending"))).limit(1);
    if (pending) return fail("An execution refresh is unconfirmed. Check or discard that exact attempt before starting another.");
    const values = { ...selection, userId, requestId, externalAccountId: binding.account.externalAccountId!,
      brokerOrderId: binding.order.brokerOrderId!, state: "pending" as const, receipt: null, recordHash: null,
      failureCode: null, createdAt: Date.now(), completedAt: null };
    const [inserted] = await tx.insert(evidence).values(values);
    return { row: { ...values, id: Number(inserted.insertId) }, created: true };
  });
  if (!initial.created) return { requestId, ...(await readExecutionEvidence(db, userId, selection)) };
  let receipt: OrderExecutionReceipt | null = null;
  try {
    const read = provider ?? brokerFor("alpaca_paper", selection.accountId).getOrderExecutions;
    if (!read) throw new Error("execution reader unavailable");
    receipt = orderExecutionReceiptSchema.parse(await read.call(brokerFor("alpaca_paper", selection.accountId), {
      brokerOrderId: initial.row.brokerOrderId, expectedExternalAccountId: initial.row.externalAccountId,
    }));
    if (receipt.externalAccountId !== initial.row.externalAccountId || receipt.brokerOrderId !== initial.row.brokerOrderId
      || receipt.observedAt < initial.row.createdAt || receipt.observedAt > Date.now()) throw new Error("execution binding mismatch");
  } catch { receipt = null; }
  await db.transaction(async tx => {
    await tx.select().from(portfolioAccounts).where(and(eq(portfolioAccounts.id, selection.accountId), eq(portfolioAccounts.userId, userId))).for("update");
    const binding = await source(tx, userId, selection);
    checked(initial.row, userId, selection, binding, Date.now());
    const { id: _id, recordHash: _hash, ...original } = initial.row;
    const complete = { ...original, state: receipt ? "complete" as const : "failed" as const,
      receipt, failureCode: receipt ? null : "execution_read_failed", completedAt: Date.now() };
    const [updated] = await tx.update(evidence).set({ ...complete, recordHash: hash(complete) })
      .where(and(eq(evidence.id, initial.row.id), eq(evidence.userId, userId), eq(evidence.state, "pending")));
    if (updated.affectedRows !== 1) fail("Execution refresh needs reconciliation; do not infer a new result.");
  });
  return { requestId, ...(await readExecutionEvidence(db, userId, selection)) };
}

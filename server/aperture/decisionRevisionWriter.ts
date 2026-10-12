import { and, eq, inArray, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { apertureDecisionRuns, apertureDecisionRevisions, aperturePendingOutcomes, brokerOrders } from "../../drizzle/schema";
import { getDb } from "../db";
import { decisionReceiptPendingOutcome } from "./decisionRunway";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type DecisionRevisionTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Head = typeof apertureDecisionRuns.$inferSelect;
type Revision = typeof apertureDecisionRevisions.$inferSelect;
type Values = Omit<typeof apertureDecisionRevisions.$inferInsert, "id" | "decisionRunId" | "version" | "previousRevisionId" | "createdAt" | "createdByUserId">;
const conflict = () => new TRPCError({ code: "CONFLICT", message: "The Decision Run changed while this revision was being recorded." });

/** Shared normal revision semantics, extracted from runway.begin. No broker calls. */
export async function appendDecisionRevision(db: Db, input: {
  ownerId: number; decisionRunId: number; expectedRevisionId: number; expectedLockVersion: number; now: number;
  build: (tx: DecisionRevisionTransaction, head: Head, current: Revision) => Promise<{
    values: Values; lifecycle: Head["lifecycle"];
    pending: Parameters<typeof decisionReceiptPendingOutcome>[0];
  }>;
}) {
  return db.transaction(async tx => {
    const [head] = await tx.select().from(apertureDecisionRuns).where(and(
      eq(apertureDecisionRuns.id, input.decisionRunId), eq(apertureDecisionRuns.userId, input.ownerId),
      eq(apertureDecisionRuns.currentRevisionId, input.expectedRevisionId),
      eq(apertureDecisionRuns.lockVersion, input.expectedLockVersion),
    )).for("update").limit(1);
    if (!head?.currentRevisionId || head.lifecycle === "closed") throw conflict();
    const [dispatch] = await tx.select({ id: brokerOrders.id }).from(brokerOrders).where(and(
      eq(brokerOrders.userId, input.ownerId), eq(brokerOrders.decisionRunId, head.id),
      eq(brokerOrders.status, "submitted"), isNull(brokerOrders.brokerOrderId),
    )).for("update").limit(1);
    if (dispatch) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A paper order dispatch is still resolving for this Decision Run. Record a new disposition after the broker response is persisted." });
    const [current] = await tx.select().from(apertureDecisionRevisions).where(and(
      eq(apertureDecisionRevisions.id, head.currentRevisionId), eq(apertureDecisionRevisions.decisionRunId, head.id),
    )).limit(1);
    if (!current) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The current Decision Run revision is unavailable." });
    const prepared = await input.build(tx, head, current);
    const [inserted] = await tx.insert(apertureDecisionRevisions).values({ ...prepared.values,
      decisionRunId: head.id, version: current.version + 1, previousRevisionId: current.id,
      createdByUserId: input.ownerId, createdAt: input.now });
    const revisionId = Number(inserted.insertId);
    if (!Number.isSafeInteger(revisionId) || revisionId < 1) throw new Error("Revision insert could not be confirmed");
    const updated = await tx.update(apertureDecisionRuns).set({ currentRevisionId: revisionId,
      lifecycle: prepared.lifecycle, lockVersion: head.lockVersion + 1, updatedAt: input.now }).where(and(
      eq(apertureDecisionRuns.id, head.id), eq(apertureDecisionRuns.userId, input.ownerId),
      eq(apertureDecisionRuns.currentRevisionId, current.id), eq(apertureDecisionRuns.lockVersion, head.lockVersion)));
    if (!updated[0].affectedRows) throw conflict();
    await tx.update(aperturePendingOutcomes).set({ status: "cancelled", updatedAt: input.now }).where(and(
      eq(aperturePendingOutcomes.userId, input.ownerId), eq(aperturePendingOutcomes.decisionRunId, head.id),
      eq(aperturePendingOutcomes.revisionId, current.id), inArray(aperturePendingOutcomes.status, ["pending", "due"])));
    const pending = decisionReceiptPendingOutcome(prepared.pending);
    if (pending) await tx.insert(aperturePendingOutcomes).values({ userId: input.ownerId, decisionRunId: head.id,
      revisionId, kind: pending.kind, status: "pending", dueAt: pending.dueAt, gateKey: pending.gateKey,
      reviewBasis: pending.reviewBasis, createdAt: input.now, updatedAt: input.now });
    return { decisionRunId: head.id, revisionId };
  });
}

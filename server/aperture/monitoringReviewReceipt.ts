import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { apertureAttentionBaselines, apertureCandidates, apertureRuns, brokerOrders, monitoringChecks, users } from "../../drizzle/schema";
import { attentionBaselineToken, type ApertureAttentionBaseline } from "../../shared/apertureAttention";
import { monitoringFindingVersion, type VersionedMonitoringFinding, type MonitoringReviewReceipt } from "../../shared/monitoringFinding";
import { parsePersistedJson } from "../../shared/persistedJson";
import { capitalOperatorProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

const targetSchema = z.object({ runId: z.number().int().positive(), candidateId: z.number().int().positive(), orderId: z.number().int().positive(), findingId: z.number().int().positive(), findingVersion: z.string().regex(/^v1-[a-f0-9]{8}$/) });
const reviewSchema = targetSchema.extend({ requestId: z.string().uuid(), decision: z.enum(["reviewed_unresolved", "needs_fresh_evidence"]), note: z.string().trim().min(10).max(1000) });
type Target = z.infer<typeof targetSchema>;

export interface MonitoringReviewRepository {
  readOwnedFinding(userId: number, target: Target): Promise<VersionedMonitoringFinding | null>;
  readBaseline(userId: number): Promise<ApertureAttentionBaseline | null>;
  writeBaseline(userId: number, snapshot: ApertureAttentionBaseline, now: number): Promise<void>;
  transaction<T>(userId: number, action: (locked: MonitoringReviewRepository) => Promise<T>): Promise<T>;
}

const sameTarget = (receipt: MonitoringReviewReceipt, userId: number, target: Target) => receipt.userId === userId && receipt.runId === target.runId && receipt.candidateId === target.candidateId && receipt.orderId === target.orderId && receipt.findingId === target.findingId && receipt.findingVersion === target.findingVersion;

async function verifyTarget(repo: MonitoringReviewRepository, userId: number, target: Target) {
  const check = await repo.readOwnedFinding(userId, target);
  if (!check) throw new TRPCError({ code: "NOT_FOUND", message: "This finding is not part of the selected operator-owned play. Return to its recorded checks." });
  if (monitoringFindingVersion(check) !== target.findingVersion) throw new TRPCError({ code: "CONFLICT", message: "The finding version changed. Reopen its recorded evidence before saving a review." });
}

/** Receipt ledger is a separate JSON field beside Seen, never a gate or order authority.
 * No schema migration, source-check mutation, implicit acknowledgement, or resolution. */
export function createMonitoringReviewRouter(repo: MonitoringReviewRepository) {
  return router({
    list: capitalOperatorProcedure.input(targetSchema).query(async ({ ctx, input }) => {
      await verifyTarget(repo, ctx.user.id, input);
      const snapshot = await repo.readBaseline(ctx.user.id);
      return { receipts: (snapshot?.monitoringReviews ?? []).filter(receipt => sameTarget(receipt, ctx.user.id, input)) };
    }),
    record: capitalOperatorProcedure.input(reviewSchema).mutation(async ({ ctx, input }) => repo.transaction(ctx.user.id, async locked => {
      await verifyTarget(locked, ctx.user.id, input);
      const prior = await locked.readBaseline(ctx.user.id);
      const reviews = prior?.monitoringReviews ?? [];
      const retry = reviews.find(receipt => receipt.requestId === input.requestId);
      if (retry) {
        if (!sameTarget(retry, ctx.user.id, input) || retry.decision !== input.decision || retry.note !== input.note) throw new TRPCError({ code: "CONFLICT", message: "That request already recorded a different review. Reload its receipt before making another decision." });
        return { receipt: retry, duplicate: true };
      }
      const identical = reviews.find(receipt => sameTarget(receipt, ctx.user.id, input) && receipt.decision === input.decision && receipt.note === input.note);
      if (identical) return { receipt: identical, duplicate: true };
      const now = Date.now();
      const receipt: MonitoringReviewReceipt = { ...input, userId: ctx.user.id, reviewedAt: now, resolved: false };
      const snapshot: ApertureAttentionBaseline = { ...(prior ?? { capturedAt: 0, items: [] }), monitoringReviews: [...reviews, receipt] };
      await locked.writeBaseline(ctx.user.id, snapshot, now);
      return { receipt, duplicate: false };
    })),
  });
}

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Executor = Pick<Db, "select" | "insert">;
function store(db: Executor): MonitoringReviewRepository {
  return {
    async readOwnedFinding(userId, target) {
      const [row] = await db.select({ check: monitoringChecks }).from(monitoringChecks)
        .innerJoin(apertureCandidates, and(eq(apertureCandidates.id, monitoringChecks.candidateId), eq(apertureCandidates.runId, monitoringChecks.runId)))
        .innerJoin(apertureRuns, and(eq(apertureRuns.id, monitoringChecks.runId), eq(apertureRuns.userId, userId)))
        .innerJoin(brokerOrders, and(eq(brokerOrders.id, target.orderId), eq(brokerOrders.userId, userId), eq(brokerOrders.runId, monitoringChecks.runId), eq(brokerOrders.candidateId, monitoringChecks.candidateId)))
        .where(and(eq(monitoringChecks.id, target.findingId), eq(monitoringChecks.runId, target.runId), eq(monitoringChecks.candidateId, target.candidateId))).limit(1);
      return row?.check ?? null;
    },
    async readBaseline(userId) {
      const [row] = await db.select({ snapshot: apertureAttentionBaselines.snapshot }).from(apertureAttentionBaselines).where(eq(apertureAttentionBaselines.userId, userId)).limit(1);
      return row?.snapshot ? parsePersistedJson(row.snapshot) : null;
    },
    async writeBaseline(userId, snapshot, now) {
      await db.insert(apertureAttentionBaselines).values({ userId, snapshot, token: attentionBaselineToken(snapshot), capturedAt: snapshot.capturedAt, createdAt: now, updatedAt: now })
        .onDuplicateKeyUpdate({ set: { snapshot, token: attentionBaselineToken(snapshot), capturedAt: snapshot.capturedAt, updatedAt: now } });
    },
    transaction: async () => { throw new Error("Nested monitoring review transaction is not allowed"); },
  };
}

async function database() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Review storage is unavailable. No review was saved; retry this same request when storage returns." });
  return db;
}
const repository: MonitoringReviewRepository = {
  readOwnedFinding: async (user, target) => store(await database()).readOwnedFinding(user, target),
  readBaseline: async user => store(await database()).readBaseline(user),
  writeBaseline: async () => { throw new Error("Review writes require the owner transaction"); },
  transaction: async (userId, action) => (await database()).transaction(async tx => {
    // Same owner lock as desk.markSeen, including before a baseline row exists.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    return action(store(tx));
  }),
};
export const monitoringReviewRouter = createMonitoringReviewRouter(repository);

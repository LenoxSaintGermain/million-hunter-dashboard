import { createHash } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { aperturePendingOutcomes, apertureDecisionRuns, apertureDecisionRevisions, apertureRuns, brokerOrders, portfolioAccounts } from "../../drizzle/schema";
import { parsePersistedJson } from "../../shared/persistedJson";
import { capitalOperatorProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

export type PlayOutcomeEvidence = {
  reviewId: number; userId: number; runId: number; decisionRunId: number; revisionId: number; orderId: number;
  candidateId: number | null; accountId: number;
  dueAt: number; reviewBasis: string;
  orders: Array<{ id: number; symbol: string; side: string; intent: string | null; status: string;
    filledQty: number | null; filledAvgPriceCents: number | null; filledAt: number | null; updatedAt: number }>;
};
type Review = { evidence: PlayOutcomeEvidence; status: string; result: Record<string, unknown> | null };
export interface PlayOutcomeRepository {
  list(userId: number, runId: number): Promise<Review[]>;
  read(userId: number, runId: number, reviewId: number): Promise<Review | null>;
  resolve(userId: number, reviewId: number, result: Record<string, unknown>, now: number): Promise<void>;
  transaction<T>(action: (locked: PlayOutcomeRepository) => Promise<T>): Promise<T>;
}
const scope = z.object({ runId: z.number().int().positive() });
const recordInput = scope.extend({ reviewId: z.number().int().positive(), evidenceVersion: z.string().regex(/^[a-f0-9]{64}$/),
  note: z.string().trim().min(10).max(2000), confirm: z.literal(true) }).strict();
const version = (evidence: PlayOutcomeEvidence) => createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
const filled = (evidence: PlayOutcomeEvidence) => evidence.orders.some(order => order.id === evidence.orderId && order.status === "filled"
  && order.filledQty != null && Number.isFinite(order.filledQty) && order.filledQty > 0);

export function createPlayOutcomeRouter(repo: PlayOutcomeRepository, now = Date.now) {
  return router({
    list: capitalOperatorProcedure.input(scope).query(async ({ ctx, input }) => (await repo.list(ctx.user.id, input.runId)).map(row => ({
      ...row, evidenceVersion: version(row.evidence), canRecord: row.result == null && ["pending", "due"].includes(row.status) && row.evidence.dueAt <= now() && filled(row.evidence),
    }))),
    record: capitalOperatorProcedure.input(recordInput).mutation(async ({ ctx, input }) => repo.transaction(async locked => {
      const row = await locked.read(ctx.user.id, input.runId, input.reviewId);
      if (!row || row.evidence.userId !== ctx.user.id || row.evidence.runId !== input.runId || row.evidence.reviewId !== input.reviewId)
        throw new TRPCError({ code: "NOT_FOUND", message: "This scheduled review is not linked to your selected paper run." });
      if (!["pending", "due"].includes(row.status) || row.result != null)
        throw new TRPCError({ code: "CONFLICT", message: "This review is already recorded or cancelled. Reload its receipt; it cannot be overwritten." });
      const recordedAt = now();
      if (row.evidence.dueAt > recordedAt || !filled(row.evidence))
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This review needs its declared review time and a recorded fill. No review was resolved." });
      if (version(row.evidence) !== input.evidenceVersion)
        throw new TRPCError({ code: "CONFLICT", message: "The saved order evidence changed. Reload and review it before confirming again." });
      const receipt = { schemaVersion: 1, kind: "operator_recorded_play_review", reviewId: input.reviewId,
        recordedByUserId: ctx.user.id, recordedAt, note: input.note, evidenceVersion: input.evidenceVersion,
        evidence: row.evidence, pnl: null,
        boundary: "Closes this scheduled human review only. No position closure, P&L conclusion, order, or risk clearance is inferred." };
      await locked.resolve(ctx.user.id, input.reviewId, receipt, recordedAt);
      return receipt;
    })),
  });
}

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Executor = Pick<Db, "select" | "update">;
function store(db: Executor, lock = false): PlayOutcomeRepository {
  async function load(userId: number, runId: number, reviewId?: number): Promise<Review[]> {
    // Every edge is owner- and revision-bound. Null/legacy or mismatched order
    // bindings fail closed rather than granting authority from a URL alone.
    const query = db.select({ pending: aperturePendingOutcomes, order: brokerOrders }).from(aperturePendingOutcomes)
      .innerJoin(apertureDecisionRuns, and(eq(apertureDecisionRuns.id, aperturePendingOutcomes.decisionRunId), eq(apertureDecisionRuns.userId, userId)))
      .innerJoin(apertureDecisionRevisions, and(eq(apertureDecisionRevisions.id, aperturePendingOutcomes.revisionId), eq(apertureDecisionRevisions.decisionRunId, apertureDecisionRuns.id)))
      .innerJoin(brokerOrders, and(eq(brokerOrders.id, aperturePendingOutcomes.orderId), eq(brokerOrders.userId, userId),
        eq(brokerOrders.decisionRunId, aperturePendingOutcomes.decisionRunId), eq(brokerOrders.decisionRevisionId, aperturePendingOutcomes.revisionId),
        eq(brokerOrders.runId, apertureDecisionRuns.researchRunId), eq(brokerOrders.runId, runId)))
      .innerJoin(apertureRuns, and(eq(apertureRuns.id, brokerOrders.runId), eq(apertureRuns.userId, userId)))
      .innerJoin(portfolioAccounts, and(eq(portfolioAccounts.id, brokerOrders.accountId), eq(portfolioAccounts.userId, userId), eq(portfolioAccounts.isPaper, true)))
      .where(and(eq(aperturePendingOutcomes.userId, userId), eq(aperturePendingOutcomes.kind, "play_outcome"), reviewId == null ? undefined : eq(aperturePendingOutcomes.id, reviewId)))
      .orderBy(asc(aperturePendingOutcomes.id));
    const rows = await (lock ? query.for("update") : query);
    const results: Review[] = [];
    for (const { pending, order } of rows) {
      const ordersQuery = db.select({ id: brokerOrders.id, symbol: brokerOrders.symbol, side: brokerOrders.side, intent: brokerOrders.intent,
        status: brokerOrders.status, filledQty: brokerOrders.filledQty, filledAvgPriceCents: brokerOrders.filledAvgPriceCents,
        filledAt: brokerOrders.filledAt, updatedAt: brokerOrders.updatedAt }).from(brokerOrders)
        .where(and(eq(brokerOrders.userId, userId), eq(brokerOrders.runId, runId), eq(brokerOrders.accountId, order.accountId),
          eq(brokerOrders.symbol, order.symbol), order.candidateId == null ? eq(brokerOrders.id, order.id) : eq(brokerOrders.candidateId, order.candidateId)))
        .orderBy(asc(brokerOrders.id));
      const orders = await (lock ? ordersQuery.for("update") : ordersQuery);
      results.push({ status: pending.status, result: pending.result == null ? null : parsePersistedJson(pending.result), evidence: {
        reviewId: pending.id, userId, runId, decisionRunId: pending.decisionRunId, revisionId: pending.revisionId,
        orderId: order.id, candidateId: order.candidateId, accountId: order.accountId, dueAt: pending.dueAt, reviewBasis: pending.reviewBasis, orders,
      } });
    }
    return results;
  }
  return {
    list: (user, run) => load(user, run),
    read: async (user, run, id) => (await load(user, run, id))[0] ?? null,
    resolve: async (user, id, result, now) => {
      await db.update(aperturePendingOutcomes).set({ status: "resolved", result, resolvedAt: now, updatedAt: now })
        .where(and(eq(aperturePendingOutcomes.id, id), eq(aperturePendingOutcomes.userId, user), inArray(aperturePendingOutcomes.status, ["pending", "due"])));
    },
    transaction: async () => { throw new Error("Nested play review transactions are not allowed"); },
  };
}
async function database() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Review storage is unavailable. No review was saved." });
  return db;
}
const repository: PlayOutcomeRepository = {
  list: async (user, run) => store(await database()).list(user, run),
  read: async (user, run, id) => store(await database()).read(user, run, id),
  resolve: async () => { throw new Error("Review writes require a transaction"); },
  transaction: async action => (await database()).transaction(tx => action(store(tx, true))),
};
export const playOutcomeRouter = createPlayOutcomeRouter(repository);

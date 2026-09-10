import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { apertureMissionDrafts, apertureMissionDraftRevisions } from "../../drizzle/apertureMissionDraftSchema";
import { apertureCandidates, apertureRuns, brokerOrders, apertureDecisionRevisions, apertureDecisionRuns, portfolioAccounts, thesisCompilations } from "../../drizzle/schema";
import { missionDraftValuesSchema, type MissionDraftRecord, type MissionDraftValues } from "../../shared/apertureMissionDraft";
import { capitalOperatorProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { readAcceptedObjectiveValues } from "./objectiveMission";

const saveInput = z.object({ expectedVersion: z.number().int().nonnegative(), values: missionDraftValuesSchema, replaceStrategyContext: z.boolean().optional() }).strict();
const completeInput = z.object({
  expectedVersion: z.number().int().positive(),
  decisionRunId: z.number().int().positive(),
  decisionRevisionId: z.number().int().positive(),
});
type DraftWrite = Pick<MissionDraftRecord, "values" | "updatedAt" | "completedAt">;
export interface MissionDraftStore {
  get(userId: number): Promise<MissionDraftRecord | null>;
  assertBindings(userId: number, values: MissionDraftValues): Promise<void>;
  assertReceipt(userId: number, decisionRunId: number, decisionRevisionId: number, kind?: "thesis" | "objective"): Promise<void>;
  /** Atomically replace exactly the expected owner version and append history. */
  compareAndSwap(userId: number, expectedVersion: number, next: DraftWrite): Promise<MissionDraftRecord | null>;
}

function conflict() {
  return new TRPCError({ code: "CONFLICT", message: "This draft changed on another device. Your edits have not overwritten it. Review the saved draft before continuing." });
}

/** Injectable persistence seam: these operations have no Mission/order side effects. */
export function createMissionDraftService(store: MissionDraftStore, now = Date.now) {
  return {
    get: (userId: number) => store.get(userId),
    async save(userId: number, raw: z.infer<typeof saveInput>) {
      const input = saveInput.parse(raw);
      const previous = await store.get(userId);
      if (previous?.values.strategyContext && !input.values.strategyContext && !input.replaceStrategyContext) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This saved draft contains a capital objective. Reload a workspace that supports it, or explicitly choose to replace that context. Nothing was overwritten." });
      }
      await store.assertBindings(userId, input.values);
      const result = await store.compareAndSwap(userId, input.expectedVersion, { values: input.values, updatedAt: now(), completedAt: null });
      if (!result) throw conflict();
      return result;
    },
    async complete(userId: number, raw: z.infer<typeof completeInput>) {
      const input = completeInput.parse(raw);
      const current = await store.get(userId);
      if (current?.values.strategyContext) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This capital objective has not entered the accepted Mission workflow yet. Keep the draft; an unrelated Mission receipt cannot complete it." });
      await store.assertReceipt(userId, input.decisionRunId, input.decisionRevisionId, "thesis");
      // Retrying an already-confirmed completion is harmless. A newer draft is not.
      if (current?.version === input.expectedVersion + 1 && current.completedAt != null
        && current.values.baseDecisionRunId === input.decisionRunId
        && current.values.baseDecisionRevisionId === input.decisionRevisionId) return current;
      if (!current || current.version !== input.expectedVersion) throw conflict();
      const timestamp = now();
      const result = await store.compareAndSwap(userId, input.expectedVersion, {
        values: { ...current.values, baseDecisionRunId: input.decisionRunId, baseDecisionRevisionId: input.decisionRevisionId },
        updatedAt: timestamp, completedAt: timestamp,
      });
      if (!result) throw conflict();
      return result;
    },
  };
}

async function database() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Mission draft storage is unavailable. Your draft has not been saved; retry when the connection is restored." });
  return db;
}

export function decodeMissionDraftRecord(row: typeof apertureMissionDrafts.$inferSelect): MissionDraftRecord {
  // MariaDB/mysql2 can return a JSON column as its encoded string. Decode once,
  // then enforce the same strict schema; malformed persisted data must fail.
  const values: unknown = typeof row.values === "string" ? JSON.parse(row.values) : row.values;
  return { id: row.id, version: row.version, values: missionDraftValuesSchema.parse(values), updatedAt: row.updatedAt, completedAt: row.completedAt };
}

function duplicateKey(error: unknown) {
  const value = error as { code?: string; errno?: number; cause?: { code?: string; errno?: number } };
  return value?.code === "ER_DUP_ENTRY" || value?.errno === 1062 || value?.cause?.code === "ER_DUP_ENTRY" || value?.cause?.errno === 1062;
}

export const missionDraftStore: MissionDraftStore = {
  async get(userId) {
    const db = await database();
    const [row] = await db.select().from(apertureMissionDrafts).where(eq(apertureMissionDrafts.userId, userId)).limit(1);
    return row ? decodeMissionDraftRecord(row) : null;
  },
  async assertReceipt(userId, decisionRunId, decisionRevisionId, kind) {
    const db = await database();
    const [binding] = await db.select({ id: apertureDecisionRevisions.id }).from(apertureDecisionRuns)
      .innerJoin(apertureDecisionRevisions, eq(apertureDecisionRevisions.decisionRunId, apertureDecisionRuns.id))
      .where(and(eq(apertureDecisionRuns.userId, userId), eq(apertureDecisionRuns.id, decisionRunId), eq(apertureDecisionRevisions.id, decisionRevisionId),
        kind == null ? undefined : eq(apertureDecisionRuns.contextKind, kind))).limit(1);
    if (!binding) throw new TRPCError({ code: "NOT_FOUND", message: "The saved Mission revision is not available to this operator. The draft remains unchanged." });
  },
  async assertBindings(userId, values) {
    const db = await database();
    if (values.canonicalThesisId != null) {
      const [thesis] = await db.select({ id: thesisCompilations.id }).from(thesisCompilations)
        .where(and(eq(thesisCompilations.id, values.canonicalThesisId), eq(thesisCompilations.userId, userId))).limit(1);
      if (!thesis) throw new TRPCError({ code: "NOT_FOUND", message: "The selected thesis is not available to this operator." });
    }
    if (values.accountId != null) {
      const [account] = await db.select({ id: portfolioAccounts.id }).from(portfolioAccounts)
        .where(and(eq(portfolioAccounts.id, values.accountId), eq(portfolioAccounts.userId, userId), eq(portfolioAccounts.isPaper, true))).limit(1);
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Select an available paper account before saving this account choice." });
    }
    const source = values.strategyContext?.sourceOrder;
    if (source) {
      const [owned] = await db.select({ id: brokerOrders.id }).from(brokerOrders)
        .innerJoin(apertureRuns, eq(apertureRuns.id, brokerOrders.runId))
        .innerJoin(apertureCandidates, and(eq(apertureCandidates.id, brokerOrders.candidateId), eq(apertureCandidates.runId, brokerOrders.runId)))
        .where(and(eq(brokerOrders.userId, userId), eq(apertureRuns.userId, userId),
          eq(brokerOrders.accountId, source.accountId), eq(brokerOrders.runId, source.runId),
          eq(brokerOrders.candidateId, source.candidateId), eq(brokerOrders.id, source.orderId))).limit(1);
      if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "The selected source order is not available in this account and play. Reopen that exact play; no source was guessed." });
      // An owned reference is not proof of a closing fill, profit or availability.
    }
    if (values.baseDecisionRunId != null && values.baseDecisionRevisionId != null) {
      await missionDraftStore.assertReceipt(userId, values.baseDecisionRunId, values.baseDecisionRevisionId);
      const [head] = await db.select().from(apertureDecisionRuns).where(and(eq(apertureDecisionRuns.id, values.baseDecisionRunId), eq(apertureDecisionRuns.userId, userId))).limit(1);
      if (values.strategyContext) {
        if (!head || head.contextKind !== "objective" || head.clientRequestId !== values.strategyContext.requestId
          || head.accountId !== values.accountId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This draft does not match the exact accepted capital objective. No receipt was substituted." });
        const [revision] = await db.select().from(apertureDecisionRevisions).where(and(eq(apertureDecisionRevisions.id, values.baseDecisionRevisionId), eq(apertureDecisionRevisions.decisionRunId, head.id))).limit(1);
        if (!revision) throw new TRPCError({ code: "NOT_FOUND", message: "The objective baseline receipt is unavailable." });
        const accepted = await readAcceptedObjectiveValues(db, userId, head, revision);
        if (values.canonicalThesisId !== accepted.canonicalThesisId || JSON.stringify(values.strategyContext) !== JSON.stringify(accepted.strategyContext)) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The selected thesis or capital source differs from this accepted objective. A deliberate context revision is required; the saved baseline was not changed." });
        }
      } else if (head?.contextKind === "objective") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Retain the accepted capital objective when revising this Mission." });
      }
    }
  },
  async compareAndSwap(userId, expectedVersion, next) {
    const db = await database();
    try {
      return await db.transaction(async (tx) => {
        let draftId: number;
        if (expectedVersion === 0) {
          const inserted = await tx.insert(apertureMissionDrafts).values({
            userId, version: 1, values: next.values, completedAt: next.completedAt,
            createdAt: next.updatedAt, updatedAt: next.updatedAt,
          });
          draftId = Number(inserted[0].insertId);
        } else {
          const updated = await tx.update(apertureMissionDrafts).set({
            version: expectedVersion + 1, values: next.values, completedAt: next.completedAt, updatedAt: next.updatedAt,
          }).where(and(eq(apertureMissionDrafts.userId, userId), eq(apertureMissionDrafts.version, expectedVersion)));
          if (!updated[0].affectedRows) return null;
          const [head] = await tx.select({ id: apertureMissionDrafts.id }).from(apertureMissionDrafts)
            .where(eq(apertureMissionDrafts.userId, userId)).limit(1);
          if (!head) throw new Error("Mission draft head unavailable after write");
          draftId = head.id;
        }
        await tx.insert(apertureMissionDraftRevisions).values({
          draftId, userId, version: expectedVersion + 1, values: next.values,
          completedAt: next.completedAt, createdAt: next.updatedAt,
        });
        return { id: draftId, version: expectedVersion + 1, ...next };
      });
    } catch (error) {
      if (duplicateKey(error)) return null;
      throw error;
    }
  },
};

const service = createMissionDraftService(missionDraftStore);
export const missionDraftRouter = router({
  get: capitalOperatorProcedure.query(({ ctx }) => service.get(ctx.user.id)),
  save: capitalOperatorProcedure.input(saveInput).mutation(({ ctx, input }) => service.save(ctx.user.id, input)),
  complete: capitalOperatorProcedure.input(completeInput).mutation(({ ctx, input }) => service.complete(ctx.user.id, input)),
});

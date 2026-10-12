import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { deals } from "../drizzle/schema";
import { dealEvidenceAttachments as attachments, dealEvidenceAnalysisRequests as requests, dealEvidenceAnalysisResults as results } from "../drizzle/dealEvidenceSchema";
import { dealEvidenceId, dealEvidenceSnapshotSchema, evidenceICOutputSchema, evidenceRedTeamOutputSchema } from "../shared/dealEvidence";
import { parsePersistedJson } from "../shared/persistedJson";
import { getDb } from "./db";
import { validateEvidenceOutput } from "./dealEvidenceEngine";

export type DealEvidenceAttachment = typeof attachments.$inferSelect;
export type DealEvidenceRequest = typeof requests.$inferSelect;
export type DealEvidenceResult = typeof results.$inferSelect;
export type DealEvidenceRun = DealEvidenceRequest & { status: "pending" | "complete" | "failed"; output: DealEvidenceResult["output"]; failureCode: string | null; message: string | null; completedAt: Date | null };
const uuid = z.string().uuid();
const scope = (ownerId: number, dealId: number) => ({ ownerId: dealEvidenceId.parse(ownerId), dealId: dealEvidenceId.parse(dealId) });
export class DealEvidenceStorageError extends Error {
  constructor(public code: "CONFLICT" | "DATABASE_UNAVAILABLE" | "INVALID_STORAGE" | "RATE_LIMITED" | "NOT_FOUND", message: string) { super(message); }
}
function duplicate(error: unknown): boolean {
  const seen = new Set<unknown>();
  while (error && typeof error === "object" && !seen.has(error)) {
    seen.add(error); const e = error as { code?: string; errno?: number; cause?: unknown };
    if (e.code === "ER_DUP_ENTRY" || e.errno === 1062) return true;
    error = e.cause;
  }
  return false;
}
function normalizeRequest(row: DealEvidenceRequest): DealEvidenceRequest {
  return { ...row, models: z.array(z.string().min(1).max(128)).min(1).max(3).parse(parsePersistedJson(row.models)),
    inputSnapshot: dealEvidenceSnapshotSchema.parse(parsePersistedJson(row.inputSnapshot)) };
}

export function createDealEvidenceRepository(getDbFn: typeof getDb = getDb) {
  async function lockDeal(tx: Pick<NonNullable<Awaited<ReturnType<typeof getDb>>>, "execute">, ownerId: number, dealId: number) {
    const [rows] = await tx.execute(sql`SELECT id FROM deals WHERE id = ${dealId} AND owner_user_id = ${ownerId} AND isArchived = false FOR UPDATE`);
    if (!(rows as unknown as unknown[]).length) throw new DealEvidenceStorageError("NOT_FOUND", "Deal not found.");
  }
  async function reserveMinute(tx: Pick<NonNullable<Awaited<ReturnType<typeof getDb>>>, "execute">, key: string, limit: number) {
    await tx.execute(sql`INSERT INTO public_evidence_budgets (budget_key, window_start, request_count, second_start, second_count)
      VALUES (${key}, FLOOR(UNIX_TIMESTAMP()/60)*60, 1, 0, 0)
      ON DUPLICATE KEY UPDATE request_count = IF(window_start < FLOOR(UNIX_TIMESTAMP()/60)*60, 1, request_count + 1),
      window_start = GREATEST(window_start, FLOOR(UNIX_TIMESTAMP()/60)*60)`);
    const [rows] = await tx.execute(sql`SELECT request_count AS count FROM public_evidence_budgets WHERE budget_key = ${key} FOR UPDATE`);
    const row = (rows as unknown as { count: unknown }[])[0];
    const parsed = z.union([z.number(), z.string().regex(/^\d+$/)]).transform(Number).pipe(z.number().int().positive()).safeParse(row?.count);
    if (!parsed.success) throw new DealEvidenceStorageError("INVALID_STORAGE", "Evidence admission state could not be verified.");
    if (parsed.data > limit) throw new DealEvidenceStorageError("RATE_LIMITED", "Evidence action admission limit reached.");
  }
  async function database() {
    const db = await getDbFn();
    if (!db) throw new DealEvidenceStorageError("DATABASE_UNAVAILABLE", "Analysis storage unavailable.");
    return db;
  }
  async function readRequest(ownerId: number, requestId: string) {
    dealEvidenceId.parse(ownerId); uuid.parse(requestId);
    const db = await database();
    const [row] = await db.select().from(requests).where(and(eq(requests.ownerId, ownerId), eq(requests.requestId, requestId))).limit(1);
    return row ? normalizeRequest(row) : null;
  }
  async function hydrate(request: DealEvidenceRequest): Promise<DealEvidenceRun> {
    const db = await database();
    const [row] = await db.select().from(results).where(and(eq(results.ownerId, request.ownerId), eq(results.dealId, request.dealId), eq(results.id, request.id))).limit(1);
    if (!row) return { ...request, status: "pending", output: null, failureCode: null, message: null, completedAt: null };
    if (row.status === "failed" && (row.output !== null || !row.failureCode || !row.message)) throw new DealEvidenceStorageError("INVALID_STORAGE", "Invalid failed result.");
    if (row.status === "complete" && (row.failureCode !== null || row.message !== null)) throw new DealEvidenceStorageError("INVALID_STORAGE", "Invalid successful result.");
    const output = row.status === "complete" ? (request.mode === "ic" ? evidenceICOutputSchema : evidenceRedTeamOutputSchema).parse(parsePersistedJson(row.output)) : null;
    if (output) validateEvidenceOutput(request.mode, output, request.inputSnapshot, request.models);
    return { ...request, status: row.status, output, failureCode: row.failureCode, message: row.message, completedAt: row.completedAt };
  }
  return {
    async getDeal(ownerId: number, dealId: number) {
      scope(ownerId, dealId); const db = await database();
      // Same privateWorkspace policy: explicit owner, non-archived, no admin or legacy NULL bypass.
      const [deal] = await db.select().from(deals).where(and(eq(deals.ownerUserId, ownerId), eq(deals.id, dealId), eq(deals.isArchived, false))).limit(1);
      return deal ?? null;
    },
    async attach(input: Omit<DealEvidenceAttachment, "id" | "createdAt">) {
      scope(input.ownerId, input.dealId); uuid.parse(input.requestId); uuid.parse(input.receiptId);
      const db = await database();
      const data = { ...structuredClone(input), id: randomUUID(), createdAt: new Date() };
      const match = (existing: DealEvidenceAttachment | undefined) => {
        if (!existing || existing.dealId !== input.dealId || existing.receiptId !== input.receiptId || existing.confirmedCik !== input.confirmedCik || existing.payloadHash !== input.payloadHash || existing.relation !== input.relation) throw new DealEvidenceStorageError("CONFLICT", "Attachment request already bound.");
        return existing;
      };
      try {
        return await db.transaction(async tx => {
          await lockDeal(tx, input.ownerId, input.dealId);
          const [existing] = await tx.select().from(attachments).where(and(eq(attachments.ownerId, input.ownerId), eq(attachments.requestId, input.requestId))).limit(1);
          if (existing) return match(existing); // Recover a saved request without spending quota.
          await reserveMinute(tx, "deal-attachment:global", 120);
          await reserveMinute(tx, `deal-attachment:owner:${input.ownerId}`, 30);
          await tx.insert(attachments).values(data);
          return data;
        });
      }
      catch (error) {
        if (!duplicate(error)) throw error;
        const [existing] = await db.select().from(attachments).where(and(eq(attachments.ownerId, input.ownerId), eq(attachments.requestId, input.requestId))).limit(1);
        return match(existing);
      }
    },
    async listAttachments(ownerId: number, dealId: number) {
      scope(ownerId, dealId); const db = await database();
      return db.select().from(attachments).where(and(eq(attachments.ownerId, ownerId), eq(attachments.dealId, dealId))).orderBy(desc(attachments.createdAt), desc(attachments.id)).limit(100);
    },
    async getAttachment(ownerId: number, dealId: number, id: string) {
      scope(ownerId, dealId); uuid.parse(id); const db = await database();
      const [row] = await db.select().from(attachments).where(and(eq(attachments.ownerId, ownerId), eq(attachments.dealId, dealId), eq(attachments.id, id))).limit(1);
      return row ?? null;
    },
    async findRequest(ownerId: number, requestId: string) { const row = await readRequest(ownerId, requestId); return row ? hydrate(row) : null; },
    async start(input: Omit<DealEvidenceRequest, "id" | "startedAt">) {
      scope(input.ownerId, input.dealId); uuid.parse(input.requestId);
      dealEvidenceSnapshotSchema.parse(input.inputSnapshot);
      const db = await database();
      const data = { ...structuredClone(input), id: randomUUID(), startedAt: new Date() };
      try {
        await db.transaction(async tx => {
          await lockDeal(tx, input.ownerId, input.dealId);
          await tx.insert(requests).values(data);
          // Distributed paid-run admission: fixed global then owner rows. A retry
          // loses the unique insert before consuming quota or invoking a model.
          for (const [key, limit] of [["deal-analysis:global", 30], [`deal-analysis:owner:${input.ownerId}`, 5]] as const) {
            await reserveMinute(tx, key, limit);
          }
        });
        return { claimed: true, run: await hydrate(data) };
      } catch (error) {
        if (!duplicate(error)) throw error;
        const existing = await readRequest(input.ownerId, input.requestId);
        if (!existing || existing.dealId !== input.dealId || existing.requestHash !== input.requestHash || existing.mode !== input.mode) throw new DealEvidenceStorageError("CONFLICT", "Analysis request already bound.");
        return { claimed: false, run: await hydrate(existing) };
      }
    },
    async finish(input: DealEvidenceResult) {
      scope(input.ownerId, input.dealId); uuid.parse(input.id); const db = await database();
      const [request] = await db.select().from(requests).where(and(eq(requests.ownerId, input.ownerId), eq(requests.dealId, input.dealId), eq(requests.id, input.id))).limit(1);
      if (!request) throw new DealEvidenceStorageError("INVALID_STORAGE", "Analysis request missing.");
      const normalized = normalizeRequest(request);
      if (input.status === "complete") {
        if (input.failureCode !== null || input.message !== null) throw new DealEvidenceStorageError("INVALID_STORAGE", "Invalid successful result.");
        validateEvidenceOutput(normalized.mode, input.output, normalized.inputSnapshot, normalized.models);
      } else if (input.output !== null || !input.failureCode || !input.message) throw new DealEvidenceStorageError("INVALID_STORAGE", "Invalid failed result.");
      try {
        await db.transaction(async tx => { await lockDeal(tx, input.ownerId, input.dealId); await tx.insert(results).values(structuredClone(input)); });
      }
      catch (error) { if (!duplicate(error)) throw error; }
      return hydrate(normalized);
    },
    async getRun(ownerId: number, dealId: number, id: string) {
      scope(ownerId, dealId); uuid.parse(id); const db = await database();
      const [row] = await db.select().from(requests).where(and(eq(requests.ownerId, ownerId), eq(requests.dealId, dealId), eq(requests.id, id))).limit(1);
      return row ? hydrate(normalizeRequest(row)) : null;
    },
    async listRuns(ownerId: number, dealId: number) {
      scope(ownerId, dealId); const db = await database();
      const rows = await db.select().from(requests).where(and(eq(requests.ownerId, ownerId), eq(requests.dealId, dealId))).orderBy(desc(requests.startedAt), desc(requests.id)).limit(20);
      return Promise.all(rows.map(row => hydrate(normalizeRequest(row))));
    },
  };
}
export type DealEvidenceRepository = ReturnType<typeof createDealEvidenceRepository>;

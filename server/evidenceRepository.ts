import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { publicEvidenceReceipts, publicEvidenceCaptureClaims } from "../drizzle/publicEvidenceSchema";
import type { SecSubmissionsResult } from "../shared/secEvidence";
import { parsePersistedJson } from "../shared/persistedJson";
import { getDb } from "./db";

export type EvidenceReceipt = typeof publicEvidenceReceipts.$inferSelect;
export type AppendEvidenceInput = Omit<EvidenceReceipt, "id" | "recordedAt">;
export type CaptureClaim = { status: "claimed" | "pending"; startedAt: Date };
const feedProviderSchema = z.enum(["polymarket", "markbase", "usaspending", "frankfurter"]);
export type FeedProvider = z.infer<typeof feedProviderSchema>;
export interface EvidenceRepository {
  append(input: AppendEvidenceInput): Promise<EvidenceReceipt>;
  list(ownerId: number, subjectKey: string, limit?: number): Promise<EvidenceReceipt[]>;
  get(ownerId: number, id: string): Promise<EvidenceReceipt | null>;
  findRequest(ownerId: number, requestId: string): Promise<EvidenceReceipt | null>;
  reserveCaptureAttempt(ownerId: number): Promise<void>;
  reserveFeedCaller(ownerId: number): Promise<void>;
  reserveFeedProvider(provider: FeedProvider): Promise<void>;
  reserveSecBudget(ownerId: number): Promise<void>;
  reserveSecProviderBudget(): Promise<void>;
  setSecCooldown(until: Date): Promise<void>;
  claimCapture(ownerId: number, requestId: string, subjectKey: string): Promise<CaptureClaim>;
}
export class EvidenceRepositoryError extends Error {
  constructor(public readonly code: "DATABASE_UNAVAILABLE" | "CONFLICT" | "RATE_LIMITED" | "BUDGET_STATE_INVALID" | "RECEIPT_INVALID", message: string) {
    super(message);
    this.name = "EvidenceRepositoryError";
  }
}

const ownerSchema = z.number().int().min(1).max(2147483647);
const uuidSchema = z.string().uuid().transform(value => value.toLowerCase());
const subjectSchema = z.string().regex(/^sec:CIK\d{10}$/).refine(value => !value.endsWith("0000000000"));
/** Called with a server-resolved issuer CIK, not a user-supplied deal identity. */
export function deriveSecSubjectKey(cik: string): string {
  const digits = z.string().regex(/^\d{1,10}$/).refine(value => Number(value) > 0).parse(cik);
  return `sec:CIK${digits.padStart(10, "0")}`;
}
const appendSchema = z.object({
  ownerId: ownerSchema, subjectKey: subjectSchema, requestId: uuidSchema,
  provider: z.literal("sec-submissions"), schemaVersion: z.literal(1),
  sourceUrl: z.string().max(512), status: z.enum(["ok", "empty", "unavailable"]),
  // Payload shape is validated/normalized by the SEC adapter; the repository
  // validates serialization and receipt metadata, and never recalculates it.
  payload: z.custom<SecSubmissionsResult>(value => value !== null && typeof value === "object" && !Array.isArray(value)),
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  retrievedAt: z.date().nullable(), expiresAt: z.date().nullable(),
  message: z.string().max(65535).nullable(), failureCode: z.string().max(64).nullable(),
}).strict().superRefine((value, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (value.sourceUrl !== `https://data.sec.gov/submissions/${value.subjectKey.slice(4)}.json`) fail("Source must match the server-resolved CIK.");
  if (value.status === "unavailable") {
    if (value.retrievedAt !== null || value.expiresAt !== null) fail("Unavailable evidence has no retrieval or expiry timestamp.");
  } else if (!value.retrievedAt || !value.expiresAt || value.expiresAt < value.retrievedAt) {
    fail("Successful captures require valid retrieval and expiry timestamps.");
  }
  try {
    JSON.stringify(value.payload, (_key, item) => {
      if (item === undefined || typeof item === "function" || typeof item === "symbol" || typeof item === "bigint" || (typeof item === "number" && !Number.isFinite(item))) throw new Error("Not JSON");
      return item;
    });
  } catch { fail("Payload must be normalized JSON."); }
});

function duplicate(error: unknown): boolean {
  const seen = new Set<unknown>();
  while (error && typeof error === "object" && !seen.has(error)) {
    seen.add(error);
    const e = error as { code?: string; errno?: number; cause?: unknown };
    if (e.code === "ER_DUP_ENTRY" || e.errno === 1062) return true;
    error = e.cause;
  }
  return false;
}
function sameSubject(existing: EvidenceReceipt, subjectKey: string): EvidenceReceipt {
  if (existing.subjectKey !== subjectKey) throw new EvidenceRepositoryError("CONFLICT", "Request ID is already bound to a different subject.");
  return existing;
}

// The adapter currently exports a type, not a normalized-result validator.
// Validate persisted JSON at this boundary as MariaDB JSON may be text while
// MySQL returns an object. Validation must not rewrite the hashed payload.
const storedPayloadSchema: z.ZodType<SecSubmissionsResult> = z.object({
  status: z.enum(["ok", "empty", "unavailable"]),
  sourceUrl: z.string().url(), retrievedAt: z.string().datetime({ offset: true }).nullable(),
  company: z.object({ cik: z.string().regex(/^\d{10}$/), name: z.string().min(1) }).nullable(),
  filings: z.array(z.object({
    accessionNumber: z.string().regex(/^\d{10}-\d{2}-\d{6}$/),
    form: z.string().min(1), filingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    primaryDocument: z.string().min(1), url: z.string().url(),
  })),
  message: z.string().nullable(),
  retryAt: z.string().datetime({ offset: true }).optional(),
  failureCode: z.enum(["INVALID_CIK", "IDENTITY_NOT_CONFIGURED", "RATE_LIMITED", "HTTP_ERROR",
    "TIMEOUT", "BODY_TOO_LARGE", "NETWORK_ERROR", "INVALID_JSON", "INVALID_RESPONSE",
    "CIK_MISMATCH", "CONFLICTING_ACCESSION", "CAPTURE_INTERRUPTED"]).nullable(),
}).superRefine((payload, ctx) => {
  const invalid = payload.status === "unavailable"
    ? payload.company !== null || payload.retrievedAt !== null || payload.filings.length !== 0 || payload.failureCode === null
    : payload.company === null || payload.retrievedAt === null || payload.failureCode !== null
      || (payload.status === "empty" ? payload.filings.length !== 0 : payload.filings.length === 0);
  if (invalid) ctx.addIssue({ code: "custom", message: "Invalid evidence truth state." });
});
function normalizeReceipt(row: EvidenceReceipt): EvidenceReceipt {
  try {
    const payload = parsePersistedJson<unknown>(row.payload);
    const checked = storedPayloadSchema.safeParse(payload);
    if (!checked.success) throw new Error("Invalid persisted evidence payload");
    // Preserve all original fields and Date objects; only decode the JSON text.
    return { ...row, payload: payload as SecSubmissionsResult };
  } catch {
    throw new EvidenceRepositoryError("RECEIPT_INVALID", "Stored evidence payload could not be verified.");
  }
}

type GetDb = typeof getDb;
export function createEvidenceRepository(getDbFn: GetDb = getDb): EvidenceRepository {
  async function database() {
    const db = await getDbFn();
    if (!db) throw new EvidenceRepositoryError("DATABASE_UNAVAILABLE", "Evidence storage is unavailable.");
    return db;
  }
  async function findRequest(ownerId: number, requestId: string): Promise<EvidenceReceipt | null> {
    ownerId = ownerSchema.parse(ownerId); requestId = uuidSchema.parse(requestId);
    const db = await database();
    const [row] = await db.select().from(publicEvidenceReceipts).where(and(
      eq(publicEvidenceReceipts.ownerId, ownerId), eq(publicEvidenceReceipts.requestId, requestId),
    )).limit(1);
    return row ? normalizeReceipt(row) : null;
  }
  return {
    findRequest,
    async claimCapture(ownerId, requestId, subjectKey) {
      ownerId = ownerSchema.parse(ownerId); requestId = uuidSchema.parse(requestId);
      subjectKey = subjectSchema.parse(subjectKey);
      const db = await database();
      let status: CaptureClaim["status"] = "claimed";
      try {
        await db.insert(publicEvidenceCaptureClaims).values({ ownerId, requestId, subjectKey, startedAt: sql`UTC_TIMESTAMP(3)` });
      } catch (error) {
        if (!duplicate(error)) throw error;
        status = "pending";
      }
      const [claim] = await db.select().from(publicEvidenceCaptureClaims).where(and(
        eq(publicEvidenceCaptureClaims.ownerId, ownerId), eq(publicEvidenceCaptureClaims.requestId, requestId),
      )).limit(1);
      if (!claim || !(claim.startedAt instanceof Date) || !Number.isFinite(claim.startedAt.getTime())) {
        throw new EvidenceRepositoryError("RECEIPT_INVALID", "Capture claim could not be verified.");
      }
      if (claim.subjectKey !== subjectKey) throw new EvidenceRepositoryError("CONFLICT", "Request ID is already claimed for a different subject.");
      return { status, startedAt: claim.startedAt };
    },
    async setSecCooldown(until) {
      const untilMs = z.date().parse(until).getTime();
      if (untilMs < 0) throw new Error("Invalid SEC cooldown timestamp.");
      const db = await database();
      // Single atomic upsert serializes with all reservations on the global row.
      // It neither consumes quota nor shortens a cooldown set by another worker.
      await db.execute(sql`INSERT INTO public_evidence_budgets
        (budget_key, window_start, request_count, second_start, second_count, cooldown_until)
        VALUES ('sec-submissions:global', 0, 0, 0, 0, ${untilMs})
        ON DUPLICATE KEY UPDATE cooldown_until = GREATEST(cooldown_until, ${untilMs})`);
    },
    async append(input) {
      const parsed = appendSchema.parse(input);
      // Detach before awaiting I/O so callers cannot mutate a pending receipt.
      const data = structuredClone(parsed);
      const db = await database();
      const existing = await findRequest(data.ownerId, data.requestId);
      if (existing) return sameSubject(existing, data.subjectKey);
      const receipt: EvidenceReceipt = { ...data, id: randomUUID(), recordedAt: new Date() };
      try {
        await db.insert(publicEvidenceReceipts).values(receipt);
      } catch (error) {
        if (!duplicate(error)) throw error;
        // Concurrent insert winner is read outside a repeatable-read snapshot.
        const winner = await findRequest(data.ownerId, data.requestId);
        if (!winner) throw error;
        return sameSubject(winner, data.subjectKey);
      }
      return receipt;
    },
    async list(ownerId, subjectKey, limit = 20) {
      ownerId = ownerSchema.parse(ownerId); subjectKey = subjectSchema.parse(subjectKey);
      limit = z.number().int().min(1).max(100).parse(limit);
      const db = await database();
      const rows = await db.select().from(publicEvidenceReceipts).where(and(
        eq(publicEvidenceReceipts.ownerId, ownerId), eq(publicEvidenceReceipts.subjectKey, subjectKey),
      )).orderBy(desc(publicEvidenceReceipts.recordedAt), desc(publicEvidenceReceipts.id)).limit(limit);
      return rows.map(normalizeReceipt);
    },
    async get(ownerId, id) {
      ownerId = ownerSchema.parse(ownerId); id = uuidSchema.parse(id);
      const db = await database();
      const [row] = await db.select().from(publicEvidenceReceipts).where(and(
        eq(publicEvidenceReceipts.ownerId, ownerId), eq(publicEvidenceReceipts.id, id),
      )).limit(1);
      return row ? normalizeReceipt(row) : null;
    },
    reserveSecProviderBudget: () => reserve(),
    reserveFeedCaller: async ownerId => reserveFeedMinute(`public-feed:caller:${ownerSchema.parse(ownerId)}`, 30),
    reserveFeedProvider: async provider => reserveFeedMinute(`public-feed:provider:${feedProviderSchema.parse(provider)}`, 60),
    reserveSecBudget: async ownerId => reserve(ownerSchema.parse(ownerId)),
    async reserveCaptureAttempt(ownerId) {
      ownerId = ownerSchema.parse(ownerId);
      const db = await database();
      // Call after receipt recovery and before claiming. Admission remains charged
      // even if the later provider reservation is denied; these are separate quotas.
      await db.transaction(async tx => {
        // Fixed keys bound storage growth; global-first locking serializes workers.
        await tx.execute(sql`INSERT INTO public_evidence_budgets
          (budget_key, window_start, request_count, second_start, second_count)
          VALUES ('sec-capture-attempt:global', FLOOR(UNIX_TIMESTAMP()/60)*60, 1, 0, 0)
          ON DUPLICATE KEY UPDATE
            request_count = IF(window_start < FLOOR(UNIX_TIMESTAMP()/60)*60, 1, request_count + 1),
            window_start = GREATEST(window_start, FLOOR(UNIX_TIMESTAMP()/60)*60)`);
        const global = captureAttemptRow(await tx.execute(sql`SELECT window_start AS windowStart, request_count AS requestCount
          FROM public_evidence_budgets WHERE budget_key = 'sec-capture-attempt:global' FOR UPDATE`));
        if (global.requestCount > 60) throw new EvidenceRepositoryError("RATE_LIMITED", "Global capture admission budget exceeded.");
        const key = `sec-capture-attempt:owner:${ownerId}`;
        await tx.execute(sql`INSERT INTO public_evidence_budgets
          (budget_key, window_start, request_count, second_start, second_count)
          VALUES (${key}, ${global.windowStart}, 1, 0, 0)
          ON DUPLICATE KEY UPDATE
            request_count = IF(window_start < ${global.windowStart}, 1, request_count + 1),
            window_start = GREATEST(window_start, ${global.windowStart})`);
        const owner = captureAttemptRow(await tx.execute(sql`SELECT window_start AS windowStart, request_count AS requestCount
          FROM public_evidence_budgets WHERE budget_key = ${key} FOR UPDATE`));
        if (owner.requestCount > 10) throw new EvidenceRepositoryError("RATE_LIMITED", "Owner capture admission budget exceeded.");
        // Only admitted requests commit. Any denial/error rolls back both counts.
      });
    },
  };
  async function reserveFeedMinute(key: string, limit: number): Promise<void> {
    const db = await database();
    // Each caller shares one row across feeds; each provider shares one row
    // across callers and instances. No local fallback or rolling row creation.
    await db.transaction(async tx => {
      await tx.execute(sql`INSERT INTO public_evidence_budgets
        (budget_key, window_start, request_count, second_start, second_count)
        VALUES (${key}, FLOOR(UNIX_TIMESTAMP()/60)*60, 1, 0, 0)
        ON DUPLICATE KEY UPDATE
          request_count = IF(window_start < FLOOR(UNIX_TIMESTAMP()/60)*60, 1, request_count + 1),
          window_start = GREATEST(window_start, FLOOR(UNIX_TIMESTAMP()/60)*60)`);
      const state = captureAttemptRow(await tx.execute(sql`SELECT window_start AS windowStart, request_count AS requestCount
        FROM public_evidence_budgets WHERE budget_key = ${key} FOR UPDATE`));
      if (state.requestCount > limit) throw new EvidenceRepositoryError("RATE_LIMITED", "Public feed budget exceeded.");
      // Throwing rolls back the increment; successful admission commits before fetch.
    });
  }
  async function reserve(ownerId?: number): Promise<void> {
      const db = await database();
      await db.transaction(async tx => {
        // Always lock global first. The database clock defines fixed windows.
        // Count updates precede timestamp updates (MySQL assignment ordering).
        await tx.execute(sql`INSERT INTO public_evidence_budgets
          (budget_key, window_start, request_count, second_start, second_count)
          VALUES ('sec-submissions:global', FLOOR(UNIX_TIMESTAMP()/60)*60, 1, FLOOR(UNIX_TIMESTAMP()), 1)
          ON DUPLICATE KEY UPDATE
            request_count = IF(window_start < FLOOR(UNIX_TIMESTAMP()/60)*60, 1, request_count + 1),
            second_count = IF(second_start < FLOOR(UNIX_TIMESTAMP()), 1, second_count + 1),
            window_start = GREATEST(window_start, FLOOR(UNIX_TIMESTAMP()/60)*60),
            second_start = GREATEST(second_start, FLOOR(UNIX_TIMESTAMP()))`);
        const globalResult = await tx.execute(sql`SELECT window_start AS windowStart, request_count AS requestCount,
          second_start AS secondStart, second_count AS secondCount, cooldown_until AS cooldownUntil,
          FLOOR(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3))*1000) AS dbNowMs
          FROM public_evidence_budgets WHERE budget_key = 'sec-submissions:global' FOR UPDATE`);
        const global = budgetRow(globalResult);
        if (global.cooldownUntil > global.dbNowMs) throw new EvidenceRepositoryError("RATE_LIMITED", "SEC provider cooldown is active.");
        if (global.requestCount > 30 || global.secondCount > 1) throw new EvidenceRepositoryError("RATE_LIMITED", "SEC global capture budget exceeded.");
        if (ownerId === undefined) return;
        const key = `sec-submissions:owner:${ownerId}`;
        await tx.execute(sql`INSERT INTO public_evidence_budgets
          (budget_key, window_start, request_count, second_start, second_count)
          VALUES (${key}, ${global.windowStart}, 1, ${global.secondStart}, 1)
          ON DUPLICATE KEY UPDATE
            request_count = IF(window_start < ${global.windowStart}, 1, request_count + 1),
            second_count = IF(second_start < ${global.secondStart}, 1, second_count + 1),
            window_start = GREATEST(window_start, ${global.windowStart}),
            second_start = GREATEST(second_start, ${global.secondStart})`);
        const ownerResult = await tx.execute(sql`SELECT window_start AS windowStart, request_count AS requestCount,
          second_start AS secondStart, second_count AS secondCount, cooldown_until AS cooldownUntil,
          FLOOR(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3))*1000) AS dbNowMs
          FROM public_evidence_budgets WHERE budget_key = ${key} FOR UPDATE`);
        if (budgetRow(ownerResult).requestCount > 6) throw new EvidenceRepositoryError("RATE_LIMITED", "SEC owner capture budget exceeded.");
        // Exceptions roll back both increments. Commit before outbound fetch.
      });
  }
}

function budgetRow(result: unknown): { windowStart: number; requestCount: number; secondStart: number; secondCount: number; cooldownUntil: number; dbNowMs: number } {
  const row = (result as [Record<string, unknown>[]])?.[0]?.[0];
  const parsed = z.object({
    windowStart: z.coerce.number().int().nonnegative(), requestCount: z.coerce.number().int().positive(),
    secondStart: z.coerce.number().int().nonnegative(), secondCount: z.coerce.number().int().positive(),
    cooldownUntil: z.coerce.number().int().nonnegative(), dbNowMs: z.coerce.number().int().nonnegative(),
  }).safeParse(row);
  if (!parsed.success) throw new EvidenceRepositoryError("BUDGET_STATE_INVALID", "SEC budget state could not be verified.");
  return parsed.data;
}

function captureAttemptRow(result: unknown): { windowStart: number; requestCount: number } {
  const row = (result as [Record<string, unknown>[]])?.[0]?.[0];
  const integer = z.union([z.number(), z.string().regex(/^\d+$/)])
    .transform(value => Number(value)).pipe(z.number().int().nonnegative());
  const parsed = z.object({ windowStart: integer, requestCount: integer.refine(value => value > 0) }).safeParse(row);
  if (!parsed.success) throw new EvidenceRepositoryError("BUDGET_STATE_INVALID", "Capture admission state could not be verified.");
  return parsed.data;
}

export const evidenceRepository = createEvidenceRepository();
export const reserveFeedCaller = (ownerId: number): Promise<void> => evidenceRepository.reserveFeedCaller(ownerId);
export const reserveFeedProvider = (provider: FeedProvider): Promise<void> => evidenceRepository.reserveFeedProvider(provider);
export const reserveCaptureAttempt = (ownerId: number): Promise<void> => evidenceRepository.reserveCaptureAttempt(ownerId);
export const reserveSecBudget = (ownerId: number): Promise<void> => evidenceRepository.reserveSecBudget(ownerId);
export const reserveSecProviderBudget = (): Promise<void> => evidenceRepository.reserveSecProviderBudget();
export const setSecCooldown = (until: Date): Promise<void> => evidenceRepository.setSecCooldown(until);

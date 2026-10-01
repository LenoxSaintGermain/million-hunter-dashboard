import { TRPCError } from "@trpc/server";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { z } from "zod";
import { deals, signals, memos, outreach, activityLog } from "../drizzle/schema";
import { coerceRows, getDb } from "./db";

/** Pass ctx.user.id, never a caller-supplied owner or role. No admin bypass. */
export type PrivateDealPrincipal = { ownerUserId: number };
const idSchema = z.number().int().positive().max(2147483647);
const pagination = z.object({ limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).default(0) });
const stageSchema = z.enum(deals.stage.enumValues);
const amount = z.number().finite().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional();
export const privateDealCreateSchema = z.object({
  name: z.string().trim().min(1).max(255), source: z.string().trim().min(1).max(64).default("manual"),
  description: z.string().max(50000).optional(), industry: z.string().max(100).optional(),
  location: z.string().max(255).optional(), listingUrl: z.string().url().max(4000).optional(),
  askingPrice: amount, revenue: amount, cashFlow: z.number().finite().int().safe().optional(),
  ebitda: z.number().finite().int().safe().optional(), multiple: z.number().finite().nonnegative().optional(),
  employees: z.number().int().nonnegative().max(2147483647).optional(),
  yearEstablished: z.number().int().min(1).max(9999).optional(),
}).strict();
export type PrivateDealCreateInput = z.input<typeof privateDealCreateSchema>;
function owner(principal: PrivateDealPrincipal) { return idSchema.parse(principal.ownerUserId); }
function scope(ownerUserId: number, dealId?: number) {
  return and(eq(deals.ownerUserId, ownerUserId), eq(deals.isArchived, false),
    dealId === undefined ? undefined : eq(deals.id, idSchema.parse(dealId)));
}
async function database() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Workspace unavailable." });
  return db;
}
const notFound = () => new TRPCError({ code: "NOT_FOUND", message: "Deal not found." });

export async function listPrivateDeals(principal: PrivateDealPrincipal, options: { limit?: number; offset?: number } = {}) {
  const ownerId = owner(principal), page = pagination.parse(options), db = await database();
  return coerceRows(await db.select().from(deals).where(scope(ownerId)).orderBy(desc(deals.createdAt), desc(deals.id)).limit(page.limit).offset(page.offset));
}
export async function getPrivateDeal(principal: PrivateDealPrincipal, dealId: number) {
  const predicate = scope(owner(principal), dealId), db = await database();
  const [deal] = await db.select().from(deals).where(predicate).limit(1);
  if (!deal) throw notFound();
  return coerceRows([deal])[0]!;
}
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
export async function createPrivateDeal(principal: PrivateDealPrincipal, input: PrivateDealCreateInput) {
  const ownerUserId = owner(principal), data = privateDealCreateSchema.parse(input), db = await database();
  try {
    // Global name/source uniqueness still exists. Never update or return its conflicting row.
    const [result] = await db.insert(deals).values({ ...data, ownerUserId, stage: "new", isArchived: false, isSynthetic: false });
    return { id: idSchema.parse(Number(result.insertId)) };
  } catch (error) {
    if (duplicate(error)) throw new TRPCError({ code: "CONFLICT", message: "This deal could not be created because its name and source conflict with an existing record." });
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Deal could not be created." });
  }
}
export async function updatePrivateDealStage(principal: PrivateDealPrincipal, dealId: number, stage: typeof deals.$inferSelect.stage) {
  const predicate = scope(owner(principal), dealId), validatedStage = stageSchema.parse(stage);
  await getPrivateDeal(principal, dealId);
  const db = await database();
  await db.update(deals).set({ stage: validatedStage, updatedAt: new Date() }).where(predicate);
  return getPrivateDeal(principal, dealId);
}
export async function getPrivateDealStats(principal: PrivateDealPrincipal) {
  const predicate = scope(owner(principal)), db = await database();
  const [row] = await db.select({
    total: sql<number>`count(*)`,
    highPriority: sql<number>`coalesce(sum(case when ${deals.stage} in ('high_priority', 'in_diligence') then 1 else 0 end), 0)`,
    avgScore: sql<number>`coalesce(avg(${deals.score}), 0)`,
    totalPipelineValue: sql<number>`coalesce(sum(${deals.askingPrice}), 0)`,
  }).from(deals).where(predicate);
  return { total: Number(row?.total ?? 0), highPriority: Number(row?.highPriority ?? 0), avgScore: Number(row?.avgScore ?? 0), totalPipelineValue: Number(row?.totalPipelineValue ?? 0) };
}

/** Related reads check the parent first AND join the owner predicate to prevent a transfer race. */
export async function listPrivateDealSignals(principal: PrivateDealPrincipal, dealId: number) {
  await getPrivateDeal(principal, dealId);
  const db = await database();
  return coerceRows(await db.select(getTableColumns(signals)).from(signals).innerJoin(deals, eq(signals.dealId, deals.id))
    .where(scope(owner(principal), dealId)).orderBy(desc(signals.analyzedAt), desc(signals.id)).limit(100));
}
export async function listPrivateDealMemos(principal: PrivateDealPrincipal, dealId?: number) {
  const predicate = scope(owner(principal), dealId);
  if (dealId !== undefined) await getPrivateDeal(principal, dealId);
  const db = await database();
  return db.select(getTableColumns(memos)).from(memos).innerJoin(deals, eq(memos.dealId, deals.id))
    .where(predicate).orderBy(desc(memos.version), desc(memos.id)).limit(100);
}
export async function listPrivateDealOutreach(principal: PrivateDealPrincipal, dealId?: number) {
  const predicate = scope(owner(principal), dealId);
  if (dealId !== undefined) await getPrivateDeal(principal, dealId);
  const db = await database();
  return db.select(getTableColumns(outreach)).from(outreach).innerJoin(deals, eq(outreach.dealId, deals.id))
    .where(predicate).orderBy(desc(outreach.updatedAt), desc(outreach.id)).limit(100);
}

/** Guard by contact id; callers must retain owner predicates on subsequent writes. */
export async function getPrivateOutreach(principal: PrivateDealPrincipal, id: number) {
  const predicate = and(scope(owner(principal)), eq(outreach.id, idSchema.parse(id))), db = await database();
  const [record] = await db.select(getTableColumns(outreach)).from(outreach).innerJoin(deals, eq(outreach.dealId, deals.id))
    .where(predicate).limit(1);
  if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Outreach not found." });
  return record;
}

export async function listPrivateDealActivity(principal: PrivateDealPrincipal, options: { limit?: number; offset?: number } = {}) {
  const predicate = scope(owner(principal)), page = pagination.parse(options), db = await database();
  return db.select(getTableColumns(activityLog)).from(activityLog).innerJoin(deals, eq(activityLog.dealId, deals.id))
    .where(predicate).orderBy(desc(activityLog.createdAt), desc(activityLog.id)).limit(page.limit).offset(page.offset);
}
export async function getPrivateOutreachStats(principal: PrivateDealPrincipal) {
  const predicate = scope(owner(principal)), db = await database();
  const [row] = await db.select({
    totalSent: sql<number>`coalesce(sum(case when ${outreach.status} in ('sent','opened','replied','meeting_scheduled','closed') then 1 else 0 end),0)`,
    responded: sql<number>`coalesce(sum(case when ${outreach.status} in ('replied','meeting_scheduled','closed') then 1 else 0 end),0)`,
    scheduled: sql<number>`coalesce(sum(case when ${outreach.status} = 'meeting_scheduled' then 1 else 0 end),0)`,
  }).from(outreach).innerJoin(deals, eq(outreach.dealId, deals.id)).where(predicate);
  return { totalSent: Number(row?.totalSent ?? 0), responded: Number(row?.responded ?? 0), scheduled: Number(row?.scheduled ?? 0) };
}
export async function archivePrivateDeal(principal: PrivateDealPrincipal, dealId: number) {
  const predicate = scope(owner(principal), dealId);
  await getPrivateDeal(principal, dealId);
  const db = await database();
  const [result] = await db.update(deals).set({ isArchived: true, updatedAt: new Date() }).where(predicate);
  if (!result.affectedRows) throw notFound();
  return { success: true as const };
}

/** Ownership is evaluated in the UPDATE, not just in an earlier guard. */
export async function updatePrivateOutreachStatus(
  principal: PrivateDealPrincipal, id: number,
  status: typeof outreach.$inferSelect.status, notes?: string,
) {
  const ownerId = owner(principal), outreachId = idSchema.parse(id);
  const validatedStatus = z.enum(outreach.status.enumValues).parse(status);
  const validatedNotes = z.string().max(50000).optional().parse(notes);
  const db = await database();
  const [result] = await db.update(outreach).set({
    status: validatedStatus,
    ...(validatedNotes === undefined ? {} : { notes: validatedNotes }),
    // Preserve the legacy updater's timestamp behavior for every status change.
    lastContactedAt: new Date(), updatedAt: new Date(),
  }).where(and(eq(outreach.id, outreachId),
    sql`${outreach.dealId} in (select ${deals.id} from ${deals} where ${scope(ownerId)})`));
  // MySQL can report zero changed rows for an identical repeat. A scoped read
  // distinguishes that from a missing/foreign/archived parent without leaking it.
  if (!result.affectedRows) await getPrivateOutreach(principal, outreachId);
  return { success: true as const };
}

export async function updatePrivateDealScore(
  principal: PrivateDealPrincipal, id: number, score: number, redFlags: number,
) {
  const predicate = scope(owner(principal), id);
  const validatedScore = z.number().finite().min(0).max(1).parse(score);
  const redFlagCount = z.number().int().min(0).max(2147483647).parse(redFlags);
  const db = await database();
  const [result] = await db.update(deals).set({ score: validatedScore, redFlagCount, updatedAt: new Date() }).where(predicate);
  if (!result.affectedRows) await getPrivateDeal(principal, id);
  return { success: true as const };
}

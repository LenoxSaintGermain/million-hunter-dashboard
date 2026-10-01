import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { scanJobs, type InsertScanJob } from "../drizzle/schema";
import { getDb } from "./db";
import { parsePersistedJson } from "../shared/persistedJson";

const id = z.number().int().positive().max(2147483647);
const missing = () => new TRPCError({ code: "NOT_FOUND", message: "Search not found." });
async function database() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Search workspace unavailable." });
  return db;
}
const scope = (owner: number, job?: number) => and(eq(scanJobs.ownerUserId, id.parse(owner)), job === undefined ? undefined : eq(scanJobs.id, id.parse(job)));
const present = (row: typeof scanJobs.$inferSelect) => ({ ...row, sources: parsePersistedJson(row.sources) });

export async function createPrivateScanJob(ownerUserId: number, input: Omit<InsertScanJob, "id" | "ownerUserId">) {
  const owner = id.parse(ownerUserId);
  // Explicit allowlist prevents accidental caller-controlled ownership or IDs.
  const data = z.object({
    status: z.enum(["pending", "running"]).default("pending"),
    sources: z.array(z.string().min(1).max(128)).max(20),
    startedAt: z.date().optional(), currentPhase: z.string().max(128).optional(),
    phaseDetail: z.string().max(512).optional(), progressPct: z.number().int().min(0).max(100).optional(),
  }).strict().parse(input);
  const db = await database();
  const [result] = await db.insert(scanJobs).values({ ...data, ownerUserId: owner });
  return { id: id.parse(Number(result.insertId)) };
}
export async function getPrivateScanJob(ownerUserId: number, jobId: number) {
  const predicate = scope(ownerUserId, jobId), db = await database();
  const [row] = await db.select().from(scanJobs).where(predicate).limit(1);
  if (!row) throw missing();
  return present(row);
}
export async function getLatestPrivateScanJob(ownerUserId: number) {
  const predicate = scope(ownerUserId), db = await database();
  const [row] = await db.select().from(scanJobs).where(predicate).orderBy(desc(scanJobs.createdAt), desc(scanJobs.id)).limit(1);
  return row ? present(row) : null;
}
const patchSchema = z.object({
  status: z.enum(["pending", "running", "completed", "failed"]).optional(),
  listingsFound: z.number().int().nonnegative().optional(), listingsQualified: z.number().int().nonnegative().optional(),
  dealsScored: z.number().int().nonnegative().optional(), progressPct: z.number().int().min(0).max(100).optional(),
  currentPhase: z.string().max(128).optional(), phaseDetail: z.string().max(512).optional(),
  errorMessage: z.string().max(4000).optional(), completedAt: z.date().optional(),
}).strict();
export async function updatePrivateScanJob(ownerUserId: number, jobId: number, patch: z.infer<typeof patchSchema>) {
  const predicate = scope(ownerUserId, jobId), data = patchSchema.parse(patch), db = await database();
  if (!Object.keys(data).length) throw new TRPCError({ code: "BAD_REQUEST", message: "No search update supplied." });
  const [result] = await db.update(scanJobs).set(data).where(predicate);
  if (!result.affectedRows) await getPrivateScanJob(ownerUserId, jobId);
}

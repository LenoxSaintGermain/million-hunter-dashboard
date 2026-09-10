import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { apertureDecisionRuns } from "../../drizzle/schema";
import { apertureUnderwritingJobs } from "../../drizzle/apertureUnderwritingJobSchema";
import { jobClaimDisposition, UNDERWRITING_JOB_LEASE_MS } from "../../shared/underwritingJob";
import { parsePersistedJson } from "../../shared/persistedJson";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export async function readUnderwritingJob(db: Db, userId: number, decisionRunId: number, decisionRevisionId: number) {
  const [row] = await db.select().from(apertureUnderwritingJobs).where(and(
    eq(apertureUnderwritingJobs.userId, userId), eq(apertureUnderwritingJobs.decisionRunId, decisionRunId),
    eq(apertureUnderwritingJobs.decisionRevisionId, decisionRevisionId),
  )).orderBy(desc(apertureUnderwritingJobs.updatedAt), desc(apertureUnderwritingJobs.id)).limit(1);
  const request = row ? parsePersistedJson(row.request) : null;
  return row ? { ...row, request, workKind: request?.discovery ? "discovery" as const : "underwriting" as const } : null;
}

export async function claimUnderwritingJob(db: Db, input: {
  userId: number; decisionRunId: number; decisionRevisionId: number; requestKey: string; retryJobId?: number;
  request: typeof apertureUnderwritingJobs.$inferInsert.request;
  maxAttempts?: number;
}) {
  return db.transaction(async (tx) => {
    // Serialize claims with the same authoritative mission lock used by publication.
    const [mission] = await tx.select().from(apertureDecisionRuns).where(and(
      eq(apertureDecisionRuns.id, input.decisionRunId), eq(apertureDecisionRuns.userId, input.userId),
      eq(apertureDecisionRuns.currentRevisionId, input.decisionRevisionId),
    )).for("update").limit(1);
    if (!mission || mission.researchRunId != null) throw new TRPCError({ code: "CONFLICT", message: "The mission changed. Open its current revision." });
    const rows = await tx.select().from(apertureUnderwritingJobs).where(and(
      eq(apertureUnderwritingJobs.userId, input.userId), eq(apertureUnderwritingJobs.decisionRunId, input.decisionRunId),
    )).for("update");
    const now = Date.now();
    const prior = rows.find((row) => row.requestKey === input.requestKey) ?? null;
    const active = rows.find((row) => row.state === "running" && row.leaseUntil > now);
    if (active) throw new TRPCError({ code: "CONFLICT", message: "This mission already has analysis in progress. View its saved progress; do not start another analysis." });
    const disposition = jobClaimDisposition(prior, now, input.retryJobId);
    if (disposition === "reuse") return { job: prior!, reused: true };
    if (disposition === "needs_explicit_retry") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The previous analysis did not finish. Inspect its saved progress and explicitly resume that job." });
    if (prior && input.maxAttempts != null && prior.attempt >= input.maxAttempts) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This analysis reached its attempt limit. Review the Mission before authorizing more work." });
    const attemptToken = randomUUID();
    const update = { state: "running" as const, milestone: "market_evidence" as const, attemptToken, leaseUntil: now + UNDERWRITING_JOB_LEASE_MS, failure: null, updatedAt: now };
    if (prior) {
      await tx.update(apertureUnderwritingJobs).set({ ...update, attempt: prior.attempt + 1 }).where(eq(apertureUnderwritingJobs.id, prior.id));
      return { job: { ...prior, ...update, attempt: prior.attempt + 1 }, reused: false };
    }
    const [inserted] = await tx.insert(apertureUnderwritingJobs).values({ userId: input.userId, decisionRunId: input.decisionRunId, decisionRevisionId: input.decisionRevisionId, requestKey: input.requestKey, request: input.request, ...update, createdAt: now });
    const [job] = await tx.select().from(apertureUnderwritingJobs).where(eq(apertureUnderwritingJobs.id, Number((inserted as any).insertId))).limit(1);
    if (!job) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Analysis progress could not be persisted. No analysis was started." });
    return { job, reused: false };
  });
}

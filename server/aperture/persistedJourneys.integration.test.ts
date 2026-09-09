import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { users, brokerOrders, apertureDecisionRuns, apertureAttentionBaselines, apertureUnderwritingRuns, apertureUnderwritingRevisions } from "../../drizzle/schema";
import { apertureMissionDrafts, apertureMissionDraftRevisions } from "../../drizzle/apertureMissionDraftSchema";
import { apertureUnderwritingJobs } from "../../drizzle/apertureUnderwritingJobSchema";
import { createMissionDraftService, missionDraftStore } from "./missionDraftRouter";
import { claimUnderwritingJob, readUnderwritingJob } from "./underwritingJobs";
import { emptyMissionDraftValues } from "../../shared/apertureMissionDraft";
import { attentionBaselineToken } from "../../shared/apertureAttention";
import { underwritingJobStatus } from "../../shared/underwritingJob";
import { parsePersistedJson } from "../../shared/persistedJson";
import { apertureRouter } from "../apertureRouter";
import type { CapitalObjective } from "../../shared/playUnderwriting";

const raw = process.env.DATABASE_URL;
const url = raw ? new URL(raw) : null;
const local = url?.hostname === "127.0.0.1" && url.port === "3307" && url.pathname === "/capital_aperture_uat_9c18799" && process.env.ISOLATED_UAT_MODE === "true";
if (raw && !local) throw new Error("Refusing persistence UAT outside the exact isolated localhost database.");

describe.skipIf(!local)("real-database interrupted and returning operator journeys", () => {
  let db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  let owners: (typeof users.$inferSelect)[] = [];
  let decisionRunId: number;
  let baselineOrders: number;
  const objective: CapitalObjective = { deployableCapitalCents: 2_500_000, targetProfitCents: 600_000, targetPeriod: "week", maxPlannedLossCents: 25_000, holdingPeriods: ["swing"], instrumentPreference: "shares" };
  beforeAll(async () => {
    db = (await getDb())!;
    const [counts] = await db.select({ count: sql<number>`count(*)` }).from(brokerOrders);
    baselineOrders = Number(counts.count);
    for (let i = 0; i < 2; i++) {
      const openId = `uat_journey_${randomUUID()}`;
      await db.insert(users).values({ openId, name: "Illustrative journey test", role: "capital_operator" });
      const [owner] = await db.select().from(users).where(eq(users.openId, openId));
      owners.push(owner);
    }
    const [inserted] = await db.insert(apertureDecisionRuns).values({ userId: owners[0].id, canonicalThesisId: 1, capitalThesisId: 1, accountId: 1, currentRevisionId: 991122, createdAt: Date.now(), updatedAt: Date.now() });
    decisionRunId = Number(inserted.insertId);
  });
  afterAll(async () => {
    if (!db || !owners.length) return;
    const ids = owners.map((owner) => owner.id);
    // Exact disposable fixture owners only; no application or broker history.
    await db.delete(apertureUnderwritingJobs).where(inArray(apertureUnderwritingJobs.userId, ids));
    await db.delete(apertureMissionDraftRevisions).where(inArray(apertureMissionDraftRevisions.userId, ids));
    await db.delete(apertureMissionDrafts).where(inArray(apertureMissionDrafts.userId, ids));
    await db.delete(apertureAttentionBaselines).where(inArray(apertureAttentionBaselines.userId, ids));
    await db.delete(apertureDecisionRuns).where(inArray(apertureDecisionRuns.userId, ids));
    await db.delete(users).where(inArray(users.id, ids));
  });
  it("resumes raw incomplete inputs on a second device and serializes concurrent saves", async () => {
    const service = createMissionDraftService(missionDraftStore);
    const values = { ...emptyMissionDraftValues(), newTitle: "Illustrative MRVL thesis", capital: "2,000.", maxLoss: "", activeSection: 2 as const };
    const saved = await service.save(owners[0].id, { expectedVersion: 0, values });
    expect((await createMissionDraftService(missionDraftStore).get(owners[0].id))?.values).toEqual(values);
    expect(await service.get(owners[1].id)).toBeNull();
    const attempts = await Promise.allSettled(["1000", "2000"].map((maxLoss) => service.save(owners[0].id, { expectedVersion: saved.version, values: { ...values, maxLoss } })));
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    const revisions = await db.select().from(apertureMissionDraftRevisions).where(eq(apertureMissionDraftRevisions.userId, owners[0].id));
    expect(revisions).toHaveLength(2);
  });
  it("claims exactly one analysis across simultaneous requests and requires explicit recovery", async () => {
    const input = { userId: owners[0].id, decisionRunId, decisionRevisionId: 991122, requestKey: "journey-request", request: { objective, requestedPlayCount: 3 as const, appendRevision: false } };
    const results = await Promise.allSettled([claimUnderwritingJob(db, input), claimUnderwritingJob(db, input)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const job = (await readUnderwritingJob(db, owners[0].id, decisionRunId, 991122))!;
    expect(await readUnderwritingJob(db, owners[1].id, decisionRunId, 991122)).toBeNull();
    expect(underwritingJobStatus(job, Date.now()).state).toBe("running");
    await db.update(apertureUnderwritingJobs).set({ leaseUntil: 1 }).where(eq(apertureUnderwritingJobs.id, job.id));
    await expect(claimUnderwritingJob(db, input)).rejects.toThrow("explicitly resume");
    const resumed = await claimUnderwritingJob(db, { ...input, retryJobId: job.id });
    expect(resumed.job.id).toBe(job.id);
    expect(resumed.job.attempt).toBe(2);
    expect(resumed.job.attemptToken).not.toBe(job.attemptToken);
  });
  it("merges two devices' seen items without stale overwrite or lifecycle mutations", async () => {
    const caller = apertureRouter.createCaller({ user: owners[1], req: {} as any, res: {} as any });
    const timestamp = Date.now() - 1000;
    for (const snapshot of [
      { capturedAt: timestamp, items: [{ key: "play:a", fingerprint: "new-a" }] },
      { capturedAt: timestamp + 1, items: [{ key: "play:b", fingerprint: "b" }] },
      { capturedAt: timestamp - 1, items: [{ key: "play:a", fingerprint: "old-a" }] },
    ]) await caller.desk.markSeen({ snapshot, token: attentionBaselineToken(snapshot) });
    const [baseline] = await db.select().from(apertureAttentionBaselines).where(eq(apertureAttentionBaselines.userId, owners[1].id));
    expect(parsePersistedJson(baseline.snapshot).items.map((item) => [item.key, item.fingerprint])).toEqual([["play:a", "new-a"], ["play:b", "b"]]);
    const before = await db.select().from(apertureUnderwritingJobs).where(eq(apertureUnderwritingJobs.userId, owners[0].id));
    await caller.underwriter.status({ decisionRunId, decisionRevisionId: 991122 });
    const after = await db.select().from(apertureUnderwritingJobs).where(eq(apertureUnderwritingJobs.userId, owners[0].id));
    expect(after).toEqual(before);
    const [counts] = await db.select({ count: sql<number>`count(*)` }).from(brokerOrders);
    expect(Number(counts.count)).toBe(baselineOrders);
  });

  it("reopens the completed browser fixture through real router reads without new analysis or orders", async () => {
    const [owner] = await db.select().from(users).where(eq(users.openId, "uat_guided_20260909"));
    // This receipt was created deliberately in the browser, not fabricated by
    // a read test. Run --seed and the Mission UAT first for this acceptance lane.
    expect(owner, "Complete the labeled browser Mission fixture before this integration lane").toBeDefined();
    const caller = apertureRouter.createCaller({ user: owner, req: {} as any, res: {} as any });
    const before = await db.select().from(apertureUnderwritingJobs).where(eq(apertureUnderwritingJobs.userId, owner.id));
    const completed = before.filter((job) => job.state === "complete").sort((a, b) => b.updatedAt - a.updatedAt)[0];
    expect(completed).toBeDefined();
    const readResult = await caller.underwriter.get({ decisionRunId: completed!.decisionRunId });
    expect(readResult?.objective.holdingPeriods).toEqual(["swing"]);
    expect(readResult?.feasibility.requiredReturnPct).toBe(24);
    expect(readResult?.noTrade).not.toBeNull();
    const receipt = await caller.runway.latest({ decisionRunId: completed!.decisionRunId, revisionId: completed!.decisionRevisionId });
    expect(receipt.latest && "holdingPeriods" in receipt.latest && receipt.latest.holdingPeriods).toEqual(["swing"]);
    const desk = await caller.desk.summary();
    expect(desk.attention.primary).toBeNull();
    expect(desk.attention.entryState).toBe("check_in");
    const after = await db.select().from(apertureUnderwritingJobs).where(eq(apertureUnderwritingJobs.userId, owner.id));
    expect(after).toEqual(before);
    const [head] = await db.select().from(apertureUnderwritingRuns).where(eq(apertureUnderwritingRuns.decisionRunId, completed!.decisionRunId));
    const revisions = await db.select().from(apertureUnderwritingRevisions).where(eq(apertureUnderwritingRevisions.underwritingRunId, head.id));
    expect(revisions).toHaveLength(2);
    const ordered = revisions.sort((a, b) => a.version - b.version);
    // Explicit browser revision fixed the new scope; the original audit record
    // must retain the old scope rather than being silently rewritten.
    expect(parsePersistedJson(parsePersistedJson(ordered[0].objective).holdingPeriods)).toEqual(["intraday"]);
    expect(parsePersistedJson(ordered[1].objective).holdingPeriods).toEqual(["swing"]);
    const [counts] = await db.select({ count: sql<number>`count(*)` }).from(brokerOrders);
    expect(Number(counts.count)).toBe(baselineOrders);
  });
});

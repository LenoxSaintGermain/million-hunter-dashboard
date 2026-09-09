import { beforeAll, beforeEach, afterEach, afterAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import http from "node:http";
import https from "node:https";
import { getDb } from "../db";
import {
  users, brokerOrders, thesisCompilations, capitalTheses, portfolioAccounts,
  apertureDecisionRuns, apertureDecisionRevisions, apertureAttentionBaselines,
  apertureUnderwritingRuns, apertureUnderwritingRevisions, apertureRuns,
  apertureCandidates, apertureEvidenceReviews, aperturePendingOutcomes,
} from "../../drizzle/schema";
import { apertureMissionDrafts, apertureMissionDraftRevisions } from "../../drizzle/apertureMissionDraftSchema";
import { apertureUnderwritingJobs } from "../../drizzle/apertureUnderwritingJobSchema";
import { claimUnderwritingJob, readUnderwritingJob } from "./underwritingJobs";
import { emptyMissionDraftValues } from "../../shared/apertureMissionDraft";
import { attentionBaselineToken, type ApertureAttentionBriefing } from "../../shared/apertureAttention";
import { mayPublishUnderwriting } from "../../shared/underwritingJob";
import { parsePersistedJson } from "../../shared/persistedJson";
import { underwritePlayCandidates, type CapitalObjective, type MarketRegimeSnapshot } from "../../shared/playUnderwriting";
import { apertureRouter } from "../apertureRouter";

// Never inherit .env implicitly. The harness supplies this exact isolated target.
const raw = process.env.DATABASE_URL;
const url = raw ? new URL(raw) : null;
const local = url?.protocol === "mysql:" && url.hostname === "127.0.0.1" && url.port === "3307"
  && url.pathname === "/capital_aperture_uat_9c18799" && !url.search && !url.hash
  && process.env.ISOLATED_UAT_MODE === "true";
if (raw && !local) throw new Error("Refusing persistence UAT outside the exact isolated localhost database.");

const NOW = Date.UTC(2026, 8, 9, 14);
const objective: CapitalObjective = {
  deployableCapitalCents: 2_500_000, targetProfitCents: 600_000, targetPeriod: "week",
  maxPlannedLossCents: 25_000, holdingPeriods: ["swing"], instrumentPreference: "shares",
};
type Owner = typeof users.$inferSelect;
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
const attentionItems = (briefing: ApertureAttentionBriefing) => [
  ...(briefing.primary ? [briefing.primary] : []), ...briefing.otherCritical, ...briefing.otherAttention,
];

describe.skipIf(!local)("real-database interrupted and returning operator journeys", () => {
  let db: Db;
  let owners: Owner[];
  let ownerIds: number[];
  let expectedOrders: (typeof brokerOrders.$inferSelect)[];
  const networkAttempt = vi.fn(() => { throw new Error("Provider/HTTP calls are forbidden in persistence-only UAT."); });
  const callerFor = (owner: Owner) => apertureRouter.createCaller({ user: owner, req: {} as any, res: {} as any });
  const ordersForOwners = () => db.select().from(brokerOrders).where(inArray(brokerOrders.userId, ownerIds)).orderBy(brokerOrders.id);

  beforeAll(async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    vi.stubGlobal("fetch", networkAttempt);
    vi.spyOn(http, "request").mockImplementation(networkAttempt);
    vi.spyOn(http, "get").mockImplementation(networkAttempt);
    vi.spyOn(https, "request").mockImplementation(networkAttempt);
    vi.spyOn(https, "get").mockImplementation(networkAttempt);
    db = (await getDb())!;
    if (!db) throw new Error("Isolated database unavailable; do not substitute another target.");
  });
  beforeEach(async () => {
    owners = []; ownerIds = []; expectedOrders = [];
    networkAttempt.mockClear();
    // Per-test owners support shuffled runs and parallel harness invocations.
    // UUIDs isolate identities, not expected business behavior.
    for (let index = 0; index < 2; index++) {
      const openId = "uat_disposable_journey_" + randomUUID();
      const [inserted] = await db.insert(users).values({ openId, name: "Illustrative disposable journey", role: "capital_operator" });
      const id = Number(inserted.insertId);
      ownerIds.push(id); // track before later setup can fail
      const [owner] = await db.select().from(users).where(eq(users.id, id));
      owners.push(owner);
    }
  });
  afterEach(async () => {
    if (!db || !ownerIds?.length) return;
    try {
      expect(networkAttempt).not.toHaveBeenCalled();
      // Full owner-scoped rows catch order updates as well as inserts. A global
      // count would race the separate browser operator's legitimate activity.
      expect(await ordersForOwners()).toEqual(expectedOrders);
    } finally {
      await db.transaction(async (tx) => {
        const runs = await tx.select({ id: apertureDecisionRuns.id }).from(apertureDecisionRuns).where(inArray(apertureDecisionRuns.userId, ownerIds));
        const underwriting = await tx.select({ id: apertureUnderwritingRuns.id }).from(apertureUnderwritingRuns).where(inArray(apertureUnderwritingRuns.userId, ownerIds));
        const research = await tx.select({ id: apertureRuns.id }).from(apertureRuns).where(inArray(apertureRuns.userId, ownerIds));
        await tx.delete(apertureUnderwritingJobs).where(inArray(apertureUnderwritingJobs.userId, ownerIds));
        if (underwriting.length) await tx.delete(apertureUnderwritingRevisions).where(inArray(apertureUnderwritingRevisions.underwritingRunId, underwriting.map((row) => row.id)));
        await tx.delete(apertureUnderwritingRuns).where(inArray(apertureUnderwritingRuns.userId, ownerIds));
        await tx.delete(apertureMissionDraftRevisions).where(inArray(apertureMissionDraftRevisions.userId, ownerIds));
        await tx.delete(apertureMissionDrafts).where(inArray(apertureMissionDrafts.userId, ownerIds));
        await tx.delete(apertureAttentionBaselines).where(inArray(apertureAttentionBaselines.userId, ownerIds));
        await tx.delete(apertureEvidenceReviews).where(inArray(apertureEvidenceReviews.userId, ownerIds));
        await tx.delete(aperturePendingOutcomes).where(inArray(aperturePendingOutcomes.userId, ownerIds));
        // Exact disposable fixture owners only, never browser or broker history.
        await tx.delete(brokerOrders).where(inArray(brokerOrders.userId, ownerIds));
        if (research.length) await tx.delete(apertureCandidates).where(inArray(apertureCandidates.runId, research.map((row) => row.id)));
        await tx.delete(apertureRuns).where(inArray(apertureRuns.userId, ownerIds));
        if (runs.length) await tx.delete(apertureDecisionRevisions).where(inArray(apertureDecisionRevisions.decisionRunId, runs.map((row) => row.id)));
        await tx.delete(apertureDecisionRuns).where(inArray(apertureDecisionRuns.userId, ownerIds));
        await tx.delete(capitalTheses).where(inArray(capitalTheses.userId, ownerIds));
        await tx.delete(thesisCompilations).where(inArray(thesisCompilations.userId, ownerIds));
        await tx.delete(portfolioAccounts).where(inArray(portfolioAccounts.userId, ownerIds));
        await tx.delete(users).where(inArray(users.id, ownerIds));
      });
      expect(await db.select().from(users).where(inArray(users.id, ownerIds))).toEqual([]);
    }
  });
  afterAll(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  async function missionFixture(owner: Owner) {
    const name = "Illustrative persistence fixture — no market recommendation";
    const [canonical] = await db.insert(thesisCompilations).values({ userId: owner.id, name, thesisText: name, status: "approved", templateUsed: "capital_trade" });
    const [capital] = await db.insert(capitalTheses).values({ userId: owner.id, name, rawText: name, sourceCompilationId: Number(canonical.insertId), status: "active", createdAt: NOW, updatedAt: NOW });
    const [account] = await db.insert(portfolioAccounts).values({ userId: owner.id, label: "Illustrative paper account", brokerId: "manual", isPaper: true, equityValueCents: 10_000_000, cashCents: 5_000_000, syncSource: "illustrative_fixture", lastSyncedAt: NOW, createdAt: NOW, updatedAt: NOW });
    const binding = { canonicalThesisId: Number(canonical.insertId), capitalThesisId: Number(capital.insertId), accountId: Number(account.insertId) };
    const [run] = await db.insert(apertureDecisionRuns).values({ userId: owner.id, ...binding, createdAt: NOW, updatedAt: NOW });
    return { owner, ...binding, decisionRunId: Number(run.insertId) };
  }
  type Mission = Awaited<ReturnType<typeof missionFixture>>;

  async function appendReceipt(mission: Mission, version: number, previousRevisionId: number | null, periods: CapitalObjective["holdingPeriods"]) {
    const [inserted] = await db.insert(apertureDecisionRevisions).values({
      decisionRunId: mission.decisionRunId, version, previousRevisionId,
      missionText: "Illustrative persistence test: inspect sourced swing evidence, retain the declared risk ceiling, and do not create an order.",
      missionHash: "illustrative-version-" + version, missionSource: "edited", holdingPeriod: "swing", holdingPeriods: periods,
      instrumentPreference: "shares", deployableCapitalCents: objective.deployableCapitalCents,
      targetProfitCents: objective.targetProfitCents, targetPeriod: objective.targetPeriod,
      maxPlannedLossCents: objective.maxPlannedLossCents, invalidationRule: "Illustrative: evidence fails to confirm the recorded catalyst.",
      contextSnapshot: { canonicalThesisId: mission.canonicalThesisId, capitalThesisId: mission.capitalThesisId, accountId: mission.accountId },
      gateSnapshot: { mandateVersion: "illustrative-v1" }, createdByUserId: mission.owner.id, createdAt: NOW + version,
    });
    const revisionId = Number(inserted.insertId);
    await db.update(apertureDecisionRuns).set({ currentRevisionId: revisionId }).where(and(eq(apertureDecisionRuns.id, mission.decisionRunId), eq(apertureDecisionRuns.userId, mission.owner.id)));
    return revisionId;
  }

  async function recordNoTradeFixture(mission: Mission, decisionRevisionId: number, version: number, periods: CapitalObjective["holdingPeriods"], prior?: { headId: number; revisionId: number }) {
    const metric = { value: null, direction: "unknown" as const, asOf: NOW, source: "illustrative_fixture", freshness: "unknown" as const };
    const market: MarketRegimeSnapshot = { asOf: NOW, marketSession: "unknown", indexTrend: { spy: metric, qqq: metric, iwm: metric }, keyThemes: [], catalysts: [], regime: "unknown", confidence: 0 };
    const result = underwritePlayCandidates({ objective: { ...objective, holdingPeriods: periods }, market,
      risk: { normalPlayRiskPct: 0.75, highConvictionRiskPct: 1.25, maxAggregateOpenRiskPct: 3, weeklyLossLimitPct: 4, eventRiskAllocationPct: 1.5, perPlayHeadroomCents: 75_000, aggregateOpenRiskBeforeCents: 0, weeklyLossUsedCents: 0 },
      candidates: [], now: NOW, requestedPlayCount: 3,
    });
    const headId = prior?.headId ?? Number((await db.insert(apertureUnderwritingRuns).values({ userId: mission.owner.id, decisionRunId: mission.decisionRunId, createdAt: NOW, updatedAt: NOW }))[0].insertId);
    const [revision] = await db.insert(apertureUnderwritingRevisions).values({
      underwritingRunId: headId, decisionRevisionId, version, previousRevisionId: prior?.revisionId ?? null,
      // Legacy nested JSON fixture: no browser row is borrowed or rewritten.
      objective: version === 1 ? { ...result.objective, holdingPeriods: JSON.stringify(periods) as unknown as CapitalObjective["holdingPeriods"] } : result.objective,
      feasibility: result.feasibility, marketSnapshot: result.market, tacticalTheses: result.tacticalTheses,
      plays: result.plays, noTrade: result.noTrade, portfolioRisk: result.portfolioRisk, providerAvailability: {},
      createdByUserId: mission.owner.id, createdAt: NOW + version,
    });
    const revisionId = Number(revision.insertId);
    await db.update(apertureUnderwritingRuns).set({ currentRevisionId: revisionId }).where(eq(apertureUnderwritingRuns.id, headId));
    return { headId, revisionId };
  }

  it("resumes incomplete inputs through another authenticated caller and CAS never clobbers the winning draft", async () => {
    const deviceA = callerFor(owners[0]);
    const values = { ...emptyMissionDraftValues(), newTitle: "Illustrative MRVL thesis", newBelief: "Still typing ", capital: "2,000.", maxLoss: "", activeSection: 2 as const };
    const saved = await deviceA.runway.draft.save({ expectedVersion: 0, values });
    const deviceB = callerFor(owners[0]);
    expect((await deviceB.runway.draft.get())?.values).toEqual(values);
    expect(await callerFor(owners[1]).runway.draft.get()).toBeNull();
    const desk = await deviceB.desk.summary();
    expect(desk.attention.entryState).toBe("resume");
    expect(desk.attention.primary?.href).toBe("/aperture/mission");
    const attempts = await Promise.allSettled([deviceA, deviceB].map((caller, index) => caller.runway.draft.save({ expectedVersion: saved.version, values: { ...values, maxLoss: index ? "2000" : "1000" } })));
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    const conflict = attempts.find((attempt) => attempt.status === "rejected") as PromiseRejectedResult;
    expect(conflict.reason.code).toBe("CONFLICT");
    const winner = (attempts.find((attempt) => attempt.status === "fulfilled") as PromiseFulfilledResult<typeof saved>).value;
    expect(await callerFor(owners[0]).runway.draft.get()).toEqual(winner);
    const revisions = await db.select().from(apertureMissionDraftRevisions).where(eq(apertureMissionDraftRevisions.userId, owners[0].id)).orderBy(apertureMissionDraftRevisions.version);
    expect(revisions).toHaveLength(2);
    expect(parsePersistedJson(revisions[0].values)).toEqual(values);
    expect(await db.select().from(apertureDecisionRuns).where(inArray(apertureDecisionRuns.userId, ownerIds))).toEqual([]);
    expect(await db.select().from(apertureUnderwritingJobs).where(inArray(apertureUnderwritingJobs.userId, ownerIds))).toEqual([]);
  });

  it("serializes simultaneous claims, fences the lost worker, and reuses a completed request after explicit retry", async () => {
    const mission = await missionFixture(owners[0]);
    const decisionRevisionId = await appendReceipt(mission, 1, null, ["swing"]);
    const input = { userId: owners[0].id, decisionRunId: mission.decisionRunId, decisionRevisionId, requestKey: "illustrative-journey-request", request: { objective, requestedPlayCount: 3 as const, appendRevision: false } };
    const results = await Promise.allSettled([claimUnderwritingJob(db, input), claimUnderwritingJob(db, input)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason.code).toBe("CONFLICT");
    const job = (await readUnderwritingJob(db, owners[0].id, mission.decisionRunId, decisionRevisionId))!;
    expect((await callerFor(owners[0]).underwriter.status({ decisionRunId: mission.decisionRunId, decisionRevisionId })).state).toBe("running");
    expect(await readUnderwritingJob(db, owners[1].id, mission.decisionRunId, decisionRevisionId)).toBeNull();
    await expect(callerFor(owners[1]).underwriter.retry({ jobId: job.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db.update(apertureUnderwritingJobs).set({ leaseUntil: NOW - 1 }).where(and(eq(apertureUnderwritingJobs.id, job.id), eq(apertureUnderwritingJobs.userId, owners[0].id)));
    const expired = await readUnderwritingJob(db, owners[0].id, mission.decisionRunId, decisionRevisionId);
    expect((await callerFor(owners[0]).underwriter.status({ decisionRunId: mission.decisionRunId, decisionRevisionId })).state).toBe("interrupted");
    expect(await readUnderwritingJob(db, owners[0].id, mission.decisionRunId, decisionRevisionId)).toEqual(expired);
    await expect(claimUnderwritingJob(db, input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const retries = await Promise.allSettled([claimUnderwritingJob(db, { ...input, retryJobId: job.id }), claimUnderwritingJob(db, { ...input, retryJobId: job.id })]);
    expect(retries.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((retries.find((result) => result.status === "rejected") as PromiseRejectedResult).reason.code).toBe("CONFLICT");
    const resumed = (await readUnderwritingJob(db, owners[0].id, mission.decisionRunId, decisionRevisionId))!;
    expect(resumed.id).toBe(job.id);
    expect(resumed.attempt).toBe(2);
    expect(resumed.attemptToken).not.toBe(job.attemptToken);
    expect(mayPublishUnderwriting(resumed, job.attemptToken, NOW)).toBe(false);
    const result = await recordNoTradeFixture(mission, decisionRevisionId, 1, ["swing"]);
    // Controlled worker completion, not provider execution or approval.
    await db.update(apertureUnderwritingJobs).set({ state: "complete", milestone: "complete", resultRevisionId: result.revisionId }).where(eq(apertureUnderwritingJobs.id, job.id));
    const before = await readUnderwritingJob(db, owners[0].id, mission.decisionRunId, decisionRevisionId);
    const repeated = await Promise.all([claimUnderwritingJob(db, input), claimUnderwritingJob(db, input)]);
    expect(repeated.map((claim) => [claim.reused, claim.job.id, claim.job.resultRevisionId])).toEqual([[true, job.id, result.revisionId], [true, job.id, result.revisionId]]);
    expect(await readUnderwritingJob(db, owners[0].id, mission.decisionRunId, decisionRevisionId)).toEqual(before);
    expect(await db.select().from(apertureUnderwritingJobs).where(eq(apertureUnderwritingJobs.userId, owners[0].id))).toHaveLength(1);
  });

  it("records only displayed versions as seen; evidence, pending review, and exact order stay unacknowledged", async () => {
    const mission = await missionFixture(owners[0]);
    const decisionRevisionId = await appendReceipt(mission, 1, null, ["swing"]);
    const [research] = await db.insert(apertureRuns).values({ userId: owners[0].id, thesisId: mission.capitalThesisId, accountId: mission.accountId, deployableCapitalCents: objective.deployableCapitalCents, status: "completed", holdingPeriod: "swing", createdAt: NOW });
    const researchRunId = Number(research.insertId);
    await db.update(apertureDecisionRuns).set({ researchRunId, lifecycle: "researching" }).where(eq(apertureDecisionRuns.id, mission.decisionRunId));
    const [candidate] = await db.insert(apertureCandidates).values({ runId: researchRunId, symbol: "MRVL", role: "core", verifyFields: ["Named catalyst primary-source evidence"], createdAt: NOW });
    await db.insert(aperturePendingOutcomes).values({ userId: owners[0].id, decisionRunId: mission.decisionRunId, revisionId: decisionRevisionId, kind: "gate_review", status: "due", dueAt: NOW - 1000, reviewBasis: "Illustrative unresolved catalyst review", createdAt: NOW - 1000, updatedAt: NOW - 1000 });
    await db.insert(brokerOrders).values({ userId: owners[0].id, runId: researchRunId, candidateId: Number(candidate.insertId), accountId: mission.accountId, decisionRunId: mission.decisionRunId, decisionRevisionId, symbol: "MRVL", side: "buy", intent: "open", qty: 1, status: "pending_approval", reason: "Illustrative sentinel only — not a broker instruction", plannedRiskCents: 100, createdAt: NOW, updatedAt: NOW });
    expectedOrders = await ordersForOwners();
    const decisionsBefore = await db.select().from(apertureDecisionRuns).where(eq(apertureDecisionRuns.id, mission.decisionRunId));
    const reviewsBefore = await db.select().from(aperturePendingOutcomes).where(eq(aperturePendingOutcomes.userId, owners[0].id));
    const a = callerFor(owners[0]); const b = callerFor(owners[0]);
    const initial = await a.desk.summary();
    expect(await db.select().from(apertureAttentionBaselines).where(eq(apertureAttentionBaselines.userId, owners[0].id))).toEqual([]);
    const evidence = attentionItems(initial.attention).find((item) => item.kind === "evidence_missing")!;
    const review = attentionItems(initial.attention).find((item) => item.kind === "review_due")!;
    expect(evidence).toBeDefined(); expect(review).toBeDefined();
    const displayed = { capturedAt: NOW - 10, items: initial.attention.baseline.items.filter((item) => item.key === evidence.key) };
    await a.desk.markSeen({ snapshot: displayed, token: attentionBaselineToken(displayed) });
    const [seenOne] = await db.select().from(apertureAttentionBaselines).where(eq(apertureAttentionBaselines.userId, owners[0].id));
    expect(parsePersistedJson(seenOne.snapshot).items.map((item) => item.key)).toEqual([evidence.key]);
    const next = await b.desk.summary();
    expect(attentionItems(next.attention).some((item) => item.key === evidence.key)).toBe(true);
    expect(attentionItems(next.attention).some((item) => item.key === review.key)).toBe(true);
    const another = { capturedAt: NOW - 5, items: initial.attention.baseline.items.filter((item) => item.key === review.key) };
    const stale = { capturedAt: NOW - 20, items: [{ key: evidence.key, fingerprint: "stale-device-version" }] };
    await Promise.all([b.desk.markSeen({ snapshot: another, token: attentionBaselineToken(another) }), a.desk.markSeen({ snapshot: stale, token: attentionBaselineToken(stale) })]);
    const [merged] = await db.select().from(apertureAttentionBaselines).where(eq(apertureAttentionBaselines.userId, owners[0].id));
    expect(parsePersistedJson(merged.snapshot).items.map((item) => [item.key, item.fingerprint]).sort()).toEqual([...displayed.items, ...another.items].map((item) => [item.key, item.fingerprint]).sort());
    expect(await db.select().from(apertureEvidenceReviews).where(eq(apertureEvidenceReviews.userId, owners[0].id))).toEqual([]);
    expect(await db.select().from(aperturePendingOutcomes).where(eq(aperturePendingOutcomes.userId, owners[0].id))).toEqual(reviewsBefore);
    expect(await db.select().from(apertureDecisionRuns).where(eq(apertureDecisionRuns.id, mission.decisionRunId))).toEqual(decisionsBefore);
    expect(await db.select().from(apertureAttentionBaselines).where(eq(apertureAttentionBaselines.userId, owners[1].id))).toEqual([]);
    expect(await callerFor(owners[1]).underwriter.get({ decisionRunId: mission.decisionRunId })).toBeNull();
  });

  it("reopens its own completed two-revision journey and preserves original history without browser setup", async () => {
    const mission = await missionFixture(owners[0]);
    const firstReceipt = await appendReceipt(mission, 1, null, ["intraday"]);
    const first = await recordNoTradeFixture(mission, firstReceipt, 1, ["intraday"]);
    const originalReceipt = await db.select().from(apertureDecisionRevisions).where(eq(apertureDecisionRevisions.id, firstReceipt));
    const originalResult = await db.select().from(apertureUnderwritingRevisions).where(eq(apertureUnderwritingRevisions.id, first.revisionId));
    const legacy = await callerFor(owners[0]).underwriter.get({ decisionRunId: mission.decisionRunId });
    expect(legacy?.objective.holdingPeriods).toEqual(["intraday"]);
    const historical = await callerFor(owners[0]).runway.latest({ decisionRunId: mission.decisionRunId, revisionId: firstReceipt });
    expect(historical.latest).toMatchObject({ holdingPeriod: "swing", holdingPeriods: ["intraday"] });
    const secondReceipt = await appendReceipt(mission, 2, firstReceipt, ["swing"]);
    const second = await recordNoTradeFixture(mission, secondReceipt, 2, ["swing"], first);
    for (const [decisionRevisionId, resultRevisionId] of [[firstReceipt, first.revisionId], [secondReceipt, second.revisionId]]) {
      await db.insert(apertureUnderwritingJobs).values({ userId: owners[0].id, decisionRunId: mission.decisionRunId, decisionRevisionId, requestKey: "illustrative-revision-" + decisionRevisionId, request: { objective: { ...objective, holdingPeriods: decisionRevisionId === firstReceipt ? ["intraday"] : ["swing"] }, requestedPlayCount: 3, appendRevision: decisionRevisionId === secondReceipt }, state: "complete", milestone: "complete", attemptToken: randomUUID(), leaseUntil: NOW - 1, resultRevisionId, createdAt: NOW, updatedAt: NOW });
    }
    const before = await db.select().from(apertureUnderwritingJobs).where(eq(apertureUnderwritingJobs.userId, owners[0].id)).orderBy(apertureUnderwritingJobs.id);
    for (const caller of [callerFor(owners[0]), callerFor(owners[0])]) {
      const result = await caller.underwriter.get({ decisionRunId: mission.decisionRunId });
      expect(result?.underwritingRevisionId).toBe(second.revisionId);
      expect(result?.objective.holdingPeriods).toEqual(["swing"]);
      expect(result?.feasibility.requiredReturnPct).toBe(24);
      expect(result?.plays).toEqual([]); expect(result?.noTrade?.reason).toBe("market_data_stale");
      const receipt = await caller.runway.latest({ decisionRunId: mission.decisionRunId, revisionId: secondReceipt });
      expect(receipt.latest && "holdingPeriods" in receipt.latest && receipt.latest.holdingPeriods).toEqual(["swing"]);
      expect((await caller.underwriter.status({ decisionRunId: mission.decisionRunId, decisionRevisionId: secondReceipt })).state).toBe("complete");
      const desk = await caller.desk.summary();
      expect(desk.attention.primary).toBeNull(); expect(desk.attention.entryState).toBe("check_in");
    }
    expect(await db.select().from(apertureAttentionBaselines).where(eq(apertureAttentionBaselines.userId, owners[0].id))).toEqual([]);
    expect(await db.select().from(apertureUnderwritingJobs).where(eq(apertureUnderwritingJobs.userId, owners[0].id)).orderBy(apertureUnderwritingJobs.id)).toEqual(before);
    expect(await db.select().from(apertureUnderwritingRevisions).where(eq(apertureUnderwritingRevisions.underwritingRunId, first.headId))).toHaveLength(2);
    expect(await db.select().from(apertureDecisionRevisions).where(eq(apertureDecisionRevisions.id, firstReceipt))).toEqual(originalReceipt);
    expect(await db.select().from(apertureUnderwritingRevisions).where(eq(apertureUnderwritingRevisions.id, first.revisionId))).toEqual(originalResult);
    expect(parsePersistedJson(parsePersistedJson(originalResult[0].objective).holdingPeriods)).toEqual(["intraday"]);
    expect(await callerFor(owners[1]).underwriter.get({ decisionRunId: mission.decisionRunId })).toBeNull();
  });
});

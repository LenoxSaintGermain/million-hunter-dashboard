import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import http from "node:http";
import https from "node:https";
import {
  users, portfolioAccounts, thesisCompilations, capitalTheses, apertureRuns, apertureCandidates,
  brokerOrders, monitoringChecks, positions, positionSnapshots, apertureEvidenceReviews,
  apertureDecisionRuns, apertureDecisionRevisions, apertureUnderwritingRuns, apertureUnderwritingRevisions,
  apertureMissionDrafts, apertureMissionDraftRevisions, apertureUnderwritingJobs,
  apertureCapitalEvents, apertureCapitalClaims, apertureAttentionBaselines,
} from "../../drizzle/schema";
import { emptyMissionDraftValues, missionDraftFingerprint, type MissionDraftValues } from "../../shared/apertureMissionDraft";
import { parsePersistedJson } from "../../shared/persistedJson";
import { requireIsolatedIntegrationDatabase } from "../../scripts/isolated-integration-identity.mjs";
import { immutableReceiptBindingIssue } from "./decisionReceiptBinding";

// No skip/fallback: main owns provisioning, schema integration and the DB lane.
// This check runs before either service or database modules can be imported.
requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;
type Owner = { userId: number; accountId: number };
const NOW = Date.UTC(2026, 8, 9, 19);
const DECLARATION_ID = "55555555-5555-4555-8555-555555555555";
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const NEXT_REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const request = { expectedVersion: 1, requestId: REQUEST_ID };

describe("objective Mission acceptance — actual isolated persistence", () => {
  let db: Db;
  let service: typeof import("./objectiveMission");
  let router: typeof import("../apertureRouter").apertureRouter;
  let owners: Owner[] = [], ownerIds: number[] = [];
  let unchanged: Awaited<ReturnType<typeof sideEffects>> | null;
  const network = vi.fn(() => { throw new Error("Provider/broker HTTP forbidden in objective acceptance integration"); });

  async function callerFor(owner = owners[0]) {
    const [user] = await db.select().from(users).where(eq(users.id, owner.userId));
    expect(user).toBeDefined();
    return router.createCaller({ user, req: {} as any, res: {} as any });
  }

  function values(owner = owners[0]): MissionDraftValues {
    return {
      ...emptyMissionDraftValues(), accountId: owner.accountId, activeSection: 3,
      capital: "8,000.25", maxLoss: "500.10", targetProfit: "1,200.50", targetPeriod: "week",
      holdingPeriod: "swing", holdingPeriods: ["swing", "position"], instrument: "either",
      objective: "best_qualified_play", includeHeld: true,
      mission: "Compare uses of my declared excess capital, including retaining it. Verify the mechanism before any allocation.",
      strategyContext: { schemaVersion: 1, requestId: REQUEST_ID, intent: "deploy_excess_capital",
        searchScope: "broader_permitted_universe", requestedSymbols: ["PWR", "MRVL"],
        declarationId: DECLARATION_ID, sourceOrder: null, profitReserve: "200.00" },
    };
  }

  async function missionRows() {
    return {
      heads: await db.select().from(apertureDecisionRuns).where(inArray(apertureDecisionRuns.userId, ownerIds)).orderBy(apertureDecisionRuns.id),
      revisions: await db.select().from(apertureDecisionRevisions).where(inArray(apertureDecisionRevisions.createdByUserId, ownerIds)).orderBy(apertureDecisionRevisions.id),
      drafts: await db.select().from(apertureMissionDrafts).where(inArray(apertureMissionDrafts.userId, ownerIds)).orderBy(apertureMissionDrafts.id),
      history: await db.select().from(apertureMissionDraftRevisions).where(inArray(apertureMissionDraftRevisions.userId, ownerIds)).orderBy(apertureMissionDraftRevisions.id),
    };
  }

  async function sideEffects() {
    // Full rows catch mutations, not just extra records. Dynamically discover all
    // owned research IDs so an accidentally created run cannot hide its checks.
    const research = await db.select().from(apertureRuns).where(inArray(apertureRuns.userId, ownerIds)).orderBy(apertureRuns.id);
    const runIds = research.map(row => row.id);
    return {
      users: await db.select().from(users).where(inArray(users.id, ownerIds)).orderBy(users.id),
      accounts: await db.select().from(portfolioAccounts).where(inArray(portfolioAccounts.userId, ownerIds)).orderBy(portfolioAccounts.id),
      theses: await db.select().from(thesisCompilations).where(inArray(thesisCompilations.userId, ownerIds)).orderBy(thesisCompilations.id),
      projections: await db.select().from(capitalTheses).where(inArray(capitalTheses.userId, ownerIds)).orderBy(capitalTheses.id),
      jobs: await db.select().from(apertureUnderwritingJobs).where(inArray(apertureUnderwritingJobs.userId, ownerIds)).orderBy(apertureUnderwritingJobs.id),
      underwriting: await db.select().from(apertureUnderwritingRuns).where(inArray(apertureUnderwritingRuns.userId, ownerIds)).orderBy(apertureUnderwritingRuns.id),
      underwritingRevisions: await db.select().from(apertureUnderwritingRevisions).where(inArray(apertureUnderwritingRevisions.createdByUserId, ownerIds)).orderBy(apertureUnderwritingRevisions.id),
      research,
      candidates: runIds.length ? await db.select().from(apertureCandidates).where(inArray(apertureCandidates.runId, runIds)).orderBy(apertureCandidates.id) : [],
      evidence: await db.select().from(apertureEvidenceReviews).where(inArray(apertureEvidenceReviews.userId, ownerIds)).orderBy(apertureEvidenceReviews.id),
      orders: await db.select().from(brokerOrders).where(inArray(brokerOrders.userId, ownerIds)).orderBy(brokerOrders.id),
      checks: runIds.length ? await db.select().from(monitoringChecks).where(inArray(monitoringChecks.runId, runIds)).orderBy(monitoringChecks.id) : [],
      positions: await db.select().from(positions).where(inArray(positions.accountId, owners.map(owner => owner.accountId))).orderBy(positions.id),
      snapshots: runIds.length ? await db.select().from(positionSnapshots).where(inArray(positionSnapshots.runId, runIds)).orderBy(positionSnapshots.id) : [],
      events: await db.select().from(apertureCapitalEvents).where(inArray(apertureCapitalEvents.userId, ownerIds)).orderBy(apertureCapitalEvents.id),
      claims: await db.select().from(apertureCapitalClaims).where(inArray(apertureCapitalClaims.userId, ownerIds)).orderBy(apertureCapitalClaims.id),
      attention: await db.select().from(apertureAttentionBaselines).where(inArray(apertureAttentionBaselines.userId, ownerIds)).orderBy(apertureAttentionBaselines.id),
    };
  }

  async function seedDraft(input = values(), owner = owners[0]) {
    // Deliberate raw fixture insertion lets acceptance recheck references rather
    // than relying on a draft-save guard to reject the unauthorized test data.
    const id = await db.transaction(async tx => {
      const [row] = await tx.insert(apertureMissionDrafts).values({ userId: owner.userId, version: 1, values: input, completedAt: null, createdAt: NOW - 100, updatedAt: NOW - 100 });
      const draftId = Number(row.insertId);
      await tx.insert(apertureMissionDraftRevisions).values({ draftId, userId: owner.userId, version: 1, values: input, completedAt: null, createdAt: NOW - 100 });
      return draftId;
    });
    unchanged = await sideEffects();
    return id;
  }

  async function seedThesis(owner: Owner) {
    const [canonical] = await db.insert(thesisCompilations).values({ userId: owner.userId, name: "Illustrative owned thesis", thesisText: "Illustrative stored belief, not market evidence", status: "approved", templateUsed: "capital_trade" });
    const canonicalId = Number(canonical.insertId);
    await db.update(users).set({ activeCapitalThesisId: canonicalId }).where(eq(users.id, owner.userId));
    return canonicalId;
  }

  async function seedSource(owner: Owner) {
    const canonicalId = await seedThesis(owner);
    const [projection] = await db.insert(capitalTheses).values({ userId: owner.userId, sourceCompilationId: canonicalId, name: "Illustrative source projection", rawText: "Illustrative unchanged source thesis", status: "active", createdAt: NOW - 1000, updatedAt: NOW - 1000 });
    const [run] = await db.insert(apertureRuns).values({ userId: owner.userId, accountId: owner.accountId, thesisId: Number(projection.insertId), deployableCapitalCents: 100_000, status: "completed", createdAt: NOW - 1000 });
    const runId = Number(run.insertId);
    const [candidate] = await db.insert(apertureCandidates).values({ runId, symbol: "PWR", role: "core", createdAt: NOW - 1000 });
    const candidateId = Number(candidate.insertId);
    const [order] = await db.insert(brokerOrders).values({ userId: owner.userId, accountId: owner.accountId, runId, candidateId,
      symbol: "PWR", side: "sell", intent: "close", status: "filled", qty: 10, filledQty: 10,
      filledAvgPriceCents: 20_000, filledAt: NOW - 500, reason: "Illustrative filled close: cost basis, fees and available gain not proven",
      createdAt: NOW - 1000, updatedAt: NOW - 500 });
    await db.insert(monitoringChecks).values({ runId, candidateId, symbol: "PWR", checkType: "catalyst", flagged: true,
      finding: "Illustrative unresolved check; accepting an objective does not review it", checkedAt: NOW - 500, createdAt: NOW - 500 });
    return { accountId: owner.accountId, runId, candidateId, orderId: Number(order.insertId), canonicalId };
  }

  beforeAll(async () => {
    requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    vi.stubGlobal("fetch", network);
    vi.spyOn(http, "request").mockImplementation(network); vi.spyOn(http, "get").mockImplementation(network);
    vi.spyOn(https, "request").mockImplementation(network); vi.spyOn(https, "get").mockImplementation(network);
    const { getDb } = await import("../db");
    db = (await getDb())!;
    if (!db) throw new Error("Exact disposable database unavailable; no fallback permitted");
    service = await import("./objectiveMission");
    router = (await import("../apertureRouter")).apertureRouter;
    // Missing new columns fail visibly; no migration/provision fallback in tests.
    await db.select().from(apertureDecisionRuns).limit(0);
  });

  beforeEach(async () => {
    owners = []; ownerIds = []; unchanged = null; network.mockClear();
    vi.stubEnv("CAPITAL_OBJECTIVE_MISSIONS_ENABLED", "false");
    for (let i = 0; i < 2; i++) {
      const openId = `uat_objective_${randomUUID()}`;
      expect(openId.length).toBeLessThanOrEqual(64);
      const [user] = await db.insert(users).values({ openId, name: "Illustrative objective owner", role: "capital_operator" });
      const userId = Number(user.insertId); ownerIds.push(userId);
      const [account] = await db.insert(portfolioAccounts).values({ userId, label: "Illustrative named paper account", brokerId: "manual", isPaper: true,
        cashCents: 5_000_000, equityValueCents: 10_000_000, lastSyncedAt: NOW - 5000,
        createdAt: NOW - 5000, updatedAt: NOW - 5000 });
      owners.push({ userId, accountId: Number(account.insertId) });
    }
    unchanged = await sideEffects();
  });

  afterEach(async () => {
    if (!db || !ownerIds.length) return;
    try {
      expect(network).not.toHaveBeenCalled();
      if (unchanged) expect(await sideEffects()).toEqual(unchanged);
    } finally {
      // Exact disposable owners only. Never truncate tables or touch browser UAT.
      await db.transaction(async tx => {
        const runs = await tx.select({ id: apertureRuns.id }).from(apertureRuns).where(inArray(apertureRuns.userId, ownerIds));
        const runIds = runs.map(row => row.id);
        await tx.delete(apertureCapitalClaims).where(inArray(apertureCapitalClaims.userId, ownerIds));
        await tx.delete(apertureCapitalEvents).where(inArray(apertureCapitalEvents.userId, ownerIds));
        await tx.delete(apertureAttentionBaselines).where(inArray(apertureAttentionBaselines.userId, ownerIds));
        await tx.delete(apertureUnderwritingJobs).where(inArray(apertureUnderwritingJobs.userId, ownerIds));
        await tx.delete(apertureUnderwritingRevisions).where(inArray(apertureUnderwritingRevisions.createdByUserId, ownerIds));
        await tx.delete(apertureUnderwritingRuns).where(inArray(apertureUnderwritingRuns.userId, ownerIds));
        await tx.delete(apertureEvidenceReviews).where(inArray(apertureEvidenceReviews.userId, ownerIds));
        if (runIds.length) {
          await tx.delete(monitoringChecks).where(inArray(monitoringChecks.runId, runIds));
          await tx.delete(positionSnapshots).where(inArray(positionSnapshots.runId, runIds));
        }
        await tx.delete(brokerOrders).where(inArray(brokerOrders.userId, ownerIds));
        if (runIds.length) await tx.delete(apertureCandidates).where(inArray(apertureCandidates.runId, runIds));
        await tx.delete(apertureRuns).where(inArray(apertureRuns.userId, ownerIds));
        await tx.delete(apertureMissionDraftRevisions).where(inArray(apertureMissionDraftRevisions.userId, ownerIds));
        await tx.delete(apertureMissionDrafts).where(inArray(apertureMissionDrafts.userId, ownerIds));
        await tx.delete(apertureDecisionRevisions).where(inArray(apertureDecisionRevisions.createdByUserId, ownerIds));
        await tx.delete(apertureDecisionRuns).where(inArray(apertureDecisionRuns.userId, ownerIds));
        await tx.delete(capitalTheses).where(inArray(capitalTheses.userId, ownerIds));
        await tx.delete(thesisCompilations).where(inArray(thesisCompilations.userId, ownerIds));
        if (owners.length) await tx.delete(positions).where(inArray(positions.accountId, owners.map(owner => owner.accountId)));
        await tx.delete(portfolioAccounts).where(inArray(portfolioAccounts.userId, ownerIds));
        await tx.delete(users).where(inArray(users.id, ownerIds));
      });
    }
  });
  afterAll(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("accepts a no-thesis objective with exact immutable inputs and an atomic draft completion", async () => {
    const input = values(), draftId = await seedDraft(input);
    const prepared = service.prepareObjectiveMission(input);
    expect(prepared).toMatchObject({ sourceBasis: "operator_declared", deployableCapitalCents: 800_025,
      maxPlannedLossCents: 50_010, targetProfitCents: 120_050, profitReserveCents: 20_000,
      availableCapitalCents: null, permittedRiskCents: null });
    const result = await service.acceptObjectiveMission(db, owners[0].userId, request, NOW);
    expect(result).toMatchObject({ created: true, status: "accepted" });
    const rows = await missionRows();
    expect(rows.heads).toHaveLength(1); expect(rows.revisions).toHaveLength(1);
    expect(rows.heads[0]).toMatchObject({ id: result.decisionRunId, userId: owners[0].userId, contextKind: "objective",
      clientRequestId: REQUEST_ID, canonicalThesisId: null, capitalThesisId: null, researchRunId: null,
      accountId: owners[0].accountId, currentRevisionId: result.revisionId, lifecycle: "mission", createdAt: NOW });
    const revision = rows.revisions[0];
    expect(revision).toMatchObject({ id: result.revisionId, decisionRunId: result.decisionRunId, version: 1,
      missionText: input.mission, deployableCapitalCents: 800_025, maxPlannedLossCents: 50_010,
      targetProfitCents: 120_050, targetPeriod: "week", desiredEndingValueCents: null,
      instrumentPreference: "either", holdingPeriod: "swing", includeHeldResearch: true,
      selectedCandidateId: null, invalidationRule: null, plannedRiskCents: 0, createdByUserId: owners[0].userId });
    expect(revision.missionHash).toBe(createHash("sha256").update(missionDraftFingerprint(input)).digest("hex"));
    expect(parsePersistedJson(revision.holdingPeriods)).toEqual(input.holdingPeriods);
    expect(parsePersistedJson(revision.contextSnapshot)).toEqual({ contextKind: "objective", requestId: REQUEST_ID,
      canonicalThesisId: null, capitalThesisId: null, selectedCanonicalThesisId: null,
      accountId: owners[0].accountId, sourceDraftId: draftId, sourceDraftVersion: 1, acceptedDraft: input,
      sourceBasis: "operator_declared", availableCapitalCents: null, profitReserveCents: 20_000,
      accountLabel: "Illustrative named paper account", accountLastSyncedAt: NOW - 5000 });
    expect(parsePersistedJson(revision.gateSnapshot)).toMatchObject({ paperOnly: true, humanApprovalRequired: true,
      riskAuthorityState: "pending_verification", permittedRiskCents: null, sourceAvailabilityVerified: false });
    expect(immutableReceiptBindingIssue({ requestedOwnerId: owners[0].userId,
      run: { ownerId: owners[0].userId, contextKind: "objective", clientRequestId: REQUEST_ID,
        canonicalThesisId: null, capitalThesisId: null, accountId: owners[0].accountId },
      contextSnapshot: parsePersistedJson(revision.contextSnapshot), gateSnapshot: parsePersistedJson(revision.gateSnapshot),
    })).toBeNull();
    const completed = { ...input, baseDecisionRunId: result.decisionRunId, baseDecisionRevisionId: result.revisionId };
    expect(rows.drafts[0]).toMatchObject({ id: draftId, version: 2, completedAt: NOW });
    expect(parsePersistedJson(rows.drafts[0].values)).toEqual(completed);
    expect(rows.history).toHaveLength(2);
    expect(parsePersistedJson(rows.history[0].values)).toEqual(input);
    expect(rows.history[0].completedAt).toBeNull();
    expect(rows.history[1]).toMatchObject({ draftId, userId: owners[0].userId, version: 2, completedAt: NOW });
    expect(parsePersistedJson(rows.history[1].values)).toEqual(completed);
    expect((await sideEffects()).theses).toEqual([]);
    expect((await sideEffects()).users.every(user => user.activeCapitalThesisId == null)).toBe(true);
  });

  it("concurrent retries create one Mission, revision and completion, then return the same IDs", async () => {
    await seedDraft();
    const results = await Promise.all(Array.from({ length: 3 }, () => service.acceptObjectiveMission(db, owners[0].userId, request, NOW)));
    expect(results.filter(result => result.created)).toHaveLength(1);
    expect(new Set(results.map(result => result.decisionRunId)).size).toBe(1);
    expect(new Set(results.map(result => result.revisionId)).size).toBe(1);
    const before = await missionRows();
    expect(before.heads).toHaveLength(1); expect(before.revisions).toHaveLength(1);
    expect(before.history.filter(row => row.completedAt != null)).toHaveLength(1);
    expect(await service.acceptObjectiveMission(db, owners[0].userId, request, NOW + 1000)).toEqual({ ...results[0], created: false });
    expect(await missionRows()).toEqual(before);
  });

  it("rejects a stale version or changed request without overwriting the saved draft", async () => {
    await seedDraft();
    const before = await missionRows();
    await expect(service.acceptObjectiveMission(db, owners[0].userId, { ...request, expectedVersion: 2 }, NOW)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(service.acceptObjectiveMission(db, owners[0].userId, { ...request, requestId: NEXT_REQUEST_ID }, NOW)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await missionRows()).toEqual(before);
    const accepted = await service.acceptObjectiveMission(db, owners[0].userId, request, NOW);
    const after = await missionRows();
    await expect(service.acceptObjectiveMission(db, owners[0].userId, { ...request, expectedVersion: 2 }, NOW)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await missionRows()).toEqual(after);
    expect(accepted.created).toBe(true);
  });

  it("an old accepted retry does not complete or overwrite a newer saved objective", async () => {
    const draftId = await seedDraft();
    const first = await service.acceptObjectiveMission(db, owners[0].userId, request, NOW);
    const next = values(); next.capital = "4,000"; next.strategyContext!.requestId = NEXT_REQUEST_ID;
    await db.transaction(async tx => {
      await tx.update(apertureMissionDrafts).set({ version: 3, values: next, completedAt: null, updatedAt: NOW + 1 }).where(eq(apertureMissionDrafts.id, draftId));
      await tx.insert(apertureMissionDraftRevisions).values({ draftId, userId: owners[0].userId, version: 3, values: next, completedAt: null, createdAt: NOW + 1 });
    });
    const before = await missionRows();
    expect(await service.acceptObjectiveMission(db, owners[0].userId, request, NOW + 2)).toEqual({ ...first, created: false });
    expect(await missionRows()).toEqual(before);
  });

  it("a real completion-history uniqueness failure rolls back all acceptance writes", async () => {
    const input = values(), draftId = await seedDraft(input);
    // A deliberately inconsistent history row forces a genuine DB error at the
    // final insert, after the Mission, revision and draft update have executed.
    const [collision] = await db.insert(apertureMissionDraftRevisions).values({ draftId, userId: owners[0].userId,
      version: 2, values: input, completedAt: null, createdAt: NOW - 50 });
    const before = await missionRows();
    await expect(service.acceptObjectiveMission(db, owners[0].userId, request, NOW)).rejects.toThrow();
    expect(await missionRows()).toEqual(before); // No orphan head/revision/completion.
    await db.delete(apertureMissionDraftRevisions).where(eq(apertureMissionDraftRevisions.id, Number(collision.insertId)));
    expect((await service.acceptObjectiveMission(db, owners[0].userId, request, NOW)).created).toBe(true);
  });

  it.each(["account", "thesis", "source_order", "source_run", "source_candidate", "source_account"] as const)("rechecks raw persisted foreign/mismatched %s identity without side effects", async kind => {
    const foreign = await seedSource(owners[1]);
    const input = values();
    if (kind === "account") input.accountId = owners[1].accountId;
    else if (kind === "thesis") input.canonicalThesisId = foreign.canonicalId;
    else {
      const own = await seedSource(owners[0]);
      input.strategyContext!.intent = "redeploy_realized_gains";
      input.strategyContext!.sourceOrder = { accountId: own.accountId, runId: own.runId, candidateId: own.candidateId, orderId: own.orderId };
      if (kind === "source_order") input.strategyContext!.sourceOrder.orderId = foreign.orderId;
      if (kind === "source_run") input.strategyContext!.sourceOrder.runId = foreign.runId;
      if (kind === "source_candidate") input.strategyContext!.sourceOrder.candidateId = foreign.candidateId;
      if (kind === "source_account") input.strategyContext!.sourceOrder.accountId = foreign.accountId;
    }
    await seedDraft(input);
    const before = await missionRows();
    await expect(service.acceptObjectiveMission(db, owners[0].userId, request, NOW)).rejects.toThrow();
    expect(await missionRows()).toEqual(before);
  });

  it("an owned thesis is optional context, never a synthetic canonical/projection binding", async () => {
    const canonicalId = await seedThesis(owners[0]);
    const input = values(); input.canonicalThesisId = canonicalId; input.strategyContext!.searchScope = "current_thesis";
    await seedDraft(input);
    await service.acceptObjectiveMission(db, owners[0].userId, request, NOW);
    const rows = await missionRows();
    expect(rows.heads[0]).toMatchObject({ contextKind: "objective", canonicalThesisId: null, capitalThesisId: null });
    expect(parsePersistedJson(rows.revisions[0].contextSnapshot)).toMatchObject({ selectedCanonicalThesisId: canonicalId, canonicalThesisId: null, capitalThesisId: null });
    expect((await sideEffects()).projections).toEqual([]);
  });

  it("a filled owned closing order still yields hypothetical gains planning only", async () => {
    const own = await seedSource(owners[0]);
    const input = values(); input.capital = "1,200"; input.targetProfit = "";
    input.strategyContext!.intent = "redeploy_realized_gains";
    input.strategyContext!.sourceOrder = { accountId: own.accountId, runId: own.runId, candidateId: own.candidateId, orderId: own.orderId };
    await seedDraft(input);
    expect(service.prepareObjectiveMission(input)).toMatchObject({ sourceBasis: "hypothetical_only", availableCapitalCents: null, permittedRiskCents: null });
    await service.acceptObjectiveMission(db, owners[0].userId, request, NOW);
    const rows = await missionRows();
    expect(parsePersistedJson(rows.revisions[0].contextSnapshot)).toMatchObject({ sourceBasis: "hypothetical_only", availableCapitalCents: null,
      acceptedDraft: { strategyContext: { sourceOrder: input.strategyContext!.sourceOrder } } });
    expect(parsePersistedJson(rows.revisions[0].gateSnapshot)).toMatchObject({ sourceAvailabilityVerified: false, permittedRiskCents: null });
    expect(rows.revisions[0]).toMatchObject({ targetProfitCents: null, targetPeriod: null, deployableCapitalCents: 120_000 });
  });

  it("the same request UUID is independently owner-scoped, never crosslinked", async () => {
    await seedDraft(values(owners[0]), owners[0]); await seedDraft(values(owners[1]), owners[1]);
    const results = await Promise.all(owners.map(owner => service.acceptObjectiveMission(db, owner.userId, request, NOW)));
    expect(results.every(result => result.created)).toBe(true);
    expect(new Set(results.map(result => result.decisionRunId)).size).toBe(2);
    expect(new Set(results.map(result => result.revisionId)).size).toBe(2);
    const rows = await missionRows();
    for (let index = 0; index < owners.length; index++) {
      const owner = owners[index], result = results[index];
      expect(rows.heads.find(row => row.id === result.decisionRunId)).toMatchObject({ userId: owner.userId, accountId: owner.accountId, clientRequestId: REQUEST_ID });
      expect(rows.revisions.find(row => row.id === result.revisionId)).toMatchObject({ decisionRunId: result.decisionRunId, createdByUserId: owner.userId });
      const draft = rows.drafts.find(row => row.userId === owner.userId)!;
      expect(parsePersistedJson(draft.values)).toMatchObject({ baseDecisionRunId: result.decisionRunId, baseDecisionRevisionId: result.revisionId });
    }
  });

  it("strict preparation rejects injected availability, source proof and unknown fields", async () => {
    await seedDraft();
    const before = await missionRows();
    expect(() => service.prepareObjectiveMission({ ...values(), availableCapitalCents: 120_000 } as any)).toThrow();
    expect(() => service.prepareObjectiveMission({ ...values(), strategyContext: { ...values().strategyContext, sourceAvailabilityVerified: true } } as any)).toThrow();
    await expect(service.acceptObjectiveMission(db, owners[0].userId, { ...request, accountId: owners[1].accountId } as any, NOW)).rejects.toThrow();
    expect(await missionRows()).toEqual(before);
  });

  it.each(["accepted_draft", "account", "gate", "history", "calculation", "effective_branch", "operator_choice", "planned_risk", "paper_boundary", "approval_boundary"] as const)("retry/read reject inconsistent %s without repairing history or accepting again", async kind => {
    await seedDraft();
    const accepted = await service.acceptObjectiveMission(db, owners[0].userId, request, NOW);
    const rows = await missionRows(), revision = rows.revisions[0];
    const context = parsePersistedJson(revision.contextSnapshot);
    if (kind === "accepted_draft") {
      delete context.acceptedDraft;
      await db.update(apertureDecisionRevisions).set({ contextSnapshot: context }).where(eq(apertureDecisionRevisions.id, revision.id));
    } else if (kind === "account") {
      await db.update(apertureDecisionRuns).set({ accountId: owners[1].accountId }).where(eq(apertureDecisionRuns.id, accepted.decisionRunId));
    } else if (kind === "gate") {
      await db.update(apertureDecisionRevisions).set({ gateSnapshot: { mandateVersion: "v2", permittedRiskCents: 50000 } }).where(eq(apertureDecisionRevisions.id, revision.id));
    } else if (kind === "history") {
      await db.update(apertureMissionDraftRevisions).set({ values: { ...values(), capital: "99" } }).where(eq(apertureMissionDraftRevisions.id, rows.history[0].id));
    } else if (kind === "effective_branch") {
      await db.update(apertureDecisionRevisions).set({ effectiveBranch: "cash" }).where(eq(apertureDecisionRevisions.id, revision.id));
    } else if (kind === "operator_choice") {
      await db.update(apertureDecisionRevisions).set({ operatorChoice: "cash" }).where(eq(apertureDecisionRevisions.id, revision.id));
    } else if (kind === "planned_risk") {
      await db.update(apertureDecisionRevisions).set({ plannedRiskCents: 1 }).where(eq(apertureDecisionRevisions.id, revision.id));
    } else if (kind === "paper_boundary" || kind === "approval_boundary") {
      const gate = parsePersistedJson(revision.gateSnapshot);
      gate[kind === "paper_boundary" ? "paperOnly" : "humanApprovalRequired"] = false;
      await db.update(apertureDecisionRevisions).set({ gateSnapshot: gate }).where(eq(apertureDecisionRevisions.id, revision.id));
    } else {
      await db.update(apertureDecisionRevisions).set({ maxPlannedLossCents: 500000 }).where(eq(apertureDecisionRevisions.id, revision.id));
    }
    const before = await missionRows();
    await expect(service.acceptObjectiveMission(db, owners[0].userId, request, NOW)).rejects.toThrow();
    const caller = await callerFor();
    await expect(caller.runway.latest({ decisionRunId: accepted.decisionRunId, revisionId: accepted.revisionId })).rejects.toThrow();
    expect(await missionRows()).toEqual(before);
  });

  it("a legacy draft cannot complete against an owned objective receipt", async () => {
    await seedDraft();
    const accepted = await service.acceptObjectiveMission(db, owners[0].userId, request, NOW);
    const caller = await callerFor();
    await caller.runway.draft.save({ expectedVersion: 2, values: emptyMissionDraftValues(), replaceStrategyContext: true });
    const before = await missionRows();
    await expect(caller.runway.draft.complete({ expectedVersion: 3, decisionRunId: accepted.decisionRunId, decisionRevisionId: accepted.revisionId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await missionRows()).toEqual(before);
  });

  it.each(["thesis", "source"] as const)("an owned %s cannot drift while retaining the accepted objective baseline", async kind => {
    const owned = await seedSource(owners[0]);
    await seedDraft();
    await service.acceptObjectiveMission(db, owners[0].userId, request, NOW);
    const caller = await callerFor(), completed = (await caller.runway.draft.get())!;
    const revised = structuredClone(completed.values);
    if (kind === "thesis") revised.canonicalThesisId = owned.canonicalId;
    else revised.strategyContext!.sourceOrder = { accountId: owned.accountId, runId: owned.runId, candidateId: owned.candidateId, orderId: owned.orderId };
    const before = await missionRows();
    await expect(caller.runway.draft.save({ expectedVersion: completed.version, values: revised })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(await missionRows()).toEqual(before);
  });

  it.each([undefined, "false"])("authenticated acceptance stays fail-closed with feature flag %s", async flag => {
    await seedDraft();
    vi.stubEnv("CAPITAL_OBJECTIVE_MISSIONS_ENABLED", flag);
    const caller = await callerFor(), before = await missionRows();
    await expect(caller.runway.acceptObjectiveDraft(request)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(await missionRows()).toEqual(before);
  });

  it("authenticated acceptance reloads the exact receipt and exposes objective resume without read mutations", async () => {
    const input = values(), draftId = await seedDraft(input);
    vi.stubEnv("CAPITAL_OBJECTIVE_MISSIONS_ENABLED", "true");
    const caller = await callerFor();
    const accepted = await caller.runway.acceptObjectiveDraft(request);
    const before = await missionRows();
    const exact = await caller.runway.latest({ decisionRunId: accepted.decisionRunId, revisionId: accepted.revisionId });
    expect(exact.activeCanonicalThesisId).toBeNull();
    expect(exact.latest).toMatchObject({ authority: "authoritative", contextKind: "objective",
      decisionRunId: accepted.decisionRunId, decisionRevisionId: accepted.revisionId, runId: null,
      canonicalThesisId: null, capitalThesisId: null, accountId: owners[0].accountId,
      objectiveContext: { requestId: REQUEST_ID, sourceDraftId: draftId, sourceDraftVersion: 1, values: input },
      binding: { ownerId: owners[0].userId, canonicalThesisId: null, capitalThesisId: null, accountId: owners[0].accountId },
    });
    expect((await caller.runway.latest()).latest).toEqual(exact.latest);
    const desk = await caller.desk.summary();
    expect(desk.orders).toEqual([]);
    expect(desk.attention).toMatchObject({ entryState: "resume", changeHeading: "Current status", quiet: false,
      primary: { actionLabel: "Review saved objective", stateLabel: "Objective saved · analysis unavailable",
        href: `/aperture/decision/${accepted.decisionRunId}/revision/${accepted.revisionId}` } });
    expect((await caller.desk.summary()).attention).toEqual(desk.attention);
    const other = await callerFor(owners[1]);
    await expect(other.runway.latest({ decisionRunId: accepted.decisionRunId, revisionId: accepted.revisionId })).rejects.toThrow();
    expect((await other.runway.latest()).latest).toBeNull();
    expect(await missionRows()).toEqual(before);
    expect((await sideEffects()).attention).toEqual([]); // Reading is not seen/acknowledged/resolved.
  });

  it("objective underwriting and research routes reject before jobs, providers or fixture work", async () => {
    await seedDraft();
    vi.stubEnv("CAPITAL_OBJECTIVE_MISSIONS_ENABLED", "true");
    const caller = await callerFor(), accepted = await caller.runway.acceptObjectiveDraft(request);
    const before = await missionRows();
    const blocked = { code: "PRECONDITION_FAILED", message: expect.stringContaining("verified discovery-to-research handoff") };
    await expect(caller.underwriter.run({ decisionRunId: accepted.decisionRunId, decisionRevisionId: accepted.revisionId, requestedPlayCount: 3 })).rejects.toMatchObject(blocked);
    await expect(caller.runway.startResearch({ decisionRunId: accepted.decisionRunId, revisionId: accepted.revisionId })).rejects.toMatchObject(blocked);
    // Even an explicit fixture request must hit the objective boundary first.
    await expect(caller.runway.startResearch({ decisionRunId: accepted.decisionRunId, revisionId: accepted.revisionId, uatCase: "qualified-play" })).rejects.toMatchObject(blocked);
    expect(await missionRows()).toEqual(before);
    const after = await sideEffects();
    expect(after.jobs).toEqual([]); expect(after.research).toEqual([]); expect(after.orders).toEqual([]);
    expect(network).not.toHaveBeenCalled();
  });

  it("an unauthenticated caller cannot accept even when the feature flag is enabled", async () => {
    await seedDraft();
    vi.stubEnv("CAPITAL_OBJECTIVE_MISSIONS_ENABLED", "true");
    const before = await missionRows();
    const anonymous = router.createCaller({ user: null, req: {} as any, res: {} as any });
    await expect(anonymous.runway.acceptObjectiveDraft(request)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(await missionRows()).toEqual(before);
  });
});

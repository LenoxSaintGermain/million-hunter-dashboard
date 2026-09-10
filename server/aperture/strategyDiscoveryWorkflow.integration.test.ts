import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import http from "node:http";
import https from "node:https";
import {
  users, portfolioAccounts, thesisCompilations, capitalTheses, apertureRuns, apertureCandidates,
  brokerOrders, monitoringChecks, positions, positionSnapshots, apertureEvidenceReviews,
  apertureDecisionRuns, apertureDecisionRevisions, apertureUnderwritingRuns, apertureUnderwritingRevisions,
  apertureMissionDrafts, apertureMissionDraftRevisions, apertureCapitalEvents, apertureCapitalClaims,
  apertureAttentionBaselines, researchResults,
} from "../../drizzle/schema";
import { apertureUnderwritingJobs as jobs } from "../../drizzle/apertureUnderwritingJobSchema";
import { apertureStrategyDiscoveries as discoveries } from "../../drizzle/apertureStrategyDiscoverySchema";
import { emptyMissionDraftValues, type MissionDraftValues } from "../../shared/apertureMissionDraft";
import { parsePersistedJson } from "../../shared/persistedJson";
import type { StrategyDiscoveryRequest } from "../../shared/strategyDiscoveryJob";
import type { StrategyDiscoveryContext, StrategyDiscoveryPayload } from "./strategyDiscovery";
import type { DiscoveryProvider } from "./strategyDiscoveryWorkflow";
import { requireIsolatedIntegrationDatabase } from "../../scripts/isolated-integration-identity.mjs";

// Fail at collection, not a skip or beforeAll-only guard. Main owns staging,
// include/exclude, schema preparation and running the disposable harness.
// No dotenv, router/server startup, provisioning, DDL, browser fixture or fallback.
requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
const liveProvider = vi.hoisted(() => vi.fn(() => { throw new Error("Live discovery provider forbidden in workflow integration"); }));
vi.mock("./strategyDiscoveryProvider", () => ({ discoverObjectiveMission: liveProvider }));

type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;
type Identity = { decisionRunId: number; decisionRevisionId: number };
type Owner = { userId: number; accountId: number; identity: Identity };
const NOW = Date.UTC(2026, 8, 9, 19);
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const NEXT_REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const DECLARATION_ID = "55555555-5555-4555-8555-555555555555";

/** Illustrative no-lead result, NOT a real market search or provider receipt. */
function noLeads(request: StrategyDiscoveryRequest): { payload: StrategyDiscoveryPayload; context: StrategyDiscoveryContext } {
  return {
    payload: { schemaVersion: 1, searchScope: request.searchScope, reviewedUniverse: [],
      coverageGaps: ["Illustrative empty-universe fixture, not a market-wide search."], hypotheses: [] },
    context: { requestId: request.requestId, provider: "illustrative-injected-workflow-fixture",
      asOf: NOW, receivedAt: NOW, searchScope: request.searchScope, universePolicy: request.universePolicy,
      permittedUniverse: [...request.permittedUniverse], citations: [], sources: [],
      providerState: { status: "available", failures: [] }, classifierState: { status: "available", failures: [] } },
  };
}

function rejectedAlternative(request: StrategyDiscoveryRequest) {
  const fixture = noLeads(request);
  fixture.payload.hypotheses = [{
    id: "illustrative-fixed-fee-rejection", title: "Illustrative fixed-fee alternative", use: "new_play", horizon: "swing",
    disposition: "reject", rejectionReasons: ["Illustrative fixed-fee alternative has no usage-linked uplift."],
    whyThisUse: "Test retention of an explicitly rejected economic hypothesis.",
    whyNow: "Illustrative comparison only; no current market event is asserted.",
    whyNotAlternatives: "No alternative is qualified or allocated by this fixture.", changeCondition: "Verify a different commercial mechanism.",
    causalPath: {
      id: "illustrative-fixed-fee-path", originatingSignal: { id: "illustrative-origin",
        statement: "Illustrative hypothesis of increased activity, not a reported observation.", assertionClass: "user_hypothesis",
        sourceIds: [], requiredConditions: [], contradictions: [], unknowns: ["No external evidence was retrieved."], invalidation: "Activity does not increase." },
      hops: [{ id: "illustrative-hop", from: "Hypothetical activity", to: "Illustrative fixed-fee supplier",
        assertion: { id: "illustrative-economic-link", statement: "Usage alone does not increase a fixed contractual fee.",
          assertionClass: "analyst_inference", sourceIds: [], requiredConditions: [], contradictions: [], unknowns: [], invalidation: "Contract terms change." },
        mechanism: { kind: "fixed_fee", commercialTermsStatus: "unverified" },
        estimatedImpact: { basis: "usage_driven", amountCents: null, description: "Illustrative unsupported uplift hypothesis; no amount asserted." },
        expectedTiming: "Unverified", nextFactToVerify: "Actual commercial terms", failureCondition: "Consideration remains fixed." }],
      affectedEntities: ["Illustrative fixed-fee supplier"], securityMapping: { entity: "Illustrative supplier", symbol: null, status: "unverified" },
      whatChangedFromExpectations: "No verified change; this is an explicitly rejected fixture.", counterargument: "Fixed consideration has no usage upside.",
      expectationsBaseline: null, technologyPermission: null, marketMeasurement: null, reviewAt: NOW + 3_600_000, expiresAt: NOW + 7_200_000,
    },
  }];
  return fixture;
}

// Independent test oracle: native MySQL JSON can reorder all object keys while
// preserving arrays. Reverse-order fixture writes must not invalidate receipts.
function ordered(value: unknown, reverse = false): unknown {
  if (Array.isArray(value)) return value.map(item => ordered(item, reverse));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (reverse) keys.reverse();
    return Object.fromEntries(keys.map(key => [key, ordered(record[key], reverse)]));
  }
  return value;
}
function receiptHash(row: Pick<typeof discoveries.$inferSelect,
  "userId" | "decisionRunId" | "decisionRevisionId" | "jobId" | "attempt" | "attemptToken" | "createdAt" |
  "request" | "payload" | "manifest" | "result">) {
  return createHash("sha256").update(JSON.stringify(ordered({
    userId: row.userId, decisionRunId: row.decisionRunId, decisionRevisionId: row.decisionRevisionId,
    jobId: row.jobId, attempt: row.attempt, attemptToken: row.attemptToken, createdAt: row.createdAt,
    request: parsePersistedJson(row.request), payload: parsePersistedJson(row.payload),
    manifest: parsePersistedJson(row.manifest), result: parsePersistedJson(row.result),
  }))).digest("hex");
}
function readOnly<T extends { mutations: { analysisStarted: boolean } }>(result: T) {
  return { ...result, mutations: { ...result.mutations, analysisStarted: false } };
}
function latch() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
async function bounded<T>(promise: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), 10_000);
    })]);
  } finally { clearTimeout(timer); }
}

describe("accepted objective discovery — actual isolated workflow persistence", () => {
  let db: Db;
  let acceptance: typeof import("./objectiveMission");
  let workflow: typeof import("./strategyDiscoveryWorkflow");
  let owners: Owner[] = [], ownerIds: number[] = [];
  let unchanged: Awaited<ReturnType<typeof sideEffects>> | null = null;
  let savedMissions: Awaited<ReturnType<typeof missionRows>> | null = null;
  let outsideWork: Awaited<ReturnType<typeof outsideRows>> | null = null;
  const network = vi.fn(() => { throw new Error("Provider/broker HTTP forbidden in discovery workflow integration"); });
  const provider = () => vi.fn<DiscoveryProvider>(async request => noLeads(request));
  const execute = (produce: DiscoveryProvider, owner = owners[0], retryJobId?: number) =>
    workflow.executeObjectiveDiscovery(db, owner.userId, { ...owner.identity, ...(retryJobId == null ? {} : { retryJobId }) }, produce);
  const read = (owner = owners[0]) => workflow.readObjectiveDiscovery(db, owner.userId, owner.identity);

  function values(accountId: number): MissionDraftValues {
    return { ...emptyMissionDraftValues(), accountId, activeSection: 3,
      capital: "8,000.25", maxLoss: "500.10", targetProfit: "1,200.50", targetPeriod: "week",
      holdingPeriod: "swing", holdingPeriods: ["swing", "position"], instrument: "either", includeHeld: true,
      mission: "Illustrative capital question: compare uses of declared excess capital, including retaining it. Verify any mechanism before allocation.",
      strategyContext: { schemaVersion: 1, requestId: REQUEST_ID, intent: "deploy_excess_capital",
        searchScope: "broader_permitted_universe", requestedSymbols: [], declarationId: DECLARATION_ID, sourceOrder: null, profitReserve: "200.00" } };
  }
  async function missionRows() {
    return {
      heads: await db.select().from(apertureDecisionRuns).orderBy(apertureDecisionRuns.id),
      revisions: await db.select().from(apertureDecisionRevisions).orderBy(apertureDecisionRevisions.id),
      drafts: await db.select().from(apertureMissionDrafts).orderBy(apertureMissionDrafts.id),
      history: await db.select().from(apertureMissionDraftRevisions).orderBy(apertureMissionDraftRevisions.id),
    };
  }
  async function workRows(owner?: Owner) {
    const ids = owner ? [owner.userId] : ownerIds;
    return {
      jobs: await db.select().from(jobs).where(inArray(jobs.userId, ids)).orderBy(jobs.id),
      receipts: await db.select().from(discoveries).where(inArray(discoveries.userId, ids)).orderBy(discoveries.id),
    };
  }
  async function outsideRows() {
    return {
      jobs: (await db.select().from(jobs).orderBy(jobs.id)).filter(row => !ownerIds.includes(row.userId)),
      receipts: (await db.select().from(discoveries).orderBy(discoveries.id)).filter(row => !ownerIds.includes(row.userId)),
    };
  }
  async function sideEffects() {
    // Full rows over the EXACT disposable DB, not counts or selected owners.
    // Catch cross-owner inserts/updates/deletes and research children even if a
    // buggy write supplied a foreign run/account. No forbidden sentinel writes.
    return {
      users: await db.select().from(users).orderBy(users.id),
      accounts: await db.select().from(portfolioAccounts).orderBy(portfolioAccounts.id),
      theses: await db.select().from(thesisCompilations).orderBy(thesisCompilations.id),
      projections: await db.select().from(capitalTheses).orderBy(capitalTheses.id),
      research: await db.select().from(apertureRuns).orderBy(apertureRuns.id),
      researchResults: await db.select().from(researchResults).orderBy(researchResults.id),
      candidates: await db.select().from(apertureCandidates).orderBy(apertureCandidates.id),
      underwriting: await db.select().from(apertureUnderwritingRuns).orderBy(apertureUnderwritingRuns.id),
      underwritingRevisions: await db.select().from(apertureUnderwritingRevisions).orderBy(apertureUnderwritingRevisions.id),
      evidence: await db.select().from(apertureEvidenceReviews).orderBy(apertureEvidenceReviews.id),
      orders: await db.select().from(brokerOrders).orderBy(brokerOrders.id),
      checks: await db.select().from(monitoringChecks).orderBy(monitoringChecks.id),
      positions: await db.select().from(positions).orderBy(positions.id),
      snapshots: await db.select().from(positionSnapshots).orderBy(positionSnapshots.id),
      events: await db.select().from(apertureCapitalEvents).orderBy(apertureCapitalEvents.id),
      claims: await db.select().from(apertureCapitalClaims).orderBy(apertureCapitalClaims.id),
      attention: await db.select().from(apertureAttentionBaselines).orderBy(apertureAttentionBaselines.id),
    };
  }
  async function assertBlockedWithoutWrites(action: () => Promise<unknown>, code = "PRECONDITION_FAILED") {
    const before = await workRows();
    await expect(action()).rejects.toMatchObject({ code });
    expect(await workRows()).toEqual(before);
  }

  beforeAll(async () => {
    requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
    vi.spyOn(Date, "now").mockReturnValue(NOW); // Keep real timers/socket IO for concurrency.
    vi.stubGlobal("fetch", network);
    vi.spyOn(http, "request").mockImplementation(network); vi.spyOn(http, "get").mockImplementation(network);
    vi.spyOn(https, "request").mockImplementation(network); vi.spyOn(https, "get").mockImplementation(network);
    const { getDb } = await import("../db");
    db = (await getDb())!;
    if (!db) throw new Error("Exact disposable database unavailable; no fallback permitted");
    acceptance = await import("./objectiveMission");
    workflow = await import("./strategyDiscoveryWorkflow");
    // Missing main-owned schema integration is a failure, never a CREATE fallback.
    await db.select().from(discoveries).limit(0);
    await db.select().from(jobs).limit(0);
    await db.select().from(apertureDecisionRuns).limit(0);
  });
  beforeEach(async () => {
    requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
    owners = []; ownerIds = []; unchanged = null; savedMissions = null; outsideWork = null;
    network.mockClear(); liveProvider.mockClear();
    vi.stubEnv("CAPITAL_OBJECTIVE_MISSIONS_ENABLED", "true");
    vi.stubEnv("CAPITAL_STRATEGY_DISCOVERY_ENABLED", "true");
    vi.stubEnv("ISOLATED_UAT_MODE", "true");
    const accounts: Array<{ userId: number; accountId: number }> = [];
    for (let i = 0; i < 2; i++) {
      const openId = `uat_discovery_${randomUUID()}`;
      expect(openId.length).toBeLessThanOrEqual(64);
      const [user] = await db.insert(users).values({ openId, name: "Illustrative no-thesis discovery owner", role: "capital_operator" });
      const userId = Number(user.insertId); ownerIds.push(userId);
      const [account] = await db.insert(portfolioAccounts).values({ userId, label: `Illustrative discovery paper account ${i + 1}`,
        brokerId: "manual", isPaper: true, cashCents: 5_000_000, equityValueCents: 10_000_000,
        lastSyncedAt: NOW - 5000, createdAt: NOW - 5000, updatedAt: NOW - 5000 });
      accounts.push({ userId, accountId: Number(account.insertId) });
    }
    unchanged = await sideEffects();
    outsideWork = await outsideRows();
    for (const owner of accounts) {
      const input = values(owner.accountId);
      expect(input.canonicalThesisId).toBeNull();
      await db.transaction(async tx => {
        const [draft] = await tx.insert(apertureMissionDrafts).values({ userId: owner.userId, version: 1, values: input,
          completedAt: null, createdAt: NOW - 100, updatedAt: NOW - 100 });
        await tx.insert(apertureMissionDraftRevisions).values({ draftId: Number(draft.insertId), userId: owner.userId,
          version: 1, values: input, completedAt: null, createdAt: NOW - 100 });
      });
      const accepted = await acceptance.acceptObjectiveMission(db, owner.userId, { expectedVersion: 1, requestId: REQUEST_ID }, NOW);
      expect(accepted).toMatchObject({ status: "accepted", created: true });
      owners.push({ ...owner, identity: { decisionRunId: accepted.decisionRunId, decisionRevisionId: accepted.revisionId } });
    }
    savedMissions = await missionRows();
    for (const owner of owners) {
      expect(savedMissions.heads.find(row => row.id === owner.identity.decisionRunId)).toMatchObject({ userId: owner.userId,
        contextKind: "objective", canonicalThesisId: null, capitalThesisId: null, clientRequestId: REQUEST_ID,
        accountId: owner.accountId, researchRunId: null, currentRevisionId: owner.identity.decisionRevisionId, lifecycle: "mission" });
      expect(savedMissions.revisions.find(row => row.id === owner.identity.decisionRevisionId)).toMatchObject({ invalidationRule: null, selectedCandidateId: null, plannedRiskCents: 0 });
      expect(unchanged.users.find(row => row.id === owner.userId)?.activeCapitalThesisId).toBeNull();
    }
    expect(await sideEffects()).toEqual(unchanged); // Actual acceptance also has no collateral writes.
    expect(await workRows()).toEqual({ jobs: [], receipts: [] });
  }, 30_000);
  afterEach(async () => {
    if (!db || !ownerIds.length) return;
    try {
      expect(network).not.toHaveBeenCalled(); expect(liveProvider).not.toHaveBeenCalled();
      if (unchanged) expect(await sideEffects()).toEqual(unchanged);
      if (savedMissions) expect(await missionRows()).toEqual(savedMissions);
      if (outsideWork) expect(await outsideRows()).toEqual(outsideWork);
    } finally {
      requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
      // Only this test's allowed fixtures/jobs/discoveries. Never truncate or
      // delete broker/evidence/position/ledger/thesis/research rows to hide a bug.
      await db.transaction(async tx => {
        await tx.delete(discoveries).where(inArray(discoveries.userId, ownerIds));
        await tx.delete(jobs).where(inArray(jobs.userId, ownerIds));
        await tx.delete(apertureMissionDraftRevisions).where(inArray(apertureMissionDraftRevisions.userId, ownerIds));
        await tx.delete(apertureMissionDrafts).where(inArray(apertureMissionDrafts.userId, ownerIds));
        await tx.delete(apertureDecisionRevisions).where(inArray(apertureDecisionRevisions.createdByUserId, ownerIds));
        await tx.delete(apertureDecisionRuns).where(inArray(apertureDecisionRuns.userId, ownerIds));
        await tx.delete(portfolioAccounts).where(inArray(portfolioAccounts.userId, ownerIds));
        await tx.delete(users).where(inArray(users.id, ownerIds));
      });
    }
  }, 30_000);
  afterAll(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("discovers from actual accepted no-thesis inputs and reads/reuses the immutable no-lead receipt", async () => {
    const produce = provider();
    const notStarted = await read();
    expect(notStarted).toMatchObject({ job: { state: "not_started" }, receipt: null, history: [],
      mutations: { analysisStarted: false, allocationCreated: false, orderCreated: false } });
    expect(await workRows()).toEqual({ jobs: [], receipts: [] });
    const result = await execute(produce);
    expect(produce).toHaveBeenCalledTimes(1);
    const request = produce.mock.calls[0][0];
    const revision = savedMissions!.revisions.find(row => row.id === owners[0].identity.decisionRevisionId)!;
    expect(request).toEqual({ schemaVersion: 1, requestId: REQUEST_ID, missionHash: revision.missionHash,
      searchScope: "broader_permitted_universe", universePolicy: "cited_us_security_leads", permittedUniverse: [],
      mission: revision.missionText, holdingPeriods: ["swing", "position"], instrumentPreference: "either" });
    expect(result).toMatchObject({ ...owners[0].identity, account: { id: owners[0].accountId, isPaper: true },
      job: { state: "complete", canRetry: false }, usingPreviousResult: false,
      mutations: { analysisStarted: true, allocationCreated: false, orderCreated: false },
      receipt: { attempt: 1, request, result: { status: "incomplete", reviewedUniverse: [], hypotheses: [], rejectedHypotheses: [], confidence: null, investmentAlternatives: [] } } });
    const before = await workRows();
    expect(before.jobs).toHaveLength(1); expect(before.receipts).toHaveLength(1);
    expect(before.jobs[0]).toMatchObject({ userId: owners[0].userId, ...owners[0].identity, attempt: 1, state: "complete", resultRevisionId: null });
    const row = before.receipts[0];
    expect(row).toMatchObject({ userId: owners[0].userId, ...owners[0].identity, jobId: before.jobs[0].id,
      attempt: 1, attemptToken: before.jobs[0].attemptToken, createdAt: NOW });
    expect(row.recordHash).toBe(receiptHash(row));
    const payloadBytes = JSON.stringify(noLeads(request).payload);
    expect(parsePersistedJson(row.payload)).toEqual({ raw: payloadBytes });
    expect(result.receipt!.result.contentSha256).toBe(createHash("sha256").update(payloadBytes).digest("hex"));
    expect(parsePersistedJson(row.manifest)).toEqual({ raw: noLeads(request).context });
    expect(await read()).toEqual(readOnly(result)); expect(await read()).toEqual(readOnly(result));
    expect(await execute(produce)).toEqual(readOnly(result));
    expect(await workRows()).toEqual(before);
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it("reconciles an accepted request before any job without accepting or starting it again", async () => {
    const before = await workRows();
    const result = await workflow.resumeObjectiveDiscovery(db, owners[0].userId, { requestId: REQUEST_ID });
    expect(result).toEqual(await read());
    expect(result).toMatchObject({ ...owners[0].identity, sourceDraftVersion: 1,
      acceptedValues: values(owners[0].accountId), job: { state: "not_started" },
      mutations: { analysisStarted: false, allocationCreated: false, orderCreated: false } });
    expect(await workRows()).toEqual(before);
  });

  it("reconciles the same request ID within each owner rather than returning another owner's result", async () => {
    const produce = provider();
    const result = await execute(produce);
    const before = await workRows();
    expect(await workflow.resumeObjectiveDiscovery(db, owners[0].userId, { requestId: REQUEST_ID })).toEqual(readOnly(result));
    const other = await workflow.resumeObjectiveDiscovery(db, owners[1].userId, { requestId: REQUEST_ID });
    expect(other).toMatchObject({ ...owners[1].identity, account: { id: owners[1].accountId }, job: { state: "not_started" }, receipt: null });
    expect(await workflow.resumeObjectiveDiscovery(db, owners[0].userId, { requestId: NEXT_REQUEST_ID })).toBeNull();
    expect(await workRows()).toEqual(before);
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it("rejects a damaged original receipt during request reconciliation without rewriting it", async () => {
    const [revision] = await db.select().from(apertureDecisionRevisions).where(eq(apertureDecisionRevisions.id, owners[0].identity.decisionRevisionId));
    await db.update(apertureDecisionRevisions).set({ missionHash: "invalid-fixture-hash" }).where(eq(apertureDecisionRevisions.id, revision.id));
    try {
      await assertBlockedWithoutWrites(() => workflow.resumeObjectiveDiscovery(db, owners[0].userId, { requestId: REQUEST_ID }));
    } finally {
      await db.update(apertureDecisionRevisions).set({ missionHash: revision.missionHash }).where(eq(apertureDecisionRevisions.id, revision.id));
    }
  });

  it("survives database JSON key reordering without rewriting receipt hashes, results or jobs", async () => {
    const produce = provider();
    const original = await execute(produce);
    const initial = await workRows();
    const row = initial.receipts[0];
    const reordered = {
      request: ordered(parsePersistedJson(row.request), true) as typeof row.request,
      payload: ordered(parsePersistedJson(row.payload), true) as typeof row.payload,
      manifest: ordered(parsePersistedJson(row.manifest), true) as typeof row.manifest,
      result: ordered(parsePersistedJson(row.result), true) as typeof row.result,
    };
    expect(JSON.stringify(ordered(noLeads(produce.mock.calls[0][0]).payload, true))).not.toBe(JSON.stringify(noLeads(produce.mock.calls[0][0]).payload));
    expect(receiptHash({ ...row, ...reordered })).toBe(row.recordHash);
    // Controlled corruption-test seam: identical JSON values, different key order.
    // Do NOT recalculate recordHash or contentSha256 to make readback pass.
    await db.update(discoveries).set(reordered).where(and(eq(discoveries.id, row.id), eq(discoveries.userId, owners[0].userId)));
    await db.update(jobs).set({ request: ordered(parsePersistedJson(initial.jobs[0].request), true) as typeof initial.jobs[0]["request"] })
      .where(and(eq(jobs.id, row.jobId), eq(jobs.userId, owners[0].userId)));
    const reorderedRows = await workRows();
    expect(await read()).toEqual(readOnly(original));
    expect(await execute(produce)).toEqual(readOnly(original));
    expect(await workRows()).toEqual(reorderedRows);
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it("fences three concurrent executions to one provider, one job and one immutable receipt", async () => {
    const entered = latch(), release = latch();
    const produce = vi.fn<DiscoveryProvider>(async request => { entered.resolve(); await release.promise; return noLeads(request); });
    // Attach rejection handlers immediately; no unhandled rejection or dangling
    // worker is permitted to outlive fixture cleanup, even if an assertion fails.
    const attempts = Array.from({ length: 3 }, () => execute(produce));
    const settled = Promise.allSettled(attempts);
    let outcomes: Awaited<typeof settled> = [];
    try {
      await bounded(Promise.race([entered.promise, settled.then(() => { throw new Error("No concurrent execution entered the injected provider"); })]), "Discovery provider did not enter");
      const running = await workRows();
      expect(running.jobs).toHaveLength(1); expect(running.receipts).toEqual([]);
      expect(running.jobs[0]).toMatchObject({ state: "running", attempt: 1 });
      expect((await read()).job).toMatchObject({ state: "running", jobId: running.jobs[0].id });
      expect(await workRows()).toEqual(running);
      expect(produce).toHaveBeenCalledTimes(1);
    } finally {
      release.resolve();
      outcomes = await bounded(settled, "Concurrent discovery workers did not settle after release");
    }
    expect(outcomes.some(outcome => outcome.status === "fulfilled")).toBe(true);
    for (const outcome of outcomes) {
      if (outcome.status === "rejected") expect(outcome.reason).toMatchObject({ code: "CONFLICT" });
      else expect(outcome.value.job.state).toBe("complete");
    }
    expect(produce).toHaveBeenCalledTimes(1);
    const complete = await workRows();
    expect(complete.jobs).toHaveLength(1); expect(complete.receipts).toHaveLength(1);
    expect(complete.jobs[0]).toMatchObject({ attempt: 1, state: "complete" });
    expect(complete.receipts[0]).toMatchObject({ jobId: complete.jobs[0].id, attempt: 1 });
    await execute(produce);
    expect(await workRows()).toEqual(complete); expect(produce).toHaveBeenCalledTimes(1);
  }, 30_000);

  it("requires explicit failed retry of the same job and caps provider attempts at three", async () => {
    const produce = vi.fn<DiscoveryProvider>(async () => { throw new Error("Illustrative deterministic provider failure"); });
    await expect(execute(produce)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    const first = (await workRows()).jobs[0];
    expect(first).toMatchObject({ state: "failed", attempt: 1 });
    expect((await workRows()).receipts).toEqual([]);
    const tokens = new Set([first.attemptToken]);
    const failed = await workRows();
    expect((await read()).job).toMatchObject({ state: "failed", jobId: first.id });
    expect(await workRows()).toEqual(failed);
    await assertBlockedWithoutWrites(() => execute(produce));
    await assertBlockedWithoutWrites(() => execute(produce, owners[0], first.id + 1000));
    expect(produce).toHaveBeenCalledTimes(1);
    for (const attempt of [2, 3]) {
      await expect(execute(produce, owners[0], first.id)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
      const rows = await workRows();
      expect(rows.jobs).toHaveLength(1); expect(rows.receipts).toEqual([]);
      expect(rows.jobs[0]).toMatchObject({ id: first.id, requestKey: first.requestKey, createdAt: first.createdAt, state: "failed", attempt });
      expect(parsePersistedJson(rows.jobs[0].request)).toEqual(parsePersistedJson(first.request));
      tokens.add(rows.jobs[0].attemptToken);
    }
    expect(tokens.size).toBe(3); expect(produce).toHaveBeenCalledTimes(3);
    const cappedRows = await workRows();
    expect((await read()).job).toMatchObject({ state: "failed", jobId: first.id, canRetry: false, message: expect.stringMatching(/three attempts/i) });
    expect(await workRows()).toEqual(cappedRows);
    await assertBlockedWithoutWrites(() => execute(produce, owners[0], first.id));
    await assertBlockedWithoutWrites(() => execute(produce));
    expect(produce).toHaveBeenCalledTimes(3);
  });

  it("preserves the failed classifier receipt when an explicit retry succeeds on the same job", async () => {
    const malformed = vi.fn<DiscoveryProvider>(async request => ({ payload: "{malformed classifier JSON", context: noLeads(request).context }));
    const first = await execute(malformed);
    expect(first).toMatchObject({ job: { state: "failed" }, receipt: { attempt: 1, result: { status: "unavailable", hypotheses: [], coverageGaps: expect.arrayContaining(["invalid_json"]) } } });
    const failedRows = await workRows();
    const produce = provider();
    await assertBlockedWithoutWrites(() => execute(produce)); expect(produce).not.toHaveBeenCalled();
    const second = await execute(produce, owners[0], failedRows.jobs[0].id);
    expect(second).toMatchObject({ job: { state: "complete", jobId: failedRows.jobs[0].id }, receipt: { attempt: 2, result: { status: "incomplete" } } });
    const saved = await workRows();
    expect(saved.jobs).toHaveLength(1); expect(saved.jobs[0].attempt).toBe(2);
    expect(saved.receipts).toHaveLength(2); expect(saved.receipts[0]).toEqual(failedRows.receipts[0]);
    expect(second.history).toEqual([
      { id: saved.receipts[1].id, attempt: 2, createdAt: NOW, status: "incomplete" },
      { id: saved.receipts[0].id, attempt: 1, createdAt: NOW, status: "unavailable" },
    ]);
    expect(await read()).toEqual(readOnly(second)); expect(await execute(produce)).toEqual(readOnly(second));
    expect(await workRows()).toEqual(saved); expect(produce).toHaveBeenCalledTimes(1);
  });

  it.each(["swing", "overnight"] as const)("retains an explicit rejected %s hypothesis, even outside accepted horizons, never an investment alternative", async horizon => {
    const produce = vi.fn<DiscoveryProvider>(async request => {
      const fixture = rejectedAlternative(request); fixture.payload.hypotheses[0].horizon = horizon; return fixture;
    });
    const result = await execute(produce);
    expect(result.job.state).toBe("complete");
    expect(result.receipt!.result.hypotheses).toHaveLength(1);
    expect(result.receipt!.result.hypotheses[0]).toMatchObject({ id: "illustrative-fixed-fee-rejection", disposition: "rejected", confidence: null,
      reasons: expect.arrayContaining(["fixed_fee_has_no_usage_uplift", "Illustrative fixed-fee alternative has no usage-linked uplift."]) });
    expect(result.receipt!.result.rejectedHypotheses).toEqual([expect.objectContaining({ id: "illustrative-fixed-fee-rejection", index: 0 })]);
    expect(result.receipt!.result.investmentAlternatives).toEqual([]);
    const before = await workRows();
    expect(result.receipt!.result.coverageGaps).not.toContain("accepted_horizon_mismatch");
    expect(await read()).toEqual(readOnly(result)); expect(await execute(produce)).toEqual(readOnly(result));
    expect(await workRows()).toEqual(before); expect(produce).toHaveBeenCalledTimes(1);
  });

  it.each(["malformed_json", "schema_invalid", "classifier_failed"] as const)("records %s as unavailable, not a successful empty search", async kind => {
    const produce = vi.fn<DiscoveryProvider>(async request => {
      const fixture = noLeads(request);
      if (kind === "classifier_failed") fixture.context.classifierState = { status: "failed", failures: ["Illustrative classifier receipt failed validation."] };
      return { payload: kind === "malformed_json" ? "```json\n{}\n```" : kind === "schema_invalid" ? {} : fixture.payload, context: fixture.context };
    });
    const result = await execute(produce);
    expect(result.job.state).toBe("failed");
    expect(result.receipt!.result).toMatchObject({ status: "unavailable", hypotheses: [], investmentAlternatives: [], confidence: null });
    expect(result.receipt!.result.coverageGaps.length).toBeGreaterThan(0);
    const saved = await workRows();
    expect(saved.jobs).toHaveLength(1); expect(saved.jobs[0]).toMatchObject({ attempt: 1, state: "failed" });
    expect(saved.receipts).toHaveLength(1); expect(saved.receipts[0].recordHash).toBe(receiptHash(saved.receipts[0]));
    expect(await read()).toEqual(readOnly(result)); await assertBlockedWithoutWrites(() => execute(produce));
    expect(await workRows()).toEqual(saved); expect(produce).toHaveBeenCalledTimes(1);
  });

  it("isolates owner reads, mixed Mission identities and retry IDs despite the same request UUID", async () => {
    const good = provider(), outsider = provider();
    await assertBlockedWithoutWrites(() => workflow.readObjectiveDiscovery(db, owners[1].userId, owners[0].identity), "NOT_FOUND");
    await assertBlockedWithoutWrites(() => workflow.executeObjectiveDiscovery(db, owners[1].userId, owners[0].identity, outsider), "NOT_FOUND");
    await assertBlockedWithoutWrites(() => workflow.executeObjectiveDiscovery(db, owners[0].userId,
      { ...owners[0].identity, decisionRevisionId: owners[1].identity.decisionRevisionId }, outsider), "NOT_FOUND");
    expect(outsider).not.toHaveBeenCalled();
    const own = await execute(good);
    const failing = vi.fn<DiscoveryProvider>(async () => { throw new Error("Illustrative outsider failure"); });
    await expect(execute(failing, owners[1])).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await assertBlockedWithoutWrites(() => execute(outsider, owners[1], own.job.jobId!));
    expect(outsider).not.toHaveBeenCalled();
    const beforeOwn = await workRows(owners[0]);
    const otherJob = (await workRows(owners[1])).jobs[0];
    const other = await execute(outsider, owners[1], otherJob.id);
    expect(other.job.jobId).not.toBe(own.job.jobId);
    expect(other.receipt!.request.requestId).toBe(own.receipt!.request.requestId);
    expect(other.receipt!.id).not.toBe(own.receipt!.id);
    expect(await workRows(owners[0])).toEqual(beforeOwn);
    expect((await workRows(owners[1])).receipts[0]).toMatchObject({ userId: owners[1].userId, ...owners[1].identity, jobId: otherJob.id });
    await assertBlockedWithoutWrites(() => workflow.readObjectiveDiscovery(db, owners[1].userId, owners[0].identity), "NOT_FOUND");
    expect(await read()).toEqual(readOnly(own));
  });

  it.each(["missing", "bad_hash", "forged_result", "wrong_attempt", "attempt_token", "created_at"] as const)("fails closed on a completed discovery with %s receipt without recomputing or rerunning", async kind => {
    const produce = provider(); await execute(produce);
    const row = (await workRows()).receipts[0];
    const where = and(eq(discoveries.id, row.id), eq(discoveries.userId, owners[0].userId));
    if (kind === "missing") await db.delete(discoveries).where(where);
    else if (kind === "bad_hash") await db.update(discoveries).set({ recordHash: "0".repeat(64) }).where(where);
    else if (kind === "wrong_attempt") await db.update(discoveries).set({ attempt: 2 }).where(where);
    else if (kind === "attempt_token") await db.update(discoveries).set({ attemptToken: row.attemptToken === REQUEST_ID ? DECLARATION_ID : REQUEST_ID }).where(where);
    else if (kind === "created_at") await db.update(discoveries).set({ createdAt: row.createdAt + 1 }).where(where);
    else {
      // A matching record hash is insufficient: recompute classification from
      // original evidence rather than accepting a forged stored summary.
      const result = { ...parsePersistedJson(row.result), status: "complete" as const, coverageGaps: [] };
      await db.update(discoveries).set({ result, recordHash: receiptHash({ ...row, result }) }).where(where);
    }
    await assertBlockedWithoutWrites(() => read());
    await assertBlockedWithoutWrites(() => execute(produce));
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it.each(["missing_original", "invalid_gate"] as const)("refuses %s accepted Mission authority before creating a job or invoking the provider", async kind => {
    const owner = owners[0], produce = provider();
    if (kind === "missing_original") {
      await db.delete(apertureMissionDraftRevisions).where(and(eq(apertureMissionDraftRevisions.userId, owner.userId), eq(apertureMissionDraftRevisions.version, 1)));
    } else {
      await db.update(apertureDecisionRevisions).set({ gateSnapshot: { paperOnly: false } })
        .where(and(eq(apertureDecisionRevisions.id, owner.identity.decisionRevisionId), eq(apertureDecisionRevisions.createdByUserId, owner.userId)));
    }
    savedMissions = await missionRows(); // Only this deliberate authority-corruption fixture changed.
    await assertBlockedWithoutWrites(() => read()); await assertBlockedWithoutWrites(() => execute(produce));
    expect(produce).not.toHaveBeenCalled(); expect(await workRows()).toEqual({ jobs: [], receipts: [] });
  });

  it.each(["CAPITAL_OBJECTIVE_MISSIONS_ENABLED", "CAPITAL_STRATEGY_DISCOVERY_ENABLED"])("fails closed when %s is disabled", async flag => {
    const produce = provider(); vi.stubEnv(flag, "false");
    await assertBlockedWithoutWrites(() => execute(produce));
    expect((await read()).job.state).toBe("not_started"); expect(produce).not.toHaveBeenCalled();
  });
  it("rejects an 8,001-character pending draft under the acceptance lock before completing it or creating a Mission", async () => {
    const owner = owners[0];
    const draft = savedMissions!.drafts.find(row => row.userId === owner.userId)!;
    const pending = values(owner.accountId);
    pending.strategyContext!.requestId = NEXT_REQUEST_ID;
    pending.mission = "Illustrative overlong capital question. ".padEnd(8001, "x");
    const version = draft.version + 1;
    // A later pending draft, not another acceptance of the old request UUID.
    await db.transaction(async tx => {
      await tx.update(apertureMissionDrafts).set({ values: pending, version, completedAt: null, updatedAt: NOW + 1 })
        .where(and(eq(apertureMissionDrafts.id, draft.id), eq(apertureMissionDrafts.userId, owner.userId), eq(apertureMissionDrafts.version, draft.version)));
      await tx.insert(apertureMissionDraftRevisions).values({ draftId: draft.id, userId: owner.userId,
        values: pending, version, completedAt: null, createdAt: NOW + 1 });
    });
    savedMissions = await missionRows();
    const workBefore = await workRows();
    const validate = vi.fn(async (tx: Pick<Db, "select">, input: MissionDraftValues) =>
      workflow.validateObjectiveDiscoveryDraft(tx, owner.userId, input));
    await expect(acceptance.acceptObjectiveMission(db, owner.userId,
      { expectedVersion: version, requestId: NEXT_REQUEST_ID }, NOW + 1, validate))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("8,000") });
    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.calls[0][1]).toEqual(pending);
    expect(await missionRows()).toEqual(savedMissions);
    expect(await workRows()).toEqual(workBefore);
  });
  it("requires the injected provider in isolated UAT even with both service flags enabled", async () => {
    await assertBlockedWithoutWrites(() => workflow.executeObjectiveDiscovery(db, owners[0].userId, owners[0].identity));
    expect(await workRows()).toEqual({ jobs: [], receipts: [] }); expect(liveProvider).not.toHaveBeenCalled();
  });
});

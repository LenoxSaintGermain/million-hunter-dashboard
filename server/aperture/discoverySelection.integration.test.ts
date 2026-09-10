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
  apertureAttentionBaselines, researchResults, apertureDiscoverySelections as selections,
  apertureStrategies, apertureSetAside, exposureNodes, exposureCoverage, securityFacts,
} from "../../drizzle/schema";
import { apertureUnderwritingJobs as jobs } from "../../drizzle/apertureUnderwritingJobSchema";
import { apertureStrategyDiscoveries as discoveries } from "../../drizzle/apertureStrategyDiscoverySchema";
import { emptyMissionDraftValues, type MissionDraftValues } from "../../shared/apertureMissionDraft";
import { parsePersistedJson } from "../../shared/persistedJson";
import { revisionJsonForInsert } from "./decisionReceiptBinding";
import { underwritePlayCandidates } from "../../shared/playUnderwriting";
import type { StrategyDiscoveryRequest } from "../../shared/strategyDiscoveryJob";
import type { StrategyDiscoveryContext, StrategyDiscoveryPayload } from "./strategyDiscovery";
import type { DiscoveryProvider } from "./strategyDiscoveryWorkflow";
import { requireIsolatedIntegrationDatabase } from "../../scripts/isolated-integration-identity.mjs";

// Collection must fail closed before database/service imports. Main owns the
// disposable harness, migrations and test-lane config. No dotenv or DB fallback.
requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
const forbidden = vi.hoisted(() => ({
  discovery: vi.fn(() => { throw new Error("Live discovery provider forbidden in selection integration"); }),
  underwriter: vi.fn(() => { throw new Error("Selection must not invoke Underwriter, even an illustrative fixture"); }),
  swarm: vi.fn(() => { throw new Error("Research requires an explicit fixture authorization"); }),
  macro: vi.fn(() => { throw new Error("Macro collection requires an explicit fixture authorization"); }),
}));
vi.mock("./strategyDiscoveryProvider", () => ({ discoverObjectiveMission: forbidden.discovery }));
vi.mock("./underwriter", () => ({ underwriteCapitalMission: forbidden.underwriter }));
vi.mock("./researchSwarm", () => ({ runResearchSwarm: forbidden.swarm }));
vi.mock("./providers/index", async original => ({ ...await original<typeof import("./providers/index")>(),
  collectMacroFacts: forbidden.macro,
}));

type Db = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;
type Identity = { decisionRunId: number; decisionRevisionId: number };
type Owner = { userId: number; accountId: number; otherAccountId: number; canonicalId: number; identity: Identity };
type SelectionInput = Identity & { discoveryReceiptId: number; hypothesisId: string };
type Selected = Awaited<ReturnType<typeof import("./discoverySelection").selectDiscoveryForResearch>>;
type Fixture = { payload: StrategyDiscoveryPayload; context: StrategyDiscoveryContext };
const NOW = Date.UTC(2026, 8, 10, 15);
const EXPIRES = NOW + 7_200_000;
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const DECLARATION_ID = "55555555-5555-4555-8555-555555555555";
const HYPOTHESIS = "illustrative-selection-lead";

/** Illustrative deterministic evidence ONLY; no market, underwriting or broker proof. */
function fixture(request: StrategyDiscoveryRequest): Fixture {
  return {
    context: {
      requestId: request.requestId, provider: "illustrative-injected-selection-fixture", asOf: NOW, receivedAt: NOW,
      searchScope: request.searchScope, universePolicy: request.universePolicy, permittedUniverse: [...request.permittedUniverse],
      citations: ["https://example.test/release", "https://example.test/contract"],
      sources: [
        { id: "release", originId: "announcement", originUrl: "https://example.test/release", sourceName: "Illustrative issuer release",
          sourceUrl: "https://example.test/release", observedAt: NOW - 300, publishedAt: NOW - 400, retrievedAt: NOW - 100,
          quality: { kind: "primary", basis: "Illustrative originating document, not retrieved evidence" } },
        { id: "contract", originId: "contract-filing", originUrl: "https://example.test/contract", sourceName: "Illustrative contract filing",
          sourceUrl: "https://example.test/contract", observedAt: NOW - 300, publishedAt: NOW - 400, retrievedAt: NOW - 100,
          quality: { kind: "primary", basis: "Illustrative independent filing, not retrieved evidence" } },
      ],
      providerState: { status: "available", failures: [] }, classifierState: { status: "available", failures: [] },
    },
    payload: { schemaVersion: 1, searchScope: request.searchScope, reviewedUniverse: ["DATA"],
      coverageGaps: ["Illustrative composite fixture; not a real market search or trading recommendation."],
      hypotheses: [{ id: HYPOTHESIS, title: "Illustrative usage-linked research lead", use: "new_play", horizon: "swing",
        disposition: "research_lead", rejectionReasons: [], whyThisUse: "Investigate illustrative variable consideration.",
        whyNow: "Illustrative comparison against a retained baseline; no current event asserted.",
        whyNotAlternatives: "Fixed consideration may not participate in usage growth.", changeCondition: "Verify actual commercial terms and adoption.",
        causalPath: {
          id: "illustrative-causal-path", originatingSignal: { id: "origin", statement: "Illustrative issuer claim of broader distribution.",
            assertionClass: "issuer_claim", sourceIds: ["release"], requiredConditions: [], contradictions: [], unknowns: [], invalidation: "Distribution is withdrawn." },
          hops: [{ id: "hop-1", from: "Illustrative distribution", to: "Variable consideration",
            assertion: { id: "economic-link", statement: "Illustrative contract varies with usage; actual adoption is unproven.", assertionClass: "analyst_inference",
              sourceIds: ["contract"], requiredConditions: ["Incremental usage occurs."], contradictions: ["Usage may displace existing business."], unknowns: [], invalidation: "Consideration is fixed." },
            mechanism: { kind: "variable_usage", commercialTermsStatus: "verified" },
            estimatedImpact: { basis: "usage_driven", amountCents: null, description: "No revenue amount estimated." },
            expectedTiming: "Next reporting period", nextFactToVerify: "Actual incremental adoption", failureCondition: "No adoption occurs." }],
          affectedEntities: ["Illustrative supplier"], securityMapping: { entity: "Illustrative supplier", symbol: "DATA", status: "unverified" },
          whatChangedFromExpectations: "Illustrative contract changes participation, subject to verifying incremental adoption.",
          counterargument: "Lower pricing elsewhere may offset participation.", expectationsBaseline: null, technologyPermission: null,
          marketMeasurement: null, reviewAt: NOW + 3_600_000, expiresAt: EXPIRES,
        },
      }],
    },
  };
}

// Independent native-JSON oracle: object ordering is not evidence tampering.
function ordered(value: unknown, reverse = false): unknown {
  if (Array.isArray(value)) return value.map(item => ordered(item, reverse));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>, keys = Object.keys(record).sort();
    if (reverse) keys.reverse();
    return Object.fromEntries(keys.map(key => [key, ordered(record[key], reverse)]));
  }
  return value;
}
function sourceHash(row: typeof discoveries.$inferSelect) {
  return createHash("sha256").update(JSON.stringify(ordered({
    userId: row.userId, decisionRunId: row.decisionRunId, decisionRevisionId: row.decisionRevisionId,
    jobId: row.jobId, attempt: row.attempt, attemptToken: row.attemptToken, createdAt: row.createdAt,
    request: parsePersistedJson(row.request), payload: parsePersistedJson(row.payload),
    manifest: parsePersistedJson(row.manifest), result: parsePersistedJson(row.result),
  }))).digest("hex");
}

describe("discovery selection — isolated persisted adversarial handoff", () => {
  let expectedUnderwriterCalls = 0;
  let researchFixtureRunId: number | null = null;
  let db: Db;
  let service: typeof import("./discoverySelection");
  let acceptance: typeof import("./objectiveMission");
  let workflow: typeof import("./strategyDiscoveryWorkflow");
  let owners: Owner[] = [], ownerIds: number[] = [];
  let providers: Array<ReturnType<typeof vi.fn<DiscoveryProvider>>> = [];
  const network = vi.fn(() => { throw new Error("Provider/broker HTTP forbidden in discovery selection integration"); });

  // Whole-table, ordered full rows: detect writes to foreign owners, modified
  // existing records, and children with unexpected owner/run/account bindings.
  async function snapshot() {
    return {
      users: await db.select().from(users).orderBy(users.id),
      accounts: await db.select().from(portfolioAccounts).orderBy(portfolioAccounts.id),
      canonical: await db.select().from(thesisCompilations).orderBy(thesisCompilations.id),
      projections: await db.select().from(capitalTheses).orderBy(capitalTheses.id),
      heads: await db.select().from(apertureDecisionRuns).orderBy(apertureDecisionRuns.id),
      revisions: await db.select().from(apertureDecisionRevisions).orderBy(apertureDecisionRevisions.id),
      selections: await db.select().from(selections).orderBy(selections.id),
      drafts: await db.select().from(apertureMissionDrafts).orderBy(apertureMissionDrafts.id),
      draftHistory: await db.select().from(apertureMissionDraftRevisions).orderBy(apertureMissionDraftRevisions.id),
      jobs: await db.select().from(jobs).orderBy(jobs.id),
      discoveries: await db.select().from(discoveries).orderBy(discoveries.id),
      research: await db.select().from(apertureRuns).orderBy(apertureRuns.id),
      researchResults: await db.select().from(researchResults).orderBy(researchResults.id),
      candidates: await db.select().from(apertureCandidates).orderBy(apertureCandidates.id),
      underwriting: await db.select().from(apertureUnderwritingRuns).orderBy(apertureUnderwritingRuns.id),
      underwritingRevisions: await db.select().from(apertureUnderwritingRevisions).orderBy(apertureUnderwritingRevisions.id),
      evidence: await db.select().from(apertureEvidenceReviews).orderBy(apertureEvidenceReviews.id),
      orders: await db.select().from(brokerOrders).orderBy(brokerOrders.id),
      checks: await db.select().from(monitoringChecks).orderBy(monitoringChecks.id),
      positions: await db.select().from(positions).orderBy(positions.id),
      positionSnapshots: await db.select().from(positionSnapshots).orderBy(positionSnapshots.id),
      events: await db.select().from(apertureCapitalEvents).orderBy(apertureCapitalEvents.id),
      claims: await db.select().from(apertureCapitalClaims).orderBy(apertureCapitalClaims.id),
      attention: await db.select().from(apertureAttentionBaselines).orderBy(apertureAttentionBaselines.id),
    };
  }
  async function blocked(action: () => Promise<unknown>, inputValidation = false) {
    const before = await snapshot();
    if (inputValidation) {
      await expect(action()).rejects.toSatisfy((error: { code?: string; name?: string }) =>
        error.name === "ZodError" || ["BAD_REQUEST", "NOT_FOUND", "PRECONDITION_FAILED", "CONFLICT"].includes(error.code ?? ""));
    } else await expect(action()).rejects.toSatisfy((error: { code?: string; message?: string }) =>
      ["NOT_FOUND", "PRECONDITION_FAILED", "CONFLICT"].includes(error.code ?? "")
      || /^Discovery research context:/.test(error.message ?? ""));
    expect(await snapshot()).toEqual(before);
  }
  async function source(owner = owners[0], mutate?: (value: Fixture) => void): Promise<SelectionInput> {
    const produce = vi.fn<DiscoveryProvider>(async request => {
      const value = fixture(request); mutate?.(value); return value;
    });
    providers.push(produce);
    const result = await workflow.executeObjectiveDiscovery(db, owner.userId, owner.identity, produce);
    expect(produce).toHaveBeenCalledTimes(1);
    expect(result.receipt).not.toBeNull();
    if (!mutate) expect(result.receipt!.result.hypotheses).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: HYPOTHESIS, disposition: "research_lead" }),
    ]));
    return { ...owner.identity, discoveryReceiptId: result.receipt!.id, hypothesisId: HYPOTHESIS };
  }
  const select = (input: SelectionInput, owner = owners[0], now = NOW) =>
    service.selectDiscoveryForResearch(db, owner.userId, input, now);
  async function childRows(selected: Selected) {
    const [head] = await db.select().from(apertureDecisionRuns).where(eq(apertureDecisionRuns.id, selected.decisionRunId));
    const [revision] = await db.select().from(apertureDecisionRevisions).where(eq(apertureDecisionRevisions.id, selected.decisionRevisionId));
    expect(head).toBeDefined(); expect(revision).toBeDefined();
    return { head, revision };
  }
  async function read(selected: Selected, owner = owners[0], now = NOW, forAdvancement = false) {
    const { head, revision } = await childRows(selected);
    return service.readDiscoveryResearchBinding(db, owner.userId, head, revision, now, forAdvancement);
  }
  async function assertOnlySelectionWrites(before: Awaited<ReturnType<typeof snapshot>>, selected: Selected, input: SelectionInput, owner = owners[0]) {
    const after = await snapshot();
    expect(selected).toMatchObject({ sourceDecisionRunId: input.decisionRunId, sourceRevisionId: input.decisionRevisionId,
      discoveryReceiptId: input.discoveryReceiptId, hypothesisId: input.hypothesisId });
    expect(selected.decisionRunId).not.toBe(input.decisionRunId);
    expect(selected.decisionRevisionId).not.toBe(input.decisionRevisionId);
    const selection = after.selections.find(row => row.id === selected.selectionId)!;
    expect(selection).toMatchObject({ userId: owner.userId, sourceDecisionRunId: input.decisionRunId,
      sourceRevisionId: input.decisionRevisionId, discoveryReceiptId: input.discoveryReceiptId, hypothesisId: input.hypothesisId,
      researchDecisionRunId: selected.decisionRunId, researchRevisionId: selected.decisionRevisionId });
    expect(selection.recordHash).toMatch(/^[a-f0-9]{64}$/);
    expect(selection.sourceRecordHash).toBe(after.discoveries.find(row => row.id === input.discoveryReceiptId)!.recordHash);
    const projection = after.projections.find(row => row.id === selection.capitalThesisId)!;
    expect(projection).toMatchObject({ userId: owner.userId, sourceCompilationId: null, isPrimary: false });
    expect(parsePersistedJson(projection.graph)).toMatchObject({ researchSymbols: ["DATA"] });
    expect(after.heads.find(row => row.id === selected.decisionRunId)).toMatchObject({ userId: owner.userId,
      contextKind: "discovery", canonicalThesisId: null, capitalThesisId: projection.id, accountId: owner.accountId,
      researchRunId: null, currentRevisionId: selected.decisionRevisionId, lifecycle: "mission" });
    expect(after.revisions.find(row => row.id === selected.decisionRevisionId)).toMatchObject({
      decisionRunId: selected.decisionRunId, createdByUserId: owner.userId, selectedCandidateId: null, plannedRiskCents: 0,
      operatorChoice: "research", effectiveBranch: "research", holdingPeriod: "swing",
    });
    const sourceEvent = after.events.find(row => row.userId === owner.userId && row.capitalEventId === `declaration:${DECLARATION_ID}`)!;
    expect(sourceEvent).toMatchObject({ accountId: owner.accountId, amountCents: 800_025,
      sourceId: `declared:${DECLARATION_ID}`, sourceKey: `declaration:${DECLARATION_ID}`,
      sourceKind: "operator_declared_excess", proofBasis: "operator_declared", currency: "USD" });
    expect(after.revisions.find(row => row.id === selected.decisionRevisionId)
      && parsePersistedJson(after.revisions.find(row => row.id === selected.decisionRevisionId)!.contextSnapshot))
      .toMatchObject({ capitalSourceEventId: sourceEvent.capitalEventId, availableCapitalCents: null });
    // Removing the authorized selection inserts and at most one stable source
    // registration must recover EVERY original row. Claims remain unchanged.
    // row, including objective head/revision, canonical thesis and active pointer.
    expect({ ...after,
      selections: after.selections.filter(row => row.id !== selection.id),
      projections: after.projections.filter(row => row.id !== projection.id),
      heads: after.heads.filter(row => row.id !== selected.decisionRunId),
      revisions: after.revisions.filter(row => row.id !== selected.decisionRevisionId),
      events: after.events.filter(row => row.id !== sourceEvent.id || before.events.some(old => old.id === row.id)),
    }).toEqual(before);
    const bound = await read(selected, owner);
    expect(bound.selection.id).toBe(selection.id);
    expect(bound.projection.id).toBe(projection.id);
    expect(bound.source).toBeDefined();
    expect(bound.symbol).toBe("DATA");
    expect(await snapshot()).toEqual(after); // Successful read is also read-only.
  }

  beforeAll(async () => {
    requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
    vi.spyOn(Date, "now").mockReturnValue(NOW); // Real timers and real transaction/socket contention.
    vi.stubGlobal("fetch", network);
    vi.spyOn(http, "request").mockImplementation(network); vi.spyOn(http, "get").mockImplementation(network);
    vi.spyOn(https, "request").mockImplementation(network); vi.spyOn(https, "get").mockImplementation(network);
    const { getDb } = await import("../db"); db = (await getDb())!;
    if (!db) throw new Error("Exact disposable database unavailable; no fallback permitted");
    acceptance = await import("./objectiveMission"); workflow = await import("./strategyDiscoveryWorkflow");
    service = await import("./discoverySelection");
    await db.select().from(selections).limit(0); // Missing main-owned schema is a failure, never auto-provisioned.
  });
  beforeEach(async () => {
    requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
    owners = []; ownerIds = []; providers = []; expectedUnderwriterCalls = 0; researchFixtureRunId = null;
    network.mockClear(); forbidden.discovery.mockClear(); forbidden.underwriter.mockClear();
    forbidden.swarm.mockClear(); forbidden.macro.mockClear();
    vi.stubEnv("CAPITAL_OBJECTIVE_MISSIONS_ENABLED", "true");
    vi.stubEnv("CAPITAL_STRATEGY_DISCOVERY_ENABLED", "true");
    vi.stubEnv("ISOLATED_UAT_MODE", "true");
    for (let index = 0; index < 2; index++) {
      const [user] = await db.insert(users).values({ openId: `uat_selection_${randomUUID()}`, name: "Illustrative selection owner", role: "capital_operator" });
      const userId = Number(user.insertId); ownerIds.push(userId);
      const accounts: number[] = [];
      for (let account = 0; account < 2; account++) {
        const [row] = await db.insert(portfolioAccounts).values({ userId, label: `Illustrative paper account ${index}-${account}`,
          brokerId: "manual", isPaper: true, cashCents: 5_000_000, equityValueCents: 10_000_000,
          lastSyncedAt: NOW - 5_000, createdAt: NOW - 5_000, updatedAt: NOW - 5_000 });
        accounts.push(Number(row.insertId));
      }
      // Non-null sentinel catches accidentally selecting/promoting a canonical
      // thesis. It is unrelated operator belief, not underwriting authority.
      const [canonical] = await db.insert(thesisCompilations).values({ userId, name: "Illustrative unchanged canonical belief",
        thesisText: "Illustrative stored operator belief, not external market evidence", status: "approved", templateUsed: "capital_trade" });
      const canonicalId = Number(canonical.insertId);
      await db.update(users).set({ activeCapitalThesisId: canonicalId }).where(eq(users.id, userId));
      const values: MissionDraftValues = { ...emptyMissionDraftValues(), accountId: accounts[0], activeSection: 3,
        capital: "8,000.25", maxLoss: "500.10", targetProfit: "1,200.50", targetPeriod: "week", holdingPeriod: "swing",
        holdingPeriods: ["swing", "position"], instrument: "either", includeHeld: true,
        mission: "Illustrative capital question: compare declared excess capital uses, including retaining it. Verify any mechanism before allocation.",
        strategyContext: { schemaVersion: 1, requestId: REQUEST_ID, intent: "deploy_excess_capital", searchScope: "broader_permitted_universe",
          requestedSymbols: [], declarationId: DECLARATION_ID, sourceOrder: null, profitReserve: "200.00" } };
      expect(values.canonicalThesisId).toBeNull();
      await db.transaction(async tx => {
        if (researchFixtureRunId != null) {
          await tx.delete(exposureCoverage).where(eq(exposureCoverage.runId, researchFixtureRunId));
          await tx.delete(apertureSetAside).where(eq(apertureSetAside.runId, researchFixtureRunId));
          await tx.delete(apertureStrategies).where(eq(apertureStrategies.runId, researchFixtureRunId));
          await tx.delete(apertureCandidates).where(eq(apertureCandidates.runId, researchFixtureRunId));
          await tx.delete(apertureRuns).where(eq(apertureRuns.id, researchFixtureRunId));
          const projections = await tx.select().from(capitalTheses).where(inArray(capitalTheses.userId, ownerIds));
          if (projections.length) await tx.delete(exposureNodes).where(inArray(exposureNodes.thesisId, projections.map(row => row.id)));
        }
        const [draft] = await tx.insert(apertureMissionDrafts).values({ userId, version: 1, values, completedAt: null, createdAt: NOW - 100, updatedAt: NOW - 100 });
        await tx.insert(apertureMissionDraftRevisions).values({ draftId: Number(draft.insertId), userId, version: 1, values, completedAt: null, createdAt: NOW - 100 });
      });
      const accepted = await acceptance.acceptObjectiveMission(db, userId, { expectedVersion: 1, requestId: REQUEST_ID }, NOW);
      owners.push({ userId, accountId: accounts[0], otherAccountId: accounts[1], canonicalId,
        identity: { decisionRunId: accepted.decisionRunId, decisionRevisionId: accepted.revisionId } });
    }
  }, 30_000);
  afterEach(async () => {
    if (!db || !ownerIds.length) return;
    try {
      expect(network).not.toHaveBeenCalled(); expect(forbidden.discovery).not.toHaveBeenCalled(); expect(forbidden.underwriter).toHaveBeenCalledTimes(expectedUnderwriterCalls);
      expect(forbidden.swarm).toHaveBeenCalledTimes(researchFixtureRunId == null ? 0 : 1);
      expect(forbidden.macro).toHaveBeenCalledTimes(researchFixtureRunId == null ? 0 : 1);
      for (const provider of providers) expect(provider).toHaveBeenCalledTimes(1);
    } finally {
      requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
      // Only this suite's accepted drafts, discovery and selection fixtures.
      // Never clean broker/evidence/research/ledger rows to conceal a regression.
      await db.transaction(async tx => {
        // Only the explicitly authorized router-journey fixture creates these.
        if (expectedUnderwriterCalls) {
          await tx.delete(apertureUnderwritingRevisions).where(inArray(apertureUnderwritingRevisions.createdByUserId, ownerIds));
          await tx.delete(apertureUnderwritingRuns).where(inArray(apertureUnderwritingRuns.userId, ownerIds));
        }
        await tx.delete(selections).where(inArray(selections.userId, ownerIds));
        await tx.delete(discoveries).where(inArray(discoveries.userId, ownerIds));
        await tx.delete(jobs).where(inArray(jobs.userId, ownerIds));
        await tx.delete(apertureDecisionRevisions).where(inArray(apertureDecisionRevisions.createdByUserId, ownerIds));
        await tx.delete(apertureDecisionRuns).where(inArray(apertureDecisionRuns.userId, ownerIds));
        await tx.delete(capitalTheses).where(inArray(capitalTheses.userId, ownerIds));
        await tx.delete(apertureMissionDraftRevisions).where(inArray(apertureMissionDraftRevisions.userId, ownerIds));
        await tx.delete(apertureMissionDrafts).where(inArray(apertureMissionDrafts.userId, ownerIds));
        await tx.delete(thesisCompilations).where(inArray(thesisCompilations.userId, ownerIds));
        await tx.delete(portfolioAccounts).where(inArray(portfolioAccounts.userId, ownerIds));
        await tx.delete(users).where(inArray(users.id, ownerIds));
      });
    }
  }, 30_000);
  afterAll(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  /** Synthetic persisted proposal tests the attachment boundary, NOT market
   * preflight or createOrder. All rows remain in the owned disposable DB. */
  async function withProposalFixture(check: (orderId: number) => Promise<void>) {
    const selected = await select(await source());
    const [head] = await db.select().from(apertureDecisionRuns).where(eq(apertureDecisionRuns.id, selected.decisionRunId));
    const [run] = await db.insert(apertureRuns).values({ userId: owners[0].userId, accountId: owners[0].accountId,
      thesisId: head.capitalThesisId!, deployableCapitalCents: 800025, status: "completed", createdAt: NOW });
    const runId = Number(run.insertId);
    const [candidate] = await db.insert(apertureCandidates).values({ runId, symbol: "DATA", role: "core", createdAt: NOW });
    const candidateId = Number(candidate.insertId);
    await db.update(apertureDecisionRuns).set({ researchRunId: runId }).where(eq(apertureDecisionRuns.id, selected.decisionRunId));
    const [order] = await db.insert(brokerOrders).values({ userId: owners[0].userId, accountId: owners[0].accountId,
      runId, candidateId, decisionRunId: selected.decisionRunId, decisionRevisionId: selected.decisionRevisionId,
      symbol: "DATA", side: "buy", intent: "open", status: "pending_approval", qty: 1,
      gatedNotionalCents: 100_000, paperAckAt: NOW, gateSnapshot: { passed: true, fixture: "Illustrative attachment only" },
      createdAt: NOW, updatedAt: NOW });
    const orderId = Number(order.insertId);
    try { await check(orderId); }
    finally {
      await db.delete(apertureCapitalClaims).where(and(eq(apertureCapitalClaims.userId, owners[0].userId), eq(apertureCapitalClaims.allocationId, `paper-order:${orderId}`)));
      await db.delete(brokerOrders).where(eq(brokerOrders.id, orderId));
      await db.delete(apertureCandidates).where(eq(apertureCandidates.id, candidateId));
      await db.delete(apertureRuns).where(eq(apertureRuns.id, runId));
    }
  }

  it("attaches a proposal's exact gated amount once, without changing the order", async () => withProposalFixture(async orderId => {
    const before = await snapshot();
    const attach = () => db.transaction(tx => service.reserveDiscoveryProposalCapital(tx, owners[0].userId, orderId));
    const first = await attach();
    expect(first).toMatchObject({ duplicate: false, claim: { amountCents: 100_000, state: "pending", allocationId: `paper-order:${orderId}` } });
    const after = await snapshot();
    expect({ ...after, claims: before.claims }).toEqual(before);
    expect(await attach()).toEqual({ ...first, duplicate: true });
    expect(await snapshot()).toEqual(after);
  }));

  it.each(["pending_approval", "approved"] as const)("actual operator rejection of %s releases its attached allocation", async status => withProposalFixture(async orderId => {
    await db.transaction(tx => service.reserveDiscoveryProposalCapital(tx, owners[0].userId, orderId));
    if (status === "approved") await db.update(brokerOrders).set({ status, approvedAt: NOW }).where(eq(brokerOrders.id, orderId));
    const before = await snapshot();
    const { rejectOrder } = await import("./orderFlow");
    await rejectOrder(orderId, owners[0].userId, "Illustrative deliberate rejection");
    const after = await snapshot();
    expect(after.orders.find(row => row.id === orderId)).toMatchObject({ status: "rejected", rejectionReason: "Illustrative deliberate rejection" });
    expect(after.claims.find(row => row.allocationId === `paper-order:${orderId}`)).toMatchObject({ state: "released", previousState: "pending", amountCents: 100_000 });
    expect({ ...after, orders: before.orders, claims: before.claims }).toEqual(before);
  }));

  it("refuses rejection when its allocation contradicts an unsubmitted proposal", async () => withProposalFixture(async orderId => {
    await db.transaction(tx => service.reserveDiscoveryProposalCapital(tx, owners[0].userId, orderId));
    // Simulate inconsistent persisted state, not a legitimate release transition.
    await db.update(apertureCapitalClaims).set({ state: "released" }).where(and(
      eq(apertureCapitalClaims.userId, owners[0].userId),
      eq(apertureCapitalClaims.allocationId, `paper-order:${orderId}`),
    ));
    const before = await snapshot();
    const { rejectOrder } = await import("./orderFlow");
    await expect(rejectOrder(orderId, owners[0].userId)).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  }));

  it("runs declared discovery through real gates, proposal, approval and explicit simulated dispatch", async () => withProposalFixture(async fixtureId => {
    const original = (await snapshot()).orders.find(row => row.id === fixtureId)!;
    await db.delete(brokerOrders).where(eq(brokerOrders.id, fixtureId));
    const providerId = `uat-gate-${randomUUID().slice(0, 8)}`;
    const { recordFacts } = await import("./facts");
    await recordFacts("DATA", [{ factKey: "adv_usd_30d", valueNum: 500_000_000, unit: "usd", basis: "verified",
      providerId, sourceName: "Illustrative deterministic gate fixture, not market evidence", sourceUrl: "https://example.test/illustrative-adv", asOf: NOW, ttlMs: 60_000 }], NOW);
    const brokers = await import("./brokers/index");
    const submit = vi.fn(async () => ({ status: "accepted", brokerOrderId: "illustrative-real-gates", filledQty: 0 }));
    const broker = vi.spyOn(brokers, "brokerFor").mockReturnValue({ available: () => true,
      capabilities: { paperTrading: true, serverSideExecution: true }, submitOrder: submit } as any);
    try {
      const { preflightOrder, createOrder, approveOrder, submitOrder } = await import("./orderFlow");
      const input = { runId: original.runId, candidateId: original.candidateId!, accountId: original.accountId, userId: owners[0].userId,
        symbol: "DATA", side: "buy" as const, intent: "open" as const, qty: 1, limitPriceCents: 100_000,
        orderType: "limit" as const, timeInForce: "day" as const, paperAcknowledgement: "PAPER", now: NOW,
        holdingPeriod: "swing", reason: "Illustrative conditional demand thesis confirmed by fixture evidence only",
        invalidationCondition: "Illustrative demand assumption fails below the recorded modeled stop",
        entryPriceCents: 100_000, stopPriceCents: 99_500, slippageCents: 0, catalystDeadlineAt: NOW + 86_400_000 };
      const before = await snapshot();
      for (const invalid of [{ ...input, reason: "" }, { ...input, stopPriceCents: 1 }]) {
        const blocked = await preflightOrder(invalid);
        expect(blocked.evaluation.passed).toBe(false);
        expect(blocked.evaluation.failures.length).toBeGreaterThan(0);
        expect(await snapshot()).toEqual(before);
        expect(submit).not.toHaveBeenCalled();
      }
      const preflight = await preflightOrder(input);
      expect(preflight.evaluation.failures).toEqual([]);
      expect(preflight.evaluation.passed).toBe(true);
      expect(await snapshot()).toEqual(before);
      const created = await createOrder(input);
      expect(submit).not.toHaveBeenCalled();
      await approveOrder(created.orderId, owners[0].userId, "APPROVE PAPER", NOW);
      expect(submit).not.toHaveBeenCalled();
      const sent = await submitOrder(created.orderId, owners[0].userId, "SUBMIT PAPER", NOW);
      expect(sent).toMatchObject({ status: "submitted", brokerOrderId: "illustrative-real-gates", filledQty: 0 });
      expect(submit).toHaveBeenCalledTimes(1);
      expect((await snapshot()).claims.find(row => row.allocationId === `paper-order:${created.orderId}`)).toMatchObject({ state: "committed", amountCents: 100_000 });
    } finally {
      broker.mockRestore();
      await db.delete(securityFacts).where(eq(securityFacts.providerId, providerId));
      const own = await db.select().from(brokerOrders).where(and(eq(brokerOrders.runId, original.runId), eq(brokerOrders.userId, owners[0].userId)));
      for (const row of own) {
        await db.delete(apertureCapitalClaims).where(and(eq(apertureCapitalClaims.userId, owners[0].userId), eq(apertureCapitalClaims.allocationId, `paper-order:${row.id}`)));
        await db.delete(brokerOrders).where(eq(brokerOrders.id, row.id));
      }
    }
  }));

  it.each(["preflight", "approve"] as const)("authorizes declared discovery %s only through persisted capital proof", async action => withProposalFixture(async orderId => {
    if (action === "approve") await db.transaction(tx => service.reserveDiscoveryProposalCapital(tx, owners[0].userId, orderId));
    const before = await snapshot(), order = before.orders.find(row => row.id === orderId)!;
    const { authorizeDecisionAction } = await import("./decisionRunway");
    const result = await authorizeDecisionAction({ action, userId: owners[0].userId, runId: order.runId,
      accountId: order.accountId, intent: "open", ...(action === "approve" ? { orderId } : {}) });
    expect(result).toMatchObject({ contextKind: "discovery", validBinding: true, declaredCapitalVerified: true,
      decisionRunId: order.decisionRunId, revisionId: order.decisionRevisionId });
    expect(await snapshot()).toEqual(before);
  }));

  it.each(["missing_claim", "missing_order", "wrong_account", "feature_off", "cash"] as const)("real discovery authority refuses %s without mutations", async kind => withProposalFixture(async orderId => {
    const order = (await snapshot()).orders.find(row => row.id === orderId)!;
    if (kind === "cash") await db.update(apertureDecisionRevisions).set({ effectiveBranch: "cash" }).where(eq(apertureDecisionRevisions.id, order.decisionRevisionId!));
    if (kind === "feature_off") vi.stubEnv("CAPITAL_STRATEGY_DISCOVERY_ENABLED", "false");
    const before = await snapshot();
    const { authorizeDecisionAction } = await import("./decisionRunway");
    await expect(authorizeDecisionAction({ action: kind === "missing_claim" || kind === "missing_order" ? "approve" : "preflight",
      userId: owners[0].userId, runId: order.runId, intent: "open",
      accountId: kind === "wrong_account" ? owners[0].otherAccountId : order.accountId,
      ...(kind === "missing_claim" ? { orderId } : {}),
    })).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  }));

  it.each(["pending", "approved", "other_claim", "missing_claim", "wrong_order", "changed_amount", "dispatched"] as const)("revalidation excludes only its exact pending reservation: %s", async kind => withProposalFixture(async orderId => {
    if (kind !== "missing_claim") await db.transaction(tx => service.reserveDiscoveryProposalCapital(tx, owners[0].userId, orderId));
    if (kind === "approved") await db.update(brokerOrders).set({ status: "approved", approvedAt: NOW }).where(eq(brokerOrders.id, orderId));
    if (kind === "changed_amount") await db.update(brokerOrders).set({ gatedNotionalCents: 200_000 }).where(eq(brokerOrders.id, orderId));
    if (kind === "dispatched") await db.update(brokerOrders).set({ status: "submitted", clientOrderId: "illustrative-sent" }).where(eq(brokerOrders.id, orderId));
    const before = await snapshot();
    const order = before.orders.find(row => row.id === orderId)!;
    if (kind === "other_claim") {
      const own = before.claims.find(row => row.allocationId === `paper-order:${orderId}`)!;
      const [source] = await db.select().from(apertureCapitalEvents).where(eq(apertureCapitalEvents.id, own.eventId));
      const { claimCapital } = await import("./capitalLedger");
      await db.transaction(tx => claimCapital(tx, owners[0].userId, { accountId: order.accountId,
        capitalEventId: source!.capitalEventId, allocationId: "illustrative-other-pending", amountCents: 50_000 }));
    }
    const beforeRead = await snapshot();
    const read = () => db.transaction(tx => service.readDiscoveryDeclaredEnvelope(tx, owners[0].userId, {
      decisionRunId: order.decisionRunId!, decisionRevisionId: order.decisionRevisionId!,
      ownOrderId: kind === "wrong_order" ? orderId + 999_999 : orderId,
    }));
    if (kind === "pending" || kind === "approved") expect(await read()).toMatchObject({ status: "operator_declared", deployableCents: 800_025 });
    else if (kind === "other_claim") expect(await read()).toMatchObject({ status: "blocked" });
    else await expect(read()).rejects.toThrow();
    expect(await snapshot()).toEqual(beforeRead);
  }));

  it.each([false, true])("actual proposal creation reserves once or rolls back (over budget=%s)", async overBudget => withProposalFixture(async fixtureId => {
    const original = (await snapshot()).orders.find(row => row.id === fixtureId)!;
    await db.delete(brokerOrders).where(eq(brokerOrders.id, fixtureId));
    await db.update(portfolioAccounts).set({ lastSyncedAt: NOW }).where(eq(portfolioAccounts.id, owners[0].accountId));
    const before = await snapshot();
    const gates = await import("./gates"), runway = await import("./decisionRunway"), brokers = await import("./brokers/index");
    const gate = vi.spyOn(gates, "evaluateOrderGates").mockReturnValue({ passed: true, results: [], failures: [] } as any);
    let arrivals = 0;
    let release!: () => void;
    const bothAtAuthorization = new Promise<void>(resolve => { release = resolve; });
    const authorizeActual = runway.authorizeDecisionAction;
    const authorization = vi.spyOn(runway, "authorizeDecisionAction").mockImplementation(async input => {
      if (!overBudget) { arrivals++; if (arrivals === 2) release(); await bothAtAuthorization; }
      return authorizeActual(input);
    });
    const broker = vi.spyOn(brokers, "brokerFor").mockReturnValue({ available: () => true,
      capabilities: { paperTrading: true, serverSideExecution: true } } as any);
    const input = { runId: original.runId, candidateId: original.candidateId!, accountId: original.accountId, userId: owners[0].userId,
      symbol: "DATA", side: "buy" as const, intent: "open" as const, qty: 1, limitPriceCents: overBudget ? 900_000 : 100_000,
      orderType: "limit" as const, timeInForce: "day" as const, paperAcknowledgement: "PAPER", now: NOW };
    try {
      const { createOrder } = await import("./orderFlow");
      if (overBudget) {
        await expect(createOrder(input)).rejects.toThrow();
        expect(await snapshot()).toEqual(before);
      } else {
        const settled = await Promise.allSettled([createOrder(input), createOrder(input)]);
        expect(settled.map(result => result.status)).toEqual(["fulfilled", "fulfilled"]);
        const attempts = settled.map(result => (result as PromiseFulfilledResult<Awaited<ReturnType<typeof createOrder>>>).value);
        expect(attempts.filter(result => result.created)).toHaveLength(1);
        expect(new Set(attempts.map(result => result.orderId)).size).toBe(1);
        const first = attempts.find(result => result.created)!;
        expect(arrivals).toBe(2);
        expect(first.created).toBe(true);
        const after = await snapshot();
        expect(after.claims.find(row => row.allocationId === `paper-order:${first.orderId}`)).toMatchObject({ amountCents: 100_000, state: "pending" });
        expect(after.orders.find(row => row.id === first.orderId)).toMatchObject({ status: "pending_approval", gatedNotionalCents: 100_000 });
        expect(await createOrder(input)).toEqual({ orderId: first.orderId, created: false });
        expect(await snapshot()).toEqual(after);
      }
    } finally {
      broker.mockRestore(); authorization.mockRestore(); gate.mockRestore();
      // Only orders created in this owned fixture run, including a failing test.
      const own = await db.select().from(brokerOrders).where(and(eq(brokerOrders.runId, original.runId), eq(brokerOrders.userId, owners[0].userId)));
      for (const row of own) {
        await db.delete(apertureCapitalClaims).where(and(eq(apertureCapitalClaims.userId, owners[0].userId), eq(apertureCapitalClaims.allocationId, `paper-order:${row.id}`)));
        await db.delete(brokerOrders).where(eq(brokerOrders.id, row.id));
      }
    }
  }));

  it.each(["accepted", "rejected", "timeout", "late_acceptance", "late_timeout"] as const)("actual approval and %s dispatch reconcile durable claims", async outcome => withProposalFixture(async orderId => {
    await db.transaction(tx => service.reserveDiscoveryProposalCapital(tx, owners[0].userId, orderId));
    await db.update(brokerOrders).set({ limitPriceCents: 100_000, orderType: "limit", timeInForce: "day", instrumentType: "shares" })
      .where(eq(brokerOrders.id, orderId));
    await db.update(portfolioAccounts).set({ lastSyncedAt: NOW }).where(eq(portfolioAccounts.id, owners[0].accountId));
    const before = await snapshot();
    // Market gate arithmetic is injected; decision/source authorization and
    // ledger transactions are real. This is not live market eligibility proof.
    const gates = await import("./gates"), brokers = await import("./brokers/index");
    const gate = vi.spyOn(gates, "evaluateOrderGates").mockReturnValue({ passed: true, results: [], failures: [] } as any);
    const submit = vi.fn(async () => {
      // Root connection read must see the committed lease/reservation before
      // invoking the broker. This is not a fake transaction-boundary counter.
      const during = await snapshot();
      expect(during.orders.find(row => row.id === orderId)).toMatchObject({ status: "submitted" });
      expect(during.claims.find(row => row.allocationId === `paper-order:${orderId}`)).toMatchObject({ state: "committed" });
      if (outcome.startsWith("late_")) {
        const { withPaperOrderClaimTransaction } = await import("./capitalLedger");
        await withPaperOrderClaimTransaction(db, owners[0].userId, orderId, async tx => {
          await tx.update(brokerOrders).set({ status: "filled", brokerOrderId: "illustrative-dispatch",
            filledQty: 1, filledAvgPriceCents: 100_000, filledAt: NOW }).where(eq(brokerOrders.id, orderId));
        });
      }
      if (outcome === "timeout" || outcome === "late_timeout") throw new Error("Illustrative lost broker response");
      return { status: outcome === "rejected" ? "rejected" : "pending", brokerOrderId: "illustrative-dispatch", filledQty: 0 };
    });
    const broker = vi.spyOn(brokers, "brokerFor").mockReturnValue({ available: () => true,
      capabilities: { paperTrading: true, serverSideExecution: true }, submitOrder: submit } as any);
    try {
      const { approveOrder, submitOrder } = await import("./orderFlow");
      await approveOrder(orderId, owners[0].userId, "APPROVE PAPER", NOW);
      expect(submit).not.toHaveBeenCalled();
      const approved = await snapshot();
      expect(approved.orders.find(row => row.id === orderId)).toMatchObject({ status: "approved" });
      expect(approved.claims.find(row => row.allocationId === `paper-order:${orderId}`)).toMatchObject({ state: "pending" });
      if (outcome === "timeout" || outcome === "late_timeout") await expect(submitOrder(orderId, owners[0].userId, "SUBMIT PAPER", NOW)).rejects.toThrow(/do not resubmit/);
      else await submitOrder(orderId, owners[0].userId, "SUBMIT PAPER", NOW);
      const after = await snapshot();
      expect(after.orders.find(row => row.id === orderId)).toMatchObject({ status: outcome.startsWith("late_") ? "filled" : outcome === "rejected" ? "rejected" : "submitted" });
      expect(after.claims.find(row => row.allocationId === `paper-order:${orderId}`)).toMatchObject({ state: outcome.startsWith("late_") ? "consumed" : outcome === "rejected" ? "released" : "committed" });
      if (outcome.startsWith("late_")) expect(after.orders.find(row => row.id === orderId)).toMatchObject({ filledQty: 1, filledAvgPriceCents: 100_000, dispatchError: null });
      expect({ ...after, orders: before.orders, claims: before.claims }).toEqual(before);
      await expect(submitOrder(orderId, owners[0].userId, "SUBMIT PAPER", NOW)).rejects.toThrow(/must be approved/);
      expect(submit).toHaveBeenCalledTimes(1);
      expect(await snapshot()).toEqual(after);
    } finally { broker.mockRestore(); gate.mockRestore(); }
  }));

  it.each([
    { label: "partial fill", status: "pending", filledQty: 0.5, claimState: "committed" },
    { label: "confirmed zero-fill rejection", status: "rejected", filledQty: 0, claimState: "released" },
    { label: "unknown-fill rejection", status: "rejected", filledQty: null, claimState: "committed" },
  ])("actual fill mirror reconciles $label without submitting", async scenario => withProposalFixture(async orderId => {
    await db.transaction(tx => service.reserveDiscoveryProposalCapital(tx, owners[0].userId, orderId));
    await db.update(brokerOrders).set({ status: "submitted", brokerOrderId: "illustrative-mirror",
      clientOrderId: "illustrative-client", submittedAt: NOW, filledQty: null }).where(eq(brokerOrders.id, orderId));
    const before = await snapshot();
    const brokers = await import("./brokers/index");
    const getOrder = vi.fn(async () => ({ status: scenario.status, brokerOrderId: "illustrative-mirror", filledQty: scenario.filledQty }));
    const broker = vi.spyOn(brokers, "brokerFor").mockReturnValue({ available: () => true, getOrder } as any);
    try {
      const { mirrorFills } = await import("./orderFlow");
      expect(await mirrorFills(owners[0].userId)).toBe(1);
      const after = await snapshot();
      expect(after.claims.find(row => row.allocationId === `paper-order:${orderId}`)).toMatchObject({ state: scenario.claimState });
      expect(after.orders.find(row => row.id === orderId)).toMatchObject({
        status: scenario.status === "pending" ? "submitted" : "rejected", filledQty: scenario.filledQty,
      });
      expect({ ...after, orders: before.orders, claims: before.claims }).toEqual(before);
      expect(await mirrorFills(owners[0].userId)).toBe(0);
      expect(await snapshot()).toEqual(after);
    } finally { broker.mockRestore(); }
  }));

  it.each(["over_budget", "failed_gate", "already_dispatched", "foreign_owner"] as const)("refuses %s proposal attachment without reserving capital", async kind => withProposalFixture(async orderId => {
    if (kind === "over_budget") await db.update(brokerOrders).set({ gatedNotionalCents: 900_000 }).where(eq(brokerOrders.id, orderId));
    if (kind === "failed_gate") await db.update(brokerOrders).set({ gateSnapshot: { passed: false } }).where(eq(brokerOrders.id, orderId));
    if (kind === "already_dispatched") await db.update(brokerOrders).set({ status: "submitted", clientOrderId: "illustrative-dispatch" }).where(eq(brokerOrders.id, orderId));
    const before = await snapshot();
    await expect(db.transaction(tx => service.reserveDiscoveryProposalCapital(tx, owners[kind === "foreign_owner" ? 1 : 0].userId, orderId))).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  }));

  it("rolls back an attachment with its caller transaction", async () => withProposalFixture(async orderId => {
    const before = await snapshot();
    await expect(db.transaction(async tx => {
      await service.reserveDiscoveryProposalCapital(tx, owners[0].userId, orderId);
      throw new Error("Illustrative caller rollback");
    })).rejects.toThrow("Illustrative caller rollback");
    expect(await snapshot()).toEqual(before);
  }));

  it("concurrent attachment retries resolve to one committed reservation", async () => withProposalFixture(async orderId => {
    const target = requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
    const mysql = await import("mysql2/promise"), { drizzle } = await import("drizzle-orm/mysql2");
    const connections: Awaited<ReturnType<typeof mysql.createConnection>>[] = [];
    const before = await snapshot();
    try {
      connections.push(await mysql.createConnection(target.toString()));
      connections.push(await mysql.createConnection(target.toString()));
      expect(connections[0].threadId).not.toBe(connections[1].threadId);
      const { withCapitalLedgerTransaction } = await import("./capitalLedger");
      const outcomes = await Promise.allSettled(connections.map(connection => withCapitalLedgerTransaction(drizzle(connection), tx =>
        service.reserveDiscoveryProposalCapital(tx, owners[0].userId, orderId))));
      const results = outcomes.map(result => {
        if (result.status === "rejected") throw new Error(`${result.reason?.message}; database cause: ${result.reason?.cause?.code} ${result.reason?.cause?.sqlMessage}`);
        return result.value;
      });
      expect(results.map(result => result.duplicate).sort()).toEqual([false, true]);
      expect(results[0].claim.id).toBe(results[1].claim.id);
      const after = await snapshot();
      expect(after.claims.length).toBe(before.claims.length + 1);
      expect({ ...after, claims: before.claims }).toEqual(before);
    } finally { await Promise.all(connections.map(connection => connection.end())); }
  }));

  it("selects one owned lead and a double click reuses exactly one child/projection without advancing anything", async () => {
    const input = await source(), before = await snapshot();
    const first = await select(input);
    expect(first.created).toBe(true);
    await assertOnlySelectionWrites(before, first, input);
    const selected = await snapshot();
    expect(await select(input)).toEqual({ ...first, created: false });
    expect(await snapshot()).toEqual(selected);
    expect((await read(first, owners[0], NOW, true)).symbol).toBe("DATA");
    expect(await snapshot()).toEqual(selected);
  });

  it("rejects a conflicting declaration amount without creating a child or claim", async () => {
    const input = await source();
    const { recordCapitalEvent } = await import("./capitalLedger");
    await db.transaction(tx => recordCapitalEvent(tx, owners[0].userId, {
      accountId: owners[0].accountId, sourceId: `declared:${DECLARATION_ID}`,
      sourceKey: `declaration:${DECLARATION_ID}`, capitalEventId: `declaration:${DECLARATION_ID}`,
      sourceKind: "operator_declared_excess", currency: "USD", amountCents: 1_200,
    }));
    const before = await snapshot();
    await expect(select(input)).rejects.toMatchObject({ code: "SOURCE_CONFLICT" });
    expect(await snapshot()).toEqual(before);
  });

  it("rolls back source registration if the final selection insert fails", async () => {
    const input = await source(), before = await snapshot();
    const failing = new Proxy(db, { get(target, key) {
      if (key === "transaction") return (operation: Parameters<Db["transaction"]>[0]) => db.transaction(tx => operation(new Proxy(tx, {
        get(transaction, method) {
          if (method === "insert") return (table: unknown) => {
            if (table === selections) throw new Error("Illustrative final-write failure");
            return transaction.insert(table as Parameters<typeof transaction.insert>[0]);
          };
          const member = Reflect.get(transaction, method);
          return typeof member === "function" ? member.bind(transaction) : member;
        },
      })));
      const member = Reflect.get(target, key);
      return typeof member === "function" ? member.bind(target) : member;
    }});
    await expect(service.selectDiscoveryForResearch(failing, owners[0].userId, input, NOW)).rejects.toThrow("Illustrative final-write failure");
    expect(await snapshot()).toEqual(before);
  });

  it("concurrent selection on distinct actual connections resolves to one committed child, revision and projection", async () => {
    const input = await source(), before = await snapshot();
    const target = requireIsolatedIntegrationDatabase(process.env.DATABASE_URL, process.env.ISOLATED_INTEGRATION_DATABASE);
    const mysql = await import("mysql2/promise"), { drizzle } = await import("drizzle-orm/mysql2");
    const connections: Awaited<ReturnType<typeof mysql.createConnection>>[] = [];
    try {
      // Sequential opening also guarantees cleanup if opening the second fails.
      connections.push(await mysql.createConnection(target.toString()));
      connections.push(await mysql.createConnection(target.toString()));
      expect(connections[0].threadId).not.toBe(connections[1].threadId);
      const results = await Promise.allSettled(connections.map(connection =>
        service.selectDiscoveryForResearch(drizzle(connection), owners[0].userId, input, NOW)));
      // Settle BOTH before releasing sockets or cleaning fixtures, even on error.
      expect(results.every(result => result.status === "fulfilled")).toBe(true);
      const selected = results.map(result => {
        if (result.status === "rejected") throw result.reason;
        return result.value;
      });
      expect(selected.map(result => result.created).sort()).toEqual([false, true]);
      expect({ ...selected[0], created: false }).toEqual({ ...selected[1], created: false });
      await assertOnlySelectionWrites(before, selected[0], input);
    } finally { await Promise.all(connections.map(connection => connection.end())); }
  }, 30_000);

  it("binds a selected lead to its one declared pool without asserting verified cash or writing", async () => {
    const selected = await select(await source());
    const before = await snapshot();
    const envelope = await db.transaction(tx => service.readDiscoveryDeclaredEnvelope(tx, owners[0].userId, selected));
    expect(envelope).toMatchObject({ status: "operator_declared", deployableCents: 800025,
      alreadyAllocatedCents: 0, blockers: [] });
    expect(await snapshot()).toEqual(before);
    await expect(db.transaction(tx => service.readDiscoveryDeclaredEnvelope(tx, owners[1].userId, selected))).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });

  it("does not recreate a missing declaration ledger from the selected lead", async () => {
    const selected = await select(await source());
    await db.delete(apertureCapitalEvents).where(eq(apertureCapitalEvents.userId, owners[0].userId));
    const before = await snapshot();
    await expect(db.transaction(tx => service.readDiscoveryDeclaredEnvelope(tx, owners[0].userId, selected))).rejects.toThrow("The recorded capital declaration is unavailable");
    expect(await snapshot()).toEqual(before);
  });

  it("reads existing commitments for the exact source instead of granting each lead a fresh pool", async () => {
    const selected = await select(await source());
    const { claimCapital } = await import("./capitalLedger");
    await db.transaction(tx => claimCapital(tx, owners[0].userId, {
      accountId: owners[0].accountId, capitalEventId: `declaration:${DECLARATION_ID}`,
      allocationId: "illustrative-existing-commitment", amountCents: 100_000,
    }));
    const before = await snapshot();
    const envelope = await db.transaction(tx => service.readDiscoveryDeclaredEnvelope(tx, owners[0].userId, selected));
    expect(envelope).toMatchObject({ status: "blocked", deployableCents: 0,
      alreadyAllocatedCents: 100_000, blockers: ["concurrent_allocation"] });
    expect(await snapshot()).toEqual(before);
  });

  it.each(["amount", "source", "account_binding", "expired"] as const)("refuses %s declaration proof without repair or order writes", async kind => {
    const selected = await select(await source());
    if (kind === "amount") await db.update(apertureCapitalEvents).set({ amountCents: 900_000 }).where(eq(apertureCapitalEvents.userId, owners[0].userId));
    if (kind === "source") await db.update(apertureCapitalEvents).set({ sourceId: "declared:substituted" }).where(eq(apertureCapitalEvents.userId, owners[0].userId));
    if (kind === "account_binding") await db.update(portfolioAccounts).set({ externalAccountId: "changed-binding" }).where(eq(portfolioAccounts.id, owners[0].accountId));
    if (kind === "expired") vi.mocked(Date.now).mockReturnValue(EXPIRES + 1);
    const before = await snapshot();
    try {
      await expect(db.transaction(tx => service.readDiscoveryDeclaredEnvelope(tx, owners[0].userId, selected))).rejects.toThrow();
      expect(await snapshot()).toEqual(before);
    } finally { vi.mocked(Date.now).mockReturnValue(NOW); }
  });

  it("deduplication is scoped by owner and receipt even when request UUID and hypothesis ID match", async () => {
    const own = await source(), other = await source(owners[1]);
    const before = await snapshot(), first = await select(own);
    await assertOnlySelectionWrites(before, first, own);
    const intermediate = await snapshot(), second = await select(other, owners[1]);
    expect(second.selectionId).not.toBe(first.selectionId);
    expect(second.decisionRunId).not.toBe(first.decisionRunId);
    await assertOnlySelectionWrites(intermediate, second, other, owners[1]);
    await blocked(() => select(own, owners[1]));
    await blocked(() => read(first, owners[1]));
  });

  it("distinct hypotheses in one owned receipt get distinct children and each deduplicates independently", async () => {
    const input = await source(owners[0], value => {
      const second = structuredClone(value.payload.hypotheses[0]);
      second.id = "illustrative-second-selection-lead";
      second.causalPath.id = "illustrative-second-causal-path";
      second.title = "Illustrative alternative mechanism for the same symbol";
      value.payload.hypotheses.push(second);
    });
    const before = await snapshot(), first = await select(input);
    await assertOnlySelectionWrites(before, first, input);
    const secondInput = { ...input, hypothesisId: "illustrative-second-selection-lead" };
    const intermediate = await snapshot(), second = await select(secondInput);
    expect(second.created).toBe(true);
    expect(second.selectionId).not.toBe(first.selectionId);
    expect(second.decisionRunId).not.toBe(first.decisionRunId);
    await assertOnlySelectionWrites(intermediate, second, secondInput);
    const both = await snapshot();
    expect(await select(input)).toEqual({ ...first, created: false });
    expect(await select(secondInput)).toEqual({ ...second, created: false });
    expect(await snapshot()).toEqual(both);
    const readEnvelope = (selected: Selected) => db.transaction(tx => service.readDiscoveryDeclaredEnvelope(tx, owners[0].userId, selected));
    const firstEnvelope = await readEnvelope(first), secondEnvelope = await readEnvelope(second);
    expect(secondEnvelope).toEqual(firstEnvelope);
    expect(firstEnvelope).toMatchObject({ status: "operator_declared", deployableCents: 800025 });
    const { claimCapital } = await import("./capitalLedger");
    await db.transaction(tx => claimCapital(tx, owners[0].userId, {
      accountId: owners[0].accountId, capitalEventId: `declaration:${DECLARATION_ID}`,
      allocationId: "illustrative-shared-source-claim", amountCents: 100_000,
    }));
    const withClaim = await snapshot();
    expect(await readEnvelope(first)).toMatchObject({ status: "blocked", blockers: ["concurrent_allocation"] });
    expect(await readEnvelope(second)).toMatchObject({ status: "blocked", blockers: ["concurrent_allocation"] });
    expect(await snapshot()).toEqual(withClaim);
  });

  it.each(["foreign_owner", "foreign_revision", "foreign_receipt", "unknown_hypothesis", "wrong_run"] as const)("rejects %s selection identity without writes", async kind => {
    const input = await source(), other = await source(owners[1]);
    const altered = { ...input };
    if (kind === "foreign_revision") altered.decisionRevisionId = other.decisionRevisionId;
    if (kind === "foreign_receipt") altered.discoveryReceiptId = other.discoveryReceiptId;
    if (kind === "unknown_hypothesis") altered.hypothesisId = "illustrative-absent-lead";
    if (kind === "wrong_run") altered.decisionRunId = other.decisionRunId;
    await blocked(() => select(altered, kind === "foreign_owner" ? owners[1] : owners[0]));
  });

  it.each(["null_receipt", "zero_run", "fractional_revision", "empty_hypothesis", "null_hypothesis"] as const)("rejects malformed %s at the service boundary", async kind => {
    const input = await source();
    // Deliberately bypass compile-time input shape; no runtime coercion is allowed.
    if (kind === "null_receipt") Object.assign(input, { discoveryReceiptId: null });
    if (kind === "zero_run") input.decisionRunId = 0;
    if (kind === "fractional_revision") input.decisionRevisionId = 1.5;
    if (kind === "empty_hypothesis") input.hypothesisId = "";
    if (kind === "null_hypothesis") Object.assign(input, { hypothesisId: null });
    await blocked(() => select(input), true);
  });

  it.each(["rejected", "unavailable", "null_symbol", "malformed_symbol", "unbound_reference", "malformed_reference", "wrong_horizon", "malformed_horizon", "null_horizon", "expired"] as const)("cannot select a %s hypothesis from an actual persisted discovery attempt", async kind => {
    const input = await source(owners[0], value => {
      const hypothesis = value.payload.hypotheses[0], path = hypothesis.causalPath;
      if (kind === "rejected") { hypothesis.disposition = "reject"; hypothesis.rejectionReasons = ["Illustrative rejected economic path."]; }
      if (kind === "unavailable") value.context.classifierState = { status: "failed", failures: ["Illustrative classifier unavailable."] };
      if (kind === "null_symbol") path.securityMapping.symbol = null;
      if (kind === "malformed_symbol") path.securityMapping.symbol = "NOT/A/US/SYMBOL";
      if (kind === "unbound_reference") path.originatingSignal.sourceIds = ["invented-reference"];
      if (kind === "malformed_reference") Object.assign(path.originatingSignal, { sourceIds: [null] });
      if (kind === "wrong_horizon") hypothesis.horizon = "intraday";
      if (kind === "malformed_horizon") Object.assign(hypothesis, { horizon: "forever" });
      if (kind === "null_horizon") Object.assign(hypothesis, { horizon: null });
      if (kind === "expired") path.expiresAt = NOW - 1;
    });
    await blocked(() => select(input));
  });

  it.each(["same_owner_other_account", "foreign_account", "non_paper", "account_owner", "missing_original", "not_current", "closed_objective", "missing_job", "failed_job", "job_attempt", "job_token", "job_request", "source_receipt"] as const)("requires intact current objective and source-job authority: %s", async kind => {
    const input = await source(), owner = owners[0];
    const [receipt] = await db.select().from(discoveries).where(eq(discoveries.id, input.discoveryReceiptId));
    if (kind === "same_owner_other_account" || kind === "foreign_account") await db.update(apertureDecisionRuns).set({
      accountId: kind === "foreign_account" ? owners[1].accountId : owner.otherAccountId,
    }).where(eq(apertureDecisionRuns.id, input.decisionRunId));
    if (kind === "non_paper") await db.update(portfolioAccounts).set({ isPaper: false }).where(eq(portfolioAccounts.id, owner.accountId));
    if (kind === "account_owner") await db.update(portfolioAccounts).set({ userId: owners[1].userId }).where(eq(portfolioAccounts.id, owner.accountId));
    if (kind === "missing_original") {
      const history = await db.select().from(apertureMissionDraftRevisions).where(eq(apertureMissionDraftRevisions.userId, owner.userId));
      await db.delete(apertureMissionDraftRevisions).where(eq(apertureMissionDraftRevisions.id, history.find(row => row.version === 1)!.id));
    }
    if (kind === "not_current") {
      // Explicit tamper fixture: a different persisted current revision, not a
      // fabricated research or underwriting receipt and not a null-only check.
      const [original] = await db.select().from(apertureDecisionRevisions).where(eq(apertureDecisionRevisions.id, input.decisionRevisionId));
      const { id: _id, ...fields } = original;
      const [next] = await db.insert(apertureDecisionRevisions).values({ ...fields, version: 2, previousRevisionId: original.id, createdAt: NOW + 1 });
      await db.update(apertureDecisionRuns).set({ currentRevisionId: Number(next.insertId) }).where(eq(apertureDecisionRuns.id, input.decisionRunId));
    }
    if (kind === "closed_objective") await db.update(apertureDecisionRuns).set({ lifecycle: "closed", closedAt: NOW }).where(eq(apertureDecisionRuns.id, input.decisionRunId));
    if (kind === "missing_job") await db.delete(jobs).where(eq(jobs.id, receipt.jobId));
    if (kind === "failed_job") await db.update(jobs).set({ state: "failed", milestone: "failed" }).where(eq(jobs.id, receipt.jobId));
    if (kind === "job_attempt") await db.update(jobs).set({ attempt: receipt.attempt + 1 }).where(eq(jobs.id, receipt.jobId));
    if (kind === "job_token") await db.update(jobs).set({ attemptToken: DECLARATION_ID }).where(eq(jobs.id, receipt.jobId));
    if (kind === "job_request") {
      const [job] = await db.select().from(jobs).where(eq(jobs.id, receipt.jobId));
      const request = parsePersistedJson(job.request)!;
      await db.update(jobs).set({ request: { ...request, discovery: { ...request.discovery!, missionHash: "0".repeat(64) } } }).where(eq(jobs.id, receipt.jobId));
    }
    if (kind === "source_receipt") await db.update(discoveries).set({ recordHash: "0".repeat(64) }).where(eq(discoveries.id, receipt.id));
    await blocked(() => select(input));
  });

  it.each(["missing_selection", "selection_hash", "selection_context", "source_hash", "source_rehashed", "source_owner", "source_revision", "graph", "projection_owner", "projection_canonical", "projection_primary", "child_context", "child_account", "child_revision", "child_hash"] as const)("immutable binding reads fail closed on %s tampering without repair writes", async kind => {
    const input = await source(), selected = await select(input), { head, revision } = await childRows(selected);
    const [selection] = await db.select().from(selections).where(eq(selections.id, selected.selectionId));
    if (kind === "missing_selection") await db.delete(selections).where(eq(selections.id, selection.id));
    if (kind === "selection_hash") await db.update(selections).set({ recordHash: "0".repeat(64) }).where(eq(selections.id, selection.id));
    if (kind === "selection_context") await db.update(selections).set({ context: { ...parsePersistedJson(selection.context), symbol: "ALT" } }).where(eq(selections.id, selection.id));
    if (kind === "source_hash") await db.update(selections).set({ sourceRecordHash: "0".repeat(64) }).where(eq(selections.id, selection.id));
    if (kind === "source_rehashed") {
      const [receipt] = await db.select().from(discoveries).where(eq(discoveries.id, input.discoveryReceiptId));
      const changed = { ...receipt, createdAt: receipt.createdAt + 1 };
      await db.update(discoveries).set({ createdAt: changed.createdAt, recordHash: sourceHash(changed) }).where(eq(discoveries.id, receipt.id));
    }
    if (kind === "source_owner") await db.update(discoveries).set({ userId: owners[1].userId }).where(eq(discoveries.id, input.discoveryReceiptId));
    if (kind === "source_revision") await db.update(selections).set({ sourceRevisionId: owners[1].identity.decisionRevisionId }).where(eq(selections.id, selection.id));
    if (kind === "graph") await db.update(capitalTheses).set({ graph: { researchSymbols: ["ALT"], horizons: ["intraday"] } }).where(eq(capitalTheses.id, selection.capitalThesisId));
    if (kind === "projection_owner") await db.update(capitalTheses).set({ userId: owners[1].userId }).where(eq(capitalTheses.id, selection.capitalThesisId));
    if (kind === "projection_canonical") await db.update(capitalTheses).set({ sourceCompilationId: owners[0].canonicalId }).where(eq(capitalTheses.id, selection.capitalThesisId));
    if (kind === "projection_primary") await db.update(capitalTheses).set({ isPrimary: true }).where(eq(capitalTheses.id, selection.capitalThesisId));
    if (kind === "child_context") await db.update(apertureDecisionRevisions).set({ contextSnapshot: { ...parsePersistedJson(revision.contextSnapshot), discoveryReceiptId: -1 } }).where(eq(apertureDecisionRevisions.id, revision.id));
    if (kind === "child_account") await db.update(apertureDecisionRuns).set({ accountId: owners[0].otherAccountId }).where(eq(apertureDecisionRuns.id, head.id));
    if (kind === "child_revision") await db.update(apertureDecisionRevisions).set({ decisionRunId: owners[1].identity.decisionRunId, version: 99 }).where(eq(apertureDecisionRevisions.id, revision.id));
    if (kind === "child_hash") await db.update(apertureDecisionRevisions).set({ missionHash: "0".repeat(64) }).where(eq(apertureDecisionRevisions.id, revision.id));
    await blocked(() => read(selected));
    await blocked(() => read(selected, owners[0], NOW, true));
    if (kind !== "missing_selection") await blocked(() => select(input)); // Dedup must not bless a corrupt binding.
  });

  it("recomputes source classification rather than trusting a forged result with a matching record hash", async () => {
    const input = await source(owners[0], value => {
      value.payload.hypotheses[0].disposition = "reject";
      value.payload.hypotheses[0].rejectionReasons = ["Illustrative rejected source hypothesis."];
    });
    const [receipt] = await db.select().from(discoveries).where(eq(discoveries.id, input.discoveryReceiptId));
    const result = parsePersistedJson(receipt.result)!;
    const forged = { ...result, status: "complete" as const, hypotheses: result.hypotheses.map(item => ({ ...item, disposition: "research_lead" as const, reasons: [] })) };
    await db.update(discoveries).set({ result: forged, recordHash: sourceHash({ ...receipt, result: forged }) }).where(eq(discoveries.id, receipt.id));
    await blocked(() => select(input));
  });

  it("keeps historical reads available after expiry but refuses advancement and new expired selection", async () => {
    const input = await source(), selected = await select(input), before = await snapshot();
    expect((await read(selected, owners[0], EXPIRES + 1)).symbol).toBe("DATA");
    expect(await snapshot()).toEqual(before);
    await blocked(() => read(selected, owners[0], EXPIRES, true));
    await blocked(() => read(selected, owners[0], EXPIRES + 1, true));
    const other = await source(owners[1]);
    await blocked(() => select(other, owners[1], EXPIRES + 1));
  });

  it("resume links resolve the current child revision while preserving the original selection", async () => {
    const input = await source(), selected = await select(input);
    const [first] = await db.select().from(apertureDecisionRevisions).where(eq(apertureDecisionRevisions.id, selected.decisionRevisionId));
    const { id: _id, ...original } = first;
    const [inserted] = await db.insert(apertureDecisionRevisions).values({ ...original, ...revisionJsonForInsert(first),
      version: 2, previousRevisionId: first.id, effectiveBranch: "conditional", createdAt: NOW });
    const revisionId = Number(inserted.insertId);
    await db.update(apertureDecisionRuns).set({ currentRevisionId: revisionId }).where(eq(apertureDecisionRuns.id, selected.decisionRunId));
    const before = await snapshot();
    const resumed = await service.readDiscoverySelections(db, owners[0].userId, owners[0].identity);
    expect(resumed).toEqual([{ ...selected, created: false, decisionRevisionId: revisionId }]);
    expect(await snapshot()).toEqual(before);
  });

  it("native JSON key reordering preserves valid binding hashes and does not trigger a replacement", async () => {
    const input = await source(), selected = await select(input), { revision } = await childRows(selected);
    const [selection] = await db.select().from(selections).where(eq(selections.id, selected.selectionId));
    const [projection] = await db.select().from(capitalTheses).where(eq(capitalTheses.id, selection.capitalThesisId));
    // Preserve scalar values and array ordering, and do not rewrite raw JSON bytes.
    await db.update(selections).set({ context: ordered(parsePersistedJson(selection.context), true) as typeof selection.context }).where(eq(selections.id, selection.id));
    await db.update(capitalTheses).set({ graph: ordered(parsePersistedJson(projection.graph), true) as typeof projection.graph }).where(eq(capitalTheses.id, projection.id));
    await db.update(apertureDecisionRevisions).set({ contextSnapshot: ordered(parsePersistedJson(revision.contextSnapshot), true) as typeof revision.contextSnapshot }).where(eq(apertureDecisionRevisions.id, revision.id));
    const before = await snapshot();
    expect((await read(selected)).symbol).toBe("DATA");
    expect(await select(input)).toEqual({ ...selected, created: false });
    expect(await snapshot()).toEqual(before);
  });

  it("the original objective still cannot enter legacy underwriting or research after selection", async () => {
    const input = await source(); await select(input);
    // Only rejection calls: no underwriting output, eligibility or broker proof is manufactured.
    const { apertureRouter } = await import("../apertureRouter");
    const [user] = await db.select().from(users).where(eq(users.id, owners[0].userId));
    const caller = apertureRouter.createCaller({ user, req: {} as never, res: {} as never });
    await blocked(() => caller.underwriter.run({ ...owners[0].identity, requestedPlayCount: 3 }));
    await blocked(() => caller.runway.startResearch({ decisionRunId: input.decisionRunId, revisionId: input.decisionRevisionId }));
    await blocked(() => caller.runway.startResearch({ decisionRunId: input.decisionRunId, revisionId: input.decisionRevisionId, uatCase: "qualified-play" }));
  });

  it.each([false, true])("public selection persists underwriting and resumes without new work (positive=%s)", async positive => {
    const input = await source(), before = await snapshot();
    expectedUnderwriterCalls = 1;
    forbidden.underwriter.mockImplementationOnce(async (args: any) => {
      expect(args.projection.sourceCompilationId).toBeNull();
      expect(parsePersistedJson(args.projection.graph).researchSymbols).toEqual(["DATA"]);
      expect(args.objective.deployableCapitalCents).toBe(800_025);
      expect(args.objective.maxPlannedLossCents).toBe(50_010);
      const metric = { value: null, direction: "unknown" as const, asOf: NOW,
        source: "Illustrative fixture; no market observation", freshness: positive ? "fresh" as const : "unknown" as const };
      return { result: underwritePlayCandidates({ objective: args.objective, now: NOW, requestedPlayCount: 3,
        market: { asOf: NOW, marketSession: "unknown", indexTrend: { spy: metric, qqq: metric, iwm: metric },
          keyThemes: [], catalysts: [], regime: "unknown", confidence: 0 },
        candidates: positive ? [{ symbol: "DATA", title: "Illustrative conditional research play", direction: "conditional",
          evidence: ["Illustrative contract mechanism; adoption still unverified."], sourceUrls: ["https://example.test/contract"],
          confirmationDescription: "Verify actual incremental adoption.", invalidationDescription: "Consideration is fixed.",
          liquidityScore: 50, portfolioFitScore: 75 }] : [], risk: { normalPlayRiskPct: 0.75, highConvictionRiskPct: 1.25,
          maxAggregateOpenRiskPct: 3, weeklyLossLimitPct: 4, eventRiskAllocationPct: 1.5,
          perPlayHeadroomCents: 75_000, aggregateOpenRiskBeforeCents: 0, weeklyLossUsedCents: 0 },
      }), providerAvailability: { illustrative_no_setup: true, provider_network_invoked: false } };
    });
    const { apertureRouter } = await import("../apertureRouter");
    const [user] = await db.select().from(users).where(eq(users.id, owners[0].userId));
    const caller = () => apertureRouter.createCaller({ user, req: {} as never, res: {} as never });
    const selected = await caller().underwriter.selectDiscovery(input);
    expect(selected.result.plays).toHaveLength(positive ? 1 : 0);
    if (positive) expect(selected.result.noTrade).toBeNull();
    else expect(selected.result.noTrade).not.toBeNull();
    expect(selected.createdResearchRun).toBe(false);
    expect(selected.createdBrokerOrder).toBe(false);
    const after = await snapshot();
    for (const key of ["users", "accounts", "canonical", "research", "researchResults", "candidates", "orders", "claims"] as const) {
      expect(after[key]).toEqual(before[key]);
    }
    expect((await caller().underwriter.status({ decisionRunId: selected.decisionRunId,
      decisionRevisionId: selected.decisionRevisionId })).state).toBe("complete");
    const reopened = await caller().underwriter.get({ decisionRunId: selected.decisionRunId });
    expect(reopened).toEqual(selected.result);
    const replayed = await caller().underwriter.selectDiscovery(input);
    expect(replayed.selectionId).toBe(selected.selectionId);
    expect(replayed.result.underwritingRevisionId).toBe(selected.result.underwritingRevisionId);
    expect(await snapshot()).toEqual(after);
    expect(forbidden.underwriter).toHaveBeenCalledTimes(1);
    if (positive) {
      const play = selected.result.plays[0];
      const validation = await caller().underwriter.validatePlay({ underwritingRunId: selected.result.underwritingRunId,
        underwritingRevisionId: selected.result.underwritingRevisionId, playId: play.id });
      expect(validation.createdResearchRun).toBe(false);
      expect(validation.createdBrokerOrder).toBe(false);
      forbidden.macro.mockImplementationOnce(async () => ({ facts: [], ranProviders: [], errors: [] }));
      forbidden.swarm.mockImplementationOnce(async () => undefined);
      const request = { decisionRunId: validation.decisionRunId, revisionId: validation.decisionRevisionId };
      const attempts = await Promise.allSettled([caller().runway.startResearch(request), caller().runway.startResearch(request)]);
      const first = attempts.find(attempt => attempt.status === "fulfilled");
      if (!first || first.status !== "fulfilled") throw new Error("No research dispatch completed");
      const started = first.value;
      expect(started.status).toBe("started");
      if (started.status !== "started") throw new Error("Expected exact research handoff");
      researchFixtureRunId = started.runId;
      expect(attempts.every(attempt => attempt.status === "fulfilled")).toBe(true);
      expect(attempts.map(attempt => attempt.status === "fulfilled" && attempt.value.status === "started" ? attempt.value.runId : null)).toEqual([started.runId, started.runId]);
      const recovered = await caller().runway.startResearch(request);
      expect(recovered.status === "started" && recovered.runId).toBe(started.runId);
      await vi.waitFor(async () => {
        const [run] = await db.select().from(apertureRuns).where(eq(apertureRuns.id, started.runId));
        expect(["completed", "failed"]).toContain(run.status);
        expect(run.error).toBeNull();
        expect(run.status).toBe("completed");
      }, { timeout: 8000, interval: 50 });
      const candidates = await db.select().from(apertureCandidates).where(eq(apertureCandidates.runId, started.runId));
      expect(candidates).toHaveLength(1);
      expect(candidates[0].symbol).toBe("DATA");
      expect(forbidden.swarm.mock.calls[0][0]).toEqual(["DATA"]);
      expect(forbidden.swarm).toHaveBeenCalledTimes(1);
      expect(parsePersistedJson(candidates[0].verifyFields).join(" ")).toContain("capital source and allocation require separate verification");
      const finished = await snapshot();
      for (const key of ["users", "accounts", "canonical", "orders", "claims", "evidence"] as const) expect(finished[key]).toEqual(before[key]);
    }
  });
});

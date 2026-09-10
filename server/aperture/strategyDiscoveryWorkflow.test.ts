import http from "node:http";
import https from "node:https";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "../_core/context";
import { getDb } from "../db";
import { emptyMissionDraftValues, type MissionDraftValues } from "../../shared/apertureMissionDraft";
import type { StrategyDiscoveryRequest } from "../../shared/strategyDiscoveryJob";
import { readAcceptedObjectiveValues } from "./objectiveMission";
import { claimUnderwritingJob, readUnderwritingJob } from "./underwritingJobs";
import { assessObjectiveDiscovery, executeObjectiveDiscovery, type DiscoveryProvider } from "./strategyDiscoveryWorkflow";
import { strategyDiscoveryRouter } from "./strategyDiscoveryRouter";
import { parseStrategyDiscovery, type StrategyDiscoveryContext, type StrategyDiscoveryPayload } from "./strategyDiscovery";

vi.mock("../db", () => ({ getDb: vi.fn() }));
vi.mock("./underwritingJobs", () => ({ claimUnderwritingJob: vi.fn(), readUnderwritingJob: vi.fn() }));
vi.mock("./objectiveMission", async (importOriginal) => ({
  ...await importOriginal<typeof import("./objectiveMission")>(), readAcceptedObjectiveValues: vi.fn(),
}));
// These modules must never be initialized by this pure/mock regression suite.
vi.mock("./strategyDiscoveryProvider", () => { throw new Error("Live discovery adapter forbidden in workflow unit tests"); });
vi.mock("mysql2/promise", () => { throw new Error("Database driver forbidden in workflow unit tests"); });

const now = Date.UTC(2026, 8, 10, 14);
const requestId = "00000000-0000-4000-8000-000000000001";
const identity = { decisionRunId: 1, decisionRevisionId: 2 };
const request: StrategyDiscoveryRequest = {
  schemaVersion: 1, requestId, missionHash: "illustrative-mission-hash", searchScope: "broader_permitted_universe",
  universePolicy: "declared_symbols", permittedUniverse: ["DATA"], mission: "Illustrative research question, not a verified investment claim.",
  holdingPeriods: ["swing"], instrumentPreference: "shares",
};
function context(): StrategyDiscoveryContext {
  return {
    requestId, provider: "illustrative-fixture", asOf: now, receivedAt: now,
    searchScope: request.searchScope, universePolicy: request.universePolicy, permittedUniverse: ["DATA"],
    citations: [], sources: [], providerState: { status: "partial", failures: ["source_provenance_unverified"] },
    classifierState: { status: "available", failures: [] },
  };
}
function hypothesis(id: string, horizon: "swing" | "position", rejected = false): StrategyDiscoveryPayload["hypotheses"][number] {
  return {
    id, title: "Illustrative conditional research", use: "new_play", horizon,
    disposition: rejected ? "reject" : "research_lead", rejectionReasons: rejected ? ["outside_authorized_holding_periods"] : [],
    whyThisUse: "Research economic participation.", whyNow: "Compare a possible change with expectations.",
    whyNotAlternatives: "Other mechanisms may be fixed fee.", changeCondition: "Verify economic terms.",
    causalPath: {
      id: `path-${id}`, originatingSignal: {
        id: "signal", statement: "Conditional inference, not a verified fact.", assertionClass: "analyst_inference",
        sourceIds: [], requiredConditions: ["Verify incremental adoption."], contradictions: [], unknowns: ["No independently verified evidence."],
        invalidation: "Adoption does not occur.",
      },
      hops: [], affectedEntities: ["Illustrative company"], securityMapping: { entity: "Illustrative company", symbol: "DATA", status: "unverified" },
      whatChangedFromExpectations: "Possible distribution change.", counterargument: "Usage may replace existing sales.",
      expectationsBaseline: null, technologyPermission: null, marketMeasurement: null, reviewAt: null, expiresAt: null,
    },
  };
}
function twoHorizons(rejected: boolean): StrategyDiscoveryPayload {
  return { schemaVersion: 1, searchScope: request.searchScope, reviewedUniverse: ["DATA"], coverageGaps: [],
    hypotheses: [hypothesis("within-horizon", "swing"), hypothesis("outside-horizon", "position", rejected)] };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("CAPITAL_OBJECTIVE_MISSIONS_ENABLED", "true");
  vi.stubEnv("CAPITAL_STRATEGY_DISCOVERY_ENABLED", "true");
  vi.stubEnv("ISOLATED_UAT_MODE", "false");
  const forbidden = () => { throw new Error("Network forbidden in workflow unit tests"); };
  vi.stubGlobal("fetch", vi.fn(forbidden));
  vi.spyOn(http, "request").mockImplementation(forbidden);
  vi.spyOn(http, "get").mockImplementation(forbidden);
  vi.spyOn(https, "request").mockImplementation(forbidden);
  vi.spyOn(https, "get").mockImplementation(forbidden);
  vi.mocked(getDb).mockRejectedValue(new Error("Unexpected database access"));
});
afterEach(() => {
  for (const network of [fetch, http.request, http.get, https.request, https.get]) expect(network).not.toHaveBeenCalled();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

describe("discovery horizon regression (real parser, illustrative evidence)", () => {
  it("retains an explicitly rejected second horizon without failing the valid lead", () => {
    const body = twoHorizons(true);
    const parsed = parseStrategyDiscovery(body, context());
    const assessed = assessObjectiveDiscovery(body, context(), request);
    expect(assessed).toEqual(parsed);
    expect(assessed.status).toBe("incomplete");
    expect(assessed.hypotheses.map(item => item.disposition)).toEqual(["research_lead", "rejected"]);
    expect(assessed.rejectedHypotheses).toEqual([expect.objectContaining({ id: "outside-horizon", reasons: expect.arrayContaining(["outside_authorized_holding_periods"]) })]);
    expect(assessed.coverageGaps).not.toContain("accepted_horizon_mismatch");
    expect(assessed.investmentAlternatives).toEqual([]); expect(assessed.confidence).toBeNull();
    expect(getDb).not.toHaveBeenCalled();
  });

  it("still blocks a proposed research lead outside the accepted horizons", () => {
    const body = twoHorizons(false);
    expect(parseStrategyDiscovery(body, context()).hypotheses[1].disposition).toBe("research_lead");
    const assessed = assessObjectiveDiscovery(body, context(), request);
    expect(assessed.status).toBe("unavailable");
    expect(assessed.coverageGaps).toContain("accepted_horizon_mismatch");
    expect(assessed.issues).toContainEqual({ path: "request", code: "accepted_horizon_mismatch" });
    expect(assessed.hypotheses.every(item => item.disposition === "unavailable")).toBe(true);
    expect(assessed.investmentAlternatives).toEqual([]); expect(getDb).not.toHaveBeenCalled();
  });
});

function failingWorkflow(storageFails: boolean) {
  const values: MissionDraftValues = {
    ...emptyMissionDraftValues(), accountId: 11, capital: "1000", maxLoss: "100", mission: request.mission,
    holdingPeriod: "swing", holdingPeriods: ["swing"], instrument: "shares",
    strategyContext: { schemaVersion: 1, requestId, intent: "deploy_excess_capital", searchScope: request.searchScope,
      requestedSymbols: ["DATA"], declarationId: requestId, sourceOrder: null, profitReserve: "" },
  };
  vi.mocked(readAcceptedObjectiveValues).mockResolvedValue(values);
  vi.mocked(readUnderwritingJob).mockResolvedValue(null);
  vi.mocked(claimUnderwritingJob).mockImplementation(async (_db, input) => ({
    reused: false,
    job: { id: 3, userId: input.userId, decisionRunId: 1, decisionRevisionId: 2, requestKey: input.requestKey, request: input.request,
      state: "running", milestone: "market_evidence", attemptToken: "00000000-0000-4000-8000-000000000003",
      attempt: 1, leaseUntil: now + 900_000, resultRevisionId: null, failure: null, createdAt: now, updatedAt: now },
  }));
  const limit = vi.fn().mockResolvedValueOnce([{ id: 1, userId: 7, accountId: 11, currentRevisionId: 2, researchRunId: null }])
    .mockResolvedValueOnce([{ id: 2, missionHash: request.missionHash }])
    .mockResolvedValueOnce([{ id: 11, label: "Illustrative Paper", isPaper: true }]);
  const writeFailure = storageFails
    ? vi.fn().mockRejectedValue(new Error("MOCK_DB_DETAIL mysql://fixture-user:fixture-password@private-host"))
    : vi.fn().mockResolvedValue([{ affectedRows: 1 }]);
  const set = vi.fn(() => ({ where: writeFailure }));
  const db = {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit })) })) })),
    update: vi.fn(() => ({ set })),
    insert: vi.fn(() => { throw new Error("No result should be inserted after provider failure"); }),
    transaction: vi.fn(() => { throw new Error("No publication transaction should start after provider failure"); }),
  };
  const provider = vi.fn<DiscoveryProvider>().mockRejectedValue(new Error("MOCK_PROVIDER_DETAIL Authorization: Bearer fixture-secret"));
  return { db, set, writeFailure, provider };
}

describe("discovery failure recording regression (mocked storage and provider)", () => {
  it.each([false, true])("keeps the failure generic when the status write also fails: %s", async (storageFails) => {
    const f = failingWorkflow(storageFails);
    const error = await executeObjectiveDiscovery(f.db as unknown as Parameters<typeof executeObjectiveDiscovery>[0], 7, identity, f.provider)
      .then(() => { throw new Error("Expected discovery to fail"); }, error => error);
    expect(error).toBeInstanceOf(TRPCError); expect(error.code).toBe("SERVICE_UNAVAILABLE");
    expect(error.message).toBe(storageFails
      ? "Discovery and its status update could not finish. Reconcile the saved job when storage recovers; do not start another request."
      : "Discovery could not finish. Inspect the saved job before retrying.");
    expect(error.cause).toBeUndefined();
    expect(String(error)).not.toMatch(/MOCK_|fixture-secret|fixture-password|private-host/);
    expect(f.provider).toHaveBeenCalledTimes(1); expect(f.provider).toHaveBeenCalledWith(request);
    expect(claimUnderwritingJob).toHaveBeenCalledTimes(1);
    expect(vi.mocked(claimUnderwritingJob).mock.calls[0][1].maxAttempts).toBe(3);
    expect(f.db.update).toHaveBeenCalledTimes(1); expect(f.writeFailure).toHaveBeenCalledTimes(1);
    expect(f.set).toHaveBeenCalledWith(expect.objectContaining({ state: "failed", milestone: "failed" }));
    expect(JSON.stringify(f.set.mock.calls)).not.toMatch(/MOCK_|fixture-secret|fixture-password/);
    expect(f.db.transaction).not.toHaveBeenCalled(); expect(f.db.insert).not.toHaveBeenCalled();
    expect(getDb).not.toHaveBeenCalled();
  });
});

describe("discovery router storage-error sanitization (real in-process caller)", () => {
  it.each(["start", "run", "get", "resume"] as const)("sanitizes a raw getDb rejection on %s before any workflow action", async (route) => {
    vi.mocked(getDb).mockRejectedValue(new Error("MOCK_DB_DETAIL mysql://fixture-user:fixture-password@private-host"));
    const caller = strategyDiscoveryRouter.createCaller({ user: { id: 7, role: "capital_operator" } } as TrpcContext);
    const operation = route === "start" ? caller.start({ requestId, expectedVersion: 1 }) : route === "resume" ? caller.resume({ requestId }) : caller[route](identity);
    await expect(operation).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE",
      message: "Mission analysis storage is unavailable. Reconcile the saved Mission and job before retrying; no eligibility is asserted.", cause: undefined });
    expect(getDb).toHaveBeenCalledTimes(1);
    expect(readAcceptedObjectiveValues).not.toHaveBeenCalled();
    expect(readUnderwritingJob).not.toHaveBeenCalled(); expect(claimUnderwritingJob).not.toHaveBeenCalled();
  });
});

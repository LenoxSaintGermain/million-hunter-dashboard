import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { emptyMissionDraftValues, missionDraftFingerprint, missionDraftValuesSchema, missionDraftSaveState, type MissionDraftValues } from "../../shared/apertureMissionDraft";
import { apertureDecisionRuns, apertureDecisionRevisions, apertureMissionDrafts, apertureMissionDraftRevisions } from "../../drizzle/schema";
import { acceptObjectiveMission, prepareObjectiveMission, readAcceptedObjectiveValues, declaredObjectiveCapitalEvent } from "./objectiveMission";
import { decisionActionBlock } from "./decisionRunway";
import { validateObjectiveDiscoveryDraft } from "./strategyDiscoveryWorkflow";

// Pure services plus explicit storage doubles: never connect to any database.
vi.mock("../db", () => ({ getDb: vi.fn(() => { throw new Error("Database forbidden in research-only tests"); }) }));
vi.mock("mysql2/promise", () => { throw new Error("Database driver forbidden in research-only tests"); });

const requestId = "00000000-0000-4000-8000-000000000011";
function values(researchOnly?: boolean): MissionDraftValues {
  return { ...emptyMissionDraftValues(), accountId: 31, capital: "25000", maxLoss: "250",
    mission: "Illustrative research question; compare mechanisms without allocating capital.",
    holdingPeriod: "swing", holdingPeriods: ["swing"],
    strategyContext: { schemaVersion: 1, requestId, intent: "explore_opportunity",
      searchScope: "broader_permitted_universe", requestedSymbols: ["DATA"], declarationId: null,
      sourceOrder: null, profitReserve: "", ...(researchOnly === undefined ? {} : { researchOnly }) } };
}

describe("explicit research-only draft contract", () => {
  it("retains exact pre-flag fingerprint bytes for legacy drafts", () => {
    // Frozen field order from the legacy wire contract, not the new serializer.
    const legacy = '{"schemaVersion":1,"canonicalThesisId":null,"accountId":31,"baseDecisionRunId":null,"baseDecisionRevisionId":null,"activeSection":1,"capital":"25000","maxLoss":"250","targetProfit":"","targetPeriod":"week","holdingPeriod":"swing","holdingPeriods":["swing"],"objective":"deploy_today","instrument":"shares","includeHeld":false,"mission":"Illustrative research question; compare mechanisms without allocating capital.","missionDirty":false,"editingMission":false,"showTune":false,"branch":"research","reason":"","blocker":"","reopen":"","gateLabel":"","newTitle":"","newBelief":"","declaredCatalystAt":null,"declaredCatalystLabel":null,"eligibilityReviewAt":"","outcomeReviewAtInput":"","revisingReceipt":false,"underwritingDirty":false,"strategyContext":{"schemaVersion":1,"requestId":"00000000-0000-4000-8000-000000000011","intent":"explore_opportunity","searchScope":"broader_permitted_universe","requestedSymbols":["DATA"],"declarationId":null,"sourceOrder":null,"profitReserve":""}}';
    const parsed = missionDraftValuesSchema.parse(values());
    expect(parsed.strategyContext).not.toHaveProperty("researchOnly");
    expect(missionDraftFingerprint(parsed)).toBe(legacy);
    expect(missionDraftFingerprint({ ...parsed, strategyContext: { ...parsed.strategyContext!, researchOnly: undefined } })).toBe(legacy);
  });

  it.each([true, false])("includes explicit %s and remains stable across JSON key ordering", researchOnly => {
    const draft = missionDraftValuesSchema.parse(values(researchOnly));
    expect(draft.strategyContext?.researchOnly).toBe(researchOnly);
    const fingerprint = missionDraftFingerprint(draft);
    expect(fingerprint).not.toBe(missionDraftFingerprint(values()));
    expect(fingerprint).not.toBe(missionDraftFingerprint(values(!researchOnly)));
    expect(JSON.parse(fingerprint).strategyContext.researchOnly).toBe(researchOnly);
    const reordered = { ...draft, strategyContext: Object.fromEntries(Object.entries(draft.strategyContext!).reverse()) } as MissionDraftValues;
    expect(missionDraftFingerprint(reordered)).toBe(fingerprint);
    expect(missionDraftSaveState({ initialized: true, values: draft, saving: false, error: null,
      saved: { id: 1, version: 1, values: values(), updatedAt: 1, completedAt: null } })).toBe("unsaved");
  });

  it.each([null, "true", "false", 1, 0, {}, []])("rejects non-boolean flag %j without coercion", researchOnly => {
    expect(missionDraftValuesSchema.safeParse({ ...values(), strategyContext: { ...values().strategyContext, researchOnly } }).success).toBe(false);
  });

  it("retains strict proof-field rejection and source/account matching", () => {
    expect(missionDraftValuesSchema.safeParse({ ...values(true), strategyContext: { ...values(true).strategyContext, permittedRiskCents: 25000 } }).success).toBe(false);
    expect(missionDraftValuesSchema.safeParse({ ...values(true), strategyContext: { ...values(true).strategyContext,
      sourceOrder: { accountId: 99, runId: 1, candidateId: 2, orderId: 3 } } }).success).toBe(false);
    expect(() => prepareObjectiveMission({ ...values(true), maxLoss: "" })).toThrow();
    expect(() => prepareObjectiveMission({ ...values(true), capital: "0" })).toThrow();
  });
});

/** Queue-backed storage double. This proves service calls and receipt contents,
 * not SQL isolation/locking; the isolated integration lane covers persistence. */
function storage(reads: unknown[][]) {
  const queue = [...reads];
  const limit = vi.fn(async () => {
    if (!queue.length) throw new Error("Unexpected read");
    return queue.shift()!;
  });
  const query = { limit, for: vi.fn(() => query), where: vi.fn(() => query), innerJoin: vi.fn(() => query) };
  const inserts: { table: unknown; row: any }[] = [];
  const updates: { table: unknown; row: any }[] = [];
  const db = {
    select: vi.fn(() => ({ from: vi.fn(() => query) })),
    insert: vi.fn((table: unknown) => ({ values: vi.fn(async (row: unknown) => {
      inserts.push({ table, row }); return [{ insertId: 100 + inserts.length }];
    }) })),
    update: vi.fn((table: unknown) => ({ set: vi.fn((row: unknown) => {
      updates.push({ table, row }); return { where: vi.fn(async () => [{ affectedRows: 1 }]) };
    }) })),
    transaction: vi.fn(async (fn: (tx: unknown) => unknown): Promise<any> => fn(db)),
  };
  return { db: db as unknown as Parameters<typeof acceptObjectiveMission>[0], inserts, updates, limit };
}
const request = { requestId, expectedVersion: 1 };
const draftRow = (draft = values(true)) => ({ id: 41, userId: 7, version: 1, values: draft, completedAt: null });
const account = { id: 31, userId: 7, isPaper: true, label: "Illustrative paper account", lastSyncedAt: null };

describe("research-only acceptance and immutable authority boundaries", () => {
  it.each([undefined, false, true])("flag %s cannot turn declared capital into an allocation or verified cash", async researchOnly => {
    const draft = values(researchOnly);
    draft.strategyContext!.intent = "deploy_excess_capital";
    draft.strategyContext!.declarationId = "00000000-0000-4000-8000-000000000012";
    const prepared = prepareObjectiveMission(draft);
    expect(prepared).toMatchObject({ sourceBasis: "operator_declared", availableCapitalCents: null, permittedRiskCents: null });
    // Existing explicit declarations remain declarations, not a cash claim.
    expect(declaredObjectiveCapitalEvent(prepared)?.sourceKind).toBe("operator_declared_excess");
    const f = storage([[draftRow(draft)], [], [account]]);
    await acceptObjectiveMission(f.db, 7, request, 1000);
    expect(f.inserts.map(write => write.table)).toEqual([apertureDecisionRuns, apertureDecisionRevisions, apertureMissionDraftRevisions]);
    expect(f.updates.map(write => write.table)).toEqual([apertureDecisionRuns, apertureMissionDrafts]);
    expect(f.inserts[1].row).toMatchObject({ plannedRiskCents: 0,
      gateSnapshot: { permittedRiskCents: null, sourceAvailabilityVerified: false, paperOnly: true, humanApprovalRequired: true } });
  });

  it("persists the flag in an exact receipt but writes no allocation, job, research, or order", async () => {
    const f = storage([[draftRow()], [], [account]]);
    const accepted = await acceptObjectiveMission(f.db, 7, request, 1000, (db, draft) => validateObjectiveDiscoveryDraft(db, 7, draft));
    expect(accepted).toEqual({ decisionRunId: 101, revisionId: 102, created: true, status: "accepted" });
    expect(f.inserts.map(write => write.table)).toEqual([apertureDecisionRuns, apertureDecisionRevisions, apertureMissionDraftRevisions]);
    expect(f.updates.map(write => write.table)).toEqual([apertureDecisionRuns, apertureMissionDrafts]);
    const revision = f.inserts[1].row;
    expect(revision).toMatchObject({ createdByUserId: 7, plannedRiskCents: 0, effectiveBranch: "research", operatorChoice: "research",
      contextSnapshot: { availableCapitalCents: null, sourceBasis: "hypothetical_only", acceptedDraft: { strategyContext: { researchOnly: true } } },
      gateSnapshot: { paperOnly: true, humanApprovalRequired: true, permittedRiskCents: null, sourceAvailabilityVerified: false, riskAuthorityState: "pending_verification" } });
    expect(revision.missionHash).toBe(createHash("sha256").update(missionDraftFingerprint(values(true))).digest("hex"));
    expect(f.inserts[2].row.values.strategyContext.researchOnly).toBe(true);
    expect(declaredObjectiveCapitalEvent(prepareObjectiveMission(values(true)))).toBeNull();
    const head = { ...f.inserts[0].row, id: 101 };
    const savedRevision = { ...revision, id: 102 };
    const original = { values: values(true), completedAt: null };
    expect(await readAcceptedObjectiveValues(storage([[original]]).db, 7, head, savedRevision)).toEqual(values(true));
    // Owner checks happen before looking up any immutable source version.
    const foreign = storage([]);
    await expect(readAcceptedObjectiveValues(foreign.db, 8, head, savedRevision)).rejects.toThrow(/inconsistent/);
    expect(foreign.limit).not.toHaveBeenCalled();
    for (const replacement of [undefined, false]) {
      const changed = { ...savedRevision, contextSnapshot: { ...revision.contextSnapshot, acceptedDraft: values(replacement) } };
      await expect(readAcceptedObjectiveValues(storage([[original]]).db, 7, head, changed)).rejects.toThrow(/original draft/);
    }
    // Exact request retry reads the original receipt, never reaccepts/writes.
    const retry = storage([[draftRow()], [head], [savedRevision], [original]]);
    expect(await acceptObjectiveMission(retry.db, 7, request, 2000)).toEqual({ ...accepted, created: false });
    expect(retry.inserts).toEqual([]); expect(retry.updates).toEqual([]);
  });

  it.each(["account", "thesis", "source", "version", "request"] as const)("retains the %s guard before acceptance writes", async kind => {
    const draft = values(true);
    if (kind === "thesis") draft.canonicalThesisId = 99;
    if (kind === "source") draft.strategyContext!.sourceOrder = { accountId: 31, runId: 1, candidateId: 2, orderId: 3 };
    const row = draftRow(draft);
    if (kind === "version") row.version = 2;
    if (kind === "request") draft.strategyContext!.requestId = "00000000-0000-4000-8000-000000000022";
    const reads = [[row], [], ...(kind === "version" || kind === "request" ? [] : kind === "account" ? [[]] : [[account], []])];
    const f = storage(reads);
    await expect(acceptObjectiveMission(f.db, 7, request)).rejects.toMatchObject({ code: kind === "version" || kind === "request" ? "CONFLICT" : "PRECONDITION_FAILED" });
    expect(f.inserts).toEqual([]); expect(f.updates).toEqual([]);
  });

  it.each(["preflight", "create_proposal", "approve", "submit"] as const)("research acceptance never authorizes %s or unknown exposure", action => {
    for (const contextKind of ["objective", "discovery"] as const) {
      const snapshot = { source: "authoritative" as const, decisionRunId: 101, revisionId: 102,
        effectiveBranch: "eligible" as const, accountId: 31, researchRunId: 201,
        maxPlannedLossCents: 25000, contextKind, validBinding: true, declaredCapitalVerified: false };
      expect(decisionActionBlock(snapshot, action, "open")).not.toBeNull();
      expect(decisionActionBlock(snapshot, action, "unknown")).not.toBeNull();
      expect(decisionActionBlock(snapshot, action, "close")).toBeNull();
    }
  });
});

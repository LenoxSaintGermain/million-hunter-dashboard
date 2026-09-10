import { describe, expect, it, vi } from "vitest";
import { emptyMissionDraftValues, missionDraftFingerprint, missionDraftValuesSchema, type MissionDraftRecord } from "../../shared/apertureMissionDraft";
import { createMissionDraftService, type MissionDraftStore } from "./missionDraftRouter";

const context = () => ({
  schemaVersion: 1 as const,
  requestId: "00000000-0000-4000-8000-000000000011",
  intent: "deploy_excess_capital" as const,
  searchScope: "broader_permitted_universe" as const,
  requestedSymbols: ["SPY", "IWM"],
  declarationId: "00000000-0000-4000-8000-000000000012",
  sourceOrder: null,
  profitReserve: "",
});

function harness() {
  const rows = new Map<number, MissionDraftRecord>();
  const history: MissionDraftRecord[] = [];
  const store: MissionDraftStore = {
    get: vi.fn(async owner => structuredClone(rows.get(owner) ?? null)),
    assertBindings: vi.fn(async () => {}),
    assertReceipt: vi.fn(async () => {}),
    compareAndSwap: vi.fn(async (owner, version, next) => {
      if ((rows.get(owner)?.version ?? 0) !== version) return null;
      const row = { id: owner, version: version + 1, ...structuredClone(next) };
      rows.set(owner, row); history.push(structuredClone(row)); return row;
    }),
  };
  return { store, history, service: createMissionDraftService(store, () => 1000) };
}

describe("objective-led drafts use the existing durable Mission store", () => {
  it("saves/resumes an excess-capital request without manufacturing a canonical thesis or receipt", async () => {
    const { service, history, store } = harness();
    const values = { ...emptyMissionDraftValues(), strategyContext: context(), mission: "Illustrative: compare uses of my declared capital over the next month.", capital: "10,000.", maxLoss: "", activeSection: 2 as const };
    const saved = await service.save(7, { expectedVersion: 0, values });
    const deviceB = createMissionDraftService(store);
    expect((await deviceB.get(7))?.values).toEqual(values);
    expect(saved.values.canonicalThesisId).toBeNull();
    expect(saved.values.baseDecisionRunId).toBeNull();
    expect(saved.values.baseDecisionRevisionId).toBeNull();
    expect(await deviceB.get(8)).toBeNull();
    expect(history).toHaveLength(1);
    expect(store.assertReceipt).not.toHaveBeenCalled();
  });

  it("does not let an older client silently erase a saved intent on its next autosave", async () => {
    const { service, history } = harness();
    const values = { ...emptyMissionDraftValues(), strategyContext: context() };
    await service.save(7, { expectedVersion: 0, values });
    const { strategyContext: _ignored, ...oldClientValues } = values;
    await expect(service.save(7, { expectedVersion: 1, values: oldClientValues })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(history).toHaveLength(1);
    expect((await service.get(7))?.values).toEqual(values);
  });

  it("requires an explicit replacement and retains the original context in history", async () => {
    const { service, history } = harness();
    const values = { ...emptyMissionDraftValues(), strategyContext: context() };
    await service.save(7, { expectedVersion: 0, values });
    const replacement = { ...emptyMissionDraftValues(), newBelief: "A deliberate new belief" };
    await service.save(7, { expectedVersion: 1, values: replacement, replaceStrategyContext: true });
    expect((await service.get(7))?.values).toEqual(replacement);
    expect(history[0].values).toEqual(values);
    expect(history).toHaveLength(2);
  });

  it("keeps legacy null/absent context equivalent and normalizes insertion order", () => {
    const legacy = emptyMissionDraftValues();
    expect(missionDraftValuesSchema.parse(legacy)).toEqual(legacy);
    expect(missionDraftFingerprint(legacy)).toBe(missionDraftFingerprint({ ...legacy, strategyContext: null }));
    const values = { ...legacy, strategyContext: context() };
    const reversed = Object.fromEntries(Object.entries(context()).reverse()) as ReturnType<typeof context>;
    expect(missionDraftFingerprint(values)).toBe(missionDraftFingerprint({ ...values, strategyContext: reversed }));
  });

  it("retains intent in save equality and rejects provider/availability claims inside draft context", () => {
    const a = { ...emptyMissionDraftValues(), strategyContext: context() };
    const b = { ...a, strategyContext: { ...context(), intent: "explore_opportunity" as const } };
    expect(missionDraftFingerprint(a)).not.toBe(missionDraftFingerprint(b));
    expect(missionDraftValuesSchema.safeParse({ ...a, strategyContext: { ...context(), verifiedAvailableCents: 1_200_000 } }).success).toBe(false);
    expect(missionDraftValuesSchema.safeParse({ ...a, strategyContext: { ...context(), sourceOrder: { accountId: 7, runId: 1, candidateId: 2 } } }).success).toBe(false);
    expect(missionDraftValuesSchema.safeParse({ ...a, strategyContext: { ...context(), requestedSymbols: Array(101).fill("SPY") } }).success).toBe(false);
    // Parsing identities is not authorization; the server verifies exact accepted lineage.
    expect(missionDraftValuesSchema.safeParse({ ...a, baseDecisionRunId: 11, baseDecisionRevisionId: 12 }).success).toBe(true);
    expect(missionDraftValuesSchema.safeParse({ ...a, accountId: 8, strategyContext: { ...context(), sourceOrder: { accountId: 7, runId: 1, candidateId: 2, orderId: 3 } } }).success).toBe(false);
  });

  it("does not mark an intent request completed using an unrelated canonical Mission receipt", async () => {
    const { service, history } = harness();
    await service.save(7, { expectedVersion: 0, values: { ...emptyMissionDraftValues(), strategyContext: context() } });
    await expect(service.complete(7, { expectedVersion: 1, decisionRunId: 11, decisionRevisionId: 12 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect((await service.get(7))?.completedAt).toBeNull();
    expect(history).toHaveLength(1);
  });

  it("preserves CAS conflict behavior for two objective edits", async () => {
    const { service, history } = harness();
    const values = { ...emptyMissionDraftValues(), strategyContext: context() };
    await service.save(7, { expectedVersion: 0, values });
    const attempts = await Promise.allSettled(["10,000", "25,000"].map(capital => service.save(7, { expectedVersion: 1, values: { ...values, capital } })));
    expect(attempts.filter(a => a.status === "fulfilled")).toHaveLength(1);
    expect((attempts.find(a => a.status === "rejected") as PromiseRejectedResult).reason.code).toBe("CONFLICT");
    expect(history).toHaveLength(2);
  });
});

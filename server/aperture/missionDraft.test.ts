import { describe, expect, it, vi } from "vitest";
import { missionDraftValuesSchema, emptyMissionDraftValues, missionDraftSaveState, missionSectionReducer, initialMissionSection, validReceiptHorizonShape, validMissionHorizonCollection, replacePrimaryMissionHorizon, type MissionDraftRecord } from "../../shared/apertureMissionDraft";
import { createMissionDraftService, decodeMissionDraftRecord, missionDraftRouter, missionDraftStore, type MissionDraftStore } from "./missionDraftRouter";
import type { TrpcContext } from "../_core/context";

function memoryStore() {
  const rows = new Map<number, MissionDraftRecord>();
  const history: MissionDraftRecord[] = [];
  const store: MissionDraftStore = {
    get: async (userId) => structuredClone(rows.get(userId) ?? null),
    assertBindings: async () => {},
    compareAndSwap: async (userId, expectedVersion, next) => {
      const previous = rows.get(userId);
      if ((previous?.version ?? 0) !== expectedVersion) return null;
      const row = { id: previous?.id ?? userId, version: expectedVersion + 1, ...structuredClone(next) };
      rows.set(userId, row);
      history.push(structuredClone(row));
      return row;
    },
    assertReceipt: async () => {},
  };
  return { store, history };
}

describe("durable incomplete Mission drafts", () => {
  it("an explicit primary-horizon change includes the new horizon and removes the prior one", () => {
    expect(replacePrimaryMissionHorizon("intraday", "swing", ["intraday"])).toEqual(["swing"]);
    expect(replacePrimaryMissionHorizon("intraday", "swing", ["intraday", "position"])).toEqual(["swing", "position"]);
    expect(replacePrimaryMissionHorizon("intraday", "swing", ["intraday", "swing"])).toEqual(["swing"]);
    const prior = ["intraday", "position"] as const;
    replacePrimaryMissionHorizon("intraday", "swing", prior);
    expect(prior).toEqual(["intraday", "position"]); // old receipt data remains immutable
  });
  it("rejects encoded or malformed receipt/underwriting horizons before array operations or hydration", () => {
    expect(validReceiptHorizonShape({ holdingPeriod: "swing", holdingPeriods: '["swing"]' })).toBe(false);
    expect(validMissionHorizonCollection('["swing"]')).toBe(false);
    expect(validMissionHorizonCollection({ slice: () => "swing" })).toBe(false);
    expect(validReceiptHorizonShape({ holdingPeriod: "swing", holdingPeriods: ["invalid"] })).toBe(false);
    expect(validReceiptHorizonShape({ holdingPeriod: "swing", holdingPeriods: ["swing"] })).toBe(true);
    expect(validReceiptHorizonShape({ holdingPeriod: "swing", holdingPeriods: null })).toBe(true); // legacy single horizon remains explicit
  });
  it("keeps Account & risk open as inputs become valid and advances only after explicit Review mission", () => {
    let section = initialMissionSection({ hasThesis: true, capitalCents: 0, maxLossCents: 0 });
    expect(section).toBe(2);
    // Same input-change event used by the Mission's form capture: capital,
    // target, then max-loss now satisfy all validation. This must not navigate.
    section = missionSectionReducer(section, { type: "input_changed" });
    section = missionSectionReducer(section, { type: "input_changed" });
    section = missionSectionReducer(section, { type: "input_changed" });
    expect(section).toBe(2);
    expect(initialMissionSection({ hasThesis: true, capitalCents: 2_500_000, maxLossCents: 25_000 })).toBe(3);
    expect(section).toBe(2); // the initial default is not recomputed during edits
    section = missionSectionReducer(section, { type: "choose", section: 3 });
    expect(section).toBe(3);
    expect(missionSectionReducer(3, { type: "hydrate", section: 2 })).toBe(2);
  });
  it("strictly decodes mysql2 JSON strings without replacing corrupt rows with empty input", () => {
    const values = { ...emptyMissionDraftValues(), capital: "2,000.", maxLoss: "" };
    const row = { id: 7, userId: 7, version: 2, values: JSON.stringify(values) as unknown as typeof values, createdAt: 1000, updatedAt: 1000, completedAt: null };
    expect(decodeMissionDraftRecord(row).values).toEqual(values);
    expect(decodeMissionDraftRecord({ ...row, values }).values).toEqual(values);
    expect(() => decodeMissionDraftRecord({ ...row, values: "{broken" as unknown as typeof values })).toThrow();
    expect(() => decodeMissionDraftRecord({ ...row, values: "{}" as unknown as typeof values })).toThrow();
  });
  it("restores incomplete raw money, inline belief, and the exact section on another device without a Mission", async () => {
    const { store, history } = memoryStore();
    const firstDevice = createMissionDraftService(store, () => 1000);
    const values = { ...emptyMissionDraftValues(), capital: "2,000.", maxLoss: "", newTitle: "MRVL", newBelief: "Still writing ", activeSection: 2 as const };
    await firstDevice.save(7, { expectedVersion: 0, values });
    const secondDevice = createMissionDraftService(store);
    expect((await secondDevice.get(7))?.values).toEqual(values);
    expect(history).toHaveLength(1);
    expect(values.baseDecisionRunId).toBeNull();
    expect(values.baseDecisionRevisionId).toBeNull();
    expect(await secondDevice.get(8)).toBeNull();
    expect(history).toHaveLength(1); // reads neither save nor create Mission objects
  });

  it("allows only one concurrent writer and preserves both the original and winning revision", async () => {
    const { store, history } = memoryStore();
    const service = createMissionDraftService(store, () => 1000);
    const values = emptyMissionDraftValues();
    await service.save(7, { expectedVersion: 0, values });
    const results = await Promise.allSettled([
      service.save(7, { expectedVersion: 1, values: { ...values, capital: "1000" } }),
      service.save(7, { expectedVersion: 1, values: { ...values, capital: "2000" } }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const failure = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(failure.reason.code).toBe("CONFLICT");
    expect(history).toHaveLength(2);
    expect(history[0].values.capital).toBe("");
    expect((await service.get(7))?.values.capital).toBe("1000");
  });

  it("does not complete or overwrite a newer device draft", async () => {
    const { store } = memoryStore();
    const service = createMissionDraftService(store, () => 2000);
    const values = emptyMissionDraftValues();
    await service.save(7, { expectedVersion: 0, values });
    await service.save(7, { expectedVersion: 1, values: { ...values, capital: "25000" } });
    await expect(service.complete(7, { expectedVersion: 1, decisionRunId: 11, decisionRevisionId: 12 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await service.get(7))?.completedAt).toBeNull();
  });

  it("completes only against a persisted receipt and leaves history available", async () => {
    const { store, history } = memoryStore();
    let receiptChecks = 0;
    store.assertReceipt = async () => { receiptChecks++; };
    const service = createMissionDraftService(store, () => 2000);
    await service.save(7, { expectedVersion: 0, values: emptyMissionDraftValues() });
    const complete = await service.complete(7, { expectedVersion: 1, decisionRunId: 11, decisionRevisionId: 12 });
    expect(complete).toMatchObject({ version: 2, completedAt: 2000, values: { baseDecisionRunId: 11, baseDecisionRevisionId: 12 } });
    expect(receiptChecks).toBe(1);
    expect(history).toHaveLength(2);
    expect(history[0].completedAt).toBeNull();
  });

  it("fails closed on unavailable storage or an unauthorized binding", async () => {
    const { store } = memoryStore();
    store.assertBindings = async () => { throw new Error("binding not owned"); };
    const service = createMissionDraftService(store);
    await expect(service.save(7, { expectedVersion: 0, values: emptyMissionDraftValues() })).rejects.toThrow("binding not owned");
    expect(await service.get(7)).toBeNull();
    store.get = async () => { throw new Error("database unavailable"); };
    await expect(service.get(7)).rejects.toThrow("database unavailable");
  });

  it("accepts incomplete strings without coercion but rejects oversized input and half-bound revisions", () => {
    const values = emptyMissionDraftValues();
    expect(missionDraftValuesSchema.parse({ ...values, capital: "not yet", maxLoss: "." }).capital).toBe("not yet");
    expect(missionDraftValuesSchema.safeParse({ ...values, newBelief: "a".repeat(30001) }).success).toBe(false);
    expect(missionDraftValuesSchema.safeParse({ ...values, baseDecisionRunId: 1 }).success).toBe(false);
  });

  it("never calls an unsaved or failed current edit Saved", () => {
    const values = emptyMissionDraftValues();
    const saved: MissionDraftRecord = { id: 1, version: 1, values, updatedAt: 1000, completedAt: null };
    expect(missionDraftSaveState({ initialized: false, values, saved, saving: false, error: null })).toBe("loading");
    expect(missionDraftSaveState({ initialized: true, values, saved, saving: false, error: null })).toBe("saved");
    expect(missionDraftSaveState({ initialized: true, values: { ...values, capital: "3" }, saved, saving: false, error: null })).toBe("unsaved");
    expect(missionDraftSaveState({ initialized: true, values, saved, saving: false, error: "network" })).toBe("failed");
    expect(missionDraftSaveState({ initialized: true, values, saved, saving: true, error: null })).toBe("saving");
  });

  it("enforces authentication and delegates reads only with the authenticated user ID", async () => {
    const read = vi.spyOn(missionDraftStore, "get").mockResolvedValue(null);
    try {
      const anonymous = missionDraftRouter.createCaller({ user: null } as TrpcContext);
      await expect(anonymous.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(read).not.toHaveBeenCalled();
      const investor = missionDraftRouter.createCaller({ user: { id: 8, role: "investor" } } as TrpcContext);
      await expect(investor.get()).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(read).not.toHaveBeenCalled();
      const operator = missionDraftRouter.createCaller({ user: { id: 7, role: "capital_operator" } } as TrpcContext);
      expect(await operator.get()).toBeNull();
      expect(read).toHaveBeenCalledTimes(1);
      expect(read).toHaveBeenCalledWith(7);
    } finally { read.mockRestore(); }
  });

  it("completing a draft is idempotent but reopening it keeps a new revision", async () => {
    const { store, history } = memoryStore();
    const service = createMissionDraftService(store, () => 2000);
    const values = emptyMissionDraftValues();
    await service.save(7, { expectedVersion: 0, values });
    const first = await service.complete(7, { expectedVersion: 1, decisionRunId: 11, decisionRevisionId: 12 });
    expect(await service.complete(7, { expectedVersion: 1, decisionRunId: 11, decisionRevisionId: 12 })).toEqual(first);
    expect(history).toHaveLength(2);
    await service.save(7, { expectedVersion: 2, values: { ...first.values, capital: "500" } });
    expect(await service.get(7)).toMatchObject({ version: 3, completedAt: null, values: { capital: "500" } });
    expect(history).toHaveLength(3);
  });
});

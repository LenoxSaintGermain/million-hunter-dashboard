import { beforeEach, describe, expect, it, vi } from "vitest";
import { capitalTheses, thesisCompilations } from "../drizzle/schema";

const storage = vi.hoisted(() => ({ records: new Map<unknown, Record<string, unknown>[]>(), inserts: 0 }));
vi.mock("./db", () => ({
  getDb: async () => ({
    insert: (table: unknown) => ({ values: async (value: Record<string, unknown>) => {
      const records = storage.records.get(table) ?? [];
      records.push(value);
      storage.records.set(table, records);
      storage.inserts++;
      return [{ insertId: 123 }];
    } }),
    select: () => ({ from: (table: unknown) => ({ where: () => ({ limit: async () =>
      (storage.records.get(table) ?? []).map(record => ({ id: 123, name: record.name }))
    }) }) }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  }),
  logActivity: vi.fn(),
}));
import { thesisRouter } from "./thesisRouter";

const caller = () => thesisRouter.createCaller({ user: { id: 1, role: "admin" }, req: { header: () => undefined } } as any);
const thesisText = "Illustrative refiner thesis; evidence must be verified before any paper play.";
describe("Capital thesis input boundary (in-memory storage only)", () => {
  beforeEach(() => { storage.records.clear(); storage.inserts = 0; });
  it("rejects prose in the ticker field before storing any canonical record", async () => {
    await expect(caller().createCapital({ thesisText, details: { symbols: "Liquid U.S.-listed refiners and diesel-sensitive transport businesses; verify company-to-ticker mapping before inclusion." } }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(storage.inserts).toBe(0);
    expect(storage.records.size).toBe(0);
  });
  it("saves descriptive scope independently with no manufactured ticker", async () => {
    const researchUniverse = "Liquid U.S.-listed refiners; verify mapping before inclusion.";
    await caller().createCapital({ thesisText, details: { researchUniverse, symbols: "" } });
    const compilations = storage.records.get(thesisCompilations);
    const projections = storage.records.get(capitalTheses);
    expect(storage.inserts).toBe(2);
    expect(compilations).toHaveLength(1);
    expect(projections).toHaveLength(1);
    expect(compilations![0].compiledFilters).toMatchObject({ researchUniverse, researchSymbols: [] });
    expect(compilations![0].thesisText).toBe(thesisText);
    expect(projections![0]).toMatchObject({
      sourceCompilationId: 123,
      rawText: thesisText,
      name: compilations![0].name,
      status: "active",
      isPrimary: true,
      graph: { researchUniverse, researchSymbols: [] },
    });
  });
});

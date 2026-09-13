import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ saved: null as any, inserts: 0 }));
vi.mock("./db", () => ({
  getDb: async () => ({
    insert: () => ({ values: async (value: unknown) => { storage.saved = value; storage.inserts++; return [{ insertId: 123 }]; } }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 123, name: storage.saved?.name }] }) }) }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  }),
  logActivity: vi.fn(),
}));
import { thesisRouter } from "./thesisRouter";

const caller = () => thesisRouter.createCaller({ user: { id: 1, role: "admin" }, req: { header: () => undefined } } as any);
const thesisText = "Illustrative refiner thesis; evidence must be verified before any paper play.";
describe("Capital thesis input boundary (in-memory storage only)", () => {
  beforeEach(() => { storage.saved = null; storage.inserts = 0; });
  it("rejects prose in the ticker field before storing any canonical record", async () => {
    await expect(caller().createCapital({ thesisText, details: { symbols: "Liquid U.S.-listed refiners and diesel-sensitive transport businesses; verify company-to-ticker mapping before inclusion." } }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(storage.inserts).toBe(0);
  });
  it("saves descriptive scope independently with no manufactured ticker", async () => {
    const researchUniverse = "Liquid U.S.-listed refiners; verify mapping before inclusion.";
    await caller().createCapital({ thesisText, details: { researchUniverse, symbols: "" } });
    expect(storage.saved.compiledFilters).toMatchObject({ researchUniverse, researchSymbols: [] });
    expect(storage.saved.thesisText).toBe(thesisText);
  });
});

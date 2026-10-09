import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ compilations: [] as any[], inserts: 0 }));
vi.mock("../db", () => ({
  getDb: async () => ({
    insert: () => ({ values: async (value: any) => { storage.inserts++; if ("templateUsed" in value) storage.compilations.push(value); return [{ insertId: 900 + storage.compilations.length }]; } }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 900 + storage.compilations.length, name: storage.compilations.at(-1)?.name }] }) }) }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  }),
  logActivity: vi.fn(),
}));
import { thesisRouter } from "../thesisRouter";
import { WEEKLY_INCOME_THESIS_PREFILL } from "../../shared/strategyTemplates/weeklyIncome";
import { isCapitalThesisEligible } from "../../shared/capitalThesisEligibility";

const caller = () => thesisRouter.createCaller({ user: { id: 7, role: "capital_operator" }, req: { header: () => undefined } } as any);
const { statement, name, details } = WEEKLY_INCOME_THESIS_PREFILL;

describe("Saving a Weekly Income thesis (#83)", () => {
  beforeEach(() => { storage.compilations = []; storage.inserts = 0; });

  it("saves with the exact templateUsed, holding period, instrument and a halted parameter set", async () => {
    await caller().createCapital({ thesisText: statement, name, details: { ...details, holdingPeriod: "position", instrument: "either" }, strategyTemplate: { id: "capital_weekly_income" } });
    const saved = storage.compilations[0];
    expect(saved.templateUsed).toBe("capital_weekly_income");
    expect(saved.name).toBe("Weekly Income · defined-risk premium · v0.1 · paper");
    expect(saved.compiledFilters).toMatchObject({ holdingPeriod: "swing", instrumentPreference: "options" });
    expect(saved.compiledFilters.strategyTemplate).toMatchObject({ id: "capital_weekly_income", version: "0.1", strategyState: "halted" });
    expect(isCapitalThesisEligible(saved)).toBe(true);
  });

  it("refuses an out-of-range parameter server-side before anything is stored", async () => {
    await expect(caller().createCapital({ thesisText: statement, name, details, strategyTemplate: { id: "capital_weekly_income", parameters: { short_delta_max: 0.45 } } }))
      .rejects.toMatchObject({ code: "BAD_REQUEST", message: "short_delta_max must be between 0.20 and 0.40" });
    expect(storage.inserts).toBe(0);
  });

  it("leaves an ordinary Capital thesis unchanged", async () => {
    await caller().createCapital({ thesisText: statement, details: { instrument: "either" } });
    expect(storage.compilations[0].templateUsed).toBe("capital_trade");
    expect(storage.compilations[0].compiledFilters.strategyTemplate).toBeUndefined();
  });
});

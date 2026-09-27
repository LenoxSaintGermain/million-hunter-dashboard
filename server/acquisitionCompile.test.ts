import { afterEach, expect, it, vi } from "vitest";

const { generateContent, execute, logActivity } = vi.hoisted(() => ({
  generateContent: vi.fn(), execute: vi.fn(), logActivity: vi.fn(),
}));
vi.mock("@google/genai", () => ({ GoogleGenAI: class {
  models = { generateContent };
} }));
vi.mock("./db", () => ({ getDb: async () => ({ execute }), logActivity }));
import { thesisRouter } from "./thesisRouter";

const output = {
  compiledFilters: { geographies: ["FL"], businessAgeMin: "5", cashFlowMin: null, cashFlowMax: null, askingPriceMin: null, askingPriceMax: null },
  scoringWeights: [{ dimension: "Recurring revenue", weight: "100", isCustom: true }],
  evidenceRequirements: ["Direct listing URL"], autoDisqualifiers: [], confidenceNotes: ["Broker claims need verification"],
  estimatedTargetsMin: "0", estimatedTargetsMax: "0", estimatedCostMin: "0", estimatedCostMax: "0",
  suggestedName: "Illustrative acquisition test",
};
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

it("compiles using the configured Google provider without a Forge credential", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-only-not-a-key");
  vi.stubEnv("BUILT_IN_FORGE_API_KEY", "");
  const fetchSpy = vi.fn().mockRejectedValue(new Error("Legacy gateway must not be called"));
  vi.stubGlobal("fetch", fetchSpy);
  execute.mockResolvedValue([{ insertId: 123 }]);
  generateContent.mockResolvedValue({ text: JSON.stringify(output) });
  const result = await thesisRouter.createCaller({ user: { id: 1, role: "admin" } } as any)
    .compile({ thesisText: "Find established plumbing businesses in Florida with recurring maintenance." });
  expect(result.compilationId).toBe(123);
  expect(result.compiled.compiledFilters.businessAgeMin).toBe(5);
  expect(result.compiled.compiledFilters.cashFlowMin).toBeUndefined();
  expect(generateContent).toHaveBeenCalledOnce();
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(logActivity).toHaveBeenCalledOnce();
});

it("rejects malformed provider numbers instead of coercing them into usable filters", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-only-not-a-key");
  execute.mockResolvedValue([{ insertId: 124 }]);
  generateContent.mockResolvedValue({ text: JSON.stringify({ ...output, compiledFilters: { revenueMin: "2000000garbage" } }) });
  await expect(thesisRouter.createCaller({ user: { id: 1, role: "admin" } } as any)
    .compile({ thesisText: "Find established plumbing businesses in Florida with recurring maintenance." }))
    .rejects.toThrow();
  expect(logActivity).not.toHaveBeenCalled();
  expect(generateContent).toHaveBeenCalledOnce();
});

it("does not accept a compilation that silently omits the financial and geographic fields", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-only-not-a-key");
  execute.mockResolvedValue([{ insertId: 125 }]);
  generateContent.mockResolvedValue({ text: JSON.stringify({ ...output, compiledFilters: { askingPriceMin: "1000000", askingPriceMax: "5000000" } }) });
  await expect(thesisRouter.createCaller({ user: { id: 1, role: "admin" } } as any)
    .compile({ thesisText: "Find Florida HVAC businesses with asking price $1M to $5M and seller cash flow $300k to $1M." }))
    .rejects.toThrow();
  expect(logActivity).not.toHaveBeenCalled();
});

it("preserves explicit cash flow, asking price and all named states separately", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-only-not-a-key");
  execute.mockResolvedValue([{ insertId: 126 }]);
  generateContent.mockResolvedValue({ text: JSON.stringify({ ...output, compiledFilters: {
    cashFlowMin: "300000", cashFlowMax: "1000000", askingPriceMin: "1000000", askingPriceMax: "5000000",
    geographies: ["GA", "FL", "NC", "SC"],
  } }) });
  const result = await thesisRouter.createCaller({ user: { id: 1, role: "admin" } } as any)
    .compile({ thesisText: "Find GA, FL, NC and SC HVAC businesses asking $1M-$5M with cash flow $300k-$1M." });
  expect(result.compiled.compiledFilters).toMatchObject({ cashFlowMin: 300000, cashFlowMax: 1000000,
    askingPriceMin: 1000000, askingPriceMax: 5000000, geographies: ["GA", "FL", "NC", "SC"] });
  expect(result.compiled.compiledFilters.revenueMin).toBeUndefined();
  expect(generateContent.mock.calls[0][0].config.responseJsonSchema.properties.compiledFilters.required)
    .toEqual(expect.arrayContaining(["cashFlowMin", "cashFlowMax", "askingPriceMin", "askingPriceMax", "geographies"]));
});

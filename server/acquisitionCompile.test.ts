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
  compiledFilters: { geographies: ["FL"], businessAgeMin: "5" },
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

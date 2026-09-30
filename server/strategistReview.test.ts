import { afterEach, expect, it, vi } from "vitest";
const { generateContent, getDb } = vi.hoisted(() => ({ generateContent: vi.fn(), getDb: vi.fn() }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class { models = { generateContent }; } }));
vi.mock("./db", () => ({ getDb, logActivity: vi.fn() }));
import { thesisRouter } from "./thesisRouter";
import { strategistReviewFixture as fixture } from "./fixtures/strategist-review";
import { reviewKey, strategistReceipt, strategistApprovalSchema } from "../shared/strategistReview";
import { GEMINI_FAST } from "../shared/models";
const caller = () => thesisRouter.createCaller({ user: { id: 1, role: "admin" } } as any);
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
it("refines with validated registry role without saving or launching anything", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-only");
  generateContent.mockResolvedValue({ text: JSON.stringify(fixture) });
  expect(await caller().refine({ thesisText: fixture.brief, scope: "acquisition" })).toEqual(fixture);
  expect(getDb).not.toHaveBeenCalled();
  expect(generateContent.mock.calls[0][0].model).toBe(GEMINI_FAST);
});
it("fails closed on malformed output with no DB work", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-only"); generateContent.mockResolvedValue({ text: '{"brief":"buy it"}' });
  await expect(caller().refine({ thesisText: fixture.brief, scope: "acquisition" })).rejects.toThrow(/validated review/);
  expect(getDb).not.toHaveBeenCalled();
});
it("requires authentication", async () => {
  await expect(thesisRouter.createCaller({ user: null } as any).refine({ thesisText: fixture.brief, scope: "acquisition" })).rejects.toThrow();
  expect(generateContent).not.toHaveBeenCalled();
});
it("rejects stale approval before database insertion", async () => {
  await expect(caller().compile({ thesisText: "A different changed thesis for a business", strategistApproval: { review: fixture, dispositions: ["investigate"] } })).rejects.toThrow(/current brief/);
  expect(getDb).not.toHaveBeenCalled();
});
it("requires a disposition per angle and keeps decisions as unverified notes", () => {
  expect(strategistApprovalSchema.safeParse({ review: fixture, dispositions: [] }).success).toBe(false);
  const receipt = strategistReceipt({ review: fixture, dispositions: ["investigate"] }, fixture.brief);
  expect(receipt.join(" ")).toContain("investigation only, not a filter");
  expect(receipt.join(" ")).toContain("Qualified professional review required");
});
it("invalidates evaluations when text, scope or feedback changes", () => {
  const key = reviewKey(fixture.brief, "acquisition", "");
  expect(reviewKey(fixture.brief + " Changed budget.", "acquisition", "")).not.toBe(key);
  expect(reviewKey(fixture.brief, "property", "")).not.toBe(key);
  expect(reviewKey(fixture.brief, "acquisition", "Less involvement")).not.toBe(key);
});

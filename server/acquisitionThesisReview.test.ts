import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ generateContent: vi.fn(), values: vi.fn(), limit: vi.fn() }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class { models = { generateContent: mocks.generateContent }; } }));
vi.mock("./db", () => ({ getDb: async () => ({ insert: () => ({ values: mocks.values }), select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: mocks.limit }) }) }) }) }) }));
import { assessThesisCriteria, saveThesisReview, readThesisReview, thesisReviewKey, type ThesisReviewSnapshot } from "./acquisitionThesisReview";
const snapshot: ThesisReviewSnapshot = { version: 1, userId: 1, jobId: 2, thesisId: 3, thesisText: "Illustrative recurring revenue thesis",
  weights: [{ dimension: "Recurring revenue", weight: 100 }], sources: [{ url: "https://example.com/listing", excerpt: "Revenue details are not disclosed.", asOf: 1000 }],
  items: [{ dealId: 4, name: "Fixture", listingUrl: "https://example.com/listing", assessments: [], assessmentFailed: false }] };
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
it("stores a user/search-scoped immutable snapshot without changing deal scores", async () => {
  await saveThesisReview(snapshot);
  expect(mocks.values).toHaveBeenCalledOnce();
  const value = mocks.values.mock.calls[0][0];
  expect(value.subjectKey).toBe(thesisReviewKey(1, 2));
  expect(JSON.parse(value.content)).toEqual(snapshot);
  expect(thesisReviewKey(2, 2)).not.toBe(value.subjectKey);
  expect(mocks.generateContent).not.toHaveBeenCalled();
});
it("reads old snapshots without rerunning analysis or inventing a fit score", async () => {
  mocks.limit.mockResolvedValue([{ content: JSON.stringify(snapshot), createdAt: 1000, expiresAt: 2000 }]);
  const result = await readThesisReview(1, 2);
  expect(result?.stale).toBe(true);
  expect(result?.items[0].comparison.score).toBeNull();
  expect(mocks.generateContent).not.toHaveBeenCalled(); expect(mocks.values).not.toHaveBeenCalled();
});
it("rejects a stored snapshot belonging to another user or search", async () => {
  mocks.limit.mockResolvedValue([{ content: JSON.stringify(snapshot), createdAt: 1000, expiresAt: 2000 }]);
  await expect(readThesisReview(9, 2)).rejects.toThrow("identity mismatch");
  await expect(readThesisReview(1, 9)).rejects.toThrow("identity mismatch");
});
it("passes the exact thesis, weights and source to the configured provider", async () => {
  vi.stubEnv("GEMINI_API_KEY", "fixture-only");
  mocks.generateContent.mockResolvedValue({ text: JSON.stringify([{ dimension: "Recurring revenue", score: null, explanation: "Not disclosed", evidence: [] }]) });
  const result = await assessThesisCriteria({ thesisText: snapshot.thesisText, weights: snapshot.weights, source: snapshot.sources[0] });
  expect(result[0].score).toBeNull();
  expect(mocks.generateContent.mock.calls[0][0].contents[0].parts[0].text).toContain(snapshot.sources[0].excerpt);
  expect(mocks.values).not.toHaveBeenCalled();
});
it("does not accept malformed assessment output as a successful empty result", async () => {
  vi.stubEnv("GEMINI_API_KEY", "fixture-only"); mocks.generateContent.mockResolvedValue({ text: "broken" });
  await expect(assessThesisCriteria({ thesisText: snapshot.thesisText, weights: snapshot.weights, source: snapshot.sources[0] })).rejects.toThrow();
});
it("rejects provider output that silently omits the thesis criteria", async () => {
  vi.stubEnv("GEMINI_API_KEY", "fixture-only"); mocks.generateContent.mockResolvedValue({ text: "[]" });
  await expect(assessThesisCriteria({ thesisText: snapshot.thesisText, weights: snapshot.weights, source: snapshot.sources[0] })).rejects.toThrow("omitted");
});
it("rejects an oversized receipt before touching persistent storage", async () => {
  await expect(saveThesisReview({ ...snapshot, sources: [{ ...snapshot.sources[0], excerpt: "x".repeat(61000) }] })).rejects.toThrow("storage size");
  expect(mocks.values).not.toHaveBeenCalled();
});

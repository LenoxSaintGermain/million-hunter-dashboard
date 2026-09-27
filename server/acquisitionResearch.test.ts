import { afterEach, expect, it, vi } from "vitest";
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class { models = { generateContent }; } }));
import { researchAcquisitionListings } from "./acquisitionResearch";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetAllMocks(); });
const url = "https://www.bizbuysell.com/business-opportunity/illustrative-fixture/1234567/";
it("keeps an undisclosed industry unknown instead of aborting valid source extraction", async () => {
  vi.stubEnv("SONAR_API_KEY", "test-only"); vi.stubEnv("GEMINI_API_KEY", "test-only");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [
    { title: "Illustrative fixture", url, snippet: "Asking Price:$1,100,000 Cash Flow:$338,930" },
  ] }) }));
  generateContent.mockResolvedValueOnce({ text: JSON.stringify(["HVAC business for sale"]) });
  generateContent.mockResolvedValueOnce({ text: JSON.stringify([{ name: "Illustrative fixture", listingUrl: url,
    industry: null, location: null, askingPrice: 1100000, cashFlow: 338930 }]) });
  const rows = await researchAcquisitionListings({ thesisText: "HVAC", sources: ["bizbuysell"] });
  expect(rows).toHaveLength(1);
  expect(rows[0].industry).toBe("Not disclosed");
  expect(rows[0].cashFlow).toBe(338930);
  expect(rows[0].revenue).toBeNull();
});
it("grounds extracted listings in returned individual source records", async () => {
  vi.stubEnv("SONAR_API_KEY", "test-only"); vi.stubEnv("GEMINI_API_KEY", "test-only");
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [
    { title: "Illustrative HVAC fixture", url, snippet: "Atlanta, Georgia. Asking Price:$1,000,000 Cash Flow (SDE):$388,000" },
  ] }) });
  vi.stubGlobal("fetch", fetcher);
  generateContent.mockResolvedValueOnce({ text: JSON.stringify(["Georgia HVAC business for sale"]) });
  generateContent.mockResolvedValueOnce({ text: JSON.stringify([{ name: "Invented company", listingUrl: url,
    industry: "HVAC", location: "Atlanta, Georgia", askingPrice: 1000000, cashFlow: 388000, revenue: 2500000 }]) });
  const rows = await researchAcquisitionListings({ thesisText: "Georgia HVAC businesses", sources: ["bizbuysell"] });
  expect(fetcher.mock.calls[0][0]).toBe("https://api.perplexity.ai/search");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).not.toHaveProperty("search_domain_filter");
  expect(rows[0].name).toBe("Illustrative HVAC fixture");
  expect(rows[0].cashFlow).toBe(388000);
  expect(rows[0].revenue).toBeNull();
  expect(rows[0].source).toBe("bizbuysell.com");
});
it("rejects invented source URLs even when the model returns plausible economics", async () => {
  vi.stubEnv("SONAR_API_KEY", "test-only"); vi.stubEnv("GEMINI_API_KEY", "test-only");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [
    { title: "Illustrative fixture", url, snippet: "Asking Price:$1,000,000" },
  ] }) }));
  generateContent.mockResolvedValueOnce({ text: JSON.stringify(["Georgia HVAC business for sale"]) });
  generateContent.mockResolvedValueOnce({ text: JSON.stringify([{ name: "Invented", listingUrl: "https://example.com/invented", askingPrice: 1000000 }]) });
  await expect(researchAcquisitionListings({ thesisText: "Georgia HVAC", sources: ["bizbuysell"] })).rejects.toThrow();
});

it("does not convert a retrieval failure into an empty result", async () => {
  vi.stubEnv("SONAR_API_KEY", "test-only"); vi.stubEnv("GEMINI_API_KEY", "test-only");
  generateContent.mockResolvedValueOnce({ text: JSON.stringify(["HVAC for sale"]) });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  await expect(researchAcquisitionListings({ thesisText: "HVAC", sources: ["bizbuysell"] })).rejects.toThrow("retrieval failed");
  expect(generateContent).toHaveBeenCalledTimes(1);
});

it("does not extract category pages or unselected publisher records", async () => {
  vi.stubEnv("SONAR_API_KEY", "test-only"); vi.stubEnv("GEMINI_API_KEY", "test-only");
  generateContent.mockResolvedValueOnce({ text: JSON.stringify(["HVAC for sale"]) });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [
    { title: "Catalog", url: "https://dealstream.com/construction-for-sale", snippet: "Various businesses" },
    { title: "Unselected", url: "https://example.com/listing/1", snippet: "Asking Price:$1,000,000" },
  ] }) }));
  expect(await researchAcquisitionListings({ thesisText: "HVAC", sources: ["dealstream"] })).toEqual([]);
  expect(generateContent).toHaveBeenCalledTimes(1);
});

it("does not borrow prices from similar listings or repeat a source twice", async () => {
  vi.stubEnv("SONAR_API_KEY", "test-only"); vi.stubEnv("GEMINI_API_KEY", "test-only");
  generateContent.mockResolvedValueOnce({ text: JSON.stringify(["HVAC for sale"]) });
  const row = { name: "Fixture", listingUrl: url, askingPrice: 1500000, cashFlow: 403000 };
  generateContent.mockResolvedValueOnce({ text: JSON.stringify([row, row]) });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [
    { title: "Fixture", url, snippet: "Financials not disclosed. Similar Listings Asking Price:$1,500,000 Cash Flow:$403,000" },
  ] }) }));
  const rows = await researchAcquisitionListings({ thesisText: "HVAC", sources: ["bizbuysell"] });
  expect(rows).toHaveLength(1);
  expect(rows[0].askingPrice).toBeNull();
  expect(rows[0].cashFlow).toBeNull();
});

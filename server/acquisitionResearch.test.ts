import { afterEach, expect, it, vi } from "vitest";
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class { models = { generateContent }; } }));
import { researchAcquisitionListings } from "./acquisitionResearch";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetAllMocks(); });
const url = "https://www.bizbuysell.com/business-opportunity/illustrative-fixture/1234567/";
it("V2 preserves typed evidence without a second model extraction call", async () => {
  vi.stubEnv("SONAR_API_KEY", "test-only"); vi.stubEnv("GEMINI_API_KEY", "test-only");
  generateContent.mockResolvedValueOnce({ text: '["business for sale"]' });
  vi.stubGlobal("fetch", listingFetch("Illustrative fixture", "Asking Price: $1,850,000"));
  const onCaptures = vi.fn();
  expect(await researchAcquisitionListings({ thesisText: "test", sources: ["bizbuysell"], captureOnly: true, onCaptures })).toEqual([]);
  expect(generateContent).toHaveBeenCalledTimes(1);
  expect(onCaptures.mock.calls[0][0][0].evidence.fields.ask.value).toBe(1850000);
});
function listingFetch(title: string, page: string) {
  return vi.fn(async (target: string, _options?: any) => target.includes("api.perplexity")
    ? { ok: true, json: async () => ({ results: [{ title, url, snippet: "Discovery only; financial evidence comes from the page." }] }) }
    : new Response(`<main>${title}<br>${page}</main>`, { headers: { "content-type": "text/html" } }));
}
it("awaits evidence preservation before requesting extraction", async () => {
  vi.stubEnv("SONAR_API_KEY", "test-only"); vi.stubEnv("GEMINI_API_KEY", "test-only");
  vi.stubGlobal("fetch", listingFetch("Illustrative fixture", "Asking Price: $1,850,000"));
  generateContent.mockResolvedValueOnce({ text: '["business for sale"]' });
  generateContent.mockResolvedValueOnce({ text: "[]" });
  let extractionCallsAtReceipt = 0;
  await researchAcquisitionListings({ thesisText: "test", sources: ["bizbuysell"], onCaptures: async () => {
    await Promise.resolve();
    extractionCallsAtReceipt = generateContent.mock.calls.length;
  } });
  expect(extractionCallsAtReceipt).toBe(1);
});
it("stops extraction when asynchronous receipt persistence fails", async () => {
  vi.stubEnv("SONAR_API_KEY", "test-only"); vi.stubEnv("GEMINI_API_KEY", "test-only");
  vi.stubGlobal("fetch", listingFetch("Illustrative fixture", "Asking Price: $1,850,000"));
  generateContent.mockResolvedValueOnce({ text: '["business for sale"]' });
  await expect(researchAcquisitionListings({ thesisText: "test", sources: ["bizbuysell"], onCaptures: async () => {
    throw new Error("Receipt unavailable");
  } })).rejects.toThrow("Receipt unavailable");
  expect(generateContent).toHaveBeenCalledTimes(1);
});
it("retains expired source evidence but cannot promote it through model extraction", async () => {
  vi.stubEnv("SONAR_API_KEY", "test-only"); vi.stubEnv("GEMINI_API_KEY", "test-only");
  vi.stubGlobal("fetch", listingFetch("Illustrative fixture", "Listing status: Expired. Asking Price: $1,850,000"));
  generateContent.mockResolvedValueOnce({ text: '["business for sale"]' });
  generateContent.mockResolvedValueOnce({ text: JSON.stringify([{ name: "Fixture", listingUrl: url }]) });
  const receipt = vi.fn();
  expect(await researchAcquisitionListings({ thesisText: "test", sources: ["bizbuysell"], onCaptures: receipt })).toEqual([]);
  expect(receipt.mock.calls[0][0][0]).toMatchObject({ url, state: "captured" });
});
it("uses a fetched page rather than discovery snippets as financial evidence", async () => {
  vi.stubEnv("SONAR_API_KEY", "test-only"); vi.stubEnv("GEMINI_API_KEY", "test-only");
  vi.stubGlobal("fetch", vi.fn(async (target: string) => target.includes("api.perplexity")
    ? { ok: true, json: async () => ({ results: [{ title: "Fixture", url, snippet: "Asking Price: $9,000,000 Cash Flow: $9,000,000" }] }) }
    : new Response("<main>Asking Price: $1,850,000<br>Cash Flow: $702,537<br>Revenue: $3,590,234</main>", { headers: { "content-type": "text/html" } })));
  generateContent.mockResolvedValueOnce({ text: '["septic for sale"]' });
  generateContent.mockResolvedValueOnce({ text: JSON.stringify([{ name: "Fixture", listingUrl: url, askingPrice: 9000000 }]) });
  const rows = await researchAcquisitionListings({ thesisText: "septic", sources: ["bizbuysell"] });
  expect(rows[0].askingPrice).toBe(1850000);
  expect(rows[0].cashFlow).toBe(702537);
});
it("keeps an undisclosed industry unknown instead of aborting valid source extraction", async () => {
  vi.stubEnv("SONAR_API_KEY", "test-only"); vi.stubEnv("GEMINI_API_KEY", "test-only");
  vi.stubGlobal("fetch", listingFetch("Illustrative fixture", "Asking Price:$1,100,000 Cash Flow:$338,930"));
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
  const fetcher = listingFetch("Illustrative HVAC fixture", "Atlanta, Georgia. Asking Price:$1,000,000 Cash Flow (SDE):$388,000");
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
  vi.stubGlobal("fetch", listingFetch("Illustrative fixture", "Asking Price:$1,000,000"));
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
  vi.stubGlobal("fetch", listingFetch("Fixture", "Financials not disclosed. Similar Listings Asking Price:$1,500,000 Cash Flow:$403,000"));
  const rows = await researchAcquisitionListings({ thesisText: "HVAC", sources: ["bizbuysell"] });
  expect(rows).toHaveLength(1);
  expect(rows[0].askingPrice).toBeNull();
  expect(rows[0].cashFlow).toBeNull();
});

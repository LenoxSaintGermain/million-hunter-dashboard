import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GEMINI_BALANCED } from "../../shared/models";
import { discoverObjectiveMission } from "./strategyDiscoveryProvider";

const provider = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class {
  models = { generateContent: provider.generateContent };
} }));
vi.mock("../deepResearch", () => ({ runResearch: vi.fn(async () => ({
  content: "Illustrative diesel research: no defensible security hypothesis yet.",
  citations: ["https://example.test/diesel"], searchResults: [], createdAt: 1_000,
})) }));
vi.mock("../db", () => { throw new Error("No database permitted in provider routing tests"); });

describe("objective discovery production provider routing", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "illustrative-not-a-key");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "");
    vi.stubEnv("BUILT_IN_FORGE_API_URL", "");
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No network permitted"); }));
    provider.generateContent.mockReset().mockResolvedValue({
      text: JSON.stringify({ schemaVersion: 1, searchScope: "broader_permitted_universe",
        reviewedUniverse: [], coverageGaps: ["Illustrative evidence does not establish a setup."], hypotheses: [] }),
      candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Illustrative structured response" }] } }],
    });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("classifies via the configured direct provider with no legacy Forge credentials", async () => {
    const result = await discoverObjectiveMission({ requestId: "illustrative-diesel-routing",
      mission: "Verify the diesel price move before proposing a paper research play.",
      searchScope: "broader_permitted_universe", permittedUniverse: [], universePolicy: "cited_us_security_leads",
      holdingPeriods: ["intraday"], instrumentPreference: "shares",
    });
    expect(result.context.classifierState).toEqual({ status: "available", failures: [] });
    expect(result.payload).toMatchObject({ schemaVersion: 1, hypotheses: [] });
    expect(provider.generateContent).toHaveBeenCalledOnce();
    expect(provider.generateContent.mock.calls[0][0].model).toBe(GEMINI_BALANCED);
    const config = provider.generateContent.mock.calls[0][0].config;
    expect(JSON.stringify(config.responseJsonSchema)).not.toMatch(/"(?:minItems|maxItems|minLength|maxLength|minimum|maximum|\$schema)":/);
    expect(config.systemInstruction).toContain('"maxItems":12');
    expect(config.systemInstruction).toContain('"maximum":9007199254740991');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["MAX_TOKENS", "SAFETY", undefined])("rejects noncomplete provider output (%s)", async (finishReason) => {
    provider.generateContent.mockResolvedValue({ text: '{}', candidates: [{ finishReason }] });
    const result = await discoverObjectiveMission({ requestId: "illustrative-diesel-routing",
      mission: "Illustrative evidence only", searchScope: "broader_permitted_universe", permittedUniverse: [],
      universePolicy: "cited_us_security_leads", holdingPeriods: ["intraday"], instrumentPreference: "shares" });
    expect(result.context.classifierState.failures).toContain("invalid_classifier_response");
    expect(result.payload).toBeNull();
  });

  it("rejects a text response accompanied by a function call rather than dropping it", async () => {
    provider.generateContent.mockResolvedValue({ text: JSON.stringify({ schemaVersion: 1,
      searchScope: "broader_permitted_universe", reviewedUniverse: [], coverageGaps: [], hypotheses: [] }),
      candidates: [{ finishReason: "STOP", content: { parts: [{ text: "{}" }, { functionCall: { name: "unrequested", args: {} } }] } }] });
    const result = await discoverObjectiveMission({ requestId: "illustrative-diesel-routing",
      mission: "Illustrative evidence only", searchScope: "broader_permitted_universe", permittedUniverse: [],
      universePolicy: "cited_us_security_leads", holdingPeriods: ["intraday"], instrumentPreference: "shares" });
    expect(result.context.classifierState.failures).toContain("invalid_classifier_response");
    expect(result.payload).toBeNull();
  });
});

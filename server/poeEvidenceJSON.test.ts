import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("openai", () => ({ default: class { chat = { completions: { create: mocks.create } }; } }));
describe("evidence Poe JSON preserves the reviewer object", () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.stubEnv("Poe_api_key", "synthetic-parser-test"); });
  afterEach(() => { vi.unstubAllEnvs(); });
  it("does not unwrap citations and forwards bounded abort options", async () => {
    const { poeJSON } = await import("./poe");
    const output = { score: 0.5, rationale: "Hypothesis only.", citations: [{ citationId: "E1", quote: "Metadata only." }] };
    mocks.create.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(output) } }] });
    const signal = AbortSignal.timeout(1000);
    expect(await poeJSON({ model: "unit-test-only", userPrompt: "Unit fixture", signal, preserveObject: true })).toEqual(output);
    expect(mocks.create.mock.calls[0][1]).toEqual({ signal, maxRetries: 0 });
    vi.unstubAllEnvs();
  });
  it("classifies invalid JSON without leaking response text", async () => {
    const { poeJSON } = await import("./poe");
    mocks.create.mockResolvedValueOnce({ choices: [{ message: { content: "secret-response-invalid-json" } }] });
    await expect(poeJSON({ model: "unit-test-only", userPrompt: "Unit fixture", preserveObject: true })).rejects.toMatchObject({ code: "INVALID_JSON", message: "Poe returned invalid JSON." });
    vi.unstubAllEnvs();
  });
  it("leaves legacy array unwrapping unchanged", async () => {
    const { poeJSON } = await import("./poe");
    mocks.create.mockResolvedValueOnce({ choices: [{ message: { content: '{"signals":[{"id":1}]}' } }] });
    expect(await poeJSON({ model: "unit-test-only", userPrompt: "Unit fixture" })).toEqual([{ id: 1 }]);
  });
  it.each(['[]', '{"text":"' + "x".repeat(24000) + '"}'])("rejects array or oversized output in object mode %#", async content => {
    const { poeJSON } = await import("./poe");
    mocks.create.mockResolvedValueOnce({ choices: [{ message: { content } }] });
    await expect(poeJSON({ model: "unit-test-only", userPrompt: "Unit fixture", preserveObject: true })).rejects.toMatchObject({ code: "INVALID_JSON" });
  });
});

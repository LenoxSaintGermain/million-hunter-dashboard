import { afterEach, expect, it, vi } from "vitest";
const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb }));
import { runResearch } from "./deepResearch";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });
it("does not replace saved research when the provider returns empty evidence", async () => {
  vi.stubEnv("SONAR_API_KEY", "fixture-only");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: " " } }] }) }));
  await expect(runResearch({ subjectKey: "deal:fixture", subjectType: "deal", query: "Illustrative fixture", forceRefresh: true })).rejects.toThrow("no usable evidence");
  expect(getDb).not.toHaveBeenCalled();
});

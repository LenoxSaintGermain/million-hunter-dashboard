import { describe, expect, it } from "vitest";
import { readOptionalStatusSource } from "./optionalStatusSource";
import { deriveApertureAttention } from "../../shared/apertureAttention";

describe("partial source failure", () => {
  it("preserves useful records without converting a failed query into a quiet empty result", async () => {
    const failed = await readOptionalStatusSource("Monitoring", async () => { throw new Error("connection lost"); });
    expect(failed.value).toBeNull();
    expect(failed.unavailable).toContain("unavailable");
    const briefing = deriveApertureAttention({ now: 1000, mission: null, underwriting: null, evidenceTasks: [], orders: [], activePlays: [{ id: 1, symbol: "MRVL", state: "watching", detail: "Waiting for sourced trigger", href: "/aperture/plays?play=1", updatedAt: 900 }], pendingReviews: [], monitoringFindings: [], checks: { state: "partial", asOf: 1000, monitoring: "on_demand", error: failed.unavailable } }, null);
    expect(briefing.quiet).toBe(false);
    expect(briefing.primary?.kind).toBe("status_unavailable");
    expect(briefing.inMotion).toHaveLength(1);
  });
  it("distinguishes a genuinely empty source from an unavailable source", async () => {
    expect(await readOptionalStatusSource("Monitoring", async () => [])).toEqual({ value: [], unavailable: null });
  });
});

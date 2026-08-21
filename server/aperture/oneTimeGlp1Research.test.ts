import { describe, expect, it } from "vitest";
import { oneTimePostOpenResearchGate, oneTimeResearchCron } from "./oneTimeGlp1Research";

describe("one-time GLP-1 post-open research schedule", () => {
  // 10:00 EDT on 2026-08-21, while New York observes daylight saving time.
  const targetAt = Date.UTC(2026, 7, 21, 14, 0, 0);

  it("emits the six-field UTC cron for the named one-time window", () => {
    expect(oneTimeResearchCron(targetAt)).toBe("0 0 14 21 8 *");
  });

  it("accepts the intended post-open regular-session window", () => {
    expect(oneTimePostOpenResearchGate(targetAt, targetAt)).toMatchObject({ eligible: true });
  });

  it("fails closed before the opening-range window, after its retry grace, and on another date", () => {
    expect(oneTimePostOpenResearchGate(targetAt - 60_000, targetAt).eligible).toBe(false);
    expect(oneTimePostOpenResearchGate(targetAt + 16 * 60_000, targetAt).eligible).toBe(false);
    expect(oneTimePostOpenResearchGate(Date.UTC(2026, 7, 24, 14, 0, 0), targetAt).eligible).toBe(false);
  });
});

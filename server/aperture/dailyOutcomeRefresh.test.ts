import { describe, expect, it } from "vitest";
import { isDailyOutcomeRefreshEligible } from "./dailyOutcomeRefresh";

const atEt = (value: string) => Date.parse(value);

describe("daily paper-outcome refresh eligibility", () => {
  const live = { snapshotBasis: "live_capture" as const, status: "awaiting_outcome" as const, sessionDateEt: "2026-08-20" };

  it("waits until the captured ET session is closed plus the evidence buffer", () => {
    expect(isDailyOutcomeRefreshEligible(live, atEt("2026-08-20T20:14:00Z"))).toBe(false); // 16:14 ET
    expect(isDailyOutcomeRefreshEligible(live, atEt("2026-08-20T20:15:00Z"))).toBe(true); // 16:15 ET
  });

  it("allows a later ET date but excludes complete or historical records", () => {
    expect(isDailyOutcomeRefreshEligible(live, atEt("2026-08-21T13:00:00Z"))).toBe(true);
    expect(isDailyOutcomeRefreshEligible({ ...live, status: "complete" }, atEt("2026-08-21T13:00:00Z"))).toBe(false);
    expect(isDailyOutcomeRefreshEligible({ ...live, snapshotBasis: "historical_reconstruction" }, atEt("2026-08-21T13:00:00Z"))).toBe(false);
  });
});

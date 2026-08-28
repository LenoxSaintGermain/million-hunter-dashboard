import { describe, expect, it } from "vitest";
import { monitoringReviewState, parseMonitoringProviderOutput } from "./monitor";

const cited = ["https://example.com/current-source"];

describe("monitoring provider honesty", () => {
  it("fails malformed provider output closed as UNKNOWN requiring review", () => {
    const result = parseMonitoringProviderOutput(
      "A narrative answer without the required fields.",
      "catalyst",
      cited,
    );

    expect(result.flagged).toBe(true);
    expect(result.finding).toMatch(/^UNKNOWN ·/);
  });

  it("fails an otherwise clear answer closed when it has no citations", () => {
    const result = parseMonitoringProviderOutput(
      "FINDING: No material catalyst found.\nFLAGGED: NO",
      "catalyst",
      [],
    );

    expect(result.flagged).toBe(true);
    expect(result.finding).toMatch(/^UNKNOWN ·/);
  });

  it("fails provider output closed when it disclaims current evidence", () => {
    const result = parseMonitoringProviderOutput(
      "FINDING: Available data is stale and cannot verify current conditions.\nFLAGGED: NO",
      "macro",
      cited,
    );

    expect(result.flagged).toBe(true);
    expect(result.finding).toBe("UNKNOWN · Provider output could not establish current evidence.");
  });

  it("accepts a correctly formed, cited clear answer", () => {
    const result = parseMonitoringProviderOutput(
      "FINDING: No material catalyst found.\nFLAGGED: NO",
      "catalyst",
      cited,
    );

    expect(result).toMatchObject({
      checkType: "catalyst",
      finding: "No material catalyst found.",
      flagged: false,
    });
  });

  it("turns an aged check into UNKNOWN with a concrete next action", () => {
    const now = Date.UTC(2026, 7, 28, 16);
    const state = monitoringReviewState({
      finding: "No material catalyst found.",
      flagged: false,
      citations: cited,
      checkedAt: now - 25 * 60 * 60 * 1000,
    }, now);

    expect(state).toEqual({
      state: "unknown",
      needsReview: true,
      nextAction: "Refresh sourced monitoring evidence",
      reason: "Monitoring evidence is stale.",
    });
  });
});

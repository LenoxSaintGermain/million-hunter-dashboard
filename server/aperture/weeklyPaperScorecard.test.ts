import { describe, expect, it } from "vitest";
import { buildWeeklyPaperScorecard } from "../../shared/weeklyPaperScorecard";

describe("weekly paper scorecard", () => {
  it("counts selected verified outcomes and recorded skips without treating unresolved tape as a result", () => {
    const scorecard = buildWeeklyPaperScorecard([
      {
        snapshotBasis: "live_capture",
        items: [
          { operatorDecision: "selected", outcomeStatus: "resolved", outcomeResult: "win", outcomeBasis: "verified" },
          { operatorDecision: "selected", outcomeStatus: "unavailable", outcomeResult: "unresolved", outcomeBasis: "unknown" },
          { operatorDecision: "skipped", outcomeStatus: "pending", outcomeResult: "unresolved", outcomeBasis: "unknown" },
          { operatorDecision: "deferred", outcomeStatus: "pending", outcomeResult: "unresolved", outcomeBasis: "unknown" },
        ],
      },
      { snapshotBasis: "historical_reconstruction", items: [{ operatorDecision: "selected", outcomeStatus: "resolved", outcomeResult: "loss", outcomeBasis: "verified" }] },
    ]);

    expect(scorecard).toMatchObject({ liveCohortCount: 1, historicalExcluded: 1, selectedCount: 2, wins: 1, losses: 0, skipped: 1, deferred: 1, unavailable: 1, verifiedTerminalCount: 1 });
    expect(scorecard.sampleLimit).toContain("not enough to establish accuracy");
  });

  it("uses an explicit no-claim message when no source-verified selected outcome exists", () => {
    const scorecard = buildWeeklyPaperScorecard([{ snapshotBasis: "live_capture", items: [{ operatorDecision: "selected", outcomeStatus: "pending", outcomeResult: "unresolved", outcomeBasis: "unknown" }] }]);
    expect(scorecard.sampleLimit).toContain("not a performance claim");
  });
});

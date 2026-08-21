import { describe, expect, it } from "vitest";
import { orderDailyPlayQueue, researchCoverageLabel } from "../../shared/dailyPlayQueue";

describe("daily trader queue", () => {
  it("orders by operational readiness before the nearest catalyst, never a fit score", () => {
    const queued = orderDailyPlayQueue([
      { item: { symbol: "FIT_ONLY", fit: 0.99 }, readiness: "needs_evidence", catalystDeadlineAt: 1 },
      { item: { symbol: "READY_LATER", fit: 0.05 }, readiness: "ready_to_prepare", catalystDeadlineAt: 3 },
      { item: { symbol: "READY_FIRST", fit: 0.01 }, readiness: "ready_to_prepare", catalystDeadlineAt: 2 },
    ]);
    expect(queued.map(({ item }) => item.symbol)).toEqual(["READY_FIRST", "READY_LATER", "FIT_ONLY"]);
  });

  it("keeps confidence coverage and open evidence counts together in plain language", () => {
    expect(researchCoverageLabel(0.33, 2)).toBe("Research coverage 33/100 · 2 decision-critical checks open");
    expect(researchCoverageLabel(null, 0)).toBe("Research coverage not measured · required checks recorded");
  });
});

import { describe, expect, it } from "vitest";
import { orderDailyPlayQueue } from "./dailyPlayQueue";

describe("daily paper-play queue", () => {
  it.each([10, 50, 100])("keeps all %i candidates while ordering only by readiness and live catalyst timing", (count) => {
    const baseDeadline = 1_000_000;
    const candidates = Array.from({ length: count }, (_, index) => ({
      symbol: `C${String(index).padStart(3, "0")}`,
      readiness: index % 3 === 0 ? "ready_to_prepare" as const : index % 3 === 1 ? "needs_risk_plan" as const : "needs_evidence" as const,
      catalystDeadlineAt: baseDeadline + (count - index) * 1_000,
      ignoredPredictedReturn: 10_000 - index,
    }));

    const ordered = orderDailyPlayQueue(candidates);

    expect(ordered).toHaveLength(count);
    expect(ordered[0].readiness).toBe("ready_to_prepare");
    expect(ordered.at(-1)?.readiness).toBe("needs_evidence");
    expect(ordered.filter((candidate) => candidate.readiness === "ready_to_prepare").map((candidate) => candidate.symbol))
      .toEqual(candidates.filter((candidate) => candidate.readiness === "ready_to_prepare").reverse().map((candidate) => candidate.symbol));
  });
});

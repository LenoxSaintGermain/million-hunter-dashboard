import { describe, expect, it } from "vitest";
import {
  classifyDeskCandidate,
  playDeskJourneyLane,
  summarizeDeskCandidates,
} from "@shared/playDeskState";

describe("Capital Aperture play desk state", () => {
  const now = Date.UTC(2026, 8, 2, 14, 0, 0);

  it("does not offer an already-active or expired play as a fresh choice", () => {
    const active = classifyDeskCandidate({
      id: 1,
      symbol: "IWM",
      hasActiveOrder: true,
      catalystDeadlineAt: now - 1,
      paperStageDeclined: false,
      unreviewedChecks: 0,
      runFailed: false,
    }, now);
    const expired = classifyDeskCandidate({
      id: 2,
      symbol: "IWM",
      hasActiveOrder: false,
      catalystDeadlineAt: now - 1,
      paperStageDeclined: false,
      unreviewedChecks: 0,
      runFailed: false,
    }, now);

    expect(active.state).toBe("active");
    expect(expired.state).toBe("expired");
    expect(playDeskJourneyLane(summarizeDeskCandidates([active]))).toBe("in_motion_only");
    expect(playDeskJourneyLane(summarizeDeskCandidates([expired]))).toBe("backlog");
  });

  it("surfaces the one actionable candidate in a mixed run", () => {
    const summary = summarizeDeskCandidates([
      classifyDeskCandidate({ id: 10, symbol: "NU", hasActiveOrder: true, catalystDeadlineAt: now + 1_000, paperStageDeclined: false, unreviewedChecks: 0, runFailed: false }, now),
      classifyDeskCandidate({ id: 11, symbol: "MRVL", hasActiveOrder: false, catalystDeadlineAt: now + 1_000, paperStageDeclined: false, unreviewedChecks: 0, runFailed: false }, now),
      classifyDeskCandidate({ id: 12, symbol: "COHR", hasActiveOrder: false, catalystDeadlineAt: now + 1_000, paperStageDeclined: false, unreviewedChecks: 1, runFailed: false }, now),
      classifyDeskCandidate({ id: 13, symbol: "MU", hasActiveOrder: false, catalystDeadlineAt: now + 1_000, paperStageDeclined: false, unreviewedChecks: 2, runFailed: false }, now),
    ]);

    expect(summary).toMatchObject({ total: 4, ready: 1, active: 1, blocked: 2, actionableCandidateId: 11, actionableSymbol: "MRVL" });
    expect(summary.label).toBe("1 ready · 1 in motion · 2 need evidence");
    expect(playDeskJourneyLane(summary)).toBe("choose");
  });

  it("keeps failed and declined candidates out of the choice lane", () => {
    const summary = summarizeDeskCandidates([
      classifyDeskCandidate({ id: 20, symbol: "TLT", hasActiveOrder: false, catalystDeadlineAt: null, paperStageDeclined: false, unreviewedChecks: 0, runFailed: true }, now),
      classifyDeskCandidate({ id: 21, symbol: "CASH", hasActiveOrder: false, catalystDeadlineAt: null, paperStageDeclined: true, unreviewedChecks: 0, runFailed: false }, now),
    ]);

    expect(summary.failed).toBe(1);
    expect(summary.declined).toBe(1);
    expect(playDeskJourneyLane(summary)).toBe("backlog");
  });
});

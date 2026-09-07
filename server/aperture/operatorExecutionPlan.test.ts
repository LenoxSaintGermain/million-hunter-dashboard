import { describe, expect, it } from "vitest";
import {
  WEEKLY_EXECUTION_TARGET_CENTS,
  buildOperatorAction,
  executionBucketFor,
} from "../../shared/operatorExecutionPlan";

describe("operator execution plan", () => {
  it("classifies the three execution buckets without treating the target as a forecast", () => {
    expect(WEEKLY_EXECUTION_TARGET_CENTS).toBe(500_000);
    expect(executionBucketFor({ instrumentType: "shares", holdingPeriod: "intraday" })).toBe("dip_buying");
    expect(executionBucketFor({ instrumentType: "shares", holdingPeriod: "swing" })).toBe("swings");
    expect(executionBucketFor({ instrumentType: "long_put", holdingPeriod: "swing" })).toBe("defined_risk_options");
  });

  it("prioritizes a sourced negative catalyst over routine position monitoring", () => {
    const action = buildOperatorAction({
      now: Date.parse("2026-09-06T21:00:00Z"),
      chooseCount: 2,
      orders: [{
        id: 7,
        runId: 30,
        candidateId: 90,
        symbol: "WBD",
        instrumentType: "shares",
        holdingPeriod: "swing",
        status: "filled",
        plannedRiskCents: 20_000,
        monitoring: [{
          id: 3,
          checkType: "thesis_invalidation",
          finding: "A sourced delay may weaken the recorded catalyst.",
          flagged: true,
          citations: ["https://example.com/source"],
          checkedAt: Date.parse("2026-09-06T13:00:00Z"),
        }],
      }],
    });
    expect(action.state).toBe("action_required");
    expect(action.assetStrategy).toContain("WBD");
    expect(action.immediateAction).toMatch(/negative catalyst/i);
    expect(action.nextActionLabel).toBe("Review WBD evidence");
  });

  it("never invents a gain or exit price when verified marks are absent", () => {
    const action = buildOperatorAction({
      chooseCount: 0,
      orders: [{
        id: 8,
        runId: 31,
        candidateId: 91,
        symbol: "PWR",
        instrumentType: "shares",
        holdingPeriod: "swing",
        status: "filled",
        plannedRiskCents: 50_000,
        monitoring: [],
      }],
    });
    expect(action.currentState).toMatch(/not measured/i);
    expect(action.immediateAction).not.toMatch(/sell 50|\$\d/);
  });

  it("does not promote a stale headline into an actionable negative catalyst", () => {
    const action = buildOperatorAction({
      now: Date.parse("2026-09-06T21:00:00Z"),
      chooseCount: 0,
      orders: [{
        id: 9,
        runId: 32,
        candidateId: 92,
        symbol: "WBD",
        instrumentType: "shares",
        holdingPeriod: "swing",
        status: "filled",
        plannedRiskCents: 30_000,
        monitoring: [{
          id: 4,
          checkType: "thesis_invalidation",
          finding: "Old negative story.",
          flagged: true,
          citations: ["https://example.com/old"],
          checkedAt: Date.parse("2026-09-04T12:00:00Z"),
        }],
      }],
    });
    expect(action.immediateAction).not.toMatch(/negative catalyst/i);
    expect(action.watchFinding).toBeNull();
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WI_COPY } from "../../shared/weeklyIncome/copy";

describe("Today review baseline is explicit (#125)", () => {
  const source = readFileSync("client/src/components/aperture/TodayAttentionBriefing.tsx", "utf8");
  it("records the review baseline only from the Mark reviewed action, never from a page view", () => {
    const calls = source.split("markSeen.mutate(").length - 1;
    expect(calls).toBe(1);
    const body = source.slice(source.indexOf("const markReviewed = () => {"));
    expect(body.indexOf("markSeen.mutate(")).toBeGreaterThan(-1);
    expect(body.indexOf("markSeen.mutate(")).toBeLessThan(body.indexOf("\n  };"));
    expect(source).toContain(">{markSeen.isPending ? \"Saving review…\" : \"Mark reviewed\"}</Button>");
  });
});

describe("Weekly Income halt copy says what is true (#121)", () => {
  it("does not point at a control that does not exist", () => {
    expect(WI_COPY["wi.halt"]).not.toMatch(/lifts? the halt|owner/i);
    expect(WI_COPY["wi.halt"]).toContain("research only");
    expect(WI_COPY["wi.halt"]).toContain("can't place Weekly Income orders yet");
  });
});

describe("Today review leftovers (#125 retest)", () => {
  const source = readFileSync("client/src/components/aperture/TodayAttentionBriefing.tsx", "utf8");
  it("shows the stored review time, not the time of this read", () => {
    expect(source).toContain("attention.lastReviewedAt");
    expect(source).not.toContain("since your last review${attention.baseline?.capturedAt");
  });
  it("counts and badges come from the same changed set, and the button shows whenever something changed", () => {
    expect(source).toContain("const changedCount = changedKeys.size;");
    expect(source).toContain("{attention.changeHeading} · {changedCount}");
    expect(source).toContain("(changedCount > 0 || (read.canRecordSeen && attention.changeHeading === \"Current status\")) && <div data-mark-reviewed");
  });
});

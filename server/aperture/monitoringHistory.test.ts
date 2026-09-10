import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { partitionMonitoringHistory, monitoringReviewState } from "../../shared/monitoringState";

const now = Date.UTC(2026, 8, 9, 14);
const check = (id: number, checkType: string, checkedAt: number, flagged = false, finding = "Illustrative sourced check") => ({ id, checkType, checkedAt, flagged, finding, citations: ["https://example.org/fixture"] });

describe("Current monitoring versus recorded history", () => {
  it("does not turn three batches into twelve current tasks or erase old findings", () => {
    const records = [0, 1, 2].flatMap(batch => ["catalyst", "thesis_invalidation", "earnings", "macro"].map((kind, i) => check(batch * 4 + i, kind, now - batch * 86_400_000, i === 0)));
    const before = JSON.stringify(records);
    const result = partitionMonitoringHistory(records, now);
    expect(result.current).toHaveLength(4);
    expect(result.history).toHaveLength(8);
    expect(result.current.filter(item => monitoringReviewState(item, now).needsReview)).toHaveLength(1);
    expect(result.current[0].checkType).toBe("catalyst");
    expect([...result.current, ...result.history].map(item => item.id).sort((a, b) => a - b)).toEqual(records.map(item => item.id).sort((a, b) => a - b));
    expect(JSON.stringify(records)).toBe(before);
  });
  it("keeps a newer failed result current, never falls back to an older clear result", () => {
    const result = partitionMonitoringHistory([check(1, "catalyst", now - 1), check(2, "catalyst", now, false, "UNKNOWN · source unavailable")], now);
    expect(result.current.map(item => item.id)).toEqual([2]);
    expect(monitoringReviewState(result.current[0], now).state).toBe("unknown");
  });
  it("breaks timestamp ties by recorded identity and handles empty history", () => {
    expect(partitionMonitoringHistory([check(1, "catalyst", now), check(2, "catalyst", now)], now).current[0].id).toBe(2);
    expect(partitionMonitoringHistory([])).toEqual({ current: [], history: [] });
  });
  it("places flagged findings and uncertainty before newer routine clear checks", () => {
    const result = partitionMonitoringHistory([check(1, "catalyst", now - 2, true), check(2, "thesis_invalidation", now - 1, false, "UNKNOWN · source unavailable"), check(3, "macro", now)], now);
    expect(result.current.map(item => item.id)).toEqual([1, 2, 3]);
  });
  it("keeps an unresolved catalyst first when every check is stale without claiming fresh evidence", () => {
    const checkedAt = now - 2 * 86_400_000;
    const records = [check(1, "catalyst", checkedAt, true), check(2, "thesis_invalidation", checkedAt), check(3, "earnings", checkedAt), check(4, "macro", checkedAt)];
    const result = partitionMonitoringHistory(records, now);
    expect(result.current.map(item => item.id)).toEqual([1, 4, 3, 2]);
    expect(monitoringReviewState(result.current[0], now).state).toBe("unknown");
    expect(monitoringReviewState(result.current[0], now).reason).toContain("unresolved");
  });
  it("wires only current checks into the live review count, with history retained separately", () => {
    const source = readFileSync("client/src/pages/aperture/ApertureExecute.tsx", "utf8");
    expect(source).toContain("const reviewItems = currentChecks.filter");
    expect(source).toContain("Previous checks · {previousChecks.length}");
    expect(source).toContain("previousChecks.filter(check => !showSelected || check.id !== selectedCheck.id)");
    expect(source).toContain("Selected historical finding");
  });
});

import { describe, expect, it } from "vitest";
import { deriveApertureAttention, type ApertureAttentionInput } from "../../shared/apertureAttention";
import { monitoringFindingHref, monitoringFindingVersion, parseMonitoringFindingSelection, selectMonitoringFinding } from "../../shared/monitoringFinding";

const now = Date.UTC(2026, 8, 9, 18);
const check = { id: 1, runId: 360001, candidateId: 240003, checkType: "catalyst", checkedAt: now - 2 * 86_400_000, flagged: true, finding: "Illustrative catalyst concern", citations: ["https://example.org/fixture"] };
const input: ApertureAttentionInput = { now, mission: null, underwriting: null, evidenceTasks: [], orders: [], activePlays: [], pendingReviews: [], monitoringFindings: [{ ...check, orderId: 12, symbol: "DKNG", kind: "material_change", instrument: { symbol: "DKNG261120P00020000", instrumentType: "long_put" } }], checks: { state: "complete", asOf: now, monitoring: "on_demand" } };

describe("exact monitoring finding handoff", () => {
  it("carries order, candidate, finding and immutable version from attention to its exact record", () => {
    const task = deriveApertureAttention(input, null).primary!;
    const selection = parseMonitoringFindingSelection(new URL(task.href!, "https://fixture.invalid").search);
    expect(selection).toEqual({ orderId: 12, findingId: 1, findingVersion: monitoringFindingVersion(check) });
    expect(selectMonitoringFinding([check], selection).check).toEqual(check);
    expect(task.stateLabel).toBe("Unresolved finding · stale evidence");
    expect(task.reason).toContain("previously flagged");
    expect(task.actionLabel).toBe("Review unresolved finding");
    expect(task.title).toContain("Put");
  });
  it("opens a selected historical version without promoting it to the current check", () => {
    const newer = { ...check, id: 2, checkedAt: now, flagged: false };
    const selected = parseMonitoringFindingSelection(new URL(monitoringFindingHref({ ...check, orderId: 12 }), "https://fixture.invalid").search);
    expect(selectMonitoringFinding([newer, check], selected)).toMatchObject({ state: "selected", check, historical: true });
    expect(selectMonitoringFinding([newer], selected).state).toBe("missing");
    expect(selectMonitoringFinding([{ ...check, finding: "Changed record" }], selected).state).toBe("version_mismatch");
  });
  it("does not substitute a record for incomplete or malformed links", () => {
    for (const search of ["?finding=1", "?order=12&finding=1&findingVersion=no", "?order=-1&finding=1&findingVersion=v1-12345678"]) {
      expect(parseMonitoringFindingSelection(search)).toEqual({ invalid: true });
      expect(selectMonitoringFinding([check], parseMonitoringFindingSelection(search)).state).toBe("invalid");
    }
    expect(parseMonitoringFindingSelection("?lifecycle=monitoring")).toBeNull();
  });
  it("does not treat a new check identity or timestamp alone as a new material change", () => {
    const fresh = { ...input, monitoringFindings: input.monitoringFindings.map(f => ({ ...f, checkedAt: now })) };
    const baseline = deriveApertureAttention(fresh, null).baseline;
    const repeat = deriveApertureAttention({ ...fresh, monitoringFindings: fresh.monitoringFindings.map(f => ({ ...f, id: 2, checkedAt: now + 1 })) }, baseline);
    expect(repeat.changed).toEqual([]);
    expect(repeat.primary?.href).toContain("finding=2");
  });
  it("does not call malformed provider output an unresolved sourced finding", () => {
    const bad = { ...input, monitoringFindings: input.monitoringFindings.map(f => ({ ...f, finding: "UNKNOWN · provider failed", checkedAt: now })) };
    const task = deriveApertureAttention(bad, null).primary!;
    expect(task.stateLabel).toBe("Evidence not verified");
    expect(task.reason).not.toContain("flagged a change");
  });
});

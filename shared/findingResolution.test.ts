/**
 * Closing a finding — the verb that was missing.
 *
 * Until 2026-09-12 both review decisions kept the concern open, `resolved` was
 * typed as the literal `false`, and the server hardcoded it. Nothing could ever
 * be cleared, so every finding an operator had already dealt with stayed on
 * their list forever. These tests pin the two halves of the fix: closing works,
 * and closing cannot silence evidence nobody has read.
 */
import { describe, it, expect } from "vitest";
import {
  isFindingResolved, monitoringFindingVersion, resolvedFindingVersions,
  type MonitoringReviewDecision, type MonitoringReviewReceipt, type VersionedMonitoringFinding,
} from "./monitoringFinding";

const NOW = Date.UTC(2026, 8, 12, 14, 0);

const finding = (over: Partial<VersionedMonitoringFinding> = {}): VersionedMonitoringFinding => ({
  id: 24, checkType: "thesis_invalidation", checkedAt: NOW - 60_000, flagged: true,
  finding: "Illustrative recorded finding.", citations: ["https://example.org/fixture"],
  ...over,
} as VersionedMonitoringFinding);

const receipt = (over: Partial<MonitoringReviewReceipt> & { decision: MonitoringReviewDecision }): MonitoringReviewReceipt => ({
  requestId: `req-${Math.random()}`, userId: 1, runId: 360001, candidateId: 240002,
  orderId: 12, findingId: 24, findingVersion: monitoringFindingVersion(finding()),
  reviewedAt: NOW, note: "Illustrative reason recorded by the operator.",
  resolved: over.decision === "resolved",
  ...over,
  ...(over.resolved === undefined ? { resolved: over.decision === "resolved" } : {}),
});

describe("closing a finding", () => {
  it("closes the exact version a human read", () => {
    expect(isFindingResolved(finding(), [receipt({ decision: "resolved" })])).toBe(true);
  });

  it("leaves it open for every decision that is not a close", () => {
    for (const decision of ["reviewed_unresolved", "needs_fresh_evidence"] as const) {
      expect(isFindingResolved(finding(), [receipt({ decision })])).toBe(false);
    }
  });

  it("leaves it open when no review has been recorded at all", () => {
    expect(isFindingResolved(finding(), [])).toBe(false);
    expect(isFindingResolved(finding(), undefined)).toBe(false);
  });

  it("ignores a receipt that claims resolved without the resolved decision", () => {
    // `resolved` is derived server-side from the decision. A stored row that
    // disagrees with itself must not close anything.
    const forged = { ...receipt({ decision: "reviewed_unresolved" }), resolved: true };
    expect(isFindingResolved(finding(), [forged])).toBe(false);
  });
});

describe("closing cannot silence what nobody has read", () => {
  it("does not close a later check that flags again", () => {
    const first = finding();
    const closed = [receipt({ decision: "resolved", findingVersion: monitoringFindingVersion(first) })];
    // A new check on the same finding id: different time, different text.
    const later = finding({ checkedAt: NOW + 3_600_000, finding: "A new concern was recorded." });
    expect(monitoringFindingVersion(later)).not.toBe(monitoringFindingVersion(first));
    expect(isFindingResolved(first, closed)).toBe(true);
    expect(isFindingResolved(later, closed)).toBe(false);
  });

  it("does not close a different finding that happens to share a version string", () => {
    const closed = [receipt({ decision: "resolved", findingId: 24 })];
    expect(isFindingResolved(finding({ id: 25 } as Partial<VersionedMonitoringFinding>), closed)).toBe(false);
  });

  it("reopens when a fresh concern is recorded after a close", () => {
    const version = monitoringFindingVersion(finding());
    const history = [
      receipt({ decision: "resolved", findingVersion: version, reviewedAt: NOW }),
      receipt({ decision: "reviewed_unresolved", findingVersion: version, reviewedAt: NOW + 60_000 }),
    ];
    expect(isFindingResolved(finding(), history)).toBe(false);
  });

  it("closes again when the operator closes it after reopening", () => {
    const version = monitoringFindingVersion(finding());
    const history = [
      receipt({ decision: "resolved", findingVersion: version, reviewedAt: NOW }),
      receipt({ decision: "needs_fresh_evidence", findingVersion: version, reviewedAt: NOW + 60_000 }),
      receipt({ decision: "resolved", findingVersion: version, reviewedAt: NOW + 120_000 }),
    ];
    expect(isFindingResolved(finding(), history)).toBe(true);
  });

  it("tracks each version independently", () => {
    const a = finding({ id: 24 });
    const b = finding({ id: 25, finding: "A second recorded finding." } as Partial<VersionedMonitoringFinding>);
    const closed = [
      receipt({ decision: "resolved", findingId: 24, findingVersion: monitoringFindingVersion(a) }),
      receipt({ decision: "reviewed_unresolved", findingId: 25, findingVersion: monitoringFindingVersion(b) }),
    ];
    const versions = resolvedFindingVersions(closed);
    expect(versions.has(`24:${monitoringFindingVersion(a)}`)).toBe(true);
    expect(versions.has(`25:${monitoringFindingVersion(b)}`)).toBe(false);
  });
});

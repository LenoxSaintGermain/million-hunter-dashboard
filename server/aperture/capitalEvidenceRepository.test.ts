import { describe, expect, it, vi } from "vitest";
import { createCapitalEvidenceReader, createCapitalEvidenceRecordLoader, createCapitalEvidenceBindingService, capitalFindingsFromSavedRun, capitalEvidenceRevisionValues, capitalEvidenceConfirmationInput } from "./capitalEvidenceRepository";

describe("Capital binding current reads and suggestions", () => {
  const scope = { decisionRunId: 10, revisionId: 11, candidateId: 12 };
  it("uses locking current reads rather than awaiting the ordinary snapshot", async () => {
    const lock = vi.fn().mockResolvedValue([]);
    const snapshot = vi.fn(() => { throw new Error("stale snapshot must not be read"); });
    const query = { then: snapshot, for: lock };
    const db = { select: () => ({ from: () => ({ where: () => ({ limit: () => query }) }) }) };
    const load = createCapitalEvidenceRecordLoader({ database: async () => db as any, lockReads: true });
    expect(await load(1, scope)).toBeNull();
    expect(lock).toHaveBeenCalledWith("update"); expect(snapshot).not.toHaveBeenCalled();
  });
  it("does not enumerate securities without the owned current decision", async () => {
    const select = vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }));
    const service = createCapitalEvidenceBindingService({ database: async () => ({ select }) as any });
    await expect(service.securityChoices(1, scope)).rejects.toThrow();
    expect(select).toHaveBeenCalledTimes(1);
  });
});

describe("Capital evidence SELECT-only reader", () => {
  const scope = { decisionRunId: 10, revisionId: 11, candidateId: 12 };
  function database(rows: unknown[][]) {
    const select = vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => rows.shift() ?? [] }) }) }));
    return { select };
  }
  it("does not substitute data on missing database", async () => {
    const getRun = vi.fn();
    const reader = createCapitalEvidenceReader({ database: vi.fn().mockResolvedValue(null), evidenceRepository: { getRun } });
    expect(await reader(1, scope)).toMatchObject({ status: "unavailable", reason: "context_read_failed", findings: [], attention: [] });
    expect(getRun).not.toHaveBeenCalled();
  });
  it("stops before source reads when the owned decision is absent", async () => {
    const db = database([[]]), getRun = vi.fn();
    const reader = createCapitalEvidenceReader({ database: vi.fn().mockResolvedValue(db), evidenceRepository: { getRun } });
    expect((await reader(1, scope)).reason).toBe("context_unavailable");
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(getRun).not.toHaveBeenCalled();
  });
  it("reports a legacy revision as unbound, not an empty successful analysis", async () => {
    const db = database([[{ id: 10, currentRevisionId: 11 }], [{ id: 11, contextSnapshot: {}, gateSnapshot: {} }]]);
    const getRun = vi.fn();
    const reader = createCapitalEvidenceReader({ database: vi.fn().mockResolvedValue(db), evidenceRepository: { getRun } });
    expect((await reader(1, scope)).reason).toBe("evidence_context_not_bound");
    expect(db.select).toHaveBeenCalledTimes(2);
    expect(getRun).not.toHaveBeenCalled();
  });
  it("refuses superseded revisions before loading any evidence", async () => {
    const db = database([[{ id: 10, currentRevisionId: 99 }]]), getRun = vi.fn();
    const reader = createCapitalEvidenceReader({ database: vi.fn().mockResolvedValue(db), evidenceRepository: { getRun } });
    expect((await reader(1, scope)).status).toBe("unavailable");
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(getRun).not.toHaveBeenCalled();
  });
  it("does not treat arbitrary saved prose as finding-level analysis", () => {
    expect(() => capitalFindingsFromSavedRun({ output: { summary: "A tempting investment" } } as any)).toThrow();
  });
});

describe("binding revision authority reset", () => {
  function current(branch = "eligible") {
    return { id: 11, decisionRunId: 10, version: 2, previousRevisionId: 9, createdAt: 1, createdByUserId: 1,
      effectiveBranch: branch, operatorChoice: "selected_play", selectedCandidateId: 12, plannedRiskCents: 500,
      missionText: "Original mission", missionHash: "original", holdingPeriods: ["intraday"],
      contextSnapshot: { canonicalThesisId: 14 }, gateSnapshot: { mandateVersion: "v1", permittedRiskCents: 500 },
      rankingSnapshot: { winner: 12 }, reviewAt: 100, reopenCondition: "Review original gate", namedGateKey: "original" } as any;
  }
  it("preserves old records and mission text but does not inherit eligibility or selection", () => {
    const row = current(), old = structuredClone(row);
    const next = capitalEvidenceRevisionValues(row, { version: 1 } as any, { requestId: "request", requestHash: "hash" });
    expect(row).toEqual(old);
    expect(next).toMatchObject({ lifecycle: "researching", values: { effectiveBranch: "research", operatorChoice: "research",
      selectedCandidateId: null, plannedRiskCents: 0, rankingSnapshot: null, missionText: "Original mission",
      gateSnapshot: { permittedRiskCents: null, riskAuthorityState: "pending_verification", humanApprovalRequired: true, sourceAvailabilityVerified: false } } });
    expect(next.values).not.toHaveProperty("id");
  });
  it.each(["cash", "conditional"])("preserves %s restrictions and review schedule", branch => {
    const next = capitalEvidenceRevisionValues(current(branch), {} as any, { requestId: "request", requestHash: "hash" });
    expect(next.lifecycle).toBe(branch);
    expect(next.pending).toMatchObject({ branch, reviewAt: 100, namedGateKey: "original" });
  });
  it("rejects reuse of a confirmation ID against a later baseline", () => {
    const row = current(); row.contextSnapshot.evidenceBindingRequest = { requestId: "request", requestHash: "hash" };
    expect(() => capitalEvidenceRevisionValues(row, {} as any, { requestId: "request", requestHash: "hash" })).toThrow();
  });
  it("does not permit a client owner or confirmation timestamp", () => {
    expect(capitalEvidenceConfirmationInput.shape.binding.shape).not.toHaveProperty("ownerId");
    expect(capitalEvidenceConfirmationInput.shape.binding.shape).not.toHaveProperty("confirmedAt");
    expect(capitalEvidenceConfirmationInput.shape.confirmed.safeParse(false).success).toBe(false);
    expect(capitalEvidenceConfirmationInput.shape.expectedLockVersion.safeParse(-1).success).toBe(false);
  });
});

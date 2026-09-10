import { describe, it, expect } from "vitest";
import { jobClaimDisposition, mayPublishUnderwriting, underwritingJobStatus, type UnderwritingJobRecord } from "../../shared/underwritingJob";

const job = (overrides: Partial<UnderwritingJobRecord> = {}): UnderwritingJobRecord => ({ id: 1, state: "running", milestone: "market_evidence", attemptToken: "attempt-one", leaseUntil: 20_000, failure: null, updatedAt: 1000, ...overrides });

describe("persisted underwriting job journey", () => {
  it("another device reads actual progress without restarting work", () => {
    const persisted = job();
    const original = structuredClone(persisted);
    expect(underwritingJobStatus(persisted, 2000).state).toBe("running");
    expect(jobClaimDisposition(persisted, 2000)).toBe("in_progress");
    expect(persisted).toEqual(original);
  });
  it("timeout reconciles the same identity, then requires explicit retry after lease loss", () => {
    expect(jobClaimDisposition(job(), 2000, 1)).toBe("in_progress");
    expect(underwritingJobStatus(job(), 20_001).state).toBe("interrupted");
    expect(jobClaimDisposition(job(), 20_001)).toBe("needs_explicit_retry");
    expect(jobClaimDisposition(job(), 20_001, 2)).toBe("needs_explicit_retry");
    expect(jobClaimDisposition(job(), 20_001, 1)).toBe("retry");
  });
  it("an expired or replaced worker cannot publish a duplicate result", () => {
    expect(mayPublishUnderwriting(job(), "attempt-one", 21_000)).toBe(false);
    const resumed = job({ attemptToken: "attempt-two", leaseUntil: 40_000 });
    expect(mayPublishUnderwriting(resumed, "attempt-one", 21_000)).toBe(false);
    expect(mayPublishUnderwriting(resumed, "attempt-two", 21_000)).toBe(true);
  });
  it("completion is reused and never inferred from elapsed time", () => {
    expect(underwritingJobStatus(job(), 999_999).state).not.toBe("complete");
    expect(jobClaimDisposition(job({ state: "complete", milestone: "complete" }), 999_999)).toBe("reuse");
    expect(mayPublishUnderwriting(job({ state: "complete" }), "attempt-one", 1000)).toBe(false);
  });
  it("an empty or failed status is not described as a running or successful analysis", () => {
    expect(underwritingJobStatus(null, 1)).toMatchObject({ state: "not_started", canRetry: false });
    expect(underwritingJobStatus(job({ state: "failed", milestone: "failed" }), 1)).toMatchObject({ state: "failed", canRetry: true });
  });
  it("uses actual discovery milestones without claiming a completed underwriting or allocation", () => {
    const discovery = job({ workKind: "discovery" });
    expect(underwritingJobStatus(discovery, 2000).message).toContain("Collecting cited research");
    expect(underwritingJobStatus({ ...discovery, milestone: "recording_result" }, 2000).message).toContain("Recording hypotheses and exclusions");
    const complete = underwritingJobStatus({ ...discovery, state: "complete", milestone: "complete" }, 2000);
    expect(complete.message).toContain("Research leads are not allocations");
    expect(complete.canRetry).toBe(false);
    expect(complete.message).not.toContain("playbook");
  });
});

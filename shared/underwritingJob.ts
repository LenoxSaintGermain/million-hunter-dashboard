export const UNDERWRITING_JOB_LEASE_MS = 15 * 60 * 1_000;

export type UnderwritingJobRecord = {
  id: number;
  state: "running" | "complete" | "failed";
  milestone: "market_evidence" | "recording_result" | "complete" | "failed";
  attemptToken: string;
  leaseUntil: number;
  failure: string | null;
  updatedAt: number;
  workKind?: "underwriting" | "discovery";
};

// Read-only presentation: opening a page never retries or marks a job failed.
export function underwritingJobStatus(job: UnderwritingJobRecord | null, now: number) {
  if (!job) return { state: "not_started" as const, message: "No analysis is running. Review your mission before underwriting.", jobId: null, updatedAt: null, canRetry: false };
  const interrupted = job.state === "running" && job.leaseUntil <= now;
  const state = interrupted ? "interrupted" as const : job.state;
  const message = interrupted ? "The analysis worker has not reported completion. Resume this analysis explicitly; no order was created."
    : state === "failed" ? job.failure ?? "Analysis failed. Your mission and previous result are preserved."
    : state === "complete" ? job.workKind === "discovery" ? "The discovery receipt is recorded. Research leads are not allocations; no order was created." : "The research playbook is recorded. No ticket or order was created."
    : job.workKind === "discovery" ? job.milestone === "recording_result" ? "Source review finished. Recording hypotheses and exclusions." : "Collecting cited research for the saved capital question."
    : job.milestone === "recording_result" ? "Market analysis finished. Recording the playbook."
    : "Checking provider-backed market evidence against the mission risk limits.";
  return { state, message, jobId: job.id, updatedAt: job.updatedAt, canRetry: state === "failed" || state === "interrupted" };
}

export function jobClaimDisposition(job: UnderwritingJobRecord | null, now: number, retryJobId?: number) {
  if (!job) return "start" as const;
  if (job.state === "complete") return "reuse" as const;
  if (job.state === "running" && job.leaseUntil > now) return "in_progress" as const;
  return retryJobId === job.id ? "retry" as const : "needs_explicit_retry" as const;
}

export function mayPublishUnderwriting(job: UnderwritingJobRecord, attemptToken: string, now: number) {
  return job.state === "running" && job.attemptToken === attemptToken && job.leaseUntil > now;
}

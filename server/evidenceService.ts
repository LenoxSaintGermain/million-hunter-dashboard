import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createEvidenceRepository, deriveSecSubjectKey } from "./evidenceRepository";
import { fetchSecSubmissions } from "./secSubmissions";
import { SEC_EVIDENCE_SOURCE } from "./evidenceSources";
import type { SecSubmissionsResult } from "../shared/secEvidence";

export const secSubjectInput = z.object({ cik: z.string().regex(/^\d{1,10}$/).refine(v => !/^0+$/.test(v)) }).strict();
export const secCaptureInput = secSubjectInput.extend({ requestId: z.string().uuid() }).strict();
export const receiptIdInput = z.object({ id: z.string().uuid() }).strict();

/** Hash normalized evidence, not request/owner/time metadata. Repeated identical
 * observations can share a hash while keeping distinct immutable receipt IDs. */
export function evidencePayloadHash(payload: SecSubmissionsResult): string {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value !== null && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]))
      : value;
  const { retrievedAt: _retrievedAt, ...evidence } = payload;
  return createHash("sha256").update(JSON.stringify(canonical(evidence))).digest("hex");
}

function storageFailure(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  const code = (error as { code?: string })?.code;
  if (code === "RATE_LIMITED") throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "SEC capture budget reached. Wait one minute before trying again." });
  if (code === "CONFLICT") throw new TRPCError({ code: "CONFLICT", message: "This capture request belongs to another issuer. Start a new capture." });
  // Never return an empty library or unsaved provider payload on DB failure.
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Evidence storage is unavailable. Capture is not confirmed saved. Retry with the same request; no evidence is substituted." });
}

export function createEvidenceService(deps: {
  repository?: ReturnType<typeof createEvidenceRepository>;
  fetch?: typeof fetchSecSubmissions;
  enabled?: () => boolean;
} = {}) {
  const repo = deps.repository ?? createEvidenceRepository();
  const fetchSource = deps.fetch ?? fetchSecSubmissions;
  const enabled = deps.enabled ?? SEC_EVIDENCE_SOURCE.enabled;
  return {
    async list(ownerId: number, input: z.infer<typeof secSubjectInput>) {
      const subject = deriveSecSubjectKey(secSubjectInput.parse(input).cik);
      try {
        return (await repo.list(ownerId, subject, 20)).map(({ payload: _payload, ...summary }) => summary);
      } catch (error) { return storageFailure(error); }
    },
    async get(ownerId: number, input: z.infer<typeof receiptIdInput>) {
      const { id } = receiptIdInput.parse(input);
      try {
        const receipt = await repo.get(ownerId, id);
        if (!receipt) throw new TRPCError({ code: "NOT_FOUND", message: "Evidence receipt not found." });
        return receipt;
      } catch (error) { return storageFailure(error); }
    },
    async capture(ownerId: number, input: z.infer<typeof secCaptureInput>) {
      const { cik, requestId } = secCaptureInput.parse(input);
      const subjectKey = deriveSecSubjectKey(cik);
      try {
        // Resolve an unknown save outcome without another provider request, even
        // when the kill switch has since been disabled.
        const existing = await repo.findRequest(ownerId, requestId);
        if (existing) {
          if (existing.subjectKey !== subjectKey) throw new TRPCError({ code: "CONFLICT", message: "This request was already used for another issuer." });
          return existing;
        }
        if (!enabled()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "SEC evidence capture is disabled. Existing receipts remain readable." });
        await repo.reserveCaptureAttempt(ownerId);
        const claim = await repo.claimCapture(ownerId, requestId, subjectKey);
        if (claim.status === "pending") {
          if (Date.now() - claim.startedAt.getTime() < 30_000) {
            throw new TRPCError({ code: "CONFLICT", message: "This capture is still in progress. Retry the same request shortly to recover its receipt." });
          }
          // A process may have stopped after fetching but before saving. Do not
          // replay its external request or pretend that no fetch occurred.
          const payload: SecSubmissionsResult = {
            status: "unavailable", sourceUrl: `https://data.sec.gov/submissions/${subjectKey.slice(4)}.json`,
            retrievedAt: null, company: null, filings: [], failureCode: "CAPTURE_INTERRUPTED",
            message: "Capture completion could not be confirmed after interruption. No successful evidence was saved for this request. Start a new capture to try again.",
          };
          return await repo.append({ ownerId, subjectKey, requestId, provider: SEC_EVIDENCE_SOURCE.id,
            schemaVersion: 1, sourceUrl: payload.sourceUrl, status: payload.status, payload,
            payloadHash: evidencePayloadHash(payload), retrievedAt: null, expiresAt: null,
            message: payload.message, failureCode: payload.failureCode });
        }
        let budgetDenied = false;
        try { await repo.reserveSecBudget(ownerId); }
        catch (error) {
          if ((error as { code?: string })?.code !== "RATE_LIMITED") throw error;
          budgetDenied = true;
        }
        const payload: SecSubmissionsResult = budgetDenied ? {
          status: "unavailable", sourceUrl: `https://data.sec.gov/submissions/${subjectKey.slice(4)}.json`,
          retrievedAt: null, company: null, filings: [], failureCode: "RATE_LIMITED",
          message: "The shared SEC request budget or provider cooldown prevented this capture. No source request was made. Try a new capture later.",
        } : await fetchSource(cik);
        if (payload.failureCode === "RATE_LIMITED" && payload.retryAt) await repo.setSecCooldown(new Date(payload.retryAt));
        const retrievedAt = payload.retrievedAt ? new Date(payload.retrievedAt) : null;
        return await repo.append({
          ownerId, subjectKey, requestId, provider: SEC_EVIDENCE_SOURCE.id,
          schemaVersion: SEC_EVIDENCE_SOURCE.schemaVersion,
          sourceUrl: payload.sourceUrl, status: payload.status, payload,
          payloadHash: evidencePayloadHash(payload), retrievedAt,
          expiresAt: retrievedAt ? new Date(retrievedAt.getTime() + SEC_EVIDENCE_SOURCE.freshnessMs) : null,
          message: payload.message, failureCode: payload.failureCode,
        });
      } catch (error) { return storageFailure(error); }
    },
  };
}

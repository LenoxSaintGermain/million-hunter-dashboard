import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { attachDealEvidenceInput, dealEvidenceId, dealEvidenceScope, dealEvidenceSnapshotSchema, getDealEvidenceRunInput, runDealEvidenceInput, SEC_ANALYSIS_LIMITATION, DEAL_EVIDENCE_PROMPT_VERSION, type DealEvidenceSnapshot } from "../shared/dealEvidence";
import { createDealEvidenceRepository, type DealEvidenceRepository, type DealEvidenceRun } from "./dealEvidenceRepository";
import { createEvidenceRepository, type EvidenceReceipt } from "./evidenceRepository";
import { evidencePayloadHash } from "./evidenceService";
import { safeSecPrimaryDocument } from "./secSubmissions";
import { evidenceEnginePrompt, EvidenceOutputError, EvidencePanelError, executeEvidenceEngine, resolveEvidenceModels, validateEvidenceOutput } from "./dealEvidenceEngine";

type Mode = "red_team" | "ic";
const fail = (message: string) => new TRPCError({ code: "PRECONDITION_FAILED", message });
function storageError(error: unknown): never {
  if (error instanceof TRPCError || error instanceof z.ZodError) throw error;
  const code = (error as { code?: string })?.code;
  if (code === "NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found." });
  if (code === "CONFLICT") throw new TRPCError({ code: "CONFLICT", message: "Request already belongs to another analysis or attachment." });
  if (code === "RATE_LIMITED") throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Evidence action budget reached. Retry later." });
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Evidence analysis storage unavailable; save is not confirmed. Retry the same request to recover; no result is substituted." });
}
export function createDealEvidenceService(deps: {
  repository?: DealEvidenceRepository;
  evidence?: Pick<ReturnType<typeof createEvidenceRepository>, "get">;
  engine?: typeof executeEvidenceEngine;
  resolveModels?: typeof resolveEvidenceModels;
  now?: () => Date;
} = {}) {
  const repo = deps.repository ?? createDealEvidenceRepository();
  const evidence = deps.evidence ?? createEvidenceRepository();
  const engine = deps.engine ?? executeEvidenceEngine;
  const resolveModels = deps.resolveModels ?? resolveEvidenceModels;
  const now = deps.now ?? (() => new Date());
  async function authorizedDeal(ownerId: number, dealId: number) {
    dealEvidenceId.parse(ownerId);
    const deal = await repo.getDeal(ownerId, dealId);
    if (!deal || deal.ownerUserId !== ownerId || deal.isArchived) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found." });
    return deal;
  }
  async function receipt(ownerId: number, receiptId: string, cik: string): Promise<EvidenceReceipt> {
    const row = await evidence.get(ownerId, receiptId);
    if (!row || row.ownerId !== ownerId) throw new TRPCError({ code: "NOT_FOUND", message: "Evidence receipt not found." });
    if (row.provider !== "sec-submissions" || row.schemaVersion !== 1 || row.status === "unavailable" || row.failureCode !== null || !row.retrievedAt || !row.expiresAt || !row.payload.company) throw fail("Only successful SEC submissions receipt versions can be attached or analyzed.");
    if (row.subjectKey !== `sec:CIK${cik}` || row.payload.company.cik !== cik || row.sourceUrl !== `https://data.sec.gov/submissions/CIK${cik}.json` || row.payload.sourceUrl !== row.sourceUrl || row.payload.status !== row.status || row.payload.failureCode !== null) throw fail("The receipt does not support the confirmed CIK relation.");
    if (row.payloadHash !== evidencePayloadHash(row.payload)) throw fail("Receipt payload hash could not be verified.");
    if (row.retrievedAt.toISOString() !== row.payload.retrievedAt || row.expiresAt < row.retrievedAt) throw fail("Receipt timestamps could not be verified.");
    return row;
  }
  async function snapshot(ownerId: number, deal: Awaited<ReturnType<typeof authorizedDeal>>, attachmentIds: string[]): Promise<DealEvidenceSnapshot> {
    const result: DealEvidenceSnapshot = {
      schemaVersion: 1, promptVersion: DEAL_EVIDENCE_PROMPT_VERSION, limitation: SEC_ANALYSIS_LIMITATION,
      deal: { id: deal.id, name: deal.name, description: deal.description?.slice(0, 8000) ?? null, industry: deal.industry,
        location: deal.location, revenue: deal.revenue, cashFlow: deal.cashFlow, askingPrice: deal.askingPrice,
        multiple: deal.multiple, employees: deal.employees, yearEstablished: deal.yearEstablished },
      evidence: [], citations: [], gaps: ["Filing content, financial statements, legal diligence and financial verification were not retrieved.", "The target/issuer relation is owner-confirmed, not independently verified."],
    };
    const seenReceipts = new Set<string>(); let cik: string | undefined;
    for (const [index, id] of Array.from(attachmentIds.entries())) {
      const attachment = await repo.getAttachment(ownerId, deal.id, id);
      if (!attachment || attachment.ownerId !== ownerId || attachment.dealId !== deal.id) throw new TRPCError({ code: "NOT_FOUND", message: "Deal attachment not found." });
      if (attachment.relation !== "same_legal_entity" || attachment.identityBasis !== "owner_confirmed_not_independently_verified") throw fail("Unsupported entity relation.");
      if (cik && cik !== attachment.confirmedCik) throw fail("Conflicting issuer identities cannot be analyzed as one legal entity.");
      cik = attachment.confirmedCik;
      const row = await receipt(ownerId, attachment.receiptId, cik);
      if (row.payloadHash !== attachment.payloadHash || seenReceipts.has(row.id)) throw fail("Attachment version is invalid or duplicated.");
      seenReceipts.add(row.id);
      const filings = row.payload.filings.slice(0, 10);
      const key = `E${index + 1}`;
      const stale = row.expiresAt!.getTime() <= now().getTime();
      result.evidence.push({ attachmentId: id, receiptId: row.id, payloadHash: row.payloadHash, cik, issuerName: row.payload.company!.name,
        sourceUrl: row.sourceUrl, retrievedAt: row.retrievedAt!.toISOString(), expiresAt: row.expiresAt!.toISOString(), staleAtRun: stale,
        relation: "same_legal_entity", identityBasis: "owner_confirmed_not_independently_verified", status: row.status as "ok" | "empty",
        totalFilings: row.payload.filings.length, includedFilings: filings.length });
      result.citations.push({ id: key, receiptId: row.id, payloadHash: row.payloadHash, sourceUrl: row.sourceUrl,
        fact: `SEC submissions metadata for CIK ${cik}, issuer ${row.payload.company!.name}: this receipt contains ${row.payload.filings.length} recent filing metadata entries. Filing content was not retrieved.` });
      for (const [filingIndex, filing] of Array.from(filings.entries())) {
        const expected = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${filing.accessionNumber.replaceAll("-", "")}/${filing.primaryDocument}`;
        if (!/^\d{10}-\d{2}-\d{6}$/.test(filing.accessionNumber) || !safeSecPrimaryDocument.safeParse(filing.primaryDocument).success || filing.url !== expected) throw fail("Unsupported SEC source citation.");
        result.citations.push({ id: `${key}F${filingIndex + 1}`, receiptId: row.id, payloadHash: row.payloadHash, sourceUrl: filing.url,
          fact: `Accession ${filing.accessionNumber}; form ${filing.form}; filing date ${filing.filingDate}; report date ${filing.reportDate ?? "not supplied"}. Metadata only; document content not retrieved.` });
      }
      if (stale) result.gaps.push(`${key} is an expired receipt snapshot, not current evidence.`);
      if (!filings.length) result.gaps.push(`${key} contains no recent filing metadata; this is not evidence of no risk.`);
      if (row.payload.filings.length > filings.length) result.gaps.push(`${key} includes only the first ${filings.length} of ${row.payload.filings.length} entries in the prompt; the exact full receipt remains saved.`);
    }
    if (result.evidence.length > 1 && new Set(result.evidence.map(row => row.payloadHash)).size > 1) result.gaps.push("Selected receipt versions differ. Do not reconcile differences as verified events without inspecting the filing content.");
    const parsed = dealEvidenceSnapshotSchema.parse(result); evidenceEnginePrompt(parsed); return parsed;
  }
  async function recover(run: DealEvidenceRun, requestHash: string, dealId: number, mode: Mode) {
    if (run.dealId !== dealId || run.requestHash !== requestHash || run.mode !== mode) throw new TRPCError({ code: "CONFLICT", message: "Request already bound to different analysis inputs." });
    if (run.status !== "pending") return run;
    if (now().getTime() - run.startedAt.getTime() < 120000) throw new TRPCError({ code: "CONFLICT", message: "Analysis is already running; retry the same request shortly." });
    return repo.finish({ id: run.id, ownerId: run.ownerId, dealId, status: "failed", output: null, failureCode: "ANALYSIS_INTERRUPTED",
      message: "Analysis completion could not be confirmed. Upstream execution may have occurred. No decision is recorded; start a new explicit run to retry.", completedAt: now() });
  }
  async function run(ownerId: number, input: z.input<typeof runDealEvidenceInput>, mode: Mode) {
    const parsed = runDealEvidenceInput.parse(input);
    try {
      const deal = await authorizedDeal(ownerId, parsed.dealId);
      const ids = [...parsed.attachmentIds].sort();
      const requestHash = createHash("sha256").update(JSON.stringify({ dealId: parsed.dealId, mode, attachmentIds: ids })).digest("hex");
      const existing = await repo.findRequest(ownerId, parsed.requestId);
      if (existing) return await recover(existing, requestHash, parsed.dealId, mode);
      const inputSnapshot = await snapshot(ownerId, deal, ids);
      const models = z.array(z.string().min(1).max(128)).length(mode === "ic" ? 3 : 1).parse(await resolveModels(mode));
      const claim = await repo.start({ ownerId, dealId: parsed.dealId, requestId: parsed.requestId, requestHash, mode, models, inputSnapshot });
      if (!claim.claimed) return await recover(claim.run, requestHash, parsed.dealId, mode);
      let output: Awaited<ReturnType<typeof validateEvidenceOutput>> | null = null;
      let failureCode: string | null = null; let message: string | null = null;
      try { output = validateEvidenceOutput(mode, await engine(mode, structuredClone(inputSnapshot), [...models]), inputSnapshot, models); }
      catch (error) {
        failureCode = error instanceof EvidenceOutputError || (error instanceof EvidencePanelError && error.failures.every(failure => ["INVALID_JSON", "INVALID_OUTPUT"].includes(failure.category))) ? "INVALID_OUTPUT" : "PROVIDER_UNAVAILABLE";
        message = failureCode === "INVALID_OUTPUT" ? "Model output or source citations could not be verified. No decision recorded." : "Analysis provider failed or credentials are unavailable. No decision recorded.";
        if (error instanceof EvidencePanelError) message += " Reviewers: " + error.failures.map(failure => `${failure.model}: ${failure.category}${failure.httpStatus === null ? "" : ` (HTTP ${failure.httpStatus})`}`).join("; ");
      }
      // Saving is outside the provider catch: a failed save never masquerades as a saved failure.
      await authorizedDeal(ownerId, parsed.dealId);
      return await repo.finish({ id: claim.run.id, ownerId, dealId: parsed.dealId, status: output ? "complete" : "failed", output, failureCode, message, completedAt: now() });
    } catch (error) { return storageError(error); }
  }
  return {
    async attach(ownerId: number, input: z.input<typeof attachDealEvidenceInput>) {
      const parsed = attachDealEvidenceInput.parse(input);
      try {
        await authorizedDeal(ownerId, parsed.dealId);
        const row = await receipt(ownerId, parsed.receiptId, parsed.confirmedCik);
        return await repo.attach({ ownerId, dealId: parsed.dealId, requestId: parsed.requestId, receiptId: row.id, payloadHash: row.payloadHash,
          confirmedCik: parsed.confirmedCik, relation: parsed.relation, identityBasis: "owner_confirmed_not_independently_verified" });
      } catch (error) { return storageError(error); }
    },
    async attachments(ownerId: number, input: z.input<typeof dealEvidenceScope>) {
      const { dealId } = dealEvidenceScope.parse(input);
      try { await authorizedDeal(ownerId, dealId); return await repo.listAttachments(ownerId, dealId); } catch (error) { return storageError(error); }
    },
    runRedTeam: (ownerId: number, input: z.input<typeof runDealEvidenceInput>) => run(ownerId, input, "red_team"),
    runIC: (ownerId: number, input: z.input<typeof runDealEvidenceInput>) => run(ownerId, input, "ic"),
    async runs(ownerId: number, input: z.input<typeof dealEvidenceScope>) {
      const { dealId } = dealEvidenceScope.parse(input);
      try { await authorizedDeal(ownerId, dealId); return await repo.listRuns(ownerId, dealId); } catch (error) { return storageError(error); }
    },
    async getRun(ownerId: number, input: z.input<typeof getDealEvidenceRunInput>) {
      const { dealId, id } = getDealEvidenceRunInput.parse(input);
      try {
        await authorizedDeal(ownerId, dealId); const saved = await repo.getRun(ownerId, dealId, id);
        if (!saved) throw new TRPCError({ code: "NOT_FOUND", message: "Analysis run not found." });
        return saved;
      } catch (error) { return storageError(error); }
    },
  };
}

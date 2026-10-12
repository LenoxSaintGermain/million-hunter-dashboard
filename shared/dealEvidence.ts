import { z } from "zod";

export const SEC_ANALYSIS_LIMITATION = "SEC submissions metadata only — not filing content, financial verification, or independent verification of the owner-confirmed entity relation. Model risks are hypotheses for diligence, not verified findings or approval.";
export const DEAL_EVIDENCE_PROMPT_VERSION = "pd06-sec-metadata-v1";
export const dealEvidenceId = z.number().int().positive().max(2147483647);
const uuid = z.string().uuid().transform(value => value.toLowerCase());
export const dealEvidenceScope = z.object({ dealId: dealEvidenceId }).strict();
export const attachDealEvidenceInput = dealEvidenceScope.extend({
  receiptId: uuid, requestId: uuid, confirmedCik: z.string().regex(/^\d{10}$/).refine(v => !/^0+$/.test(v)),
  relation: z.literal("same_legal_entity"), confirmed: z.literal(true),
}).strict();
export const runDealEvidenceInput = dealEvidenceScope.extend({
  requestId: uuid, attachmentIds: z.array(uuid).min(1).max(3).refine(ids => new Set(ids).size === ids.length),
}).strict();
export const getDealEvidenceRunInput = dealEvidenceScope.extend({ id: uuid }).strict();
export const evidenceCitationSchema = z.object({
  id: z.string().regex(/^E[1-3](?:F(?:[1-9]|10))?$/), receiptId: uuid,
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/), sourceUrl: z.string().url().max(512),
  fact: z.string().min(1).max(1200),
}).strict();
export const evidenceRedTeamOutputSchema = z.object({
  killProbability: z.number().min(0).max(1), redFlags: z.array(z.string().min(1).max(1000)).max(6),
  summary: z.string().min(1).max(3000),
  citations: z.array(z.object({ citationId: z.string().max(16), quote: z.string().min(1).max(1200) }).strict()).min(1).max(33),
}).strict();
export type EvidenceRedTeamOutput = z.infer<typeof evidenceRedTeamOutputSchema>;
export const evidenceICOutputSchema = z.object({
  scores: z.array(z.object({ model: z.string().min(1).max(128), score: z.number().min(0).max(1),
    rationale: z.string().min(1).max(3000), citations: evidenceRedTeamOutputSchema.shape.citations }).strict()).length(3),
  consensusScore: z.number().min(0).max(1), divergenceScore: z.number().min(0).max(1),
  divergenceFlag: z.boolean(), summary: z.string().min(1).max(1000),
}).strict();
export type EvidenceICOutput = z.infer<typeof evidenceICOutputSchema>;
export type EvidenceAnalysisOutput = EvidenceRedTeamOutput | EvidenceICOutput;
export const dealEvidenceSnapshotSchema = z.object({
  schemaVersion: z.literal(1), promptVersion: z.literal(DEAL_EVIDENCE_PROMPT_VERSION), limitation: z.literal(SEC_ANALYSIS_LIMITATION),
  deal: z.object({ id: dealEvidenceId, name: z.string().max(256), description: z.string().max(8000).nullable(),
    industry: z.string().max(128).nullable(), location: z.string().max(256).nullable(),
    revenue: z.number().finite().nullable(), cashFlow: z.number().finite().nullable(), askingPrice: z.number().finite().nullable(),
    multiple: z.number().finite().nullable(), employees: z.number().finite().nullable(), yearEstablished: z.number().finite().nullable(),
  }).strict(),
  evidence: z.array(z.object({
    attachmentId: uuid, receiptId: uuid, payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
    cik: z.string().regex(/^\d{10}$/), issuerName: z.string().max(256), sourceUrl: z.string().url().max(512),
    retrievedAt: z.string().datetime(), expiresAt: z.string().datetime(), staleAtRun: z.boolean(),
    relation: z.literal("same_legal_entity"), identityBasis: z.literal("owner_confirmed_not_independently_verified"),
    status: z.enum(["ok", "empty"]), totalFilings: z.number().int().nonnegative(), includedFilings: z.number().int().min(0).max(10),
  }).strict()).min(1).max(3),
  citations: z.array(evidenceCitationSchema).min(1).max(33),
  gaps: z.array(z.string().max(1000)).max(20),
}).strict();
export type DealEvidenceSnapshot = z.infer<typeof dealEvidenceSnapshotSchema>;
export type EvidenceCitation = z.infer<typeof evidenceCitationSchema>;
export type EvidenceEngineInput = { snapshot: DealEvidenceSnapshot };

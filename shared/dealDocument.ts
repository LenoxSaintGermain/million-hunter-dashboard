import { z } from "zod";
import {
  acquisitionMandateSchema,
  type AcquisitionMandate,
  type FieldState,
  type MoneyKey,
  type Gate,
  type Ratio,
} from "./acquisitionV2";

/** Already-extracted text only. This contract is not an upload or PDF parser. */
export const dealDocumentSchema = z.object({
  id: z.string().trim().min(1).max(128),
  version: z.number().int().positive(),
  source: z.string().trim().min(1).max(2048),
  capturedAt: z.string().datetime({ offset: true }),
  extractionVersion: z.string().trim().min(1).max(128),
  format: z.literal("text_pages"),
  basis: z.enum(["source_claim", "document_assumption", "derived"]),
  pages: z.array(z.object({
    page: z.number().int().positive(),
    text: z.string().max(100_000),
  }).strict()).min(1).max(100),
}).strict().superRefine((doc, ctx) => {
  if (new Set(doc.pages.map(p => p.page)).size !== doc.pages.length)
    ctx.addIssue({ code: "custom", message: "Duplicate page numbers" });
  if (doc.pages.reduce((sum, p) => sum + p.text.length, 0) > 1_000_000)
    ctx.addIssue({ code: "custom", message: "Text budget exceeded" });
});
export type DealDocument = z.infer<typeof dealDocumentSchema>;

export const dealDocumentMoneyKeys: MoneyKey[] = ["ask", "revenue", "sde", "ebitda", "inventory", "ffe"];

export type DocumentProvenance = {
  documentId: string;
  documentVersion: number;
  source: string;
  capturedAt: string;
  extractionVersion: string;
  page: number;
  span: string;
};

export type ExtractionProposal = {
  id: string;
  field: MoneyKey;
  value: number | null;
  state: FieldState;
  basis: DealDocument["basis"];
  provenance: DocumentProvenance;
  status: "proposed";
};

/** Confirmation records the operator's mapping decision, not independent verification. */
export type OperatorConfirmedFact = {
  field: MoneyKey;
  value: number;
  proposalId: string;
  provenance: DocumentProvenance;
  operator: string;
  reason: string;
  consideredProposalIds: string[];
  status: "operator_confirmed_source_claim";
};

export type DocumentReview = {
  revision: number;
  operator: string;
  mandate: AcquisitionMandate;
};

export type DocumentIntent = "business_acquisition" | "scenario_analysis";

export const storedDocumentMetadataSchema = z.object({
  id: z.string().trim().min(1).max(128),
  version: z.number().int().positive(),
  filename: z.string().trim().min(1).max(256),
  storageKey: z.string().trim().min(1).max(512),
  mimeType: z.string().trim().min(1).max(128),
  byteSize: z.number().int().positive(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  pageCount: z.number().int().positive().max(100),
  basis: z.enum(["source_claim", "document_assumption", "derived"]),
  retentionPolicy: z.enum(["permanent", "90_day"]).default("permanent").optional(),
  purgeAfter: z.string().datetime({ offset: true }).optional(),
  storageBackend: z.enum(["local_fs", "cloud_s3"]).default("local_fs").optional(),
  ocrApplied: z.boolean().optional(),
  ocrModel: z.string().optional(),
  uploadedAt: z.string().datetime({ offset: true }),
  uploadedBy: z.string().trim().min(1).max(128),
});
export type StoredDocumentMetadata = z.infer<typeof storedDocumentMetadataSchema>;

export const documentEvaluationReceiptSchema = z.object({
  revision: z.number().int().nonnegative(),
  evaluatedAt: z.string().datetime({ offset: true }),
  evaluatedBy: z.string().trim().min(1).max(128),
  mandateVersion: z.string().trim().min(1).max(80),
  confirmedFacts: z.record(z.string(), z.any()),
  verdict: z.object({
    value: z.enum(["PURSUE", "WATCHLIST", "HOLD", "FAIL"]),
    reason: z.string(),
  }),
  gates: z.array(z.any()),
  ratios: z.record(z.string(), z.any()),
  label: z.string(),
});
export type DocumentEvaluationReceipt = z.infer<typeof documentEvaluationReceiptSchema>;

export const dealDossierSchema = z.object({
  id: z.string().uuid(),
  ownerUserId: z.number().int().positive(),
  dealId: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1).max(256),
  intent: z.enum(["business_acquisition", "scenario_analysis"]),
  currency: z.literal("USD"),
  reportingPeriod: z.string().trim().min(1).max(64),
  currentRevision: z.number().int().nonnegative(),
  documents: z.array(storedDocumentMetadataSchema).max(20),
  confirmedFacts: z.record(z.string(), z.any()),
  mandate: acquisitionMandateSchema.nullable().optional(),
  reviewReceipt: z.object({
    revision: z.number().int().nonnegative(),
    operator: z.string(),
    mandate: acquisitionMandateSchema,
  }).nullable().optional(),
  evaluationReceipt: documentEvaluationReceiptSchema.nullable().optional(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type DealDossier = z.infer<typeof dealDossierSchema>;

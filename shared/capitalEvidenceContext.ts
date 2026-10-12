import { z } from "zod";
import type { EvidenceCitation } from "./dealEvidence";

const id = z.number().int().positive().safe();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const cik = z.string().regex(/^\d{10}$/).refine(value => !/^0+$/.test(value));
const time = z.number().int().nonnegative().max(8_640_000_000_000_000);

export const capitalEvidenceScopeSchema = z.object({
  decisionRunId: id, revisionId: id, candidateId: id,
}).strict();

/** Stored in a NEW immutable decision revision, never supplied as authority by a read request. */
export const capitalEvidenceBindingSchema = z.object({
  version: z.literal(1), kind: z.literal("sec_metadata_research"),
  ownerId: id, decisionRunId: id, researchRunId: id, candidateId: id,
  canonicalThesisId: id, capitalThesisId: id, accountId: id,
  securityId: id, cik, symbol: z.string().min(1).max(24),
  dealId: id, analysisRunId: z.string().uuid(), analysisSnapshotHash: hash,
  /** Pins the exact thesis graph, not its mutable display name. */
  thesisSnapshotHash: hash,
  criterionBindings: z.array(z.object({ findingId: z.string().min(1).max(160),
    field: z.enum(["beliefs", "seek", "avoid", "evidenceRequirements", "invalidationConditions"]),
    index: z.number().int().min(0).max(1023),
  }).strict()).min(1).max(12),
  confirmedByUserId: id, confirmedAt: time,
  identityBasis: z.literal("operator_confirmed_security_cik_not_independently_verified"),
  relation: z.literal("same_legal_entity"),
}).strict();
export type CapitalEvidenceBinding = z.infer<typeof capitalEvidenceBindingSchema>;
export type CapitalEvidenceScope = z.infer<typeof capitalEvidenceScopeSchema>;

/** Normalized server-side finding adapter. Never accepted directly from a browser. */
export const capitalEvidenceFindingSchema = z.object({
  id: z.string().min(1).max(160), criterion: z.string().min(1).max(160),
  statement: z.string().min(1).max(1200),
  classification: z.enum(["hypothesis", "interpretation"]),
  rationale: z.string().max(1000).optional(), uncertainty: z.string().max(600).optional(),
  citationIds: z.array(z.string().regex(/^E[1-3](?:F(?:[1-9]|10))?$/)).min(1).max(33),
}).strict();
export type CapitalEvidenceFinding = z.infer<typeof capitalEvidenceFindingSchema>;

export type CapitalEvidenceView = {
  status: "ready" | "needs_reassessment" | "unavailable";
  reason: string | null;
  scope: CapitalEvidenceScope;
  /** Read-only research context; never forward this object to ranking or execution. */
  authority: "research_only";
  findings: Array<CapitalEvidenceFinding & {
    receiptIds: string[]; analysisRunId: string;
    citations: EvidenceCitation[];
    staleAtRun: boolean; expiredNow: boolean;
    nextAction: "review_research_basis";
  }>;
  attention: Array<{
    key: string; kind: "evidence_context_review"; title: string;
    findingIds: string[]; href: string; resolution: "not_recorded";
  }>;
  source: { analysisRunId: string; completedAt: number; limitation: string } | null;
};

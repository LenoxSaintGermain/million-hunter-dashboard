import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { dealDocumentStorage } from "./dealDocumentStorage";
import { parseDealDocument } from "./dealDocumentParser";
import { dealDocumentRepository } from "./dealDocumentRepository";
import { DealDocumentEngine } from "./dealDocumentEngine";
import {
  type DealDossier,
  type DealDocument,
  type StoredDocumentMetadata,
  type DocumentEvaluationReceipt,
  storedDocumentMetadataSchema,
  dealDocumentSchema,
} from "../shared/dealDocument";
import { type AcquisitionMandate, type MoneyKey, acquisitionMandateSchema } from "../shared/acquisitionV2";

export class DealDocumentService {
  async createDossier(userId: number, input: {
    name: string;
    intent: "business_acquisition" | "scenario_analysis";
    currency?: "USD";
    reportingPeriod: string;
    dealId?: number | null;
  }) {
    return dealDocumentRepository.createDossier({
      ownerUserId: userId,
      name: input.name,
      intent: input.intent,
      currency: "USD",
      reportingPeriod: input.reportingPeriod,
      dealId: input.dealId,
    });
  }

  async listDossiers(userId: number) {
    return dealDocumentRepository.listDossiers(userId);
  }

  async getDossier(userId: number, dossierId: string) {
    const dossier = await dealDocumentRepository.getDossier(userId, dossierId);
    const engine = await this.buildEngine(userId, dossier);
    return {
      dossier,
      snapshot: engine.snapshot,
    };
  }

  private async buildEngine(userId: number, dossier: DealDossier): Promise<DealDocumentEngine> {
    const engine = new DealDocumentEngine(dossier.intent);

    for (const docMeta of dossier.documents) {
      const docPages = await dealDocumentRepository.getDocumentPages(dossier.id, docMeta.id, docMeta.version);
      if (docPages) {
        engine.putDocument(docPages);
      }
    }

    // Replay operator confirmed facts
    if (dossier.confirmedFacts) {
      const proposals = engine.snapshot.proposals;
      for (const [field, fact] of Object.entries(dossier.confirmedFacts)) {
        if (!fact) continue;
        const matchingProposal = proposals.find(p => p.id === fact.proposalId);
        if (matchingProposal && matchingProposal.state === "value" && matchingProposal.value === fact.value) {
          try {
            engine.confirmProposal({
              proposalId: fact.proposalId,
              operator: fact.operator,
              reason: fact.reason,
              consideredProposalIds: fact.consideredProposalIds ?? [fact.proposalId],
            });
          } catch {
            // If confirmation fails replay due to contradictory document changes, skip
          }
        }
      }
    }

    if (dossier.reviewReceipt?.mandate) {
      try {
        engine.review(dossier.reviewReceipt.mandate, dossier.reviewReceipt.operator);
      } catch {
        // Stale review invalidation
      }
    }

    return engine;
  }

  async uploadDocument(userId: number, input: {
    dossierId: string;
    revision: number;
    filename: string;
    mimeType: string;
    buffer: Buffer;
    basis?: "source_claim" | "document_assumption" | "derived";
    retentionPolicy?: "permanent" | "90_day";
    allowOcr?: boolean;
    ocrModel?: string;
  }) {
    const dossier = await dealDocumentRepository.getDossier(userId, input.dossierId);
    if (dossier.currentRevision !== input.revision) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Dossier was modified concurrently; please reload",
      });
    }

    const documentId = crypto.randomUUID();
    const version = 1;

    // 1. Save binary file to secure private storage
    const storageRes = await dealDocumentStorage.saveDocument({
      ownerUserId: userId,
      dossierId: dossier.id,
      documentId,
      filename: input.filename,
      buffer: input.buffer,
      mimeType: input.mimeType,
      retentionPolicy: input.retentionPolicy,
    });

    // 2. Parse text pages using isolated parser
    const parseRes = await parseDealDocument({
      buffer: input.buffer,
      mimeType: input.mimeType,
      filename: input.filename,
      allowOcr: input.allowOcr,
      ocrModel: input.ocrModel,
    });

    const now = new Date().toISOString();
    const docMeta: StoredDocumentMetadata = storedDocumentMetadataSchema.parse({
      id: documentId,
      version,
      filename: input.filename,
      storageKey: storageRes.storageKey,
      mimeType: input.mimeType,
      byteSize: storageRes.byteSize,
      contentHash: storageRes.contentHash,
      pageCount: parseRes.pageCount,
      basis: input.basis ?? "source_claim",
      retentionPolicy: storageRes.retentionPolicy,
      purgeAfter: storageRes.purgeAfter,
      storageBackend: storageRes.storageBackend,
      ocrApplied: parseRes.ocrApplied,
      ocrModel: parseRes.ocrModel,
      uploadedAt: now,
      uploadedBy: `user_${userId}`,
    });

    const docPages: DealDocument = dealDocumentSchema.parse({
      id: documentId,
      version,
      source: `uploaded:${input.filename}`,
      capturedAt: now,
      extractionVersion: "pdf-parser-v1",
      format: "text_pages",
      basis: input.basis ?? "source_claim",
      pages: parseRes.pages,
    });

    // 3. Persist document pages
    await dealDocumentRepository.saveDocumentPages(dossier.id, docPages);

    // 4. Invalidation: new document invalidates prior confirmations, review, and evaluation
    const updatedDossier: DealDossier = {
      ...dossier,
      documents: [...dossier.documents, docMeta],
      confirmedFacts: {},
      reviewReceipt: null,
      evaluationReceipt: null,
    };

    const saved = await dealDocumentRepository.updateDossier(userId, updatedDossier, input.revision);
    const engine = await this.buildEngine(userId, saved);

    return {
      dossier: saved,
      snapshot: engine.snapshot,
    };
  }

  async confirmProposal(userId: number, input: {
    dossierId: string;
    revision: number;
    proposalId: string;
    reason: string;
    consideredProposalIds: string[];
  }) {
    const dossier = await dealDocumentRepository.getDossier(userId, input.dossierId);
    if (dossier.currentRevision !== input.revision) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Dossier was modified concurrently; please reload",
      });
    }

    const engine = await this.buildEngine(userId, dossier);
    const operator = `user_${userId}`;

    engine.confirmProposal({
      proposalId: input.proposalId,
      operator,
      reason: input.reason,
      consideredProposalIds: input.consideredProposalIds,
    });

    const updatedFacts = { ...dossier.confirmedFacts };
    const confirmedField = engine.snapshot.fields.find(f => f.confirmed?.proposalId === input.proposalId);
    if (confirmedField?.confirmed) {
      updatedFacts[confirmedField.field] = confirmedField.confirmed;
    }

    // Fact confirmation invalidates downstream review and evaluation
    const updatedDossier: DealDossier = {
      ...dossier,
      confirmedFacts: updatedFacts,
      reviewReceipt: null,
      evaluationReceipt: null,
    };

    const saved = await dealDocumentRepository.updateDossier(userId, updatedDossier, input.revision);
    return {
      dossier: saved,
      snapshot: engine.snapshot,
    };
  }

  async revokeFact(userId: number, input: {
    dossierId: string;
    revision: number;
    field: MoneyKey;
  }) {
    const dossier = await dealDocumentRepository.getDossier(userId, input.dossierId);
    if (dossier.currentRevision !== input.revision) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Dossier was modified concurrently; please reload",
      });
    }

    const updatedFacts = { ...dossier.confirmedFacts };
    delete updatedFacts[input.field];

    const updatedDossier: DealDossier = {
      ...dossier,
      confirmedFacts: updatedFacts,
      reviewReceipt: null,
      evaluationReceipt: null,
    };

    const saved = await dealDocumentRepository.updateDossier(userId, updatedDossier, input.revision);
    const engine = await this.buildEngine(userId, saved);
    return {
      dossier: saved,
      snapshot: engine.snapshot,
    };
  }

  async reviewMandate(userId: number, input: {
    dossierId: string;
    revision: number;
    mandate: AcquisitionMandate;
  }) {
    const dossier = await dealDocumentRepository.getDossier(userId, input.dossierId);
    if (dossier.currentRevision !== input.revision) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Dossier was modified concurrently; please reload",
      });
    }

    const validatedMandate = acquisitionMandateSchema.parse(input.mandate);
    const engine = await this.buildEngine(userId, dossier);
    const operator = `user_${userId}`;

    const receipt = engine.review(validatedMandate, operator);

    const updatedDossier: DealDossier = {
      ...dossier,
      mandate: validatedMandate,
      reviewReceipt: {
        revision: dossier.currentRevision + 1,
        operator,
        mandate: validatedMandate,
      },
      evaluationReceipt: null,
    };

    const saved = await dealDocumentRepository.updateDossier(userId, updatedDossier, input.revision);
    return {
      dossier: saved,
      snapshot: engine.snapshot,
    };
  }

  async evaluate(userId: number, input: {
    dossierId: string;
    revision: number;
  }) {
    const dossier = await dealDocumentRepository.getDossier(userId, input.dossierId);
    if (dossier.currentRevision !== input.revision) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Dossier was modified concurrently; please reload",
      });
    }

    const engine = await this.buildEngine(userId, dossier);
    const evalRes = engine.evaluate();

    const now = new Date().toISOString();
    const evaluationReceipt: DocumentEvaluationReceipt = {
      revision: dossier.currentRevision + 1,
      evaluatedAt: now,
      evaluatedBy: `user_${userId}`,
      mandateVersion: dossier.mandate?.version ?? "unknown",
      confirmedFacts: structuredClone(dossier.confirmedFacts),
      verdict: {
        value: evalRes.result.verdict.value as "PURSUE" | "WATCHLIST" | "HOLD" | "FAIL",
        reason: evalRes.result.verdict.reason,
      },
      gates: evalRes.result.gates,
      ratios: evalRes.result.ratios,
      label: evalRes.label,
    };

    const updatedDossier: DealDossier = {
      ...dossier,
      evaluationReceipt,
    };

    const saved = await dealDocumentRepository.updateDossier(userId, updatedDossier, input.revision);
    return {
      dossier: saved,
      snapshot: engine.snapshot,
      evaluation: evaluationReceipt,
    };
  }

  async deleteDocument(userId: number, input: {
    dossierId: string;
    revision: number;
    documentId: string;
  }) {
    const dossier = await dealDocumentRepository.getDossier(userId, input.dossierId);
    if (dossier.currentRevision !== input.revision) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Dossier was modified concurrently; please reload",
      });
    }

    const targetDoc = dossier.documents.find(d => d.id === input.documentId);
    if (!targetDoc) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Document not found in dossier",
      });
    }

    // Delete physical file
    await dealDocumentStorage.deleteDocument(userId, dossier.id, targetDoc.id, targetDoc.contentHash);

    // Invalidation: deleting a document clears confirmations, review, and evaluation
    const updatedDossier: DealDossier = {
      ...dossier,
      documents: dossier.documents.filter(d => d.id !== input.documentId),
      confirmedFacts: {},
      reviewReceipt: null,
      evaluationReceipt: null,
    };

    const saved = await dealDocumentRepository.updateDossier(userId, updatedDossier, input.revision);
    const engine = await this.buildEngine(userId, saved);
    return {
      dossier: saved,
      snapshot: engine.snapshot,
    };
  }

  async downloadDocument(userId: number, input: {
    dossierId: string;
    documentId: string;
  }) {
    const dossier = await dealDocumentRepository.getDossier(userId, input.dossierId);
    const targetDoc = dossier.documents.find(d => d.id === input.documentId);
    if (!targetDoc) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Document not found in dossier",
      });
    }

    const buffer = await dealDocumentStorage.readDocument(
      userId,
      dossier.id,
      targetDoc.id,
      targetDoc.contentHash
    );

    return {
      filename: targetDoc.filename,
      mimeType: targetDoc.mimeType,
      byteSize: targetDoc.byteSize,
      contentHash: targetDoc.contentHash,
      base64Content: buffer.toString("base64"),
    };
  }

  async deleteDossier(userId: number, dossierId: string) {
    const dossier = await dealDocumentRepository.getDossier(userId, dossierId);
    await dealDocumentStorage.deleteDossierStorage(userId, dossier.id);
    return dealDocumentRepository.deleteDossier(userId, dossier.id);
  }
}

export const dealDocumentService = new DealDocumentService();

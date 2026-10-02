import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { dealDocumentService } from "./dealDocumentService";
import { acquisitionMandateSchema } from "../shared/acquisitionV2";

export const dealDocumentRouter = router({
  createDossier: protectedProcedure
    .input(z.object({
      name: z.string().trim().min(1).max(256),
      intent: z.enum(["business_acquisition", "scenario_analysis"]),
      currency: z.literal("USD").default("USD"),
      reportingPeriod: z.string().trim().min(1).max(64),
      dealId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return dealDocumentService.createDossier(ctx.user.id, input);
    }),

  listDossiers: protectedProcedure
    .query(async ({ ctx }) => {
      return dealDocumentService.listDossiers(ctx.user.id);
    }),

  getDossier: protectedProcedure
    .input(z.object({
      dossierId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      return dealDocumentService.getDossier(ctx.user.id, input.dossierId);
    }),

  uploadDocument: protectedProcedure
    .input(z.object({
      dossierId: z.string().uuid(),
      revision: z.number().int().nonnegative(),
      filename: z.string().trim().min(1).max(256),
      mimeType: z.string().trim().min(1).max(128),
      base64Content: z.string().min(1),
      basis: z.enum(["source_claim", "document_assumption", "derived"]).optional(),
      retentionPolicy: z.enum(["permanent", "90_day"]).optional(),
      allowOcr: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64Content, "base64");
      return dealDocumentService.uploadDocument(ctx.user.id, {
        dossierId: input.dossierId,
        revision: input.revision,
        filename: input.filename,
        mimeType: input.mimeType,
        buffer,
        basis: input.basis,
        retentionPolicy: input.retentionPolicy,
        allowOcr: input.allowOcr,
      });
    }),

  confirmProposal: protectedProcedure
    .input(z.object({
      dossierId: z.string().uuid(),
      revision: z.number().int().nonnegative(),
      proposalId: z.string().min(1),
      reason: z.string().trim().min(1).max(2000),
      consideredProposalIds: z.array(z.string().min(1)),
    }))
    .mutation(async ({ ctx, input }) => {
      return dealDocumentService.confirmProposal(ctx.user.id, input);
    }),

  revokeFact: protectedProcedure
    .input(z.object({
      dossierId: z.string().uuid(),
      revision: z.number().int().nonnegative(),
      field: z.enum(["ask", "revenue", "sde", "ebitda", "inventory", "ffe"]),
    }))
    .mutation(async ({ ctx, input }) => {
      return dealDocumentService.revokeFact(ctx.user.id, input);
    }),

  reviewMandate: protectedProcedure
    .input(z.object({
      dossierId: z.string().uuid(),
      revision: z.number().int().nonnegative(),
      mandate: acquisitionMandateSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      return dealDocumentService.reviewMandate(ctx.user.id, input);
    }),

  evaluate: protectedProcedure
    .input(z.object({
      dossierId: z.string().uuid(),
      revision: z.number().int().nonnegative(),
    }))
    .mutation(async ({ ctx, input }) => {
      return dealDocumentService.evaluate(ctx.user.id, input);
    }),

  deleteDocument: protectedProcedure
    .input(z.object({
      dossierId: z.string().uuid(),
      revision: z.number().int().nonnegative(),
      documentId: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      return dealDocumentService.deleteDocument(ctx.user.id, input);
    }),

  downloadDocument: protectedProcedure
    .input(z.object({
      dossierId: z.string().uuid(),
      documentId: z.string().min(1),
    }))
    .query(async ({ ctx, input }) => {
      return dealDocumentService.downloadDocument(ctx.user.id, input);
    }),

  deleteDossier: protectedProcedure
    .input(z.object({
      dossierId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const success = await dealDocumentService.deleteDossier(ctx.user.id, input.dossierId);
      return { success };
    }),
});

import { protectedProcedure, router } from "../_core/trpc";
import { createDealEvidenceService } from "../dealEvidenceService";
import { attachDealEvidenceInput, dealEvidenceScope, getDealEvidenceRunInput, runDealEvidenceInput } from "../../shared/dealEvidence";

export function createDealEvidenceRouter(service = createDealEvidenceService()) {
  return router({
    attach: protectedProcedure.input(attachDealEvidenceInput).mutation(({ ctx, input }) => service.attach(ctx.user.id, input)),
    attachments: protectedProcedure.input(dealEvidenceScope).query(({ ctx, input }) => service.attachments(ctx.user.id, input)),
    runRedTeam: protectedProcedure.input(runDealEvidenceInput).mutation(({ ctx, input }) => service.runRedTeam(ctx.user.id, input)),
    runIC: protectedProcedure.input(runDealEvidenceInput).mutation(({ ctx, input }) => service.runIC(ctx.user.id, input)),
    runs: protectedProcedure.input(dealEvidenceScope).query(({ ctx, input }) => service.runs(ctx.user.id, input)),
    getRun: protectedProcedure.input(getDealEvidenceRunInput).query(({ ctx, input }) => service.getRun(ctx.user.id, input)),
  });
}
export const dealEvidenceRouter = createDealEvidenceRouter();

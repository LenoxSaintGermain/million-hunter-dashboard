import { protectedProcedure, router } from "../_core/trpc";
import { createEvidenceService, secCaptureInput, secSubjectInput, receiptIdInput } from "../evidenceService";

export function createPublicEvidenceRouter(service = createEvidenceService()) {
  return router({
    list: protectedProcedure.input(secSubjectInput).query(({ ctx, input }) => service.list(ctx.user.id, input)),
    get: protectedProcedure.input(receiptIdInput).query(({ ctx, input }) => service.get(ctx.user.id, input)),
    capture: protectedProcedure.input(secCaptureInput).mutation(({ ctx, input }) => service.capture(ctx.user.id, input)),
  });
}
export const publicEvidenceRouter = createPublicEvidenceRouter();

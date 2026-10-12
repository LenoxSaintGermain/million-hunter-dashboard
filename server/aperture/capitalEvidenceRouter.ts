import { protectedProcedure, capitalOperatorProcedure, router } from "../_core/trpc";
import { capitalEvidenceScopeSchema, type CapitalEvidenceView, type CapitalEvidenceScope } from "../../shared/capitalEvidenceContext";
import { createCapitalEvidenceReader, createCapitalEvidenceBindingService, capitalEvidenceChoicesInput, capitalEvidenceConfirmationInput } from "./capitalEvidenceRepository";

/** Read projections and explicit confirmation share the existing immutable revision writer. */
export function createCapitalEvidenceRouter(read: (ownerId: number, scope: CapitalEvidenceScope) => Promise<CapitalEvidenceView>, binding = createCapitalEvidenceBindingService()) {
  return router({ context: protectedProcedure.input(capitalEvidenceScopeSchema)
    .query(({ ctx, input }) => read(ctx.user.id, input)),
    options: capitalOperatorProcedure.input(capitalEvidenceScopeSchema).query(({ ctx, input }) => binding.options(ctx.user.id, input)),
    securityChoices: capitalOperatorProcedure.input(capitalEvidenceScopeSchema).query(({ ctx, input }) => binding.securityChoices(ctx.user.id, input)),
    choices: capitalOperatorProcedure.input(capitalEvidenceChoicesInput).query(({ ctx, input }) => binding.choices(ctx.user.id, input)),
    confirmBinding: capitalOperatorProcedure.input(capitalEvidenceConfirmationInput).mutation(({ ctx, input }) => binding.confirmBinding(ctx.user.id, input)),
  });
}

export const capitalEvidenceRouter = createCapitalEvidenceRouter(createCapitalEvidenceReader());

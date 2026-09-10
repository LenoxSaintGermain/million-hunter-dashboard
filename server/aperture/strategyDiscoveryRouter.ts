import { TRPCError } from "@trpc/server";
import { capitalOperatorProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { acceptObjectiveMission, acceptObjectiveMissionInput } from "./objectiveMission";
import { discoveryIdentityInput, discoveryRunInput, discoveryResumeInput, executeObjectiveDiscovery, objectiveDiscoveryEnabled, readObjectiveDiscovery, resumeObjectiveDiscovery, validateObjectiveDiscoveryDraft } from "./strategyDiscoveryWorkflow";

async function database() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Mission storage is unavailable. No new analysis was started." });
  return db;
}

async function sanitized<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Mission analysis storage is unavailable. Reconcile the saved Mission and job before retrying; no eligibility is asserted." });
  }
}

export const strategyDiscoveryRouter = router({
  capabilities: capitalOperatorProcedure.query(() => ({ enabled: objectiveDiscoveryEnabled(), mode: "paper" as const, monitoring: "on_demand" as const })),
  // One authorized action carries accepted assumptions through to a usable
  // receipt. A disconnect can be reconciled with the same draft/request identity.
  start: capitalOperatorProcedure.input(acceptObjectiveMissionInput).mutation(({ ctx, input }) => sanitized(async () => {
    if (!objectiveDiscoveryEnabled()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Objective discovery is not enabled in this release. Your draft is unchanged." });
    if (process.env.ISOLATED_UAT_MODE === "true") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The isolated UAT discovery fixture is not configured. No Mission or provider work was started." });
    const db = await database();
    const accepted = await acceptObjectiveMission(db, ctx.user.id, input, Date.now(), (tx, values) => validateObjectiveDiscoveryDraft(tx, ctx.user.id, values));
    return executeObjectiveDiscovery(db, ctx.user.id, { decisionRunId: accepted.decisionRunId, decisionRevisionId: accepted.revisionId });
  })),
  run: capitalOperatorProcedure.input(discoveryRunInput).mutation(({ ctx, input }) => sanitized(async () => executeObjectiveDiscovery(await database(), ctx.user.id, input))),
  get: capitalOperatorProcedure.input(discoveryIdentityInput).query(({ ctx, input }) => sanitized(async () => readObjectiveDiscovery(await database(), ctx.user.id, input))),
  resume: capitalOperatorProcedure.input(discoveryResumeInput).query(({ ctx, input }) => sanitized(async () => resumeObjectiveDiscovery(await database(), ctx.user.id, input))),
});

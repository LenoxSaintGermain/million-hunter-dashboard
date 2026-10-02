import { TRPCError } from "@trpc/server";

/**
 * Containment for the pre-tenant catalog. These routers include direct SQL,
 * provider prompts, and related records without owner predicates. An owner
 * column/backfill alone does not make those operations tenant-safe.
 * Remove a boundary only after ALL reads/writes in that router are scoped.
 * Public fixture demos and Capital's independently scoped router stay separate.
 */
export const LEGACY_CATALOG_ROUTERS = new Set([
  "dashboard", "deals", "signals", "memos", "outreach", "activity",
  "scan", "agents", "agent", "copilot", "investorDossier", "investor",
  "scout", "sourcingSchedule", "dealShare", "research", "loi", "admin",
  "insurance", "assetShare", "stack", "freedomMap", "strategyBlender",
]);

// Exact operations only: newly added routes remain closed until audited.
export const PRIVATE_WORKSPACE_PATHS = new Set([
  "dashboard.stats", "deals.list", "deals.getById", "deals.create",
  "deals.updateStage", "deals.score", "deals.delete",
  "signals.getByDealId", "signals.analyze", "memos.list", "memos.getByDealId", "memos.generate",
  "outreach.list", "outreach.getByDealId", "outreach.create", "outreach.updateStatus", "activity.list",
  "scan.getLatest", "scan.getStatus", "scan.trigger", "scan.getThesisComparison",
  "scan.getV2State", "scan.getV2Report", "scan.saveV2Scenario",
]);

export function assertLegacyCatalogAccess(path: string, user: { role: string } | null) {
  if (!LEGACY_CATALOG_ROUTERS.has(path.split(".")[0]) && !["thesisVariant.preview", "thesisVariant.match"].includes(path)) return;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to access this workspace." });
  if (PRIVATE_WORKSPACE_PATHS.has(path)) return;
  if (user.role !== "admin") throw new TRPCError({
    code: "FORBIDDEN",
    message: "The legacy acquisition catalog is restricted to administrators while private workspaces are being enabled. Your Capital workspace is unchanged.",
  });
}

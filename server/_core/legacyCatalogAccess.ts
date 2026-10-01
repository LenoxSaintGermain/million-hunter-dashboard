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

export function assertLegacyCatalogAccess(path: string, user: { role: string } | null) {
  if (!LEGACY_CATALOG_ROUTERS.has(path.split(".")[0]) && !["thesisVariant.preview", "thesisVariant.match"].includes(path)) return;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to access this workspace." });
  if (user.role !== "admin") throw new TRPCError({
    code: "FORBIDDEN",
    message: "The legacy acquisition catalog is restricted to administrators while private workspaces are being enabled. Your Capital workspace is unchanged.",
  });
}

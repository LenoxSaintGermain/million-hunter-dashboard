/**
 * Role Module Permissions Router
 *
 * Allows the admin to control which modules each role can access.
 * Changes take effect immediately — the frontend reads permissions on every
 * nav render via getMyPermissions.
 *
 * Module keys must match the keys used in EditorialTopNav and PermissionGuard.
 */
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";
import { roleModulePermissions } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";

// ─── All available modules ────────────────────────────────────────────────────
export const ALL_MODULES = [
  { key: "command_center",       label: "Command Center",       href: "/" },
  { key: "market_scan",          label: "Market Scan",          href: "/scan" },
  { key: "tide",                 label: "TIDE Intelligence",    href: "/tide" },
  { key: "memos",                label: "Investment Memos",     href: "/memos" },
  { key: "outreach",             label: "Outreach",             href: "/outreach" },
  { key: "freedom_map",          label: "Freedom Map",          href: "/freedom-map" },
  { key: "strategy_blender",     label: "Strategy Blender",     href: "/strategy-blender" },
  { key: "opportunity_radar",    label: "Opportunity Radar",    href: "/opportunity-radar" },
  { key: "asset_scout",          label: "Asset Scout",          href: "/scout" },
  { key: "thesis_engine",        label: "Thesis Engine",        href: "/thesis" },
  { key: "capital_stack",        label: "Capital Stack",        href: "/stack" },
  { key: "investor_dossier",     label: "Investor Dossier",     href: "/investor-dossier" },
  { key: "insurance_prospector", label: "Insurance Prospector", href: "/insurance-prospector" },
  { key: "ripple_effect",        label: "RippleEffect Scanner", href: "/ripple" },
  { key: "settings",             label: "Settings",             href: "/settings" },
];

type PermRole = "admin" | "investor" | "insurance" | "user";

// ─── Default permissions per role ─────────────────────────────────────────────
const ROLE_DEFAULTS: Record<PermRole, string[]> = {
  admin: ALL_MODULES.map((m) => m.key),
  investor: [
    "command_center",
    "market_scan",
    "tide",
    "memos",
    "outreach",
    "asset_scout",
    "opportunity_radar",
    "ripple_effect",
  ],
  insurance: [
    "command_center",
    "insurance_prospector",
    "memos",
    "outreach",
  ],
  user: [
    "command_center",
  ],
};

const PERM_ROLES: PermRole[] = ["admin", "investor", "insurance", "user"];

// ─── Seed helper — idempotent ──────────────────────────────────────────────────
export async function seedRolePermissions() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(roleModulePermissions).limit(1);
  if (existing.length > 0) return; // already seeded

  const rows: Array<{ role: PermRole; moduleKey: string; enabled: boolean }> = [];
  for (const role of PERM_ROLES) {
    const enabledKeys = ROLE_DEFAULTS[role];
    for (const mod of ALL_MODULES) {
      rows.push({ role, moduleKey: mod.key, enabled: enabledKeys.includes(mod.key) });
    }
  }
  await db.insert(roleModulePermissions).values(rows);
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const rolePermissionsRouter = router({
  /**
   * Get all role x module permission rows (admin only).
   * Returns a flat list; UI groups by role.
   */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await seedRolePermissions();
    const rows = await db.select().from(roleModulePermissions);
    return { modules: ALL_MODULES, permissions: rows };
  }),

  /**
   * Toggle a single role x module permission (admin only).
   */
  setPermission: protectedProcedure
    .input(
      z.object({
        role: z.enum(["admin", "investor", "insurance", "user"]),
        moduleKey: z.string(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const existing = await db
        .select()
        .from(roleModulePermissions)
        .where(
          and(
            eq(roleModulePermissions.role, input.role),
            eq(roleModulePermissions.moduleKey, input.moduleKey)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(roleModulePermissions)
          .set({ enabled: input.enabled })
          .where(
            and(
              eq(roleModulePermissions.role, input.role),
              eq(roleModulePermissions.moduleKey, input.moduleKey)
            )
          );
      } else {
        await db.insert(roleModulePermissions).values({
          role: input.role,
          moduleKey: input.moduleKey,
          enabled: input.enabled,
        });
      }
      return { success: true };
    }),

  /**
   * Get the list of module keys the current user is allowed to access.
   * Admins always get all modules regardless of DB state.
   */
  getMyPermissions: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin") {
      return { allowedModules: ALL_MODULES.map((m) => m.key) };
    }

    const db = await getDb();
    if (!db) return { allowedModules: ["command_center"] };
    await seedRolePermissions();

    const userRole = ctx.user.role as PermRole;
    const rows = await db
      .select()
      .from(roleModulePermissions)
      .where(
        and(
          eq(roleModulePermissions.role, userRole),
          eq(roleModulePermissions.enabled, true)
        )
      );

    return { allowedModules: rows.map((r) => r.moduleKey) };
  }),

  /**
   * Reset a role's permissions back to defaults (admin only).
   */
  resetToDefaults: protectedProcedure
    .input(z.object({ role: z.enum(["admin", "investor", "insurance", "user"]) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const enabledKeys = ROLE_DEFAULTS[input.role] ?? [];

      for (const mod of ALL_MODULES) {
        const enabled = enabledKeys.includes(mod.key);
        const existing = await db
          .select()
          .from(roleModulePermissions)
          .where(
            and(
              eq(roleModulePermissions.role, input.role),
              eq(roleModulePermissions.moduleKey, mod.key)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(roleModulePermissions)
            .set({ enabled })
            .where(
              and(
                eq(roleModulePermissions.role, input.role),
                eq(roleModulePermissions.moduleKey, mod.key)
              )
            );
        } else {
          await db.insert(roleModulePermissions).values({
            role: input.role,
            moduleKey: mod.key,
            enabled,
          });
        }
      }
      return { success: true };
    }),
});

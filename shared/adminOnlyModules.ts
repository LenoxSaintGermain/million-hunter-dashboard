/**
 * Modules that may NEVER be granted to a non-admin role, whatever the admin
 * panel says.
 *
 * Capital Aperture produces personalised securities analysis for a single
 * self-directed operator. Exposing it to a client role would turn an internal
 * research instrument into something that functions as investment advice, which
 * is regulated territory (FINRA Reg BI). A toggle in a settings screen is not an
 * adequate control for that, so the server refuses the grant outright and the
 * UI renders it locked rather than offering a switch that will fail.
 */
export const ADMIN_ONLY_MODULES: readonly string[] = ["capital_aperture"];

export function isAdminOnlyModule(moduleKey: string): boolean {
  return ADMIN_ONLY_MODULES.includes(moduleKey);
}

/** Can this module be enabled for this role at all? */
export function isModuleGrantable(moduleKey: string, role: string): boolean {
  return role === "admin" || !isAdminOnlyModule(moduleKey);
}

/**
 * Modules that remain restricted regardless of ordinary role toggles.
 *
 * Capital Aperture produces personalised securities analysis for a single
 * self-directed operator. Exposing it to a client role would turn an internal
 * research instrument into something that functions as investment advice. The
 * dedicated Capital Operator role is the sole non-admin exception and remains
 * subject to the paper-only, human-approval contract.
 */
export const ADMIN_ONLY_MODULES: readonly string[] = ["capital_aperture"];

export function isAdminOnlyModule(moduleKey: string): boolean {
  return ADMIN_ONLY_MODULES.includes(moduleKey);
}

/** Can this module be enabled for this role at all? */
export function isModuleGrantable(moduleKey: string, role: string): boolean {
  if (moduleKey === "capital_aperture") {
    return role === "admin" || role === "capital_operator";
  }
  return true;
}

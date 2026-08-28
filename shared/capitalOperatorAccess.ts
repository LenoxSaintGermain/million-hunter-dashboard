export const CAPITAL_OPERATOR_ROLE = "capital_operator" as const;

/** Admins retain support access; Capital Operators get the bounded paper workspace. */
export function canOperateCapital(role: string | null | undefined): boolean {
  return role === "admin" || role === CAPITAL_OPERATOR_ROLE;
}

export type MissionLibraryBindings = {
  canonicalThesisId: number | null | undefined;
  capitalThesisId: number | null | undefined;
  accountId: number | null | undefined;
};

export type MissionLibraryBindingState = {
  ready: boolean;
  missing: Array<"assigned thesis" | "Capital thesis projection" | "paper account">;
};

/**
 * A contextual Mission Library has no safe static fallback. It may query only
 * after the owner-scoped thesis, projection, and paper-account bindings exist.
 */
export function missionLibraryBindingState(bindings: MissionLibraryBindings): MissionLibraryBindingState {
  const missing: MissionLibraryBindingState["missing"] = [];
  if (bindings.canonicalThesisId == null) missing.push("assigned thesis");
  if (bindings.capitalThesisId == null) missing.push("Capital thesis projection");
  if (bindings.accountId == null) missing.push("paper account");
  return { ready: missing.length === 0, missing };
}

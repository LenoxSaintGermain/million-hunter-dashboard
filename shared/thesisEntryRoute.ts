export type ThesisEntryWorkspace = "capital" | "legacy";

/**
 * Capital is the canonical thesis entry. Acquisition and property keep their
 * existing compiler behind explicit scopes so those workflows remain
 * reachable without competing with the Capital Aperture demo entrance.
 */
export function resolveThesisEntryWorkspace(
  requestedScope: string | null,
  requestedUatCase: string | null,
): ThesisEntryWorkspace {
  if (requestedUatCase === "qualified-play") return "capital";
  if (requestedScope === "acquisition" || requestedScope === "property") return "legacy";
  return "capital";
}

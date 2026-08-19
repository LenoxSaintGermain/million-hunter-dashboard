export type AppRole = "user" | "admin" | "investor" | "insurance" | string | undefined;
export type DefaultWorkspace = "command_center" | "capital_aperture" | "capital_aperture_trader" | null | undefined;

/** Root-route redirect only. Deep links must always remain intact. */
export function getDefaultWorkspacePath(role: AppRole, workspace: DefaultWorkspace) {
  if (role === "investor" || role === "insurance") return "/wingate";
  if (role === "admin" && (workspace === "capital_aperture" || workspace === "capital_aperture_trader")) return "/aperture";
  return null;
}

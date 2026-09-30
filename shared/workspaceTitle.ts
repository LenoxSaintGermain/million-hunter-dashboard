/** Route identity only: never expose account names, amounts or findings in tabs. */
export function workspaceTitle(location: string): string {
  const path = location.split(/[?#]/, 1)[0].replace(/\/$/, "");
  const base = "Capital Aperture";
  if (path === "/walkthrough") return "Work through a case · Signal Hunter";
  if (path === "/jims-file") return "Jim’s file · Signal Hunter";
  if (path === "/pricing") return "Launch pricing · Signal Hunter";
  if (path === "/scout") return "Discover opportunities · Signal Hunter";
  if (path === "/admin") return "Operator desk · Signal Hunter";
  if (path === "/aperture") return `Today · ${base}`;
  if (path === "/aperture/mission") return `Mission · ${base}`;
  if (path === "/aperture/plays") return `Play Desk · ${base}`;
  if (/^\/aperture\/decision\/\d+\/revision\/\d+\/underwrite$/.test(path)) return `Mission result · ${base}`;
  if (path.startsWith("/aperture/decision/")) return `Mission · ${base}`;
  if (/^\/aperture\/run\/\d+\/execute$/.test(path)) return `Play details · ${base}`;
  if (path === "/aperture/runs" || path.startsWith("/aperture/run/")) return `Research · ${base}`;
  if (path === "/aperture/record") return `Record · ${base}`;
  if (path.startsWith("/aperture/accounts")) return `Portfolio · ${base}`;
  if (path.startsWith("/aperture/thes")) return `Theses · ${base}`;
  if (path.startsWith("/aperture/")) return base;
  return "Signal Hunter OS — Acquisition Command Center";
}

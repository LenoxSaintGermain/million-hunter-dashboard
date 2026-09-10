/** Route identity only: never expose account names, amounts or findings in tabs. */
export function workspaceTitle(location: string): string {
  const path = location.split(/[?#]/, 1)[0].replace(/\/$/, "");
  const base = "Capital Aperture";
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

/**
 * Capital workspace route aliases (Refs #114). The Portfolio tab is labelled
 * "Portfolio", so /aperture/portfolio must open the same page as
 * /aperture/accounts instead of a 404. New thesis stays inside the Capital
 * shell at /aperture/theses/new.
 */
export const APERTURE_PORTFOLIO_PATH = "/aperture/accounts";
export const APERTURE_PORTFOLIO_ALIAS = "/aperture/portfolio";
export const APERTURE_NEW_THESIS_PATH = "/aperture/theses/new";

/** Which nav href is active for a location. Exact match for "/aperture" and the new-thesis page. */
export function isApertureNavActive(href: string, location: string): boolean {
  const path = location.split("?")[0];
  if (href === "/aperture") return path === "/aperture";
  if (href === APERTURE_PORTFOLIO_PATH) return path.startsWith(APERTURE_PORTFOLIO_PATH) || path.startsWith(APERTURE_PORTFOLIO_ALIAS);
  if (href === APERTURE_NEW_THESIS_PATH) return path === APERTURE_NEW_THESIS_PATH;
  if (href === "/aperture/theses") return path.startsWith("/aperture/theses") && path !== APERTURE_NEW_THESIS_PATH;
  return path.startsWith(href.split("?")[0]);
}

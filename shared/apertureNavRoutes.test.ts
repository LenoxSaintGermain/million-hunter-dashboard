import { describe, expect, it } from "vitest";
import { APERTURE_NEW_THESIS_PATH, isApertureNavActive } from "./apertureNavRoutes";

describe("isApertureNavActive", () => {
  it("marks Portfolio active on both /aperture/accounts and the /aperture/portfolio alias", () => {
    expect(isApertureNavActive("/aperture/accounts", "/aperture/accounts")).toBe(true);
    expect(isApertureNavActive("/aperture/accounts", "/aperture/portfolio")).toBe(true);
  });
  it("keeps New thesis and Theses distinct", () => {
    expect(isApertureNavActive(APERTURE_NEW_THESIS_PATH, APERTURE_NEW_THESIS_PATH)).toBe(true);
    expect(isApertureNavActive("/aperture/theses", APERTURE_NEW_THESIS_PATH)).toBe(false);
    expect(isApertureNavActive("/aperture/theses", "/aperture/theses")).toBe(true);
  });
  it("matches Today exactly", () => {
    expect(isApertureNavActive("/aperture", "/aperture/plays")).toBe(false);
    expect(isApertureNavActive("/aperture", "/aperture")).toBe(true);
  });
});

import { readFileSync } from "node:fs";
describe("retired /aperture/thesis/new editor (#114)", () => {
  it("redirects to the Capital-shell editor and is no longer linked from the sidebar", () => {
    const app = readFileSync("client/src/App.tsx", "utf8");
    expect(app).toContain('<Route path="/aperture/thesis/new">{() => <Redirect to={APERTURE_NEW_THESIS_PATH} replace />}</Route>');
    expect(app.indexOf('path="/aperture/thesis/new"')).toBeLessThan(app.indexOf('path="/aperture/thesis/:id"'));
    expect(readFileSync("client/src/components/DashboardLayout.tsx", "utf8")).not.toContain('"/aperture/thesis/new"');
  });
});

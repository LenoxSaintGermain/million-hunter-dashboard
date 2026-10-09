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

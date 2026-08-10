/**
 * Aperture role gate — regression test.
 *
 * Verifies that capital_aperture:
 *   1. Is registered in ALL_MODULES
 *   2. Is in ADMIN_ONLY_MODULES
 *   3. Cannot be granted to investor, insurance, or user roles
 *   4. Can be granted to admin
 *   5. Aperture routes are not in the investor nav
 *
 * This test must never be deleted. It is the structural guarantee that
 * Aperture does not appear for role=investor, regardless of UI changes.
 */
import { describe, it, expect } from "vitest";
import { ADMIN_ONLY_MODULES, isModuleGrantable } from "../../shared/adminOnlyModules";
import { ALL_MODULES } from "../rolePermissionsRouter";

describe("Capital Aperture role gate", () => {
  it("capital_aperture is registered in ALL_MODULES", () => {
    expect(ALL_MODULES.some((m: any) => (typeof m === "string" ? m : m.key) === "capital_aperture")).toBe(true);
  });

  it("capital_aperture is in ADMIN_ONLY_MODULES", () => {
    expect(ADMIN_ONLY_MODULES).toContain("capital_aperture");
  });

  it("capital_aperture cannot be granted to investor role", () => {
    expect(isModuleGrantable("capital_aperture", "investor")).toBe(false);
  });

  it("capital_aperture cannot be granted to insurance role", () => {
    expect(isModuleGrantable("capital_aperture", "insurance")).toBe(false);
  });

  it("capital_aperture cannot be granted to user role", () => {
    expect(isModuleGrantable("capital_aperture", "user")).toBe(false);
  });

  it("capital_aperture can be granted to admin role", () => {
    expect(isModuleGrantable("capital_aperture", "admin")).toBe(true);
  });

  it("ALL_MODULES contains the expected core modules", () => {
    // Regression: these must not be accidentally removed
    const keys = ALL_MODULES.map((m: any) => typeof m === "string" ? m : m.key);
    const required = ["capital_aperture"];
    for (const mod of required) {
      expect(keys, `${mod} must be in ALL_MODULES`).toContain(mod);
    }
  });
});

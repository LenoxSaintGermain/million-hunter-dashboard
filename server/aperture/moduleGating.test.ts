import { describe, it, expect } from "vitest";
import { ADMIN_ONLY_MODULES, isAdminOnlyModule, isModuleGrantable } from "../../shared/adminOnlyModules";
import { ALL_MODULES } from "../rolePermissionsRouter";

/**
 * Capital Aperture is an internal instrument for one self-directed operator.
 * If it ever became reachable by a client role it would function as personalised
 * investment advice. These tests are the regression guard on that.
 */
describe("Capital Aperture module gating", () => {
  it("is registered as a module", () => {
    const mod = ALL_MODULES.find((m) => m.key === "capital_aperture");
    expect(mod).toBeDefined();
    expect(mod!.href).toBe("/aperture");
  });

  it("is on the admin-only list", () => {
    expect(ADMIN_ONLY_MODULES).toContain("capital_aperture");
    expect(isAdminOnlyModule("capital_aperture")).toBe(true);
  });

  it("cannot be granted to any client role", () => {
    for (const role of ["investor", "insurance", "user"]) {
      expect(isModuleGrantable("capital_aperture", role)).toBe(false);
    }
  });

  it("can be granted to admin", () => {
    expect(isModuleGrantable("capital_aperture", "admin")).toBe(true);
  });

  it("does not restrict ordinary modules", () => {
    expect(isModuleGrantable("market_scan", "investor")).toBe(true);
    expect(isAdminOnlyModule("market_scan")).toBe(false);
  });
});

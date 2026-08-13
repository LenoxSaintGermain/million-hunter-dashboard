import { describe, expect, it } from "vitest";
import { getDefaultWorkspacePath } from "@shared/defaultWorkspace";

describe("default workspace routing", () => {
  it("routes an Aperture stakeholder to Capital Aperture at the root", () => {
    expect(getDefaultWorkspacePath("admin", "capital_aperture")).toBe("/aperture");
  });

  it("retains Command Center as the default for ordinary users", () => {
    expect(getDefaultWorkspacePath("admin", "command_center")).toBeNull();
    expect(getDefaultWorkspacePath("user", "capital_aperture")).toBeNull();
  });

  it("preserves the established investor and insurance destination", () => {
    expect(getDefaultWorkspacePath("investor", "capital_aperture")).toBe("/wingate");
    expect(getDefaultWorkspacePath("insurance", "command_center")).toBe("/wingate");
  });
});

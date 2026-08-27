import { describe, expect, it } from "vitest";
import { aperturePathForFixture, readIsolatedUatCase } from "./isolatedUatIdentity";

describe("isolated UAT fixture route preservation", () => {
  it("adds the selected fixture to every Aperture route while preserving existing query input", () => {
    expect(aperturePathForFixture("/aperture", "jim")).toBe("/aperture?uat_identity=jim");
    expect(aperturePathForFixture("/aperture/runs", "jim")).toBe("/aperture/runs?uat_identity=jim");
    expect(aperturePathForFixture("/aperture?setup=1", "jim")).toBe("/aperture?setup=1&uat_identity=jim");
  });

  it("preserves the fixture through the thesis workspace but not unrelated routes", () => {
    expect(aperturePathForFixture("/thesis", "jim")).toBe("/thesis?uat_identity=jim");
    expect(aperturePathForFixture("/wingate", "jim")).toBe("/wingate");
    expect(aperturePathForFixture("/aperture", null)).toBe("/aperture");
  });
});

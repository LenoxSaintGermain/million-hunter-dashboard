import { describe, expect, it } from "vitest";
import { buildExposureThemes, exposureSegments, friendlyExposureTheme } from "../../shared/exposureThemes";

describe("exposure theme presentation", () => {
  const raw = "GLP-1 Catalyst Events.children.Healthcare Impacts.children.Obesity & Weight Loss Drugs.children.GLP-1 manufacturers";

  it("converts serialized children paths into readable segments", () => {
    expect(exposureSegments(raw)).toEqual([
      "GLP 1 Catalyst Events",
      "Healthcare Impacts",
      "Obesity & Weight Loss Drugs",
      "GLP 1 Manufacturers",
    ]);
  });

  it("leads with the research theme and retains compact context", () => {
    expect(friendlyExposureTheme(raw)).toEqual({
      theme: "GLP 1 Manufacturers",
      context: "Healthcare Impacts · Obesity & Weight Loss Drugs",
    });
  });

  it("keeps coverage and symbols attached to a human-readable theme", () => {
    const themes = buildExposureThemes(
      [{ label: raw, path: "a", depth: 3 }],
      [{ nodePath: "a", symbol: "LLY", source: "candidate" }],
    );
    expect(themes[0]).toMatchObject({ theme: "GLP 1 Manufacturers", covered: true, symbols: ["LLY"] });
  });

  it("keeps a legacy flat list whose theme records all have root depth", () => {
    const themes = buildExposureThemes([{ label: raw, path: "a", depth: 0 }], []);
    expect(themes).toHaveLength(1);
    expect(themes[0].theme).toBe("GLP 1 Manufacturers");
  });
});

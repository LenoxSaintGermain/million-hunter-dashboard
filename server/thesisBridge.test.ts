import { describe, expect, it } from "vitest";
import { projectionValues } from "./thesisBridge";

const graph = {
  beliefs: ["AI infrastructure remains capital intensive"],
  seek: ["liquid infrastructure expressions"],
  avoid: [],
  horizons: ["short"],
  sectors: ["power"],
  exclusions: [],
  portfolioRules: {},
  behavior: {},
  exposureTree: [],
  confidenceNotes: ["Time horizon was interpreted as short."],
  suggestedName: "AI Infrastructure Cycle",
};

describe("canonical thesis projection", () => {
  it("keeps the canonical raw intent and source identity when creating an Aperture view", () => {
    const values = projectionValues({ id: 42, name: "Compute Buildout", thesisText: "Own infrastructure behind AI demand." }, graph, false, 1000);
    expect(values.sourceCompilationId).toBe(42);
    expect(values.rawText).toBe("Own infrastructure behind AI demand.");
    expect(values.name).toBe("Compute Buildout");
    expect(values.status).toBe("review");
  });

  it("keeps an active Aperture projection active when recompiling from its canonical source", () => {
    const values = projectionValues({ id: 42, name: null, thesisText: "Own infrastructure behind AI demand." }, graph, true, 1000);
    expect(values.name).toBe("AI Infrastructure Cycle");
    expect(values.status).toBe("active");
    expect(values.confidenceNotes).toEqual(graph.confidenceNotes);
  });
});

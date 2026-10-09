import { describe, expect, it } from "vitest";
import { showTestThesesLabel, thesisLibraryCounts, thesisOptions } from "./activeThesis";

describe("thesisLibraryCounts (#112)", () => {
  const projections = [
    { id: 1, name: "Power grid buildout", sourceCompilationId: 11 },
    { id: 2, name: "UAT — TLT payroll", sourceCompilationId: 12 },
    { id: 3, name: "[TEST] Momentum", sourceCompilationId: 13 },
  ];
  const canonicalOnly = [{ name: "QA: draft" }, { name: "Rates fall faster" }];

  it("selector and library agree on the selectable test count, and the library names the extra", () => {
    const counts = thesisLibraryCounts({ projections, canonicalOnly });
    expect(counts).toMatchObject({ capital: 3, canonicalOnly: 2, total: 5, selectableTestHidden: 2, testHidden: 3 });
    expect(counts.selectableTestHidden).toBe(thesisOptions(projections, { showTest: false }).hiddenCount);
    expect(showTestThesesLabel(counts, "selector")).toBe("Show 2 test theses");
    expect(showTestThesesLabel(counts, "library")).toBe("Show 3 test theses (1 not yet in Capital)");
  });
  it("never hides the active thesis from the count", () => {
    expect(thesisLibraryCounts({ projections, canonicalOnly: [], keepId: 2 }).selectableTestHidden).toBe(1);
  });
});

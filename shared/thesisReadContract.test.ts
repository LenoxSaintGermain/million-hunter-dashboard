import { describe, expect, it } from "vitest";
import { normalizeCapitalThesisRead, normalizeCanonicalThesisRead, normalizeThesisStringList } from "./thesisReadContract";

describe("canonical thesis read contract", () => {
  it("withholds the old diesel prose-symbol list on canonical and projection reads without mutation", () => {
    const description = "Liquid U.S.-listed refiners and diesel-sensitive transport businesses; verify company-to-ticker mapping before inclusion.";
    const researchSymbols = ["LIQUID", "REFINERS", "AND", "TRANSPORT", "BUSINESSES", "VERIFY", "MAPPING", "BEFORE", "INCLUSION."];
    const rawText = `Illustrative refiner thesis.\nSymbols or research universe: ${description}`;
    const canonical = { thesisText: rawText, compiledFilters: { researchSymbols }, scoringWeights: [], evidenceRequirements: [], autoDisqualifiers: [], confidenceNotes: [] };
    const projection = { rawText, graph: { researchSymbols, beliefs: ["Illustrative"] }, confidenceNotes: [] };
    const original = JSON.stringify({ canonical, projection });
    expect(normalizeCanonicalThesisRead(canonical).compiledFilters).toMatchObject({ researchSymbols: [], researchUniverse: description });
    expect(normalizeCapitalThesisRead(projection).graph).toMatchObject({ researchSymbols: [], researchUniverse: description });
    expect(JSON.stringify({ canonical, projection })).toBe(original);
  });
  it("keeps unrecoverable scope explicitly unresolved across repeated projection reads", () => {
    const row = { graph: { researchSymbols: ["LIQUID", "REFINERS", "AND", "INCLUSION."], exposureTree: [{ label: "Provider-suggested sector" }] }, rawText: "A saved belief without the original universe field." };
    const repaired = normalizeCapitalThesisRead(row);
    expect(repaired.graph).toMatchObject({ researchSymbols: [], researchUniverse: "", researchUniverseNeedsReview: true });
    expect(normalizeCapitalThesisRead(repaired).graph).toEqual(repaired.graph);
  });
  it.each([
    ["proper array", ["verified note"], ["verified note"], "canonical"],
    ["JSON array string", '["verified note"]', ["verified note"], "normalized"],
    ["plain string", "verified note", ["verified note"], "normalized"],
    ["structured notes", { notes: ["verified note"] }, ["verified note"], "normalized"],
    ["null", null, [], "absent"],
    ["malformed JSON-like string", "[not valid", ["[not valid"], "normalized"],
    ["opaque structured value", { confidence: 0.8 }, [], "unknown"],
  ])("normalizes %s without inventing a note", (_name, input, expected, status) => {
    const result = normalizeThesisStringList(input);
    expect(result.value).toEqual(expected);
    expect(result.diagnostic.status).toBe(status);
  });

  it("returns typed notes and an auditable unknown diagnostic for an unrecoverable Capital row", () => {
    const thesis = normalizeCapitalThesisRead({ id: 1, confidenceNotes: { confidence: 0.8 }, graph: "{broken" });
    expect(thesis.confidenceNotes).toEqual([]);
    expect(thesis.graph).toBeNull();
    expect(thesis.readDiagnostics.confidenceNotes.code).toBe("THESIS_LEGACY_VALUE_WITHHELD");
    expect(thesis.readDiagnostics.graph.code).toBe("THESIS_LEGACY_VALUE_WITHHELD");
  });
});

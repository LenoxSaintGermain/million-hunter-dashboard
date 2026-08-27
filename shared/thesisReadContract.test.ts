import { describe, expect, it } from "vitest";
import { normalizeCapitalThesisRead, normalizeThesisStringList } from "./thesisReadContract";

describe("canonical thesis read contract", () => {
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

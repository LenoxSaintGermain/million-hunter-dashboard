import { describe, expect, it } from "vitest";
import { describeEvidenceQuestion, EMPTY_EVIDENCE_QUESTION, evidenceQuestionReadiness, evidenceReviewNote } from "./evidenceQuestion";

const now = Date.parse("2026-09-09T18:00:00Z");
// Illustrative source/ratio only; these tests make no provider requests.
const complete = { observation: "12× trailing earnings (illustrative)", asOf: "2026-09-08", criterion: "Compare against the sourced peer methodology recorded in the thesis (illustrative)", sourceUrl: "https://example.com/fixture-valuation", note: "The recorded comparison supports further research, not an order." };

describe("answerable evidence requirements", () => {
  it.each(["C: Price / earnings", "C: Price / sales"])("explains %s without inventing a value or cutoff", (label) => {
    const question = describeEvidenceQuestion("MYRG", label);
    expect(question.checkLabel).toBe(label);
    expect(question.question).toContain("MYRG");
    expect(question.question).toContain("support the thesis");
    expect(question.criterionHelp).toContain("No pass threshold is supplied");
    expect(JSON.stringify(question)).not.toMatch(/\d/);
    expect(EMPTY_EVIDENCE_QUESTION).toEqual({ observation: "", asOf: "", criterion: "", sourceUrl: "", note: "" });
  });
  it("preserves unfamiliar requirements without guessing their economic meaning", () => {
    const question = describeEvidenceQuestion("UAT", "Verify regulatory permission for launch");
    expect(question.requirement).toBe("Verify regulatory permission for launch");
    expect(question.question).not.toContain("permission granted");
    expect(question.criterionHelp).toContain("Do not invent");
  });
  it("keeps every missing decision-critical input explicit", () => {
    expect(evidenceQuestionReadiness(EMPTY_EVIDENCE_QUESTION, now)).toMatchObject({ canResolve: false, issues: ["Observation not supplied", "As of: not supplied", "Criterion not supplied", "Source not supplied"] });
  });
  it.each(["observation", "asOf", "criterion", "sourceUrl"] as const)("does not permit clearing without %s", (field) => {
    expect(evidenceQuestionReadiness({ ...complete, [field]: "  " }, now).canResolve).toBe(false);
  });
  it.each(["javascript:alert(1)", "file:///secret", "https://user:secret@example.com", "not a link"])("rejects unsuitable source %s", (sourceUrl) => {
    expect(evidenceQuestionReadiness({ ...complete, sourceUrl }, now).canResolve).toBe(false);
  });
  it.each(["2026-09-10", "2026-02-31", "unknown", "09/08/2026"])("rejects invalid or future observation %s", (asOf) => {
    expect(evidenceQuestionReadiness({ ...complete, asOf }, now).canResolve).toBe(false);
  });
  it("records the entered evidence within the existing note contract without claiming verification", () => {
    const result = evidenceQuestionReadiness(complete, now);
    expect(result.canResolve).toBe(true);
    expect(result.note).toBe(evidenceReviewNote(complete));
    expect(result.note).toContain("Operator-entered evidence; not independently verified.");
    for (const value of Object.values(complete)) expect(result.note).toContain(value);
    expect(result.note.length).toBeLessThanOrEqual(1_000);
    expect(evidenceQuestionReadiness({ ...complete, note: "x".repeat(1_000) }, now).canResolve).toBe(false);
  });
  it("does not claim an old observation is fresh or that a negative multiple is cheap", () => {
    const draft = { ...complete, observation: "Not meaningful: negative earnings (illustrative)", asOf: "2025-03-01" };
    const result = evidenceQuestionReadiness(draft, now);
    expect(result.note).toContain("2025-03-01");
    expect(result.note).not.toMatch(/fresh|cheap|market verified|approved/);
    expect(draft).toEqual({ ...complete, observation: "Not meaningful: negative earnings (illustrative)", asOf: "2025-03-01" });
  });
});

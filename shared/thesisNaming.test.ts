import { describe, expect, it } from "vitest";
import { isDescriptiveThesisName, thesisDisplayLabel, thesisNameError, thesisStatementExcerpt } from "./thesisNaming";

describe("thesis naming (#124)", () => {
  it("treats initials and very short names as opaque", () => {
    expect(isDescriptiveThesisName("MR")).toBe(false);
    expect(isDescriptiveThesisName("PW")).toBe(false);
    expect(isDescriptiveThesisName("ABC DEF GH")).toBe(false);
    expect(isDescriptiveThesisName("Rates fall")).toBe(true);
  });
  it("shows a statement excerpt beside a short name without renaming it", () => {
    expect(thesisDisplayLabel("MR", "Mean reversion in oversold large caps after earnings gaps\nmore")).toBe("MR · Mean reversion in oversold large caps after earnings gaps");
    expect(thesisDisplayLabel("Power grid buildout", "anything")).toBe("Power grid buildout");
    expect(thesisDisplayLabel("PW", "")).toBe("PW");
    expect(thesisDisplayLabel(null, null)).toBe("Untitled Capital thesis");
  });
  it("cuts long excerpts to 60 characters", () => {
    expect(thesisStatementExcerpt("x".repeat(100))!.length).toBe(60);
  });
  it("requires a descriptive name on new saves", () => {
    expect(thesisNameError("")).toContain("name");
    expect(thesisNameError("MR")).toContain("8 characters");
    expect(thesisNameError("Weekly income on SPY")).toBeNull();
  });
});

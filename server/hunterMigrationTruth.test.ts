import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Source-contract regression guards; these do not replace authenticated browser UAT.
const page = (name: string) => readFileSync(new URL(`../client/src/pages/${name}.tsx`, import.meta.url), "utf8");
describe("migration truth contracts", () => {
  it("does not reintroduce invented operator scores or activity", () => {
    const source = page("OperatorRegistry");
    for (const fabricated of ["7919", "98.4%", "LIVE_FEED", "ALGO v1.1", "Cerberus", "Active Orchestration"])
      expect(source).not.toContain(fabricated);
    expect(source).toContain("no deal-match assessment supplied");
    expect(source).toContain("Counts and access states are unavailable, not zero");
  });
  it("keeps request decisions separate from role grants", () => {
    const source = page("OperatorRegistry");
    expect(source).toContain("it does not assign a role");
    expect(source).toContain("updateRole.isPending");
    expect(source).toContain("updateRequest.isPending");
    expect(source).toContain("window.confirm");
  });
  it("binds strategy results to their submitted inputs", () => {
    const source = page("StrategyBlender");
    expect(source).toContain("savedAnalysis?.key === inputKey");
    expect(source).toContain("recipe: variables.recipe, scenario: variables.scenario");
    expect(source).not.toContain("SBA Ready");
    expect(source).not.toContain("PLP Eligible");
  });
  it("preserves the explicit sign-in session exchange and safe return path", () => {
    const source = page("FirebaseSignIn");
    expect(source).toContain("sanitizeReturnPath");
    expect(source).toContain('fetch("/api/auth/firebase/session"');
    expect(source).toContain("if (!response.ok)");
    expect(source).toContain("window.location.replace(readReturnPath())");
    expect(source).not.toContain("remain encrypted");
  });
});

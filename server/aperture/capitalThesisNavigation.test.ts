import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Capital thesis entry navigation contract", () => {
  const entry = readFileSync("client/src/pages/ThesisEngine.tsx", "utf8");
  const workspace = readFileSync("client/src/components/aperture/CapitalThesisWorkspace.tsx", "utf8");

  it("keeps the Capital early return inside the existing editorial shell", () => {
    expect(entry).toMatch(/if \(resolveThesisEntryWorkspace\(requestedScope, requestedUatCase\) === "capital"\) \{\s*return <EditorialTopNav><CapitalThesisWorkspace \/><\/EditorialTopNav>;/);
  });

  it("does not nest a main landmark inside the editorial shell main", () => {
    expect(workspace).not.toMatch(/<\/?main\b/);
  });

  it("provides a fixture-aware return to the saved Capital theses", () => {
    expect(workspace).toContain('href={route("/aperture/theses")}');
    expect(workspace).toContain('aria-hidden="true"');
    expect(workspace).toContain("Saved theses");
  });
});

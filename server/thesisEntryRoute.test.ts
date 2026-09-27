import { describe, expect, it } from "vitest";
import { resolveThesisEntryWorkspace } from "../shared/thesisEntryRoute";
import { readFileSync } from "node:fs";

describe("resolveThesisEntryWorkspace", () => {
  it("subscribes to query-only navigation instead of reading an inert window snapshot", () => {
    const source = readFileSync(new URL("../client/src/pages/ThesisEngine.tsx", import.meta.url), "utf8");
    expect(source).toContain("const routeSearch = useSearch();");
    expect(source).not.toContain("window.location.search");
  });
  it("opens the thesis-first Capital workspace at the canonical route", () => {
    expect(resolveThesisEntryWorkspace(null, null)).toBe("capital");
    expect(resolveThesisEntryWorkspace("capital", null)).toBe("capital");
  });

  it("keeps acquisition and property compilers behind explicit scopes", () => {
    expect(resolveThesisEntryWorkspace("acquisition", null)).toBe("legacy");
    expect(resolveThesisEntryWorkspace("property", null)).toBe("legacy");
  });

  it("preserves the isolated qualified-play thesis entrance", () => {
    expect(resolveThesisEntryWorkspace("acquisition", "qualified-play")).toBe("capital");
  });

  it("defaults unknown scopes to the canonical Capital workspace", () => {
    expect(resolveThesisEntryWorkspace("unknown", null)).toBe("capital");
  });
});

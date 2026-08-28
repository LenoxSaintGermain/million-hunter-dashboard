import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Capital Aperture client honesty contract", () => {
  it("renders missing candidate confidence as Not measured", () => {
    const source = read("client/src/pages/aperture/CandidateBoard.tsx");
    expect(source).toContain('return value == null ? "Not measured"');
    expect(source).not.toContain("(value ?? 0) * 100");
  });

  it("labels a declared catalyst as operator-set, never measured", () => {
    const source = read("client/src/components/aperture/DecisionVisualLanguage.tsx");
    expect(source).toContain('<BasisMark basis={catalystLabel ? "declared" : "unknown"} label="Catalyst" />');
    expect(source).not.toContain('<BasisMark basis={catalystLabel ? "measured" : "unknown"} label="Catalyst" />');
  });

  it("does not expose static Argument Rail nodes as buttons", () => {
    const source = read("client/src/components/aperture/DecisionVisualLanguage.tsx");
    const rail = source.slice(source.indexOf("export function ArgumentRail"), source.indexOf("export function RiskBudgetBar"));
    expect(rail).not.toContain("<button");
    expect(rail).toContain('role="list"');
    expect(rail).toContain('role="listitem"');
  });
});

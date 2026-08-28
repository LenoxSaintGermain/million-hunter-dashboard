import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Decision Runway client revision contract", () => {
  it("appends conditional and cash revisions before a research run exists", () => {
    const source = readFileSync(
      resolve(process.cwd(), "client/src/components/aperture/DecisionRunway.tsx"),
      "utf8",
    );

    expect(source).toContain("? runway.latest.decisionRunId : null");
    expect(source).not.toMatch(/runway\.latest\.runId\s*!=\s*null/);
  });
});

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

  it("keeps conditional gate review on the bound Decision Run editor", () => {
    const source = readFileSync(
      resolve(process.cwd(), "client/src/components/aperture/DecisionRunway.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'if (immutableReceipt && !revisingReceipt && (latestBranch === "cash" || latestBranch === "conditional"))',
    );
    expect(source.match(/onGateReview=\{reviseReceipt\}/g)).toHaveLength(2);
    expect(source).not.toContain("onGateReview={onNewResearch}");
  });

  it("sends the declared outcome look-back for both research and cash", () => {
    const source = readFileSync(
      resolve(process.cwd(), "client/src/components/aperture/DecisionRunway.tsx"),
      "utf8",
    );

    expect(source).toContain(': easternDateTimeInputToEpoch(outcomeReviewAtInput);');
    expect(source).toContain('if (branch === "cash" && reviewAt == null)');
    expect(source).toContain('"Outcome look-back"');
  });
});

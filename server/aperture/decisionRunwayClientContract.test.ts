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

  it("preserves an edited or immutable mission when capital and horizon change", () => {
    const source = readFileSync(
      resolve(process.cwd(), "client/src/components/aperture/DecisionRunway.tsx"),
      "utf8",
    );

    expect(source).toContain("setMissionDirty(true); // Preserve the operator-authored mission across parameter edits.");
    expect(source).toContain("setMissionDirty(true); // Immutable receipt text must never be regenerated from parameter defaults.");
    expect(source).not.toContain("setCapital(value); setMissionDirty(false);");
    expect(source).not.toContain("setHoldingPeriod(event.target.value as HoldingPeriod); setMissionDirty(false);");
  });

  it("keeps a declared run instrument immutable through the paper ticket", () => {
    const source = readFileSync(
      resolve(process.cwd(), "client/src/components/aperture/PaperProposalForm.tsx"),
      "utf8",
    );

    expect(source).toContain('run?.instrumentPreference === "options"');
    expect(source).toContain('? ["long_call", "long_put"]');
    expect(source).toContain('run?.instrumentPreference === "shares"');
    expect(source).toContain('? ["shares"]');
    expect(source).toContain("This run is locked to bounded long options. No share substitution");
  });
});

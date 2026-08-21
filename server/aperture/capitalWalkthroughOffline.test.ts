import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CAPITAL_WALKTHROUGH_DISCLOSURE } from "../../shared/capitalWalkthrough";

const replaySource = readFileSync(resolve(process.cwd(), "client/src/pages/aperture/CapitalWalkthrough.tsx"), "utf8");
const fixtureSource = readFileSync(resolve(process.cwd(), "client/src/fixtures/capitalWalkthroughFixtures.ts"), "utf8");

describe("Capital walkthrough offline replay boundary", () => {
  it("imports only a frozen local fixture and contains no live transport or action hooks", () => {
    expect(replaySource).toContain("capitalWalkthroughFixtures");
    expect(replaySource).not.toMatch(/trpc\.|useQuery|useMutation|fetch\(|axios|brokerFor|providerCall/);
  });

  it("keeps its no-order and no-recalculation language visible in the replay source", () => {
    expect(CAPITAL_WALKTHROUGH_DISCLOSURE).toContain("No order can be created here");
    expect(replaySource).toContain("does not refresh tape");
  });

  it("keeps the seven-step, versioned deep-link replay contract visible", () => {
    expect(replaySource).toContain('"Today", "Rail", "One play", "Trigger", "Evidence", "Refusal", "Record"');
    expect(replaySource).toContain('query.get("capture")');
    expect(replaySource).toContain('query.get("step")');
    expect(replaySource).toContain("Capture index");
    expect(replaySource).toContain("Nothing here is live and no order can be created from this page");
    expect(fixtureSource).toContain("0 closed trades: this validates the decision process, not an edge.");
  });
});

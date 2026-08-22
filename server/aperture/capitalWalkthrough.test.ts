import { describe, expect, it } from "vitest";
import { CAPITAL_WALKTHROUGH_DISCLOSURE } from "../../shared/capitalWalkthrough";
import { CAPITAL_WALKTHROUGH_FIXTURES } from "../../client/src/fixtures/capitalWalkthroughFixtures";

describe("Capital walkthrough fixture contract", () => {
  it("requires an explicit frozen-data disclosure rather than a claim of current market state", () => {
    expect(CAPITAL_WALKTHROUGH_DISCLOSURE).toContain("Frozen replay");
    expect(CAPITAL_WALKTHROUGH_DISCLOSURE).toContain("not recalculated");
    expect(CAPITAL_WALKTHROUGH_DISCLOSURE).toContain("No order can be created");
  });

  it("retains each enriched source-session field in a later immutable capture", () => {
    const fixture = CAPITAL_WALKTHROUGH_FIXTURES.find((item) => item.version === "2026-08-21-glp1-postfix-v3");
    expect(fixture).toBeDefined();
    expect(fixture?.today.expiredPlayCount).not.toBeNull();
    expect(fixture?.today.source).toContain("expiry");
    expect(Object.keys(fixture?.rail.headroom ?? {})).not.toHaveLength(0);
    expect(fixture?.rail.source).toContain("cockpit");
    expect(fixture?.evidence.source).toContain("set_aside");
    expect(fixture?.outcome.source).toContain("aperture_play_slates");
  });
});

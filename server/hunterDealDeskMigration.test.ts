import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("deal reading desk migration contracts", () => {
  const deal = readFileSync("client/src/pages/DealDetail.tsx", "utf8");
  const scan = readFileSync("client/src/pages/Scan.tsx", "utf8");
  it("keeps a single specialist monitor and removes duplicate legacy entry points", () => {
    expect(deal.match(/<AgentMonitoringPanel /g)).toHaveLength(1);
    expect(deal).not.toContain("<CoPilot");
    expect(deal).not.toContain("Analysis tools and financing assumptions");
    expect(deal).toContain('aria-label="Senior reading desk"');
    for (const pane of ["research", "signals", "capital", "consensus", "memo", "outreach", "seller", "agents", "trajectory", "loi"]) {
      expect(deal).toContain(`value="${pane}"`);
    }
  });
  it("does not fabricate activity, qualitative business attributes or score-derived validation", () => {
    for (const unsupported of ["TIDE_SIGNALS", "VECTORS", "14% compression", "Gray-Market Lead", "stronger validated position", "AI Score", "real current listings"]) {
      expect(scan).not.toContain(unsupported);
    }
    expect(scan).toContain("not thesis fit or verified quality");
    expect(scan).toContain("Pipeline unavailable");
    expect(scan).toContain("<AlignmentPortrait");
  });
});

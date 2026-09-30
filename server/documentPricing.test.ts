import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/Pricing.tsx", import.meta.url), "utf8");

// Source contracts, not a substitute for rendered mobile/browser UAT.
describe("document-first public pricing", () => {
  it("publishes approved prices as planned scope, not active commerce", () => {
    for (const text of ["Deal Review", "$299", "Team Desk", "$699", "Three-Deal Pack", "$799",
      "Planned launch pricing · preview only", "Not available for purchase", "No payment is collected here",
      "team permissions and billing are not ready", "USD · excluding applicable taxes"])
      expect(source).toContain(text);
  });
  it("offers access and a walkthrough without commerce or provider mutations", () => {
    expect(source).toContain('href="/#request-access"');
    expect(source).toContain('href="/walkthrough"');
    expect(source).toContain("not purchases or reservations");
    expect(source).not.toMatch(/getLoginUrl|useMutation|\bfetch\(|\btrpc\.|checkout|stripe|type="file"/i);
  });
  it("removes unsupported commercial proof and legacy licensing claims", () => {
    expect(source).not.toMatch(/Most Popular|ROI Calculator|Net savings|21\.9|85%|\$0\.15|COMPETITORS|PROJECTIONS|2970|6970|25000|Pays for itself|Replaces \$200k/i);
    expect(source).toContain("No guaranteed returns or avoided losses");
    expect(source).toContain("Do not send confidential deal documents");
  });
  it("reuses the editorial shell and progressively discloses terms", () => {
    expect(source).toContain("<HunterPublicShell>");
    expect(source).toContain('className="hunter-jobs"');
    expect(source).toContain("<details");
    expect(source).toContain("Planned terms");
    expect(source).toContain("aria-labelledby=");
  });
});

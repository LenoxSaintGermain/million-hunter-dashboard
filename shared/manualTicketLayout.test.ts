import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Draft Paper Ticket auto-fit layout (UAT retest)", () => {
  const source = readFileSync("client/src/components/aperture/ManualOrderTicketModal.tsx", "utf8");
  it("puts the long Auto-Fit line under its input, wrapping, not beside the label", () => {
    expect(source).not.toMatch(/justify-between mb-1">\s*<label[^>]*>(Contracts|Share Count|Shares)<\/label>\s*\{maxAllowableUnits/);
    expect(source.match(/whitespace-normal break-words"/g)?.length).toBe(2);
    expect(source.indexOf("value={contracts}")).toBeLessThan(source.indexOf("onClick={() => setContracts(maxAllowableUnits)}"));
  });
});

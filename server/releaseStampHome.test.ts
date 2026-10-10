import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("release stamp on every signed-in surface (#123 retest)", () => {
  it("renders the shared stamp on Home and in the Capital shell", () => {
    expect(readFileSync("client/src/pages/Home.tsx", "utf8")).toContain("<ReleaseStamp");
    expect(readFileSync("client/src/components/aperture/ApertureShell.tsx", "utf8")).toContain("<ReleaseStamp");
  });
});

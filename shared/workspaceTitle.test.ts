import { describe, expect, it } from "vitest";
import { workspaceTitle } from "./workspaceTitle";

describe("workspace tab identity", () => {
  it.each([
    ["/aperture", "Today"], ["/aperture/mission", "Mission"], ["/aperture/plays", "Play Desk"],
    ["/aperture/decision/10/revision/11/underwrite", "Mission result"],
    ["/aperture/decision/10/revision/11", "Mission"], ["/aperture/run/30", "Research"],
    ["/aperture/run/30/execute?order=2&lifecycle=monitoring", "Play details"],
    ["/aperture/runs", "Research"], ["/aperture/accounts", "Portfolio"], ["/aperture/record", "Record"],
  ])("names %s without implying an execution state", (path, title) => {
    expect(workspaceTitle(path)).toBe(`${title} · Capital Aperture`);
  });
  it("ignores query/hash identity and handles trailing slash", () => {
    expect(workspaceTitle("/aperture/mission/?account=private#finding")).toBe("Mission · Capital Aperture");
  });
  it("does not relabel acquisition work or a similarly named route", () => {
    for (const path of ["/", "/scout", "/aperture-other"]) expect(workspaceTitle(path)).toBe("Signal Hunter OS — Acquisition Command Center");
  });
});

import { describe, expect, it } from "vitest";
import { dailyPlayPrimaryDestination } from "@shared/dailyPlayActions";

describe("dailyPlayPrimaryDestination", () => {
  it("opens the paper-review form only for a ready constructed play", () => {
    expect(dailyPlayPrimaryDestination("ready_to_prepare")).toBe("execute");
  });

  it("routes every blocked or unmeasured readiness state back to decisive evidence", () => {
    expect(dailyPlayPrimaryDestination("needs_evidence")).toBe("evidence");
    expect(dailyPlayPrimaryDestination("budget_too_small")).toBe("evidence");
    expect(dailyPlayPrimaryDestination("needs_equity")).toBe("evidence");
  });
});

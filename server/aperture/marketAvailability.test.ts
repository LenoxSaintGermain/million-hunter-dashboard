import { describe, expect, it } from "vitest";
import { marketAvailabilityCopy } from "../../shared/marketAvailability";

describe("market availability copy", () => {
  it("turns a raw SIP weekend gap into concise closed-market guidance", () => {
    const copy = marketAvailabilityCopy(
      "no SIP minute bars returned for PWR since 2026-09-06T04:00:00.000Z",
      {
        session: "closed",
        nextRegularSessionOpenAt: Date.parse("2026-09-08T13:30:00.000Z"),
        referencePriceCents: 31245,
        referenceAsOf: Date.parse("2026-09-04T20:00:00.000Z"),
      },
    );

    expect(copy.title).toBe("Market closed · live entry locked");
    expect(copy.summary).toContain("$312.45");
    expect(copy.summary.toLowerCase()).toContain("reference only");
    expect(copy.summary).not.toContain("2026-09-06T04:00:00.000Z");
  });

  it("does not claim a reference price when none was verified", () => {
    const copy = marketAvailabilityCopy("no SIP minute bars returned", { session: "closed" });
    expect(copy.summary).toContain("No verified price reference is available");
    expect(copy.summary).not.toContain("$");
  });
});

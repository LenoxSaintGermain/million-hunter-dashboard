import { describe, expect, it } from "vitest";
import { manualHoldingsAge } from "./manualHoldingsAge";

describe("manualHoldingsAge (#116)", () => {
  const now = new Date("2026-10-09T15:00:00-04:00").getTime();
  it("says how old a two-month-old import is and marks it stale", () => {
    expect(manualHoldingsAge(new Date("2026-08-10T12:00:00-04:00").getTime(), now)).toEqual({ text: "Holdings as of Aug 10 · 60 days old", stale: true });
  });
  it("is fresh for a recent import", () => {
    expect(manualHoldingsAge(now - 3_600_000, now)).toMatchObject({ stale: false, text: expect.stringContaining("updated today") });
  });
  it("never invents a date when nothing was imported", () => {
    expect(manualHoldingsAge(null, now)).toEqual({ text: "No holdings imported yet", stale: true });
  });
});

import { manualHoldingsAgeLine, manualHoldingsTimestamp } from "./manualHoldingsAge";
describe("manual holdings age from the real holdings timestamp (#116 retest)", () => {
  const now = new Date("2026-10-09T15:00:00-04:00").getTime();
  const aug10 = new Date("2026-08-10T12:00:00-04:00").getTime();
  it("uses the holdings' own time when the account has no sync time", () => {
    const stamp = manualHoldingsTimestamp(null, [{ priceAsOf: aug10 - 1000 }, { priceAsOf: null, updatedAt: aug10 }]);
    expect(stamp).toBe(aug10);
    expect(manualHoldingsAgeLine(stamp, 10, now).text).toBe("Holdings as of Aug 10 · 60 days old");
  });
  it("never says 'none imported' while holdings are listed", () => {
    expect(manualHoldingsAgeLine(null, 10, now).text).toBe("10 saved holdings · import date not recorded");
    expect(manualHoldingsAgeLine(null, 0, now).text).toBe("No holdings imported yet");
  });
});

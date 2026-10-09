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

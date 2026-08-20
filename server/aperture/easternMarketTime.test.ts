import { describe, expect, it } from "vitest";
import { easternDateTimeInputFromEpoch, easternDateTimeInputToEpoch } from "../../shared/easternMarketTime";

describe("Eastern market datetime conversion", () => {
  it("serializes an EDT afternoon deadline as the same absolute instant", () => {
    expect(easternDateTimeInputToEpoch("2026-08-20T15:55")).toBe(Date.UTC(2026, 7, 20, 19, 55));
  });

  it("serializes an EST deadline across the winter offset", () => {
    expect(easternDateTimeInputToEpoch("2026-01-15T15:55")).toBe(Date.UTC(2026, 0, 15, 20, 55));
  });

  it("round-trips a displayed Eastern value without using browser-local parsing", () => {
    const epoch = Date.UTC(2026, 7, 20, 19, 55);
    expect(easternDateTimeInputFromEpoch(epoch)).toBe("2026-08-20T15:55");
    expect(easternDateTimeInputToEpoch(easternDateTimeInputFromEpoch(epoch))).toBe(epoch);
  });
});

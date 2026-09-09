import { describe, expect, it } from "vitest";
import { decodeHoldingPeriods } from "../../shared/underwritingPersistence";
import { parsePersistedJson } from "../../shared/persistedJson";

describe("underwriting persisted data decoding", () => {
  it("decodes both native MySQL JSON and MariaDB text before domain use", () => {
    expect(decodeHoldingPeriods(["swing", "position"])).toEqual(["swing", "position"]);
    expect(decodeHoldingPeriods('["swing"]')).toEqual(["swing"]);
    const stored = parsePersistedJson<{ holdingPeriods: unknown }>(' {"holdingPeriods":"[\\"swing\\"]"} ');
    expect(decodeHoldingPeriods(stored.holdingPeriods).slice().sort()).toEqual(["swing"]);
  });
  it("refuses malformed, scalar, empty, and unsupported horizons rather than defaulting", () => {
    for (const value of ["bad-json", '"swing"', [], ["lottery"], null]) expect(() => decodeHoldingPeriods(value)).toThrow();
    expect(() => parsePersistedJson("bad-json")).toThrow();
  });
});

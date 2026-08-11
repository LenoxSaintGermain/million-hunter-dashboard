import { describe, expect, it } from "vitest";
import { belongsInMemoLibrary } from "./memoLibrary";

describe("Capital Aperture memo library inclusion", () => {
  it("excludes candidates before a memo has been generated", () => {
    expect(belongsInMemoLibrary("pending")).toBe(false);
    expect(belongsInMemoLibrary(null)).toBe(false);
  });

  it("retains validated, rejected, and skipped memo records for auditability", () => {
    expect(belongsInMemoLibrary("ok")).toBe(true);
    expect(belongsInMemoLibrary("rejected")).toBe(true);
    expect(belongsInMemoLibrary("skipped")).toBe(true);
  });
});

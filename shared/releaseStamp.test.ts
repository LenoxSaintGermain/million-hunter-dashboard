import { describe, expect, it } from "vitest";
import { releaseStampLabel } from "./releaseStamp";

describe("releaseStampLabel", () => {
  it("shortens a full commit SHA to 7 characters", () => {
    expect(releaseStampLabel("299ffd1a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e")).toEqual({ short: "299ffd1", label: "Release 299ffd1" });
  });
  it("never invents a SHA when the build did not stamp one", () => {
    expect(releaseStampLabel(undefined).short).toBeNull();
    expect(releaseStampLabel("").label).toBe("Release not stamped");
    expect(releaseStampLabel("unavailable").short).toBeNull();
  });
});

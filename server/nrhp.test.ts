import { describe, it, expect } from "vitest";
import { isMailableAddress, stateName } from "./nrhp";

describe("isMailableAddress", () => {
  it("accepts a real street address", () => {
    expect(isMailableAddress("161-167 N. High St.")).toBe(true);
    expect(isMailableAddress("55 Nationwide Blvd.")).toBe(true);
    expect(isMailableAddress("3583 E. Broad St.")).toBe(true);
  });

  it("rejects intersections, which cannot be matched to a parcel or mailed", () => {
    expect(isMailableAddress("S. High and E. Main Sts.")).toBe(false);
    expect(isMailableAddress("S. Columbus and High St.")).toBe(false);
  });

  it("rejects restricted archaeological locations", () => {
    expect(isMailableAddress("Address Restricted")).toBe(false);
  });

  it("rejects directional descriptions", () => {
    expect(isMailableAddress("N of Lockbourne at 1451 Rathmell Rd.")).toBe(false);
    expect(isMailableAddress("Junction of US 40 and SR 4")).toBe(false);
    expect(isMailableAddress("Vicinity of Millersport")).toBe(false);
  });

  it("rejects empty and near-empty values", () => {
    expect(isMailableAddress(null)).toBe(false);
    expect(isMailableAddress("")).toBe(false);
    expect(isMailableAddress("N/A")).toBe(false);
  });
});

describe("stateName", () => {
  it("maps abbreviations to the full names the dataset actually stores", () => {
    // Querying State='OH' returns zero rows — the field holds 'OHIO'.
    expect(stateName("OH")).toBe("OHIO");
    expect(stateName("dc")).toBe("DISTRICT OF COLUMBIA");
    expect(stateName("NC")).toBe("NORTH CAROLINA");
  });

  it("returns null for something that is not a state", () => {
    expect(stateName("ZZ")).toBeNull();
  });
});

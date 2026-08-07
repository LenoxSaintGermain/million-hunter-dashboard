import { describe, it, expect } from "vitest";
import { parseAssetCsv } from "./csvImport";

// A CoStar-shaped export: different column names, formatted money, quoted commas.
const COSTAR_LIKE = `Property Name,Street Address,City,State,Year Built,RBA,Asking Price,Cap Rate,# Floors,Listing URL
"Smith Block, The",122 Main St,Columbus,OH,1908,"18,500","$2,750,000",6.5%,3,https://example.com/1
Old Foundry,44 Water St,Louisville,KY,1921,"9,200","$640,000",7.25,2,https://example.com/2`;

describe("parseAssetCsv", () => {
  it("maps CoStar-style headers onto our fields", () => {
    const { rows, headerMap } = parseAssetCsv(COSTAR_LIKE, "historic");
    expect(rows).toHaveLength(2);
    expect(headerMap.find((h) => h.column === "RBA")?.mappedTo).toBe("squareFootage");
    expect(headerMap.find((h) => h.column === "# Floors")?.mappedTo).toBe("stories");
  });

  it("handles quoted commas in a value", () => {
    const { rows } = parseAssetCsv(COSTAR_LIKE, "historic");
    expect(rows[0].name).toBe("Smith Block, The");
  });

  it("strips currency and thousands separators", () => {
    const { rows } = parseAssetCsv(COSTAR_LIKE, "historic");
    expect(rows[0].askingPrice).toBe(2750000);
    expect(rows[0].squareFootage).toBe(18500);
  });

  it("normalises cap rate to a decimal whether or not a % sign is present", () => {
    const { rows } = parseAssetCsv(COSTAR_LIKE, "historic");
    expect(rows[0].capRate).toBeCloseTo(0.065, 5);
    expect(rows[1].capRate).toBeCloseTo(0.0725, 5);
  });

  it("uppercases and truncates the state", () => {
    const { rows } = parseAssetCsv("Name,Address,City,State\nX,1 A St,Dayton,ohio", "historic");
    expect(rows[0].state).toBe("OH");
  });

  it("skips rows without a name or without city/state, and says so", () => {
    const csv = `Property Name,Street Address,City,State
,1 A St,Columbus,OH
Nameless County,2 B St,,`;
    const { rows, errors } = parseAssetCsv(csv, "historic");
    expect(rows).toHaveLength(0);
    expect(errors.some((e) => e.includes("no property name"))).toBe(true);
    expect(errors.some((e) => e.includes("no city/state"))).toBe(true);
  });

  it("never invents an address — it labels the gap", () => {
    const { rows } = parseAssetCsv("Property Name,City,State\nNo Address Bldg,Akron,OH", "historic");
    expect(rows[0].address).toBe("Address not provided in export");
  });

  it("routes class-only columns into classMetadata, but keeps native columns native", () => {
    const csv = "Property Name,Address,City,State,netRentableSqFt,occupancyRate\nStorage A,1 A St,Dallas,TX,55000,92%";
    const { rows } = parseAssetCsv(csv, "self_storage");
    // No native column exists for net rentable SF, so it lives in class metadata.
    expect(rows[0].classMetadata?.netRentableSqFt).toBe(55000);
    // occupancy_rate IS a native column — writing it there keeps it queryable,
    // and the storage model reads native before metadata.
    expect(rows[0].occupancyRate).toBeCloseTo(0.92, 5);
  });

  it("reports unrecognised columns rather than dropping them silently", () => {
    const csv = "Property Name,Address,City,State,Broker Notes\nX,1 A St,Columbus,OH,call first";
    const { errors } = parseAssetCsv(csv, "historic");
    expect(errors.some((e) => e.includes("Broker Notes"))).toBe(true);
  });
});

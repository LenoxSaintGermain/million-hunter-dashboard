import { expect, it } from "vitest";
import { matchesAcquisitionFinancials, parseAcquisitionListings } from "./acquisitionListing";

it("never substitutes an unrelated citation for a missing listing URL", () => {
  expect(() => parseAcquisitionListings([{ name: "Illustrative test" }])).toThrow();
});
it("preserves missing financials as unknown and derives multiples only from disclosed inputs", () => {
  const [listing] = parseAcquisitionListings([{ name: "Illustrative test", listingUrl: "https://example.com/listing/fixture", cashFlow: 300000, askingPrice: 1200000 }]);
  expect(listing.revenue).toBeNull();
  expect(listing.multiple).toBe(4);
  expect(matchesAcquisitionFinancials(listing, { cashFlowMin: 300000, askingPriceMax: 1000000 })).toBe(false);
});
it("missing cash flow cannot qualify for a declared cash flow floor", () => {
  const [listing] = parseAcquisitionListings([{ name: "Illustrative test", listingUrl: "https://example.com/listing/fixture" }]);
  expect(matchesAcquisitionFinancials(listing, { cashFlowMin: 300000 })).toBe(false);
});

it("uses the listing hostname as bounded provenance, not provider prose", () => {
  const [listing] = parseAcquisitionListings([{ name: "Illustrative test", listingUrl: "https://www.bizbuysell.com/business-opportunity/example/1234567/", source: "Unverified broker claims. ".repeat(20) }]);
  expect(listing.source).toBe("bizbuysell.com");
});

it("rejects marketplace category pages as individual deal evidence", () => {
  expect(() => parseAcquisitionListings([{ name: "HVAC Business", listingUrl: "https://www.bizbuysell.com/georgia/atlanta-metro-area/hvac-businesses-for-sale/" }])).toThrow();
});

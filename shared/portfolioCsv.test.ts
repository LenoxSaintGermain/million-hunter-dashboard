import { describe, expect, it } from "vitest";
import { parsePortfolioCsv } from "./portfolioCsv";

describe("portfolio CSV intake", () => {
  it("accepts common brokerage headings", () => {
    expect(parsePortfolioCsv("Ticker,Shares,Average Cost,Current Value\nNVDA,5,120.50,750"))
      .toEqual([{ symbol: "NVDA", qty: 5, avgCostCents: 12050, marketValueCents: 75000 }]);
  });

  it("accepts the compact headerless format and preserves shorts", () => {
    expect(parsePortfolioCsv("TLT,-10,92.25,-925"))
      .toEqual([{ symbol: "TLT", qty: -10, avgCostCents: 9225, marketValueCents: -92500 }]);
  });

  it("surfaces malformed rows instead of importing zero holdings", () => {
    expect(parsePortfolioCsv("symbol,qty\nIWM,not-a-number")[0]?.error).toMatch(/non-zero quantity/);
  });
});

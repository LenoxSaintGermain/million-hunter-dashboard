import { z } from "zod";

const amount = z.number().finite().nonnegative().nullable().optional();
const listing = z.object({
  name: z.string().trim().min(1).max(200), industry: z.string().default("Service business"),
  location: z.string().default("Not disclosed"), source: z.string().default("market-research"),
  listingUrl: z.string().url().refine(url => /^https?:\/\//.test(url)),
  revenue: amount, cashFlow: amount, askingPrice: amount,
  employees: amount, yearEstablished: amount,
});

export function parseAcquisitionListings(value: unknown) {
  return z.array(listing).max(30).parse(value).map(row => ({
    ...row,
    revenue: row.revenue ?? null, cashFlow: row.cashFlow ?? null,
    askingPrice: row.askingPrice ?? null, employees: row.employees ?? null,
    yearEstablished: row.yearEstablished ?? null,
    multiple: row.askingPrice != null && row.cashFlow != null && row.cashFlow > 0
      ? row.askingPrice / row.cashFlow : null,
  }));
}

export type AcquisitionFinancials = {
  cashFlowMin?: number; cashFlowMax?: number; askingPriceMin?: number; askingPriceMax?: number;
  revenueMin?: number; revenueMax?: number; multipleMax?: number;
};
export function matchesAcquisitionFinancials(row: ReturnType<typeof parseAcquisitionListings>[number], filters: AcquisitionFinancials) {
  const ranges = [
    [row.cashFlow, filters.cashFlowMin, filters.cashFlowMax],
    [row.askingPrice, filters.askingPriceMin, filters.askingPriceMax],
    [row.revenue, filters.revenueMin, filters.revenueMax],
    [row.multiple, undefined, filters.multipleMax],
  ];
  return ranges.every(([value, min, max]) =>
    (min == null && max == null) || (value != null && (min == null || value >= min) && (max == null || value <= max)));
}

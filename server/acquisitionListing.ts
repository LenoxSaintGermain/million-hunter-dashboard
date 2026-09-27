import { z } from "zod";

const amount = z.number().finite().nonnegative().nullable().optional();
const listing = z.object({
  name: z.string().trim().min(1).max(200), industry: z.string().max(128).default("Service business"),
  location: z.string().max(256).default("Not disclosed"), source: z.string().default("market-research"),
  listingUrl: z.string().url().refine(value => {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (!/^https?:$/.test(url.protocol) || host.length > 64) return false;
    // A category/search result is not evidence for a particular business.
    if (host === "bizbuysell.com") return /^\/business-opportunity\/[^/]+\/\d+\/?$/.test(url.pathname);
    return url.pathname !== "/" && !/\/(search|search-results)(\/|$)/i.test(url.pathname);
  }, "An individual listing URL is required; marketplace search pages are not deal evidence"),
  revenue: amount, cashFlow: amount, askingPrice: amount,
  employees: amount, yearEstablished: amount,
});

export function parseAcquisitionListings(value: unknown) {
  return z.array(listing).max(30).parse(value).map(row => ({
    ...row,
    source: new URL(row.listingUrl).hostname.replace(/^www\./, ""),
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

import { afterEach, expect, it, vi } from "vitest";
import { assessAcquisitionListings, checkAcquisitionSource } from "./acquisitionSourceCheck";
import { parseAcquisitionListings } from "./acquisitionListing";

afterEach(() => vi.unstubAllGlobals());
const url = "https://www.bizbuysell.com/business-opportunity/illustrative-fixture/1234567/";
it("blocks an indexed listing whose original page is missing", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 404, ok: false }));
  expect((await checkAcquisitionSource(url)).state).toBe("unavailable");
});
it("keeps provider blocking uncertain, not available or sold", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 403, ok: false }));
  expect((await checkAcquisitionSource(url)).state).toBe("unverified");
});
it("does not follow a redirect to an unvalidated destination", async () => {
  const fetcher = vi.fn().mockResolvedValue({ status: 302, ok: false });
  vi.stubGlobal("fetch", fetcher);
  expect((await checkAcquisitionSource(url)).state).toBe("unverified");
  expect(fetcher.mock.calls[0][1].redirect).toBe("manual");
});
it("distinguishes a readable listing from verified financial claims", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, ok: true }));
  const result = await checkAcquisitionSource(url);
  expect(result.state).toBe("reachable");
  expect(result.reason).toMatch(/not.*verified/i);
});
it("does not request arbitrary hosts", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect((await checkAcquisitionSource("http://127.0.0.1/private")).state).toBe("unverified");
  expect(fetcher).not.toHaveBeenCalled();
});
it("records a timeout as uncertainty", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
  expect((await checkAcquisitionSource(url)).state).toBe("unverified");
});
it("retains a rejected-source receipt and prevents it from entering the eligible list", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 404 }));
  const rows = parseAcquisitionListings([{ name: "Illustrative fixture", listingUrl: url, cashFlow: 400000 }]);
  const results = await assessAcquisitionListings(rows, { cashFlowMin: 300000 });
  expect(results.filter(result => result.eligible)).toEqual([]);
  expect(results[0].listing.listingUrl).toBe(url);
  expect(results[0].sourceCheck?.state).toBe("unavailable");
});
it("retains missing financial evidence without wasting a source request", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const rows = parseAcquisitionListings([{ name: "Illustrative fixture", listingUrl: url }]);
  const [result] = await assessAcquisitionListings(rows, { cashFlowMin: 300000 });
  expect(result.eligible).toBe(false);
  expect(result.reason).toContain("missing");
  expect(fetcher).not.toHaveBeenCalled();
});
it("preserves useful indexed research when the publisher blocks automated access", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 403 }));
  const rows = parseAcquisitionListings([{ name: "Illustrative fixture", listingUrl: url, cashFlow: 400000 }]);
  const [result] = await assessAcquisitionListings(rows, { cashFlowMin: 300000 });
  expect(result.eligible).toBe(true);
  expect(result.sourceCheck?.state).toBe("unverified");
  expect(result.reason).toContain("could not be checked");
});

import { afterEach, expect, it, vi } from "vitest";
import { captureAcquisitionListing } from "./acquisitionCapture";
afterEach(() => vi.unstubAllGlobals());
const url = "https://www.bizbuysell.com/business-opportunity/fixture/1234567/";
it.each(["https://localhost/listing/1", "https://bizbuysell.com/businesses-for-sale/", "https://user:password@bizbuysell.com/business-opportunity/fixture/1234567/"])("rejects unsupported capture targets before networking: %s", async target => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect((await captureAcquisitionListing(target)).state).toBe("unresolved");
  expect(fetcher).not.toHaveBeenCalled();
});
it("fails closed on oversized and challenge pages without a financial fallback", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x".repeat(1_500_001), { headers: { "content-type": "text/html" } })));
  expect(await captureAcquisitionListing(url)).toMatchObject({ state: "unresolved", reason: "Listing exceeds capture limit" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<main>Verify you are human. Asking Price: $1,850,000</main>", { headers: { "content-type": "text/html" } })));
  expect(await captureAcquisitionListing(url)).toMatchObject({ state: "unresolved", reason: "Listing content incomplete or blocked" });
});
it("reads listing content, ignores scripts and refuses redirects instead of using snippets", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('<html><script>Asking Price: $9,000,000</script><main><h1>Fixture</h1><p>Asking Price: $1,850,000</p><p>Revenue: $3,590,234</p></main></html>', { headers: { "content-type": "text/html" } })));
  const result = await captureAcquisitionListing(url);
  expect(result.state).toBe("captured");
  if (result.state === "captured") expect(result.evidence.fields.ask.value).toBe(1850000);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } })));
  expect((await captureAcquisitionListing(url)).state).toBe("unresolved");
});

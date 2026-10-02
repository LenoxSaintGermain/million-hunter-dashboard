import { load } from "cheerio";
import { createHash } from "node:crypto";
import { extractListingEvidence, type ListingEvidence } from "../shared/acquisitionV2";
import { parseAcquisitionListings } from "./acquisitionListing";

const allowedHosts = new Set(["bizbuysell.com", "dealstream.com", "flippa.com", "quietlight.com", "empireflippers.com", "abbrokers.com", "bizquest.com"]);
export type ListingCapture = { url: string; fetchedAt: string } & (
  { state: "captured"; evidence: ListingEvidence; contentHash: string } |
  { state: "unresolved" | "unavailable"; reason: string }
);

/** Search snippets never enter this boundary. Bounded GET, no redirects or arbitrary hosts. */
export async function captureAcquisitionListing(listingUrl: string): Promise<ListingCapture> {
  const base = { url: listingUrl, fetchedAt: new Date().toISOString() };
  try {
    const url = new URL(listingUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !allowedHosts.has(url.hostname.replace(/^www\./, ""))) throw new Error("Unsupported public listing host");
    parseAcquisitionListings([{ name: "Capture", listingUrl }]);
    const response = await fetch(url.href, { redirect: "manual", signal: AbortSignal.timeout(12000), headers: { Accept: "text/html" } });
    if (response.status !== 200 || !response.headers.get("content-type")?.includes("text/html")) {
      await response.body?.cancel();
      return { ...base, state: [404,410].includes(response.status) ? "unavailable" : "unresolved", reason: `Listing capture unavailable (HTTP ${response.status}). No snippet fallback.` };
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        bytes += value.length;
        if (bytes > 1_500_000) throw new Error("Listing exceeds capture limit");
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    const html = Buffer.concat(chunks).toString("utf8");
    const $ = load(html);
    $("script,style,nav,footer,header,aside,noscript,iframe,[hidden],[aria-hidden=true]").remove();
    $("br").replaceWith("\n");
    $("p,div,li,tr,dt,dd,h1,h2,h3").append("\n");
    const text = ($("main").length === 1 ? $("main").text() : $("body").text()).replace(/[\t\r ]+/g, " ").replace(/\n\s*\n/g, "\n").trim();
    if (text.length < 30 || text.length > 60000 || /verify you are human|access denied|enable javascript and cookies|just a moment/i.test(text)) throw new Error("Listing content incomplete or blocked");
    const evidence = extractListingEvidence({ url: listingUrl, fetchedAt: base.fetchedAt, type: "primary", text });
    return { ...base, state: "captured", evidence, contentHash: createHash("sha256").update(evidence.text).digest("hex") };
  } catch (error) {
    return { ...base, state: "unresolved", reason: error instanceof Error && /Unsupported|capture limit|incomplete|blocked/.test(error.message) ? error.message : "Original listing could not be captured. No financial claims promoted." };
  }
}

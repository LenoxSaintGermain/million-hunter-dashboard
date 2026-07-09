/**
 * listingScraper.ts
 * Fetches a commercial listing URL and returns clean text content for AI extraction.
 * Supports LoopNet, BizBuySell, CoStar, Crexi, and generic listing pages.
 *
 * Strategy (in order):
 * 1. Direct fetch with browser-like headers
 * 2. Google AMP cache (https://amp.cache.google.com/...)
 * 3. Wayback Machine / archive.org latest snapshot
 * 4. URL-only mode — parse listing ID + address from URL, let AI fill the rest
 */

import axios from "axios";
import * as cheerio from "cheerio";

export interface ScrapedListing {
  url: string;
  title: string;
  rawText: string;
  /** Structured hints parsed from meta tags / JSON-LD before AI extraction */
  hints: {
    price?: string;
    address?: string;
    description?: string;
    imageUrl?: string;
    /** True when we fell back to URL-only mode (no page content available) */
    urlOnlyMode?: boolean;
  };
}

// ── Browser-like headers to reduce bot detection ──────────────────────────────
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
  Referer: "https://www.google.com/",
};

// ── Googlebot headers (some sites allow Googlebot) ────────────────────────────
const GOOGLEBOT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate",
};

// ── Extract structured data from HTML ─────────────────────────────────────────
function parseHtml(html: string, url: string): ScrapedListing {
  const $ = cheerio.load(html);

  // Remove noise
  $("script, style, nav, footer, header, iframe, noscript, svg, [aria-hidden='true']").remove();
  $("[class*='cookie'], [class*='modal'], [class*='popup'], [id*='cookie'], [id*='modal']").remove();

  const title =
    $("h1").first().text().trim() ||
    $("title").text().trim() ||
    "Untitled Listing";

  const hints: ScrapedListing["hints"] = {};

  // JSON-LD
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() ?? "{}");
      if (json.address?.streetAddress && !hints.address)
        hints.address = json.address.streetAddress;
      if (json.offers?.price) hints.price = String(json.offers.price);
      if (json.description && !hints.description)
        hints.description = String(json.description).slice(0, 500);
      if (json.image && !hints.imageUrl)
        hints.imageUrl = Array.isArray(json.image) ? json.image[0] : json.image;
    } catch {}
  });

  // OG meta fallbacks
  if (!hints.description) {
    hints.description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      undefined;
  }
  if (!hints.imageUrl) {
    hints.imageUrl = $('meta[property="og:image"]').attr("content") || undefined;
  }

  // Main content text
  const contentSelectors = [
    "main", "[role='main']", "#listing-detail", ".listing-detail",
    ".property-detail", ".listing-info", ".property-info", "article",
    ".content", "#content", "body",
  ];

  let rawText = "";
  for (const sel of contentSelectors) {
    const el = $(sel).first();
    if (el.length) {
      rawText = el.text().replace(/\s+/g, " ").trim();
      if (rawText.length > 200) break;
    }
  }
  if (rawText.length < 200) rawText = $("body").text().replace(/\s+/g, " ").trim();

  return { url, title, rawText: rawText.slice(0, 8_000), hints };
}

// ── Strategy 1: Direct fetch ──────────────────────────────────────────────────
async function fetchDirect(url: string): Promise<string> {
  const res = await axios.get(url, {
    headers: BROWSER_HEADERS,
    timeout: 20_000,
    maxRedirects: 5,
    decompress: true,
  });
  return res.data as string;
}

// ── Strategy 2: Googlebot UA ──────────────────────────────────────────────────
async function fetchGooglebot(url: string): Promise<string> {
  const res = await axios.get(url, {
    headers: GOOGLEBOT_HEADERS,
    timeout: 20_000,
    maxRedirects: 5,
    decompress: true,
  });
  return res.data as string;
}

// ── Strategy 3: Wayback Machine (latest snapshot) ─────────────────────────────
async function fetchWayback(url: string): Promise<string> {
  // Check availability API first
  const avail = await axios.get(
    `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
    { timeout: 10_000 }
  );
  const snapshot = avail.data?.archived_snapshots?.closest;
  if (!snapshot?.available || !snapshot?.url) {
    throw new Error("No Wayback snapshot available");
  }
  const res = await axios.get(snapshot.url, {
    headers: BROWSER_HEADERS,
    timeout: 20_000,
    maxRedirects: 5,
    decompress: true,
  });
  return res.data as string;
}

// ── Strategy 4: URL-only mode (parse address from URL slug) ───────────────────
function buildUrlOnlyResult(url: string): ScrapedListing {
  // Extract address slug from URL path — works for LoopNet, CoStar, Crexi
  // e.g. /Listing/505-SE-16th-St-Fort-Lauderdale-FL/39894327/
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split("/").filter(Boolean);

  // Try to find address-like segment (contains digits and dashes)
  const addressSlug = pathParts.find((p) => /\d/.test(p) && p.includes("-") && p.length > 10);
  const addressHint = addressSlug
    ? addressSlug.replace(/-/g, " ").replace(/\b(\w)/g, (c) => c.toUpperCase())
    : "";

  const hostname = urlObj.hostname.replace("www.", "");
  const listingId = pathParts.find((p) => /^\d{6,}$/.test(p)) ?? "";

  const rawText = [
    `Listing URL: ${url}`,
    `Source platform: ${hostname}`,
    addressHint ? `Address from URL: ${addressHint}` : "",
    listingId ? `Listing ID: ${listingId}` : "",
    `Note: The listing page is behind a login wall or bot protection. Extract what you can from the URL and apply general market knowledge for ${hostname} listings.`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    url,
    title: addressHint || `Listing on ${hostname}`,
    rawText,
    hints: {
      address: addressHint || undefined,
      urlOnlyMode: true,
    },
  };
}

/**
 * Scrape a listing URL and return clean text + structural hints.
 * Never throws — falls back to URL-only mode if all strategies fail.
 */
export async function scrapeListing(url: string): Promise<ScrapedListing> {
  // Strategy 1: Direct fetch
  try {
    const html = await fetchDirect(url);
    const result = parseHtml(html, url);
    if (result.rawText.length > 100) return result;
  } catch (e1: any) {
    console.log(`[Scraper] Direct fetch failed (${e1?.response?.status ?? e1?.code ?? e1?.message}), trying Googlebot UA...`);
  }

  // Strategy 2: Googlebot UA
  try {
    const html = await fetchGooglebot(url);
    const result = parseHtml(html, url);
    if (result.rawText.length > 100) return result;
  } catch (e2: any) {
    console.log(`[Scraper] Googlebot UA failed (${e2?.response?.status ?? e2?.code ?? e2?.message}), trying Wayback...`);
  }

  // Strategy 3: Wayback Machine
  try {
    const html = await fetchWayback(url);
    const result = parseHtml(html, url);
    if (result.rawText.length > 100) return result;
  } catch (e3: any) {
    console.log(`[Scraper] Wayback failed (${e3?.message}), falling back to URL-only mode`);
  }

  // Strategy 4: URL-only — never fails, lets AI do the heavy lifting
  console.log(`[Scraper] Using URL-only mode for ${url}`);
  return buildUrlOnlyResult(url);
}

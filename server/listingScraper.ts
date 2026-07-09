/**
 * listingScraper.ts
 * Fetches a commercial listing URL and returns clean text content for AI extraction.
 * Supports LoopNet, BizBuySell, CoStar, Crexi, and generic listing pages.
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
  };
}

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
};

/**
 * Scrape a listing URL and return clean text + structural hints.
 * Throws if the page cannot be fetched or contains no useful content.
 */
export async function scrapeListing(url: string): Promise<ScrapedListing> {
  let html: string;

  try {
    const response = await axios.get(url, {
      headers: BROWSER_HEADERS,
      timeout: 20_000,
      maxRedirects: 5,
      // Accept compressed responses
      decompress: true,
    });
    html = response.data as string;
  } catch (err: any) {
    throw new Error(`Failed to fetch listing URL: ${err?.message ?? String(err)}`);
  }

  const $ = cheerio.load(html);

  // ── Remove noise elements ──────────────────────────────────────────────────
  $("script, style, nav, footer, header, iframe, noscript, svg, [aria-hidden='true']").remove();
  $("[class*='cookie'], [class*='modal'], [class*='popup'], [id*='cookie'], [id*='modal']").remove();

  // ── Extract title ──────────────────────────────────────────────────────────
  const title =
    $("h1").first().text().trim() ||
    $("title").text().trim() ||
    "Untitled Listing";

  // ── Extract JSON-LD structured data ───────────────────────────────────────
  const hints: ScrapedListing["hints"] = {};
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() ?? "{}");
      if (json.name && !hints.address) hints.address = json.address?.streetAddress;
      if (json.offers?.price) hints.price = String(json.offers.price);
      if (json.description) hints.description = json.description?.slice(0, 500);
      if (json.image) hints.imageUrl = Array.isArray(json.image) ? json.image[0] : json.image;
    } catch {}
  });

  // ── Extract OG meta tags as fallback ──────────────────────────────────────
  if (!hints.description) {
    hints.description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      undefined;
  }
  if (!hints.imageUrl) {
    hints.imageUrl = $('meta[property="og:image"]').attr("content") || undefined;
  }

  // ── Extract visible body text ──────────────────────────────────────────────
  // Focus on main content areas first
  const contentSelectors = [
    "main",
    "[role='main']",
    "#listing-detail",
    ".listing-detail",
    ".property-detail",
    ".listing-info",
    ".property-info",
    "article",
    ".content",
    "#content",
    "body",
  ];

  let rawText = "";
  for (const sel of contentSelectors) {
    const el = $(sel).first();
    if (el.length) {
      rawText = el.text().replace(/\s+/g, " ").trim();
      if (rawText.length > 200) break;
    }
  }

  // Fallback: full body text
  if (rawText.length < 200) {
    rawText = $("body").text().replace(/\s+/g, " ").trim();
  }

  // Truncate to ~8000 chars to stay within LLM context budget
  rawText = rawText.slice(0, 8_000);

  if (rawText.length < 50) {
    throw new Error(
      "Page returned insufficient content — it may require JavaScript rendering or a login. Try pasting the listing details manually."
    );
  }

  return { url, title, rawText, hints };
}

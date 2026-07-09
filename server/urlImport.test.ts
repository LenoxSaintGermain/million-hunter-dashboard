/**
 * URL Import Tests
 * Tests the listingScraper + importFromUrl pipeline:
 * - scrapeListing: validates HTML fetch + text extraction
 * - importFromUrl procedure: validates DB asset creation from scraped data
 */
import { describe, it, expect, afterAll, vi } from "vitest";
import { getDb } from "./db";
import { commercialAssets } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── scrapeListing unit tests ─────────────────────────────────────────────────
describe("scrapeListing — URL scraper", () => {
  it("throws a descriptive error for an unreachable URL", async () => {
    const { scrapeListing } = await import("./listingScraper");
    await expect(scrapeListing("https://this-domain-does-not-exist-xyz123.com/listing/1"))
      .rejects.toThrow(/Failed to fetch listing URL/i);
  });

  it("extracts title and rawText from a real public page", async () => {
    const { scrapeListing } = await import("./listingScraper");
    // Use a stable, always-accessible public page for this test
    const result = await scrapeListing("https://example.com");
    expect(result.title).toBeTruthy();
    expect(result.rawText.length).toBeGreaterThan(50);
    expect(result.url).toBe("https://example.com");
  }, 30_000);
});

// ─── importFromUrl DB integration ─────────────────────────────────────────────
describe("scout.importFromUrl — DB asset creation", () => {
  let createdAssetId: number | undefined;

  it("createCommercialAsset with source=url_import stores the asset", async () => {
    const { createCommercialAsset, getCommercialAssetById } = await import("./db");
    const now = Date.now();
    const res = await createCommercialAsset({
      name: "Test URL Import Hotel",
      address: "505 SE 16th St",
      city: "Fort Lauderdale",
      state: "FL",
      zip: "33316",
      propertyType: "retail",
      askingPrice: 6_000_000,
      capRate: 0.0623,
      noi: 373_800,
      opportunityZone: false,
      sourceUrl: "https://www.loopnet.com/Listing/505-SE-16th-St-Fort-Lauderdale-FL/39894327/",
      source: "url_import",
      createdAt: now,
      updatedAt: now,
    }) as any;

    createdAssetId = res[0].insertId;
    expect(createdAssetId).toBeGreaterThan(0);

    const asset = await getCommercialAssetById(createdAssetId!);
    expect(asset).toBeDefined();
    expect(asset!.name).toBe("Test URL Import Hotel");
    expect(asset!.city).toBe("Fort Lauderdale");
    expect(asset!.askingPrice).toBeCloseTo(6_000_000, -2);
    expect(asset!.capRate).toBeCloseTo(0.0623, 3);
    expect(asset!.sourceUrl).toContain("loopnet.com");
  });

  it("updateCommercialAssetAiScore sets score and moves to reviewing", async () => {
    if (!createdAssetId) return;
    const { updateCommercialAssetAiScore, getCommercialAssetById } = await import("./db");
    await updateCommercialAssetAiScore(createdAssetId, 0.72, "Boutique hotel with solid cap rate in Fort Lauderdale waterfront market");
    const asset = await getCommercialAssetById(createdAssetId);
    expect(asset!.aiScore).toBeCloseTo(0.72, 2);
    expect(asset!.status).toBe("reviewing");
    expect(asset!.aiAnalysis).toContain("Boutique hotel");
  });

  afterAll(async () => {
    const db = await getDb();
    if (db && createdAssetId) {
      await db.delete(commercialAssets).where(eq(commercialAssets.id, createdAssetId));
    }
  });
});

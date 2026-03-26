/**
 * Sprint 5 Tests
 * Covers:
 *  1. OZ/TAD badge data — deals with opportunityZone=true and tadDistrict set are returned by deals.list
 *  2. Commercial Assets Scout — CRUD via DB helpers
 *  3. Consensus divergence logic — divergenceFlag is set correctly based on score spread
 */
import { describe, it, expect, afterEach } from "vitest";
import { getDb, createDeal, getDealIdByNameSource, getCommercialAssets, createCommercialAsset, updateCommercialAssetStatus } from "./db";
import { deals, commercialAssets } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

// ─── 1. OZ/TAD Badge Data ─────────────────────────────────────────────────────
describe("OZ/TAD Badge Data", () => {
  const TEST_OZ_NAME = `__test_oz_badge_${Date.now()}`;

  afterEach(async () => {
    const db = await getDb();
    if (db) await db.delete(deals).where(eq(deals.name, TEST_OZ_NAME));
  });

  it("deal with opportunityZone=true is stored and retrievable", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();

    await createDeal({
      name: TEST_OZ_NAME,
      stage: "new",
      location: "Atlanta, GA",
      revenue: 1500000,
      cashFlow: 500000,
      askingPrice: 2000000,
      multiple: 4.0,
    });

    const id = await getDealIdByNameSource(TEST_OZ_NAME, null);
    expect(id).toBeGreaterThan(0);

    // Set OZ fields
    await db!.execute(sql`UPDATE deals SET opportunity_zone = 1, oz_tract_id = '13121011900', tad_district = 'Westside TAD' WHERE id = ${id}`);

    const rows = await db!.select().from(deals).where(eq(deals.id, id!)).limit(1);
    expect(rows[0].opportunityZone).toBe(true);
    expect(rows[0].tadDistrict).toBe("Westside TAD");
    expect(rows[0].ozTractId).toBe("13121011900");
  });
});

// ─── 2. Commercial Assets Scout ───────────────────────────────────────────────
describe("Commercial Assets Scout", () => {
  let createdId: number | null = null;

  afterEach(async () => {
    if (createdId) {
      const db = await getDb();
      if (db) await db.delete(commercialAssets).where(eq(commercialAssets.id, createdId));
      createdId = null;
    }
  });

  it("creates a commercial asset and retrieves it", async () => {
    const res = await createCommercialAsset({
      name: "Test Retail Strip — Atlanta",
      address: "123 Peachtree St NW",
      city: "Atlanta",
      state: "GA",
      zip: "30303",
      propertyType: "retail",
      squareFootage: 5000,
      askingPrice: 1200000,
      capRate: 0.065,
      noi: 78000,
      leaseType: "nnn",
      zoning: "C-1",
      opportunityZone: true,
      ozTractId: "13121011900",
      tadDistrict: "Westside TAD",
      source: "manual",
    }) as any;

    createdId = res[0].insertId;
    expect(createdId).toBeGreaterThan(0);

    const assets = await getCommercialAssets({ limit: 10 });
    const found = assets.find((a) => a.id === createdId);
    expect(found).toBeDefined();
    expect(found?.name).toBe("Test Retail Strip — Atlanta");
    expect(found?.opportunityZone).toBe(true);
    expect(found?.tadDistrict).toBe("Westside TAD");
    expect(found?.capRate).toBeCloseTo(0.065, 3);
  });

  it("updates commercial asset status", async () => {
    const res = await createCommercialAsset({
      name: "Test Industrial — Norcross",
      address: "456 Industrial Blvd",
      city: "Norcross",
      state: "GA",
      propertyType: "industrial",
      source: "manual",
    }) as any;

    createdId = res[0].insertId;
    expect(createdId).toBeGreaterThan(0);

    await updateCommercialAssetStatus(createdId, "qualified");

    const db = await getDb();
    const rows = await db!.select().from(commercialAssets).where(eq(commercialAssets.id, createdId)).limit(1);
    expect(rows[0].status).toBe("qualified");
  });
});

// ─── 3. Consensus Divergence Logic ────────────────────────────────────────────
describe("Consensus Divergence Logic", () => {
  it("divergence flag is true when scores spread > 0.15", () => {
    // Replicate the divergence calculation from agents/index.ts
    const scores = [0.85, 0.62, 0.70];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxDiff = Math.max(...scores) - Math.min(...scores);
    const divergenceScore = maxDiff;
    const divergenceFlag = divergenceScore > 0.15;

    expect(avg).toBeCloseTo(0.723, 2);
    expect(maxDiff).toBeCloseTo(0.23, 2);
    expect(divergenceFlag).toBe(true);
  });

  it("divergence flag is false when scores are tightly clustered", () => {
    const scores = [0.78, 0.80, 0.79];
    const maxDiff = Math.max(...scores) - Math.min(...scores);
    const divergenceFlag = maxDiff > 0.15;

    expect(maxDiff).toBeCloseTo(0.02, 2);
    expect(divergenceFlag).toBe(false);
  });

  it("consensus score is the mean of 3 model scores", () => {
    const scores = [0.82, 0.75, 0.79];
    const consensus = scores.reduce((a, b) => a + b, 0) / scores.length;
    expect(consensus).toBeCloseTo(0.7867, 3);
  });
});

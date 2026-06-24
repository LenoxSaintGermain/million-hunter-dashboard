/**
 * Sprint 6 Tests
 * - Scout: commercial asset CRUD + AI score procedure
 * - Sentinel: macro signals seed + list
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { commercialAssets, macroSignals } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── Scout ────────────────────────────────────────────────────────────────────
describe("Scout — commercial assets", () => {
  let assetId: number;
  const testName = `Sprint6 Test Retail Strip ${Date.now()}`;

  it("inserts a commercial asset and returns an id", async () => {
    const { createCommercialAsset } = await import("./db");
    const result = await createCommercialAsset({
      name: testName,
      address: "456 Test Ave",
      city: "Atlanta",
      state: "GA",
      propertyType: "retail",
      opportunityZone: true,
      tadDistrict: "Westside TAD",
      source: "manual",
    }) as any;
    assetId = result[0].insertId;
    expect(assetId).toBeGreaterThan(0);
  });

  it("retrieves the asset by id", async () => {
    const { getCommercialAssetById } = await import("./db");
    const asset = await getCommercialAssetById(assetId);
    expect(asset).toBeDefined();
    expect(asset!.name).toBe(testName);
    expect(asset!.opportunityZone).toBe(true);
    expect(asset!.tadDistrict).toBe("Westside TAD");
  });

  it("updates asset status", async () => {
    const { updateCommercialAssetStatus, getCommercialAssetById } = await import("./db");
    await updateCommercialAssetStatus(assetId, "reviewing");
    const updated = await getCommercialAssetById(assetId);
    expect(updated!.status).toBe("reviewing");
  });

  it("updates asset AI score", async () => {
    const { updateCommercialAssetAiScore, getCommercialAssetById } = await import("./db");
    await updateCommercialAssetAiScore(assetId, 0.812, "Strong OZ play with NNN anchor tenant potential");
    const updated = await getCommercialAssetById(assetId);
    expect(updated!.aiScore).toBeCloseTo(0.812, 2);
    expect(updated!.aiAnalysis).toContain("OZ play");
  });

  it("lists assets and includes the test asset", async () => {
    const { getCommercialAssets } = await import("./db");
    const list = await getCommercialAssets({ limit: 50 });
    const found = list.find((a) => a.id === assetId);
    expect(found).toBeDefined();
    expect(found!.propertyType).toBe("retail");
  });

  afterAll(async () => {
    const db = await getDb();
    if (db && assetId) await db.delete(commercialAssets).where(eq(commercialAssets.id, assetId));
  });
});

// ─── Sentinel ─────────────────────────────────────────────────────────────────
describe("Sentinel — macro signals", () => {
  it("getMacroSignals returns an array", async () => {
    const { getMacroSignals } = await import("./db");
    const signals = await getMacroSignals(5);
    expect(Array.isArray(signals)).toBe(true);
  });

  it("seedMacroSignals is idempotent (returns seeded:false if already seeded)", async () => {
    const { seedMacroSignals, getMacroSignals } = await import("./db");
    const before = await getMacroSignals(50);
    if (before.length > 0) {
      const result = await seedMacroSignals();
      expect(result.seeded).toBe(false);
    } else {
      const result = await seedMacroSignals();
      expect(result.seeded).toBe(true);
      expect((result as any).count).toBeGreaterThan(0);
    }
  });

  it("inserted signals have required fields", async () => {
    const { getMacroSignals } = await import("./db");
    const signals = await getMacroSignals(10);
    if (signals.length > 0) {
      const sig = signals[0];
      expect(sig.id).toBeGreaterThan(0);
      expect(typeof sig.title).toBe("string");
      expect(typeof sig.summary).toBe("string");
      expect(["institutional", "government", "seasonal", "event", "macro_momentum"]).toContain(sig.signalType);
      expect(sig.createdAt).toBeGreaterThan(0);
    }
  });

  it("insertMacroSignal creates a new signal", async () => {
    const { insertMacroSignal, getMacroSignals } = await import("./db");
    await insertMacroSignal({
      signalType: "event",
      title: "Sprint6 Test Signal",
      summary: "This is a test macro signal for Sprint 6 vitest coverage.",
      confidenceScore: 0.75,
      createdAt: Date.now(),
    });
    const signals = await getMacroSignals(50);
    const found = signals.find((s) => s.title === "Sprint6 Test Signal");
    expect(found).toBeDefined();
    expect(found!.confidenceScore).toBeCloseTo(0.75, 1);

    // cleanup
    const db = await getDb();
    if (db && found) await db.delete(macroSignals).where(eq(macroSignals.id, found.id));
  });
});

// ─── Scout UI: filter logic (pure unit tests) ─────────────────────────────────
describe("Scout filter logic", () => {
  const mockAssets = [
    { id: 1, name: "Westside Retail", city: "Atlanta", propertyType: "retail", opportunityZone: true, tadDistrict: "Westside TAD", capRate: 0.065, askingPrice: 1200000, status: "new", aiScore: null },
    { id: 2, name: "Midtown Office", city: "Atlanta", propertyType: "office", opportunityZone: false, tadDistrict: null, capRate: 0.055, askingPrice: 3500000, status: "qualified", aiScore: 0.82 },
    { id: 3, name: "Decatur Industrial", city: "Decatur", propertyType: "industrial", opportunityZone: true, tadDistrict: null, capRate: 0.08, askingPrice: 800000, status: "reviewing", aiScore: 0.71 },
  ];

  it("filters by OZ flag", () => {
    const filtered = mockAssets.filter((a) => a.opportunityZone);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((a) => a.id)).toContain(1);
    expect(filtered.map((a) => a.id)).toContain(3);
  });

  it("filters by TAD district presence", () => {
    const filtered = mockAssets.filter((a) => !!a.tadDistrict);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(1);
  });

  it("filters by property type", () => {
    const filtered = mockAssets.filter((a) => a.propertyType === "industrial");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("Decatur Industrial");
  });

  it("sorts by cap rate descending", () => {
    const sorted = [...mockAssets].sort((a, b) => (b.capRate ?? 0) - (a.capRate ?? 0));
    expect(sorted[0].id).toBe(3); // 8%
    expect(sorted[1].id).toBe(1); // 6.5%
    expect(sorted[2].id).toBe(2); // 5.5%
  });

  it("sorts by AI score descending, nulls last", () => {
    const sorted = [...mockAssets].sort((a, b) => (b.aiScore ?? -Infinity) - (a.aiScore ?? -Infinity));
    expect(sorted[0].id).toBe(2); // 0.82
    expect(sorted[1].id).toBe(3); // 0.71
    expect(sorted[2].id).toBe(1); // null → last
  });
});

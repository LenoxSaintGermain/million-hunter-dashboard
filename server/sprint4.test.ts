/**
 * Sprint 4 Tests
 * Covers:
 *  1. Deal deduplication — UNIQUE constraint on (name, source) + ON DUPLICATE KEY UPDATE
 *  2. OZ/TAD enrichment schema fields exist on deals table
 *  3. Consensus model config — read/write via model_configs table
 */
import { describe, it, expect, afterEach } from "vitest";
import { getDb, createDeal, getDealIdByNameSource, getAllModelConfigs, upsertModelConfig } from "./db";
import { deals } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

// ─── 1. Deal Deduplication ────────────────────────────────────────────────────
describe("Deal Deduplication", () => {
  const TEST_DEAL_NAME = `__test_dedup_${Date.now()}`;
  const TEST_SOURCE = "test_source";

  afterEach(async () => {
    const db = await getDb();
    if (db) {
      await db.delete(deals).where(
        and(eq(deals.name, TEST_DEAL_NAME))
      );
    }
  });

  it("creates a new deal when name+source is unique", async () => {
    const res = await createDeal({
      name: TEST_DEAL_NAME,
      source: TEST_SOURCE,
      stage: "new",
      industry: "Test",
      location: "Atlanta, GA",
      revenue: 1000000,
      cashFlow: 300000,
      askingPrice: 1200000,
      multiple: 4.0,
    }) as any;
    const insertId = res[0].insertId;
    expect(insertId).toBeGreaterThan(0);
  });

  it("getDealIdByNameSource returns existing deal ID", async () => {
    await createDeal({
      name: TEST_DEAL_NAME,
      source: TEST_SOURCE,
      stage: "new",
      revenue: 1000000,
      cashFlow: 300000,
      askingPrice: 1200000,
      multiple: 4.0,
    });

    const id = await getDealIdByNameSource(TEST_DEAL_NAME, TEST_SOURCE);
    expect(id).toBeGreaterThan(0);
  });

  it("ON DUPLICATE KEY UPDATE does not create a second row on re-insert", async () => {
    await createDeal({
      name: TEST_DEAL_NAME,
      source: TEST_SOURCE,
      stage: "new",
      revenue: 1000000,
      cashFlow: 300000,
      askingPrice: 1200000,
      multiple: 4.0,
    });

    // Re-insert same name+source with updated financials
    await createDeal({
      name: TEST_DEAL_NAME,
      source: TEST_SOURCE,
      stage: "qualified",
      revenue: 1200000,
      cashFlow: 400000,
      askingPrice: 1500000,
      multiple: 3.75,
    });

    const db = await getDb();
    const rows = await db!.select().from(deals).where(
      and(eq(deals.name, TEST_DEAL_NAME), eq(deals.source, TEST_SOURCE))
    );
    // Should still be exactly 1 row
    expect(rows.length).toBe(1);
    // Revenue should be updated to the latest value
    expect(rows[0].revenue).toBe(1200000);
  });
});

// ─── 2. OZ/TAD Schema Fields ─────────────────────────────────────────────────
describe("OZ/TAD Enrichment Schema", () => {
  const TEST_OZ_DEAL = `__test_oz_${Date.now()}`;

  afterEach(async () => {
    const db = await getDb();
    if (db) {
      await db.delete(deals).where(eq(deals.name, TEST_OZ_DEAL));
    }
  });

  it("deals table has OZ/TAD enrichment columns", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();

    // Insert a deal and set OZ fields via raw SQL
    await createDeal({
      name: TEST_OZ_DEAL,
      stage: "new",
      location: "Atlanta, GA",
      revenue: 2000000,
      cashFlow: 700000,
      askingPrice: 2500000,
      multiple: 3.5,
    });

    const id = await getDealIdByNameSource(TEST_OZ_DEAL, null);
    expect(id).toBeGreaterThan(0);

    // Write OZ fields using Drizzle sql template tag (avoids ? param syntax issues)
    await db!.execute(sql`UPDATE deals SET
        opportunity_zone = 1,
        oz_tract_id = '13121011900',
        tad_district = 'Westside TAD',
        oz_potential_gain = 500000,
        event_proximity_miles = 2.5,
        event_revenue_low = 50000,
        event_revenue_high = 100000
      WHERE id = ${id}`);

    // Read them back — Drizzle maps snake_case columns to camelCase
    const rows = await db!.select().from(deals).where(eq(deals.id, id!)).limit(1);
    const row = rows[0] as any;
    expect(row.opportunityZone).toBe(true);
    expect(row.ozTractId).toBe("13121011900");
    expect(row.tadDistrict).toBe("Westside TAD");
    expect(Number(row.ozPotentialGain)).toBe(500000);
    expect(Number(row.eventProximityMiles)).toBeCloseTo(2.5, 1);
  });
});

// ─── 3. Consensus Model Config ────────────────────────────────────────────────
describe("Consensus Model Config", () => {
  it("can write and read consensus model IDs from model_configs", async () => {
    // Write test values
    await upsertModelConfig("consensus_model_1" as any, "gemini-3.1-pro-preview", true);
    await upsertModelConfig("consensus_model_2" as any, "gemini-3.1-flash-lite", true);
    await upsertModelConfig("consensus_model_3" as any, "gemini-3.1-flash-lite", true);

    const configs = await getAllModelConfigs();
    const m1 = configs.find((c) => c.module === "consensus_model_1");
    const m2 = configs.find((c) => c.module === "consensus_model_2");
    const m3 = configs.find((c) => c.module === "consensus_model_3");

    expect(m1?.modelId).toBe("gemini-3.1-pro-preview");
    expect(m2?.modelId).toBe("gemini-3.1-flash-lite");
    expect(m3?.modelId).toBe("gemini-3.1-flash-lite");
  });

  it("consensus model IDs can be changed and persisted", async () => {
    await upsertModelConfig("consensus_model_1" as any, "gemini-3.1-flash-lite", true);
    const configs = await getAllModelConfigs();
    const m1 = configs.find((c) => c.module === "consensus_model_1");
    expect(m1?.modelId).toBe("gemini-3.1-flash-lite");

    // Reset to default
    await upsertModelConfig("consensus_model_1" as any, "gemini-3.1-pro-preview", true);
    const reset = await getAllModelConfigs();
    const m1Reset = reset.find((c) => c.module === "consensus_model_1");
    expect(m1Reset?.modelId).toBe("gemini-3.1-pro-preview");
  });
});

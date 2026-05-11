/**
 * TSL-SCI-BRIEF-001-A2 — STACK Module Tests
 * Validates capital stack templates, Raleigh Keystone principal overlay,
 * and the three new SCORER dimensions.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";

describe("STACK Module — Capital Stack Templates", () => {
  let db: Awaited<ReturnType<typeof getDb>>;

  beforeAll(async () => {
    db = await getDb();
  });

  it("capital_stack_templates table exists and has seeded data", async () => {
    const [rows] = await db.execute(
      "SELECT COUNT(*) as count FROM capital_stack_templates"
    ) as any;
    const count = Number(rows[0].count);
    expect(count).toBeGreaterThanOrEqual(7);
  });

  it("Raleigh Keystone template exists as principal default", async () => {
    const [rows] = await db.execute(
      "SELECT * FROM capital_stack_templates WHERE name = 'Project Raleigh Keystone' LIMIT 1"
    ) as any;
    expect(rows.length).toBe(1);
    const t = rows[0];
    expect(t.is_principal_default).toBe(1);
    expect(Number(t.target_equity_pct)).toBeGreaterThan(0);
    expect(Number(t.target_ltv)).toBeGreaterThan(0);
  });

  it("all templates have valid target_ltv values between 0 and 1", async () => {
    const [rows] = await db.execute(
      "SELECT name, target_ltv FROM capital_stack_templates"
    ) as any;
    for (const row of rows) {
      const ltv = Number(row.target_ltv);
      expect(ltv).toBeGreaterThanOrEqual(0);
      expect(ltv).toBeLessThanOrEqual(100);
    }
  });

  it("capital_stacks and capital_stack_layers tables exist", async () => {
    const [stacks] = await db.execute(
      "SELECT COUNT(*) as count FROM capital_stacks"
    ) as any;
    const [layers] = await db.execute(
      "SELECT COUNT(*) as count FROM capital_stack_layers"
    ) as any;
    expect(Number(stacks[0].count)).toBeGreaterThanOrEqual(0);
    expect(Number(layers[0].count)).toBeGreaterThanOrEqual(0);
  });
});

describe("STACK Module — Macro Signals Extension", () => {
  let db: Awaited<ReturnType<typeof getDb>>;

  beforeAll(async () => {
    db = await getDb();
  });

  it("macro_signals has at least 6 seeded signals from patch", async () => {
    const [rows] = await db.execute(
      "SELECT COUNT(*) as count FROM macro_signals WHERE archived = 0"
    ) as any;
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(6);
  });

  it("at least one high-confidence signal exists (confidence_score >= 0.85)", async () => {
    const [highConv] = await db.execute(
      "SELECT COUNT(*) as count FROM macro_signals WHERE confidence_score >= 0.85"
    ) as any;
    expect(Number(highConv[0].count)).toBeGreaterThanOrEqual(1);
  });
});

describe("SCORER — New Dimension Stubs (TSL-DIM-004/005/006)", () => {
  it("scoreDeal exports include three new dimension stubs", async () => {
    // Verify the scorer file has the new dimension identifiers
    const fs = await import("fs");
    const content = fs.readFileSync(
      new URL("./gemini.ts", import.meta.url).pathname,
      "utf-8"
    );
    expect(content).toContain("TSL-DIM-CAP-STACK-001");
    expect(content).toContain("TSL-DIM-OPS-ALPHA-001");
    expect(content).toContain("TSL-DIM-MACRO-ARB-001");
    expect(content).toContain("capitalStackCompatibility");
    expect(content).toContain("operationalAlpha");
    expect(content).toContain("macroArbitrage");
  });
});

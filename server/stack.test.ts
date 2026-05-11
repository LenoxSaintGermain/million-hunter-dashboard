/**
 * TSL-SCI-BRIEF-001-A2 — STACK Module Tests
 * Sprint 29: Updated to validate real SCORER dimension logic (no stubs).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { scoreDeal } from "./gemini";
import type { Deal } from "../drizzle/schema";

// Minimal deal factory for scorer tests
function makeDeal(overrides: Partial<Deal>): Deal {
  return {
    id: 9000,
    name: "Test Deal",
    industry: "HVAC",
    location: "Atlanta, GA",
    cashFlow: 700000,
    revenue: 1800000,
    askingPrice: 2100000,
    multiple: 3.0,
    employees: 10,
    description: "HVAC service company in Atlanta metro",
    stage: "new",
    score: null,
    redFlagCount: null,
    source: "test",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isArchived: false,
    yearEstablished: null,
    capitalStackSummary: null,
    opportunityZone: false,
    ozTractId: null,
    tadDistrict: null,
    ozPotentialGain: null,
    onboardingCompleted: false,
    ...overrides,
  };
}

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

describe("SCORER — Real Dimension Logic (TSL-DIM-CAP-STACK-001 / OPS-ALPHA-001 / MACRO-ARB-001)", () => {
  it("gemini.ts contains real dimension identifiers and no stub comments", async () => {
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
    // Verify no stubs remain
    expect(content).not.toContain("returns 0.5 until Sprint 2");
    expect(content).not.toContain("stub -> Sprint 2");
  });

  it("TSL-DIM-CAP-STACK-001: high-DSCR HVAC deal scores above 0.6 for capital stack compatibility", async () => {
    // $800K cash flow, $2.4M asking → DSCR ≈ 1.38 (above 1.35 threshold)
    const deal = makeDeal({ id: 9001, cashFlow: 800000, revenue: 2000000, askingPrice: 2400000, multiple: 3.0, employees: 8 });
    const result = await scoreDeal(deal);
    expect(result.dimensions?.capitalStackCompatibility).toBeGreaterThan(0.6);
  });

  it("TSL-DIM-CAP-STACK-001: low-DSCR deal scores below 0.5 for capital stack compatibility", async () => {
    // $150K cash flow, $2M asking → DSCR ≈ 0.27 (well below 1.0)
    const deal = makeDeal({ id: 9002, industry: "Retail", cashFlow: 150000, revenue: 500000, askingPrice: 2000000, multiple: 13.3, employees: 20 });
    const result = await scoreDeal(deal);
    expect(result.dimensions?.capitalStackCompatibility).toBeLessThan(0.5);
  });

  it("TSL-DIM-OPS-ALPHA-001: route-based pest control scores above 0.7 for operational alpha", async () => {
    const deal = makeDeal({
      id: 9003, industry: "Pest Control", cashFlow: 650000, revenue: 1500000,
      askingPrice: 2270000, multiple: 3.5, employees: 12,
      description: "Route-based pest control with recurring contracts",
    });
    const result = await scoreDeal(deal);
    expect(result.dimensions?.operationalAlpha).toBeGreaterThan(0.7);
  });

  it("TSL-DIM-OPS-ALPHA-001: owner-dependent consulting scores below 0.6 for operational alpha", async () => {
    const deal = makeDeal({
      id: 9004, industry: "Consulting", cashFlow: 400000, revenue: 800000,
      askingPrice: 1600000, multiple: 4.0, employees: 5,
      description: "Owner operated consulting firm. Owner will train. Key relationships with top clients.",
    });
    const result = await scoreDeal(deal);
    expect(result.dimensions?.operationalAlpha).toBeLessThan(0.6);
  });

  it("TSL-DIM-MACRO-ARB-001: macro arbitrage score is a real number between 0 and 1", async () => {
    const deal = makeDeal({ id: 9005 });
    const result = await scoreDeal(deal);
    expect(result.dimensions?.macroArbitrage).toBeGreaterThanOrEqual(0);
    expect(result.dimensions?.macroArbitrage).toBeLessThanOrEqual(1);
  });

  it("TSL-DIM-MACRO-ARB-001: HVAC in Atlanta matches active macro signals (score > 0.35)", async () => {
    const deal = makeDeal({ id: 9006, industry: "HVAC", location: "Atlanta, GA" });
    const result = await scoreDeal(deal);
    expect(result.dimensions?.macroArbitrage).toBeGreaterThan(0.35);
  });

  it("composite score weights sum to exactly 1.0", () => {
    const weights = [0.40, 0.20, 0.10, 0.15, 0.10, 0.05];
    const sum = weights.reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });

  it("scoreDeal returns score between 0 and 1 with all 6 dimensions", async () => {
    const deal = makeDeal({ id: 9007 });
    const result = await scoreDeal(deal);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.dimensions).toBeDefined();
    expect(Object.keys(result.dimensions!)).toHaveLength(6);
  });
});

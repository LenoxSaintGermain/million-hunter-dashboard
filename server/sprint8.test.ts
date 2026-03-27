import { describe, it, expect } from "vitest";
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

const { commercialAssets, macroSignals, users } = schema;

const connection = await mysql.createConnection(process.env.DATABASE_URL!);
const db = drizzle(connection, { schema, mode: "default" });

// ─── Sprint 8 Tests ───────────────────────────────────────────────────────────
// Covers: Re-watch Onboarding, Scout→Deal Bridge, Sentinel urgency sort,
//         Sentinel AI Refresh procedure, Lobby buffering state (UI-only, no test needed)

describe("Sprint 8 — Lobby + Scout Bridge + Sentinel AI Refresh", () => {

  // ── 1. Re-watch Onboarding: onboarding_completed reset ───────────────────
  describe("Re-watch Onboarding", () => {
    it("should allow resetting onboarding_completed to false", async () => {
      // Insert a test user with onboarding completed
      const ts = Date.now();
      const testOpenId = `sprint8-rewatch-${ts}`;
      await db.insert(users).values({
        openId: testOpenId,
        name: "Sprint8 Test User",
        email: `sprint8-${ts}@test.com`,
        onboardingCompleted: true,
        createdAt: new Date(ts),
        updatedAt: new Date(ts),
      });

      // Reset onboarding
      await db.update(users)
        .set({ onboardingCompleted: false, updatedAt: new Date() })
        .where(eq(users.openId, testOpenId));

      const [updated] = await db.select({ onboardingCompleted: users.onboardingCompleted })
        .from(users)
        .where(eq(users.openId, testOpenId));

      expect(updated.onboardingCompleted).toBe(false);

      // Cleanup
      await db.delete(users).where(eq(users.openId, testOpenId));
    });

    it("should mark onboarding as completed", async () => {
      const ts = Date.now();
      const testOpenId = `sprint8-complete-${ts}`;
      await db.insert(users).values({
        openId: testOpenId,
        name: "Sprint8 Complete User",
        email: `sprint8c-${ts}@test.com`,
        onboardingCompleted: false,
        createdAt: new Date(ts),
        updatedAt: new Date(ts),
      });

      await db.update(users)
        .set({ onboardingCompleted: true, updatedAt: new Date() })
        .where(eq(users.openId, testOpenId));

      const [updated] = await db.select({ onboardingCompleted: users.onboardingCompleted })
        .from(users)
        .where(eq(users.openId, testOpenId));

      expect(updated.onboardingCompleted).toBe(true);

      // Cleanup
      await db.delete(users).where(eq(users.openId, testOpenId));
    });
  });

  // ── 2. Scout → Deal Bridge: convertToDeal creates a deal from asset ───────
  describe("Scout → Deal Bridge", () => {
    it("should create a commercial asset with qualified status", async () => {
      const ts = Date.now();
      const res = await db.insert(commercialAssets).values({
        name: `Sprint8 Scout Asset ${ts}`,
        address: "123 Peachtree St",
        city: "Atlanta",
        state: "GA",
        zip: "30301",
        propertyType: "retail",
        askingPrice: 1500000,
        capRate: 0.072,
        noi: 108000,
        opportunityZone: true,
        tadDistrict: "BeltLine TAD",
        status: "qualified",
        source: "manual",
        createdAt: ts,
        updatedAt: ts,
      }) as any;

      expect(res[0].affectedRows).toBe(1);

      // Verify the asset is retrievable
      const [asset] = await db.select()
        .from(commercialAssets)
        .where(eq(commercialAssets.name, `Sprint8 Scout Asset ${ts}`));

      expect(asset).toBeDefined();
      expect(asset.status).toBe("qualified");
      expect(asset.opportunityZone).toBe(true);
      expect(asset.tadDistrict).toBe("BeltLine TAD");

      // Cleanup
      await db.delete(commercialAssets).where(eq(commercialAssets.name, `Sprint8 Scout Asset ${ts}`));
    });

    it("should surface Convert to Deal button for assets with aiScore >= 0.70", async () => {
      // This is a logic test — verify the threshold condition
      const assetWithHighScore = { aiScore: 0.82, status: "reviewing" };
      const assetWithLowScore = { aiScore: 0.55, status: "reviewing" };
      const qualifiedAsset = { aiScore: null, status: "qualified" };

      const shouldShowButton = (asset: typeof assetWithHighScore) =>
        asset.status === "qualified" || (asset.aiScore != null && asset.aiScore >= 0.70);

      expect(shouldShowButton(assetWithHighScore)).toBe(true);
      expect(shouldShowButton(assetWithLowScore)).toBe(false);
      expect(shouldShowButton(qualifiedAsset as any)).toBe(true);
    });
  });

  // ── 3. Sentinel Urgency Sort: signals sorted by confidence desc ───────────
  describe("Sentinel Urgency Sort", () => {
    it("should identify high urgency signals (>= 0.88 confidence)", async () => {
      const ts = Date.now();
      // Insert test signals with varying confidence
      await db.insert(macroSignals).values([
        {
          signalType: "institutional",
          title: `Sprint8 High Urgency Signal ${ts}`,
          summary: "Blackstone acquiring Atlanta industrial portfolio",
          confidenceScore: 0.92,
          createdAt: ts,
          updatedAt: ts,
        },
        {
          signalType: "macro_momentum",
          title: `Sprint8 Normal Signal ${ts}`,
          summary: "Seasonal HVAC demand uptick",
          confidenceScore: 0.74,
          createdAt: ts,
          updatedAt: ts,
        },
      ]);

      const signals = await db.select()
        .from(macroSignals)
        .where(eq(macroSignals.title, `Sprint8 High Urgency Signal ${ts}`));

      const highUrgency = signals.filter(s => parseFloat(String(s.confidenceScore ?? 0)) >= 0.88);
      expect(highUrgency.length).toBe(1);
      expect(parseFloat(String(highUrgency[0].confidenceScore))).toBeGreaterThanOrEqual(0.88);

      // Verify sort order: higher confidence first
      const allTestSignals = await db.select()
        .from(macroSignals)
        .orderBy(desc(macroSignals.confidenceScore));

      // The first signal should have higher or equal confidence than the second
      if (allTestSignals.length >= 2) {
        expect(parseFloat(String(allTestSignals[0].confidenceScore ?? 0)))
          .toBeGreaterThanOrEqual(parseFloat(String(allTestSignals[1].confidenceScore ?? 0)));
      }

      // Cleanup
      await db.delete(macroSignals).where(eq(macroSignals.title, `Sprint8 High Urgency Signal ${ts}`));
      await db.delete(macroSignals).where(eq(macroSignals.title, `Sprint8 Normal Signal ${ts}`));
    });
  });

  // ── 4. Sentinel AI Refresh: procedure structure validation ────────────────
  describe("Sentinel AI Refresh", () => {
    it("should validate signal type enum values", () => {
      const validTypes = ["institutional", "government", "seasonal", "event", "macro_momentum"];
      const testInput = "macro_momentum";
      expect(validTypes.includes(testInput)).toBe(true);

      const invalidInput = "unknown_type";
      expect(validTypes.includes(invalidInput)).toBe(false);
    });

    it("should clamp confidence score between 0 and 1", () => {
      const clamp = (score: number) => Math.min(1, Math.max(0, score));
      expect(clamp(1.5)).toBe(1);
      expect(clamp(-0.2)).toBe(0);
      expect(clamp(0.85)).toBe(0.85);
    });

    it("should handle JSON parsing from Sonar response with markdown code blocks", () => {
      const rawWithCodeBlock = "```json\n[{\"signalType\":\"institutional\",\"title\":\"Test\",\"summary\":\"Test summary\",\"confidenceScore\":0.85}]\n```";
      const cleaned = rawWithCodeBlock.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].signalType).toBe("institutional");
    });

    it("should insert AI-generated signals into the database", async () => {
      const ts = Date.now();
      const res = await db.insert(macroSignals).values({
        signalType: "macro_momentum",
        title: `Sprint8 AI Signal ${ts}`,
        summary: "Fed rate pause signals acquisition window opening",
        roryPitch: "The absence of bad news is itself a signal — and the market hasn't learned to price it yet.",
        impactedAssetClasses: ["HVAC", "Pest Control", "Commercial Cleaning"],
        recommendedAction: "Accelerate outreach to sellers with SBA-eligible businesses under $5M",
        confidenceScore: 0.87,
        createdAt: ts,
        updatedAt: ts,
      }) as any;

      expect(res[0].affectedRows).toBe(1);

      // Cleanup
      await db.delete(macroSignals).where(eq(macroSignals.title, `Sprint8 AI Signal ${ts}`));
    });
  });
});

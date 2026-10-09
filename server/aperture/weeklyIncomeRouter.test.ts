import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screenAccountGate, takeScreenSlot, weeklyIncomeRouter, WI_P1_MIN_OPTIONS_LEVEL } from "./weeklyIncomeRouter";
import { passesWeeklyIncomeLanguage } from "../../shared/weeklyIncome/copy";

describe("Weekly Income screen endpoint (#84)", () => {
  it("is read-only: one query, no mutation, and no order path imported", () => {
    const procedures = (weeklyIncomeRouter as any)._def.procedures as Record<string, any>;
    expect(Object.keys(procedures)).toEqual(["screen"]);
    for (const procedure of Object.values(procedures)) expect(procedure._def.type).toBe("query");
    const source = readFileSync(join(__dirname, "weeklyIncomeRouter.ts"), "utf8") + readFileSync(join(__dirname, "weeklyIncomeScreen.ts"), "utf8") + readFileSync(join(__dirname, "weeklyIncomeEventData.ts"), "utf8");
    expect(source).not.toMatch(/submitOrder|orderFlow|proposedOrders|insert\(|\.update\(|\.delete\(/);
  });

  it("refuses non-paper accounts, unknown options level, and level below 3", () => {
    expect(screenAccountGate({ isPaper: false, optionsTradingLevel: 3 })?.code).toBe("not_paper");
    expect(screenAccountGate({ isPaper: true, optionsTradingLevel: null })?.code).toBe("options_level_unknown");
    expect(screenAccountGate({ isPaper: true, optionsTradingLevel: WI_P1_MIN_OPTIONS_LEVEL - 1 })?.code).toBe("options_level");
    expect(screenAccountGate({ isPaper: true, optionsTradingLevel: WI_P1_MIN_OPTIONS_LEVEL })).toBeNull();
    for (const refusal of [screenAccountGate({ isPaper: false, optionsTradingLevel: 3 }), screenAccountGate({ isPaper: true, optionsTradingLevel: 2 })]) {
      expect(passesWeeklyIncomeLanguage(refusal!.plain)).toBe(true);
    }
  });

  it("rate-limits per user in memory", () => {
    const store = new Map<number, number[]>();
    const now = 1_000_000;
    for (let i = 0; i < 6; i++) expect(takeScreenSlot(7, now + i, store)).toBe(true);
    expect(takeScreenSlot(7, now + 10, store)).toBe(false);
    expect(takeScreenSlot(8, now + 10, store)).toBe(true);
    expect(takeScreenSlot(7, now + 10 * 60_000 + 1, store)).toBe(true);
  });
});

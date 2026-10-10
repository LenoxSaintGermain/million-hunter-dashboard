import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WEEKLY_INCOME_THESIS_PREFILL } from "../strategyTemplates/weeklyIncome";
import { PROHIBITED_LANGUAGE } from "../disclosure";

describe("Weekly Income template scope (UAT retest)", () => {
  it("seeks only put credit spreads while only those are supported", () => {
    const seeks = WEEKLY_INCOME_THESIS_PREFILL.details.seeks;
    expect(seeks).toContain("Put credit spreads only");
    expect(seeks).not.toMatch(/cash-secured|covered call/i);
    expect(WEEKLY_INCOME_THESIS_PREFILL.statement).not.toMatch(/cash-secured|covered call/i);
  });
  it("says research only on the card before the template is applied", () => {
    const panel = readFileSync("client/src/components/aperture/weeklyIncome/WeeklyIncomeTemplatePanel.tsx", "utf8");
    const picker = panel.slice(panel.indexOf("export function WeeklyIncomeTemplatePicker"), panel.indexOf("function rangeLabel"));
    expect(picker).toContain("Research only");
    expect(picker).toContain('WI_COPY["wi.halt"]');
  });
  it("prefill copy passes the prohibited-language check", () => {
    const text = `${WEEKLY_INCOME_THESIS_PREFILL.statement} ${Object.values(WEEKLY_INCOME_THESIS_PREFILL.details).join(" ")}`;
    expect(PROHIBITED_LANGUAGE.test(text)).toBe(false);
  });
});

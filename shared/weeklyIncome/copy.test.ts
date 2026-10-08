import { describe, expect, it } from "vitest";
import { PROHIBITED_LANGUAGE } from "../disclosure";
import { INCOME_HYPE_LANGUAGE, WI_COPY, WI_GLOSSARY, passesWeeklyIncomeLanguage, wiCopy, wiCopyPlaceholders, type WiCopyKey } from "./copy";
import { WI_EXAMPLE_SPREAD, buildGuidedSpreadExplainer } from "./guided";

const keys = Object.keys(WI_COPY) as WiCopyKey[];

describe("Weekly Income copy library (#87)", () => {
  it("every wi.* string passes PROHIBITED_LANGUAGE and INCOME_HYPE_LANGUAGE", () => {
    for (const key of keys) {
      expect(key.startsWith("wi.")).toBe(true);
      expect(WI_COPY[key], key).not.toMatch(PROHIBITED_LANGUAGE);
      expect(WI_COPY[key], key).not.toMatch(INCOME_HYPE_LANGUAGE);
    }
    for (const entry of WI_GLOSSARY) {
      expect(passesWeeklyIncomeLanguage(`${entry.term} ${entry.plain}`), entry.term).toBe(true);
    }
  });

  it("the hype regex catches the words it exists for, and not ordinary ones", () => {
    for (const bad of ["a weekly paycheck", "Guaranteed income", "risk-free", "risk free", "passive income", "a safe trade", "pay check"]) expect(bad).toMatch(INCOME_HYPE_LANGUAGE);
    for (const ok of ["safety rules", "the floor caps the loss", "secured cash", "check again"]) expect(ok).not.toMatch(INCOME_HYPE_LANGUAGE);
  });

  it("never states or implies a return target", () => {
    for (const key of keys) expect(WI_COPY[key], key).not.toMatch(/\b(you will (earn|make)|expected return of|earn \d|make \d+%|per week return)\b/i);
  });

  it("interpolates every placeholder and refuses a half-filled sentence", () => {
    for (const key of keys) {
      const vars = Object.fromEntries(wiCopyPlaceholders(key).map((name) => [name, `<${name}>`]));
      expect(wiCopy(key, vars)).not.toMatch(/\{\w+\}/);
    }
    expect(() => wiCopy("wi.play.p1", { symbol: "XYZ" })).toThrow(/Missing copy variable/);
  });

  it("explains every trading term Guided mode shows in one plain line", () => {
    for (const entry of WI_GLOSSARY) {
      expect(entry.plain.length).toBeLessThanOrEqual(170);
      expect(entry.plain.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(2);
    }
    const terms = WI_GLOSSARY.map((entry) => entry.term.toLowerCase());
    for (const required of ["put credit spread", "strike price", "expiration", "premium (credit)", "maximum loss", "collateral", "assignment", "delta"]) expect(terms).toContain(required);
  });

  it("states the 6% arithmetic correctly", () => {
    expect(1.06 ** 52).toBeCloseTo(20.7, 1);
    expect(WI_COPY["wi.math.sixPercent"]).toContain("20.7 times");
  });
});

describe("Guided put credit spread explainer", () => {
  it("renders the thesis's worked example in dollars, labelled as an example", () => {
    const explainer = buildGuidedSpreadExplainer(WI_EXAMPLE_SPREAD);
    if ("error" in explainer) throw new Error(explainer.error);
    expect(explainer.isExample).toBe(true);
    expect(explainer.maxLossCents).toBe(41_000);
    expect(explainer.maxLoss).toBe("Most you can lose: $410");
    expect(explainer.summary).toBe("You get paid $100 now for agreeing to buy XYZ at $95 if it falls that far by Friday (7 days out). You also pay for a floor at $90, so the most you can lose is $410.");
    expect(explainer.maxLossDetail).toContain("$400 from the spread itself plus a $10 allowance");
    expect(explainer.breakeven).toContain("below $94");
    expect(explainer.whatCanGoWrong).toBe("What can go wrong: if XYZ drops below $90, you lose the full $410. One full loss erases about 8 trades that each kept $50.");
    expect(explainer.plan).toBe("The plan closes it early, whichever comes first: once you've kept $50, once the loss reaches about $100, or by Thursday 3:30 PM ET.");
    expect(explainer.proPlan).toBe("Plan to close at $0.50 (half the credit kept), at $2 (a loss of about one credit), or by Thursday 3:30 PM ET, whichever comes first.");
    expect(explainer.gapRisk).toContain("bigger than the planned $100");
    for (const text of [explainer.summary, explainer.keep, explainer.whatCanGoWrong, explainer.gapRisk, ...explainer.rows.flatMap((row) => [row.label, row.plain])]) {
      expect(passesWeeklyIncomeLanguage(text), text).toBe(true);
    }
  });

  it("refuses an impossible spread instead of explaining it", () => {
    expect(buildGuidedSpreadExplainer({ ...WI_EXAMPLE_SPREAD, credit: 5 })).toEqual({ error: "The credit must be smaller than the distance between the strikes." });
  });
});

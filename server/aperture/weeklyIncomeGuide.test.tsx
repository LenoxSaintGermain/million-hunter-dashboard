import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SixPercentNote, WeeklyIncomeIntro, WeeklyIncomeSpreadExplainer } from "../../client/src/components/aperture/weeklyIncome/WeeklyIncomeGuide";
import { WI_EXAMPLE_SPREAD, buildGuidedSpreadExplainer } from "../../shared/weeklyIncome/guided";
import { passesWeeklyIncomeLanguage } from "../../shared/weeklyIncome/copy";

/** #87 / #82: Guided mode explains the play in plain words, in dollars, with the downside stated. */
describe("Weekly Income Guided explainer", () => {
  beforeAll(() => { (globalThis as any).React = React; });
  afterAll(() => { delete (globalThis as any).React; });
  const explainer = buildGuidedSpreadExplainer(WI_EXAMPLE_SPREAD);
  if ("error" in explainer) throw new Error(explainer.error);

  it("labels example numbers, shows the most you can lose in dollars, and says what can go wrong", () => {
    const $ = load(renderToStaticMarkup(<WeeklyIncomeSpreadExplainer explainer={explainer} />));
    expect($("[data-example-data]").text()).toBe("Example data");
    expect($("[data-wi-max-loss]").text()).toContain("$410");
    expect($("[data-wi-what-can-go-wrong]").text()).toMatch(/^What can go wrong: if XYZ drops below \$90, you lose the full \$410\./);
    expect($("[data-wi-fidelity]").text()).toContain("Dividends and early assignment aren't simulated");
    expect(passesWeeklyIncomeLanguage($.root().text())).toBe(true);
  });

  it("omits the example badge for measured numbers", () => {
    const measured = buildGuidedSpreadExplainer({ ...WI_EXAMPLE_SPREAD, isExample: false });
    if ("error" in measured) throw new Error(measured.error);
    const $ = load(renderToStaticMarkup(<WeeklyIncomeSpreadExplainer explainer={measured} />));
    expect($("[data-example-data]")).toHaveLength(0);
  });

  it("intro and six-percent note pass the language rules and promise nothing", () => {
    const text = load(renderToStaticMarkup(<><WeeklyIncomeIntro /><SixPercentNote /></>)).root().text();
    expect(text).toContain("floor");
    expect(text).toContain("doesn't aim for a return");
    expect(passesWeeklyIncomeLanguage(text)).toBe(true);
  });
});

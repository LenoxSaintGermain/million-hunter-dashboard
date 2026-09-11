import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PlayAndReturn } from "../../client/src/components/aperture/PlayAndReturn";

const play = {
  symbol: "MYRG", expression: "Shares", horizon: "5–15 sessions",
  entryCondition: "holds above $285.17", invalidation: "below $280.53", target: "$292.15",
};
const terms = {
  quantity: 17, entryCents: 28_517, stopCents: 28_053,
  targets: [{ label: "1.5R target", priceCents: 29_215 }, { label: "2.5R target", priceCents: 29_680 }],
};
const render = (over: any = {}) => load(renderToStaticMarkup(
  React.createElement(PlayAndReturn, { play, terms: { ...terms, ...over } })));

describe("the decision presents two surfaces and nothing else", () => {
  beforeAll(() => vi.stubGlobal("React", React));
  afterAll(() => vi.unstubAllGlobals());

  it("renders exactly one play side and one return side", () => {
    const $ = render();
    expect($("[data-side='play']")).toHaveLength(1);
    expect($("[data-side='return']")).toHaveLength(1);
  });

  it("answers the play questions: what, when, what stops me, how long", () => {
    const text = render()("[data-side='play']").text();
    for (const expected of ["MYRG", "holds above $285.17", "below $280.53", "$292.15", "5–15 sessions"]) {
      expect(text).toContain(expected);
    }
  });

  it("answers the return questions in money and percent, not jargon", () => {
    const text = render()("[data-side='return']").text();
    expect(text).toContain("$4,847.89");     // deployed
    expect(text).toContain("−$78.88");       // at risk
    expect(text).toContain("+$118.66");      // 1.5R
    expect(text).toContain("+2.4%");
    expect(text).toContain("+$197.71");      // 2.5R
    expect(text).toContain("1.5R");
  });

  it("assigns no probability and promises no outcome", () => {
    const text = render().text();
    expect(text).toContain("No probability is assigned");
    expect(text).not.toMatch(/base case|strong case|expected value|probability-weighted|likely/i);
    expect(text).not.toMatch(/\bguaranteed\b/i);
  });

  it("offers both sides as tabs so mobile does not squeeze them into columns", () => {
    const $ = render();
    expect($("[role='tab']")).toHaveLength(2);
    expect($("[role='tab'][aria-selected='true']")).toHaveLength(1);
  });

  it("says what is missing instead of printing a number it cannot support", () => {
    const text = render({ quantity: null })("[data-side='return']").text();
    expect(text).toContain("Not measured");
    expect(text).toContain("quantity");
    expect(text).not.toMatch(/\$0\b/);
  });

  it("still states downside when no target is recorded", () => {
    const text = render({ targets: [] })("[data-side='return']").text();
    expect(text).toContain("−$78.88");
    expect(text).not.toContain("If it reaches");
  });
});

import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CockpitHeadroomLine } from "../../shared/cockpitRailSummary";
import { ConstraintResolverCard } from "../../client/src/components/aperture/ConstraintResolverCard";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

const line = (overrides: Partial<CockpitHeadroomLine> = {}): CockpitHeadroomLine => ({
  key: "position", label: "Largest single name", subject: "MSFT", usedCents: 1_200_000, ceilingCents: 1_001_900,
  remainingCents: 0, usedPct: 119.8, ceilingPct: 10, basis: "market value of the largest held position", reason: null, ...overrides,
});
const render = (props: Partial<React.ComponentProps<typeof ConstraintResolverCard>>) =>
  load(renderToStaticMarkup(React.createElement(ConstraintResolverCard, { line: null, ...props })));

describe("ConstraintResolverCard uses measured data only", () => {
  it("ships no hard-coded example symbol, amount or limit", () => {
    const source = readFileSync("client/src/components/aperture/ConstraintResolverCard.tsx", "utf8");
    expect(source).not.toMatch(/NVDA|1_065_800|1_004_500|10_658|100_000_00|15%/);
  });

  it("shows an honest empty state when the limit is not measured", () => {
    for (const missing of [null, undefined, line({ usedCents: null, ceilingCents: null }), line({ ceilingCents: 0 })]) {
      const $ = render({ line: missing });
      expect($("[role='status']").text()).toContain("This limit is not measured yet");
      expect($("button")).toHaveLength(0);
      expect($.text()).not.toMatch(/\$\d/);
    }
  });

  it("renders the measured holding, ceiling and exact excess", () => {
    const $ = render({ line: line() });
    const text = $.text();
    expect(text).toContain("MSFT uses $12,000 of its $10,019 ceiling (largest single name · 10% of account)");
    expect(text).toContain("120% of ceiling");
    expect(text).toContain("trimming at least $1,981 returns it under the ceiling");
    expect(text).toContain("[Opens the position · nothing is sold]");
    expect(text).not.toContain("NVDA");
    expect(text).not.toContain("Increase single-stock limit");
    expect($("button")).toHaveLength(1);
  });

  it("offers no position review for account-wide limits without a holding", () => {
    const $ = render({ line: line({ key: "daily_new_notional", label: "New notional today", subject: null }) });
    expect($.text()).toContain("New notional today uses $12,000");
    expect($("button")).toHaveLength(0);
  });

  it("shows a limits action only when the caller provides one", () => {
    expect(render({ line: line(), onAdjustSettings: vi.fn() })("button").last().text()).toContain("Review account limits");
  });
});

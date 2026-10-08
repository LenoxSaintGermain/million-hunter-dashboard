import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PORTRAIT_JUMPS, PortfolioPortrait } from "../../client/src/components/aperture/PortfolioPortrait";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

const account = { label: "Alpaca Paper", equityValueCents: 100_000_00, cashCents: 1_000_00, buyingPowerCents: 2_000_00, lastSyncedAt: Date.UTC(2026, 9, 7, 13), isPaper: true };
const render = (previewOnly = false) => load(renderToStaticMarkup(
  <PortfolioPortrait loading={false} failed={false} previewOnly={previewOnly} account={account} thesis={null} binding={null} now={Date.UTC(2026, 9, 7, 14)}
    holdings={[{ symbol: "MSFT", marketValueCents: 12_000_00, priceAsOf: Date.UTC(2026, 9, 7, 13) }]} />));

describe("account portrait jump row", () => {
  it("offers Positions · Orders & open plays · Limits, in that order, right under the header", () => {
    const $ = render();
    const nav = $("nav[aria-label='Jump to positions, orders or limits']");
    expect(nav).toHaveLength(1);
    expect(nav.prev().is("header")).toBe(true);
    expect(nav.find("a").map((_, el) => `${$(el).text()} ${$(el).attr("href")}`).get()).toEqual([
      "Positions #portrait-positions",
      "Orders & open plays /aperture/plays",
      "Limits #portrait-limits",
    ]);
    expect(nav.text()).toBe("Positions·Orders & open plays·Limits");
  });

  it("links only to existing sections and routes — every in-page anchor has a target, no new page", () => {
    const $ = render();
    for (const jump of PORTRAIT_JUMPS.filter(item => item.href.startsWith("#"))) expect($(jump.href)).toHaveLength(1);
    expect($("#portrait-positions").text()).toContain("01 / Exposure");
    expect($("#portrait-limits").text()).toContain("03 / Room for the next move");
    const app = readFileSync(new URL("../../client/src/App.tsx", import.meta.url), "utf8");
    expect(app).toContain('"/aperture/plays"');
  });

  it("is hidden in the frozen preview, like the portrait's other links", () => {
    expect(render(true)("nav[aria-label='Jump to positions, orders or limits']")).toHaveLength(0);
  });
});

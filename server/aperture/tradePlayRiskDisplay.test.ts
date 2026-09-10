import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, describe, expect, it, vi } from "vitest";
import { TradePlayCard } from "../../client/src/components/aperture/TradePlayCard";
import type { TradePlayBlueprint } from "../../shared/playUnderwriting";
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());

function view(kind: "shares" | "long_call", basis: "insufficient_data" | "scenario_modeled", risk: number) {
  const play = { title: "Illustrative play", instrument: { kind }, playClass: "pullback", horizon: "swing",
    status: "research_required", trigger: { status: "unknown", description: "Verify entry" },
    invalidation: { description: "Verify the recorded invalidation" }, warnings: [], scoring: { overall: 50 },
    sizing: { plannedRiskCents: risk, maxLossCents: risk, percentCapitalAtRisk: risk / 10000 },
    outcome: { basis, downsideCents: -risk, expectedBaseCents: null, expectedHighCents: null },
  } as TradePlayBlueprint;
  return load(renderToStaticMarkup(React.createElement(TradePlayCard, { rank: 1, play, thesis: null,
    portfolioRiskBeforeCents: 5000, maxOpenRiskCents: 10000, selected: false, busy: false, onValidate: vi.fn() }))).text();
}
describe("research play risk disclosure", () => {
  it("allows the primary action label to wrap at enlarged text sizes", () => {
    const tree = TradePlayCard({ rank: 1, play: { title: "Illustrative", instrument: { kind: "shares" }, playClass: "pullback", horizon: "swing",
      status: "research_required", trigger: { status: "unknown", description: "Verify" }, invalidation: { description: "Verify" },
      warnings: [], scoring: { overall: 50 }, sizing: { plannedRiskCents: 0 }, outcome: { basis: "insufficient_data" } } as TradePlayBlueprint,
      thesis: null, portfolioRiskBeforeCents: 0, maxOpenRiskCents: 100, selected: false, busy: false, onValidate: vi.fn() });
    const html = load(renderToStaticMarkup(tree));
    expect(html('button').attr('class')).toContain('whitespace-normal');
    expect(html('button span').text()).toBe('Validate this play');
  });
  it("does not present missing share sizing as zero loss or zero portfolio impact", () => {
    const text = view("shares", "insufficient_data", 0);
    expect(text).toContain("Not measured");
    expect(text).toContain("Portfolio impact not measured");
    expect(text).not.toContain("$0");
    expect(text).not.toContain("0% of declared capital");
    expect(text).not.toContain("→");
  });
  it("keeps an options budget distinct from measured contract loss", () => {
    const text = view("long_call", "insufficient_data", 1500);
    expect(text).toContain("Planned risk ceiling");
    expect(text).toContain("$15");
    expect(text).toContain("Portfolio impact not measured");
    expect(text).not.toContain("Bounded contract loss");
  });
  it("preserves measured stop scenarios and their execution uncertainty", () => {
    const text = view("shares", "scenario_modeled", 1500);
    expect(text).toContain("Planned loss at the modeled stop");
    expect(text).toContain("$15");
    expect(text).toContain("Stop execution can differ from the modeled price.");
    expect(text).toContain("→");
  });
});

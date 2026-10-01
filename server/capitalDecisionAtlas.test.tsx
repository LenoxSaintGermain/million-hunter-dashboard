import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { atlasCount, CapitalDecisionAtlas, capitalDecisionAtlasFixture, researchAtlasCounts } from "../client/src/components/aperture/CapitalDecisionAtlas";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
describe("Capital decision atlas", () => {
  it("keeps critical attention and recovery above chart filters and discloses only supporting snapshots", () => {
    const source = readFileSync(new URL("../client/src/pages/aperture/AperturePlayDesk.tsx", import.meta.url), "utf8");
    const chart = source.indexOf("<CapitalDecisionAtlas");
    expect(source.indexOf("<AttentionSourceRecovery")).toBeLessThan(chart);
    expect(source.indexOf('id="desk-critical"')).toBeLessThan(chart);
    expect(chart).toBeLessThan(source.indexOf('aria-labelledby="instrument-filter-label"'));
    const snapshot = source.slice(source.indexOf("<details data-desk-snapshot-disclosure"), source.indexOf("</details>", source.indexOf("<details data-desk-snapshot-disclosure")));
    expect(snapshot).toContain("<PlayDeskEvidence");
    expect(snapshot).not.toContain(" open");
    expect(snapshot).not.toContain("AttentionTask");
    expect(source.indexOf('id="desk-attention"')).toBeLessThan(source.indexOf("<details data-desk-snapshot-disclosure"));
    const atlas = source.slice(source.indexOf("<CapitalDecisionAtlas"), source.indexOf("]} />", source.indexOf("<CapitalDecisionAtlas")));
    expect(atlas).toContain("onSelect={id => selectStage");
    expect(atlas).not.toMatch(/mutate|approveOrder|submitOrder|handleSyncBroker/);
    const selection = source.slice(source.indexOf("const selectStage ="), source.indexOf("const utils ="));
    expect(selection).toContain("setStageFilter(next)");
    expect(selection).not.toMatch(/mutate|submit|approve|syncBroker/);
  });
  it("uses a shared zero-baseline count scale, with native keyboard filter buttons", () => {
    const $ = load(renderToStaticMarkup(<CapitalDecisionAtlas title="Lanes" caption="Saved counts" lanes={capitalDecisionAtlasFixture} selected="choose" onSelect={() => {}} />));
    expect($("button")).toHaveLength(3);
    expect($("button[aria-pressed=true]").text()).toContain("Choose");
    const widths = $(".atlas-measure").map((_, element) => Number($(element).attr("width"))).get();
    expect(widths).toEqual([4 / 7 * 400, 2 / 7 * 400, 400]);
    expect($("svg[aria-hidden=true]")).toHaveLength(3);
    expect($("button").first().text()).toContain("4");
  });
  it("never draws missing counts as empty or complete", () => {
    const $ = load(renderToStaticMarkup(<CapitalDecisionAtlas title="Unknown" caption="Unavailable" lanes={[{ id: "a", label: "Choose", count: null, detail: "Unknown source" }, { id: "b", label: "Monitor", count: 0, detail: "No records" }]} />));
    expect($(".atlas-unknown")).toHaveLength(1);
    expect($(".atlas-measure").attr("width")).toBe("0");
    expect($.text()).toContain("Unknown");
    expect($("button")).toHaveLength(0);
  });
  it("rejects invalid magnitudes", () => {
    for (const value of [undefined, null, -1, Infinity, NaN, 1.5, "2"]) expect(atlasCount(value)).toBeNull();
    expect(atlasCount(0)).toBe(0);
  });
  it("sums chapter records without pretending unique symbols or a funnel", () => {
    expect(researchAtlasCounts([{ universeCount: 10, candidateCount: 3 }, { universeCount: 10, candidateCount: 2 }])).toEqual({ symbols: 20, candidates: 5 });
    expect(researchAtlasCounts([{ universeCount: 2, candidateCount: 4 }])).toEqual({ symbols: 2, candidates: 4 });
  });
  it("keeps a partially missing series unknown and the independent series usable", () => {
    expect(researchAtlasCounts([{ candidateCount: 2 }, { universeCount: 10, candidateCount: 3 }])).toEqual({ symbols: null, candidates: 5 });
    expect(researchAtlasCounts([])).toEqual({ symbols: 0, candidates: 0 });
  });
});

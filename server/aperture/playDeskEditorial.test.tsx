import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlayDeskEvidence } from "../../client/src/components/aperture/PlayDeskEvidence";
import { load } from "cheerio";

vi.stubGlobal("React", React);
describe("Play Desk saved evidence", () => {
  it("keeps unknown metrics unknown and does not substitute cash for buying power", () => {
    const html = renderToStaticMarkup(<PlayDeskEvidence orders={[]} account={{ label: "Illustrative paper", cashCents: 9999900, buyingPowerCents: null, syncSource: null, lastSyncedAt: null }} />);
    expect(html).not.toContain("99,999");
    expect(html).toContain("Not measured");
    expect(html).toContain("Sync time not recorded");
    expect(html).toContain("Not deployable capital");
    expect(html).toContain("human approval still apply");
  });
  it("shows recorded broker buying power with provenance, never as a deployment budget", () => {
    const html = renderToStaticMarkup(<PlayDeskEvidence orders={[]} account={{ label: "Illustrative paper", cashCents: 0, buyingPowerCents: 125000, syncSource: "Illustrative fixture", lastSyncedAt: 1700000000000 }} />);
    expect(html).toContain("$1,250");
    expect(html).toContain("Illustrative fixture");
    expect(html).toContain("Saved snapshots, not fresh checks");
    expect(html).not.toContain("<button");
  });
  it("discloses provenance on demand without hiding stale status or approval boundaries", () => {
    const $ = load(renderToStaticMarkup(<PlayDeskEvidence orders={[]} account={{ label: "Illustrative paper", cashCents: 0, buyingPowerCents: 125000, syncSource: "Illustrative fixture", lastSyncedAt: Date.now() - 60 * 60_000 }} />));
    expect($('details')).toHaveLength(3);
    expect($('details[open]')).toHaveLength(0);
    expect($('summary').map((_, el) => $(el).text()).get()).toEqual(['Risk basis', 'Mark provenance', 'Broker source & time']);
    expect($('[data-desk-evidence="buying-power"] details').text()).toContain('Illustrative fixture');
    $('details').remove();
    expect($.text()).toContain('$1,250');
    expect($.text()).toContain('Stale snapshot');
    expect($.text()).toContain('Not deployable capital');
    expect($.text()).toContain('human approval still apply');
  });
  it.each([NaN, Infinity, 1e20, 0, Date.now() + 86_400_000])("rejects invalid or future sync time %s", (lastSyncedAt) => {
    const html = renderToStaticMarkup(<PlayDeskEvidence orders={[]} account={{ label: "Illustrative paper", cashCents: 0, buyingPowerCents: 125000, syncSource: "Illustrative fixture", lastSyncedAt }} />);
    expect(html).not.toContain('$1,250');
    expect(html).not.toContain('Invalid Date');
    expect(html).toContain('Snapshot unverified');
  });
  it("keeps missing-risk and partial/stale-return caveats outside disclosures", () => {
    const base = { status: 'filled', instrumentType: 'shares', qty: 1, filledQty: 1, plannedRiskCents: null };
    const $ = load(renderToStaticMarkup(<PlayDeskEvidence account={null} orders={[
      { ...base, latestMark: { qty: 1, avgCostCents: 100, lastPriceCents: 120, marketValueCents: 120, priceAsOf: Date.now() - 60 * 60_000, priceSource: 'Illustrative fixture' } },
      { ...base, latestMark: null },
    ]} />));
    $('details').remove();
    expect($.text()).toContain('2 missing risk figures');
    expect($.text()).toContain('1 of 2 filled positions marked');
    expect($.text()).toContain('1 of 2 open positions could not be marked');
    expect($.text()).toContain('Stale marks: 1');
  });
});

import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { snapshotAge, snapshotAgeLabel, snapshotSyncAvailability } from "../../shared/snapshotAge";
import { SyncNowButton } from "../../client/src/components/aperture/SnapshotSyncNow";
import { PortfolioPortrait } from "../../client/src/components/aperture/PortfolioPortrait";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

const MIN = 60_000;
const HOUR = 60 * MIN;
const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("snapshot age label", () => {
  it("states the age in words and marks stale past the 4h account threshold", () => {
    expect(snapshotAge(null)).toEqual({ text: "never synced", stale: true });
    expect(snapshotAge(20_000)).toEqual({ text: "synced just now", stale: false });
    expect(snapshotAge(42 * MIN)).toEqual({ text: "synced 42m ago", stale: false });
    expect(snapshotAge(4 * HOUR)).toEqual({ text: "synced 4h ago", stale: false });
    expect(snapshotAge(11 * HOUR)).toEqual({ text: "synced 11h ago", stale: true });
    expect(snapshotAge(73 * HOUR)).toEqual({ text: "synced 3d ago", stale: true });
    expect(snapshotAgeLabel(11 * HOUR)).toBe("synced 11h ago · stale");
    expect(snapshotAgeLabel(42 * MIN)).toBe("synced 42m ago");
    expect(snapshotAgeLabel(null)).toBe("never synced");
  });

  it("offers sync for broker-backed accounts only; manual records point to CSV", () => {
    expect(snapshotSyncAvailability({ accountId: 7, brokerId: "alpaca_paper" })).toEqual({ canSync: true, accountId: 7, reason: null });
    expect(snapshotSyncAvailability({ accountId: 7, brokerId: "manual" })).toMatchObject({ canSync: false, reason: "Manual record · update by CSV in Portfolio" });
    expect(snapshotSyncAvailability({ accountId: null, brokerId: "alpaca_paper" })).toMatchObject({ canSync: false, reason: null });
    expect(snapshotSyncAvailability({ accountId: 7, brokerId: null })).toMatchObject({ canSync: false, reason: null });
  });
});

describe("Sync now action", () => {
  it("is a labelled, person-started button that says no order is touched", () => {
    const $ = load(renderToStaticMarkup(<SyncNowButton onSync={() => {}} syncing={false} />));
    expect($("button").text()).toBe("Sync now");
    expect($("button").attr("type")).toBe("button");
    expect($("button").attr("title")).toContain("No order is placed, approved or cancelled");
    const busy = load(renderToStaticMarkup(<SyncNowButton onSync={() => {}} syncing />));
    expect(busy("button").text()).toBe("Syncing…");
    expect(busy("button").attr("disabled")).toBeDefined();
  });

  it("sits beside the age on the Today account portrait, not in preview", () => {
    const account = { label: "Alpaca Paper", equityValueCents: 100_000_00, cashCents: 1_000_00, buyingPowerCents: 2_000_00, lastSyncedAt: Date.UTC(2026, 9, 7, 3), isPaper: true };
    const now = Date.UTC(2026, 9, 7, 14);
    const html = renderToStaticMarkup(<PortfolioPortrait loading={false} failed={false} holdings={[]} account={account} thesis={null} binding={null} now={now} syncAction={<button type="button">Sync now</button>} />);
    const time = load(html)(".portrait-time");
    expect(time.text()).toContain("Stale or unsynced");
    expect(time.text()).toContain("synced 11h ago");
    expect(time.find("button").text()).toBe("Sync now");
    const preview = load(renderToStaticMarkup(<PortfolioPortrait previewOnly loading={false} failed={false} holdings={[]} account={account} thesis={null} binding={null} now={now} syncAction={<button type="button">Sync now</button>} />));
    expect(preview(".portrait-time button")).toHaveLength(0);
  });

  it("never syncs on a timer and targets the account whose age is shown", () => {
    const component = source("client/src/components/aperture/SnapshotSyncNow.tsx");
    const rail = source("client/src/components/aperture/CapitalCockpitRail.tsx");
    for (const text of [component, rail]) {
      expect(text).not.toMatch(/set(Interval|Timeout)\([^)]*[Ss]ync/);
    }
    const rapidSync = rail.slice(rail.indexOf("const handleRapidSync"), rail.indexOf("toast.loading", rail.indexOf("const handleRapidSync")));
    expect(rapidSync).toContain("const targetId = syncTarget.accountId;");
    expect(rapidSync).toContain("targetId == null) return;");
    expect(rapidSync).not.toContain("?? 1");
    expect(rail).toContain("snapshotSyncAvailability({ accountId: data?.account.accountId, brokerId: data?.account.brokerId })");
    // Editorial strip on every Capital page, mobile header, desktop pill and Today portrait.
    expect(rail.match(/<SyncNowButton onSync=\{handleRapidSync\}/g)).toHaveLength(3);
    expect(rail).toContain('{syncing ? "Syncing…" : "Sync now"}');
    expect(rail).not.toContain("Refresh before judging capacity");
  });
});

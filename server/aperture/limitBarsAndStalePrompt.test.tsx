/**
 * POC v3 parity PR-04: three limit bars (Single order · Per play · Daily
 * loss) from the cockpit's headroom lines, and a stale-snapshot prompt that
 * tops Today. Ceilings that never accumulate get no fill; unknown is "not
 * measured", never zero.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildLimitBars } from "../../shared/limitBars";
import { STALE_ACCOUNT_MS, type CockpitHeadroomLine } from "../../shared/cockpitRailSummary";

vi.mock("@/lib/trpc", () => ({ trpc: { useUtils: () => ({}), aperture: { account: { sync: { useMutation: () => ({ mutateAsync: vi.fn() }) } } } } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { LimitBars } from "../../client/src/components/aperture/LimitBars";
import { StaleSnapshotPrompt } from "../../client/src/components/aperture/StaleSnapshotPrompt";

// Mirrors shared/disclosure.ts PROHIBITED_LANGUAGE (not exported).
const PROHIBITED_LANGUAGE = /\b(copy\s*congress|follow\s+smart\s+money|insider|conflict|congressional\s+alpha)\b/i;

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

const line = (key: string, over: Partial<CockpitHeadroomLine> = {}): CockpitHeadroomLine => ({
  key, label: key, subject: null, usedCents: null, ceilingCents: null, remainingCents: null, usedPct: null, ceilingPct: 1, basis: "test", reason: null, ...over,
});
const measured = [
  line("single_order", { ceilingCents: 100_000, remainingCents: 100_000 }),
  line("planned_risk_per_play", { ceilingCents: 6_000 }),
  line("daily_planned_risk", { usedCents: 2_400, ceilingCents: 12_000, remainingCents: 9_600, usedPct: 0.2 }),
];

describe("buildLimitBars", () => {
  it("shows the two ceilings as limits only and today's planned loss as a measured bar", () => {
    const [single, perPlay, daily] = buildLimitBars(measured);
    expect(single).toMatchObject({ key: "single_order", kind: "ceiling", usedPct: null, value: "Up to $1,000" });
    expect(perPlay).toMatchObject({ key: "per_play", kind: "ceiling", usedPct: null, value: "Up to $60 planned loss" });
    expect(daily).toMatchObject({ key: "daily_loss", kind: "usage", usedPct: 20, tone: "quiet", value: "$24 of $120 used" });
  });
  it("marks near and over the daily limit", () => {
    expect(buildLimitBars([line("daily_planned_risk", { usedCents: 9_000, ceilingCents: 12_000 })])[2].tone).toBe("warning");
    expect(buildLimitBars([line("daily_planned_risk", { usedCents: 11_000, ceilingCents: 12_000 })])[2].tone).toBe("critical");
  });
  it("shows a non-whole-dollar limit to the cent instead of rounding it up", () => {
    expect(buildLimitBars([line("planned_risk_per_play", { ceilingCents: 18_750 })])[1].value).toBe("Up to $187.50 planned loss");
  });
  it("never turns unknown into zero", () => {
    const unknown = buildLimitBars([line("single_order", { reason: "equity unknown" }), line("daily_planned_risk", { ceilingCents: 12_000 })]);
    expect(unknown[0].value).toBe("Not measured");
    expect(unknown[1].value).toBe("Not measured");
    expect(unknown[2]).toMatchObject({ usedPct: null, tone: "unknown", value: "$120 limit · today not measured" });
    expect(buildLimitBars([]).every((bar) => bar.value === "Not measured")).toBe(true);
  });
});

describe("LimitBars", () => {
  it("renders three square bars, with a progressbar only for today's planned loss", () => {
    const $ = load(renderToStaticMarkup(<LimitBars lines={measured} />));
    expect($("[data-limit]").map((_, el) => $(el).attr("data-limit")).get()).toEqual(["single_order", "per_play", "daily_loss"]);
    expect($("[role=progressbar]")).toHaveLength(1);
    expect($("[role=progressbar]").attr("aria-valuenow")).toBe("20");
    expect($.text()).not.toMatch(PROHIBITED_LANGUAGE);
  });
  it("replaces the binding-limit text in the context strip", () => {
    const rail = readFileSync("client/src/components/aperture/CapitalCockpitRail.tsx", "utf8");
    expect(rail).toContain("<LimitBars lines={data.headroom.lines as HeadroomLine[]} />");
    expect(rail).not.toContain("Binding Portfolio Limit");
  });
});

describe("StaleSnapshotPrompt", () => {
  const account = (stalenessMs: number | null, brokerId = "alpaca_paper") => ({ linked: true, accountId: 4, brokerId, stalenessMs, label: "Practice" });
  it("is silent while the account is fresh or not linked", () => {
    expect(renderToStaticMarkup(<StaleSnapshotPrompt account={account(5 * 60_000)} />)).toBe("");
    expect(renderToStaticMarkup(<StaleSnapshotPrompt account={{ ...account(null), linked: false }} />)).toBe("");
  });
  it("asks to sync first when the snapshot is stale, with a read-only Sync now", () => {
    const $ = load(renderToStaticMarkup(<StaleSnapshotPrompt account={account(STALE_ACCOUNT_MS + 7 * 3_600_000)} />));
    expect($("h2").text()).toBe("Sync your practice account");
    expect($.text()).toContain("synced 11h ago");
    expect($("button").text()).toBe("Sync now");
    expect($("button").attr("title")).toContain("No order is placed");
  });
  it("covers a never-synced account and a manual account without a sync button", () => {
    expect(renderToStaticMarkup(<StaleSnapshotPrompt account={account(null)} />)).toContain("never synced");
    const manual = load(renderToStaticMarkup(<StaleSnapshotPrompt account={account(null, "manual")} />));
    expect(manual("button")).toHaveLength(0);
    expect(manual.text()).toContain("update by CSV");
  });
  it("sits above the briefing on Today", () => {
    const today = readFileSync("client/src/components/aperture/DailyPlayList.tsx", "utf8");
    expect(today.indexOf("<StaleSnapshotPrompt")).toBeGreaterThan(-1);
    expect(today.indexOf("<StaleSnapshotPrompt")).toBeLessThan(today.indexOf("<TodayAttentionBriefing"));
  });
});

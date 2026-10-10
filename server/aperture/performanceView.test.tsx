import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/styles/performance-edition.css", () => ({}));
vi.mock("../../client/src/components/aperture/AccountHoldingsPortrait", () => ({ accountStamp: () => "" }));

import { EquityChart, QuickPlayPerformance, StrategistPerformance, type PerformanceOverview } from "../../client/src/components/aperture/PerformanceView";

const NOW = Date.UTC(2026, 9, 9, 20, 0);
const play = (symbol: string, over: Record<string, unknown> = {}) => ({
  symbol, thesis: "Rate-cut beneficiaries", qty: 40, entryCents: 5000, lastCents: 5140, stopCents: 4800, targetCents: 5500, counted: true,
  uncountedReason: null, unrealizedCents: 5600, rNow: 0.7, plannedLossCents: 8000, atStopFromHereCents: -13600, atTargetFromHereCents: 14400, ...over,
});
const data = {
  accountId: 1, accountLabel: "Practice", isPracticeBook: true, planTargetR: 2.5, lastSyncedAt: NOW, cashCents: 9_317_900,
  unrealizedCents: 23_300, realizedCents: 37_900, unattributedSells: 0,
  headline: {
    equityCents: 10_061_200, asOf: NOW - 20 * 60_000,
    today: { deltaCents: 5_800, fromAt: NOW - 6 * 3_600_000 }, thisWeek: { deltaCents: 41_200, fromAt: NOW - 4 * 86_400_000 },
    sinceStart: { deltaCents: 61_200, fromAt: NOW - 13 * 86_400_000, startingCents: 10_000_000 },
  },
  plan: {
    plays: [play("SAMPLE-A"), play("SAMPLE-J", { counted: false, uncountedReason: "No plan levels saved", thesis: null, stopCents: null, targetCents: null })],
    countedCount: 1, uncountedSymbols: ["SAMPLE-J"], unrealizedCents: 5600, plannedLossCents: 8000, atStopFromHereCents: -47_300, atTargetFromHereCents: 36_700,
  },
  closed: {
    stats: { closed: 5, wins: 3, winRate: 0.6, avgR: 1.44, avgWinCents: 18_700, avgLossCents: 9_100, best: { symbol: "F", resultCents: 21_000 }, worst: { symbol: "E", resultCents: -10_000 }, sample: "process_only",
      byThesis: [{ thesis: "Rate-cut beneficiaries", plays: 3, pnlCents: 25_100, wins: 2, avgR: 1.6, avgWinCents: 17_550, avgLossCents: 10_000 }] },
    plays: [{ symbol: "SAMPLE-H", thesis: "Rate-cut beneficiaries", openedAt: 1, closedAt: NOW - 2 * 86_400_000, plannedLossCents: 5000, resultCents: 18_700, r: 3.74 }],
  },
  series: { points: [{ takenAt: NOW - 86_400_000, equityCents: 10_000_000 }, { takenAt: NOW, equityCents: 10_061_200 }], gaps: [], startingCents: 10_000_000, startingAt: NOW - 13 * 86_400_000 },
} as unknown as PerformanceOverview;

describe("Performance view", () => {
  it("Quick Play reads in plain sentences", () => {
    const html = renderToStaticMarkup(<QuickPlayPerformance data={data} now={NOW} />);
    expect(html).toContain("You&#x27;re up $412 this week and $612 since you started with $100,000. Your account is worth $100,612.");
    expect(html).toContain("down $473 from here");
    expect(html).toContain("up $367 from here");
    expect(html).toContain("not a forecast");
    expect(html).toContain("3 of 5 made money");
    expect(html).toContain("One holding (SAMPLE-J) has no stop or target saved");
    expect(html).not.toMatch(/EXAMPLE DATA|STATIC MOCKUP/i);
  });

  it("Strategist shows the full tables with plan outcomes labelled", () => {
    const html = renderToStaticMarkup(<StrategistPerformance data={data} now={NOW} />);
    expect(html).toContain("Account results");
    expect(html).toContain("Target (2.5R)");
    expect(html).toContain("Planned loss at entry");
    expect(html).toContain("By play and by thesis");
    expect(html).toContain("Not a forecast");
    expect(html).toContain("Not set");
  });

  it("a null value renders Not measured, never zero", () => {
    const empty = { ...data, headline: { ...data.headline, equityCents: null, asOf: null, today: { deltaCents: null, fromAt: null }, thisWeek: { deltaCents: null, fromAt: null }, sinceStart: { deltaCents: null, fromAt: null, startingCents: null } }, realizedCents: null, unrealizedCents: null, cashCents: null } as unknown as PerformanceOverview;
    const html = renderToStaticMarkup(<StrategistPerformance data={empty} now={NOW} />);
    expect(html).toContain("Not measured");
    expect(html).not.toContain("+$0");
  });

  it("chart shows an honest empty state with fewer than two syncs, and a labelled gap otherwise", () => {
    expect(renderToStaticMarkup(<EquityChart series={{ ...data.series, points: [] }} now={NOW} />)).toContain("History starts from your first saved sync");
    const gapped = { ...data.series, points: [{ takenAt: NOW - 10 * 86_400_000, equityCents: 10_000_000 }, { takenAt: NOW - 6 * 86_400_000, equityCents: 10_020_000 }, { takenAt: NOW, equityCents: 10_061_200 }], gaps: [{ fromDateEt: "2026-10-01", toDateEt: "2026-10-02" }] };
    const html = renderToStaticMarkup(<EquityChart series={gapped} now={NOW} />);
    expect(html).toContain("No saved sync");
    expect(html).toContain("Gaps mean no sync was saved");
  });
});

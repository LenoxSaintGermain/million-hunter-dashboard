import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { TodayExecutionSnapshot, TodayOrderRows, type TodayExecutionData, type TodayExecutionOrder } from "../../client/src/components/aperture/TodayExecutionSnapshot";
import { TodayAttentionBriefing } from "../../client/src/components/aperture/TodayAttentionBriefing";
const calls = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { aperture: { desk: { markSeen: { useMutation: () => ({ mutate: calls.mutate }) } } } } }));
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
const now = Date.UTC(2026, 8, 13, 17);
const order = (over: Partial<TodayExecutionOrder> = {}): TodayExecutionOrder => ({
  id: 7, accountId: 1, accountLabel: "Illustrative Paper", symbol: "FIX261120P00020000", status: "filled", instrumentType: "long_put", plannedRiskCents: 10000,
  qty: 1, filledQty: 1, orderType: "limit", limitPriceCents: 100, timeInForce: "day", side: "buy",
  latestMark: { qty: 1, avgCostCents: 100, lastPriceCents: 125, marketValueCents: 12500, priceAsOf: now - 60_000, priceSource: "illustrative broker" }, ...over,
});
const data = (over: Partial<TodayExecutionData> = {}): TodayExecutionData => ({ account: { id: 1, label: "Illustrative Paper", cashCents: 500000, buyingPowerCents: 1000000, lastSyncedAt: now - 60_000, syncSource: "illustrative broker" }, orders: [order()], ...over });
const snapshot = (value: TodayExecutionData | undefined = data(), props = {}) => load(renderToStaticMarkup(createElement(TodayExecutionSnapshot, { data: value, loading: false, failed: false, now, ...props })));
const motion = { key: "order:7", symbol: "FIX261120P00020000", stateLabel: "Open position", detail: "1 filled", href: "/aperture/run/1/execute?candidate=2&lifecycle=monitoring&order=7", updatedAt: now };
const rows = (value = data(), item = motion) => load(renderToStaticMarkup(createElement(TodayOrderRows, { data: value, items: [item], fingerprints: new Map([[item.key, "version-1"]]), changedKeys: new Set([item.key]), onOpen: vi.fn(), now })));

describe("Today shows sourced snapshots, not a trading permission", () => {
  it("uses existing return math and labels coverage and raw buying power", () => {
    const $ = snapshot();
    expect($.text()).toContain("+$25.00");
    expect($.text()).toContain("Broker buying power$10,000.00");
    expect($.text()).toContain("Recorded order risk$100.00");
    expect($.text()).toContain("not all holdings");
    expect($.text()).toContain("Buying power is not mission allocation");
    expect($.text()).toContain("not streaming");
    expect($("summary")).toHaveLength(1);
  });
  it("never mixes another account into the named account totals", () => {
    const $ = snapshot(data({ orders: [order(), order({ id: 8, accountId: 2, plannedRiskCents: 9999900 })] }));
    expect($.text()).toContain("+$25.00");
    expect($.text()).toContain("1/1 fully filled");
    expect($.text()).not.toContain("99,999");
  });
  it("requires account identity before reporting totals", () => {
    const value = data(); delete value.account!.id;
    const $ = snapshot(value);
    expect($.text()).toContain("Account scope unavailable");
    expect($.text()).not.toContain("+$25.00");
  });
  it("keeps both stale and partial warnings beside the P&L", () => {
    const stale = order(); stale.latestMark!.priceAsOf = now - 3600_000;
    const $ = snapshot(data({ orders: [stale, order({ id: 8, latestMark: null }), order({ id: 9, status: "submitted", qty: 4, filledQty: 1 })] }));
    const visible = $("dl").text();
    expect(visible).toContain("Unrealized · partial");
    expect(visible).toContain("1/2 fully filled positions marked; 1 partial fill(s) excluded");
    expect(visible).toContain("Stale");
  });
  it("unknown marks and balances do not become zero", () => {
    const value = data({ orders: [order({ markSourceUnavailable: true })] });
    value.account!.lastSyncedAt = null;
    const $ = snapshot(value);
    expect($("dl").text()).toContain("Unrealized · partialNot measured");
    expect($("dl").text()).toContain("Broker buying powerNot measured");
    expect($.text()).toContain("Broker position marks are unavailable");
  });
  it("distinguishes an account read failure and cash fallback", () => {
    expect(snapshot(data({ accountUnavailable: "read failed" })).text()).toContain("Account scope unavailable");
    const value = data(); value.account!.buyingPowerCents = null;
    expect(snapshot(value).text()).toContain("Broker cash$5,000.00");
  });
  it("keeps a successful snapshot after refresh failure", () => {
    const $ = snapshot(data(), { failed: true });
    expect($.text()).toContain("Refresh failed; last saved data");
    expect($.text()).toContain("+$25.00");
  });
  it("distinguishes loading, failed and absent without an all-clear", () => {
    for (const [props, expected] of [[{ loading: true }, "Loading broker snapshot"], [{ failed: true }, "Broker snapshot unavailable"], [{}, "Broker snapshot not available"]] as const) {
      const text = snapshot(data(), { data: undefined, ...props }).text();
      expect(text).toContain(expected);
      expect(text).not.toMatch(/\$0|clear/i);
    }
  });
  it("reports partial risk and uses planned-stop language for shares", () => {
    const $ = snapshot(data({ orders: [order({ instrumentType: "equity" }), order({ id: 8, plannedRiskCents: null })] }));
    expect($("dl").text()).toContain("Recorded order risk · partial");
    expect($("dl").text()).toContain("planned loss at modeled stops");
    expect($.text()).not.toContain("guaranteed maximum");
  });
});
describe("compact rows reuse lifecycle state and exact record identity", () => {
  it("shows terms, fill quantities, sourced basis and mark without trading actions", () => {
    const $ = rows();
    expect($.text()).toContain("FIX · $20 Put");
    expect($.text()).toContain("Buy · Limit $1.00 · Day");
    expect($.text()).toContain("1 filled · 0 remaining");
    expect($.text()).toContain("Basis $1.00 · Mark $1.25");
    expect($("[data-attention-key]").attr("data-attention-fingerprint")).toBe("version-1");
    expect($("button").text()).toBe("View status");
    expect($.text()).not.toMatch(/Cancel|Replace|Approve|Submit/);
  });
  it("does not equate a partial fill or unresolved dispatch with acceptance", () => {
    const $ = rows(data({ orders: [order({ status: "submitted", qty: 4, filledQty: 1 })] }), { ...motion, stateLabel: "Dispatch unresolved", detail: "Check order status" });
    expect($.text()).toContain("Dispatch unresolved");
    expect($.text()).toContain("1 filled · 3 remaining");
    expect($.text()).toContain("Partial-fill return not measured");
    expect($.text()).not.toMatch(/No fill|accepted|\+\$25/);
  });
  it("does not match a different order merely because the symbol is the same", () => {
    const $ = rows(data({ orders: [order({ id: 8 })] }));
    expect($.text()).toContain("Order details unavailable");
    expect($.text()).not.toContain("Limit $1.00");
  });
  it("marks unknown quantity and missing price provenance explicitly", () => {
    const value = order({ qty: null, filledQty: null }); value.latestMark!.priceSource = null;
    const $ = rows(data({ orders: [value] }));
    expect($.text()).toContain("Not measured filled · Not measured remaining");
    expect($.text()).toContain("Unrealized not measured");
    expect($.text()).not.toContain("Basis $1.00");
  });
  it("is wired into Today with no additional query or provider call", () => {
    const page = readFileSync("client/src/components/aperture/DailyPlayList.tsx", "utf8");
    expect(page).toContain("execution={desk.data}");
    expect(page).toContain("executionFailed={!!desk.error}");
    const source = readFileSync("client/src/components/aperture/TodayExecutionSnapshot.tsx", "utf8");
    expect(source).not.toMatch(/useQuery|useMutation|fetch\(|setInterval/);
  });
  it("Today mount creates no review, proposal or order and preserves critical items", () => {
    calls.mutate.mockClear();
    const attention = { entryState: "returning", primary: null, otherCritical: [], otherAttention: [], inMotion: [motion], changed: [], readState: "complete", nextCheckpoint: null, changeHeading: "Current status", scopeNote: "All authorized plays", monitoringNote: "On demand", quiet: false, quietMessage: null, baseline: { capturedAt: now, items: [] }, baselineToken: "fixture" } as any;
    attention.otherCritical = [{ key: "other-account", kind: "monitoring_finding", critical: true, title: "Review another account's play", reason: "Unresolved exposure concern", consequence: "Review evidence; no automatic exit", stateLabel: "Unresolved", actionLabel: "Review what changed", href: "/aperture/run/9", updatedAt: now }];
    const $ = load(renderToStaticMarkup(createElement(TodayAttentionBriefing, { attention, accountLabel: "Illustrative Paper", modeLabel: "Paper", loading: false, failed: null, execution: data(), executionFailed: false, onOpen: vi.fn(), onRetry: vi.fn(), onNewMission: vi.fn() })));
    expect($("[aria-label='Broker snapshot']")).toHaveLength(1);
    expect($("[aria-label='Recorded positions and orders']")).toHaveLength(1);
    expect($.text()).toContain("Review another account's play");
    expect(calls.mutate).not.toHaveBeenCalled();
  });
});

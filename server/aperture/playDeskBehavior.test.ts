import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { load as loadHtml } from "cheerio";
import { deriveApertureAttention, type ApertureAttentionInput } from "../../shared/apertureAttention";

const fixture = vi.hoisted(() => ({ search: "", queries: {} as Record<string, any>, navigate: vi.fn(), refetch: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/aperture/plays", fixture.navigate], useSearch: () => fixture.search }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: any) => children }));
vi.mock("@/components/aperture/OperatorDecisionBrief", () => ({ OperatorDecisionBrief: () => null }));
vi.mock("@/lib/trpc", () => ({ trpc: { aperture: {
  desk: { summary: { useQuery: () => fixture.queries.desk } },
  run: { list: { useQuery: () => fixture.queries.runs } },
  play: { list: { useQuery: () => fixture.queries.plays } },
  runway: { pending: { useQuery: () => fixture.queries.outcomes } },
} } }));
import AperturePlayDesk, { deskAttentionOutsideFilters, deskOrderPresentation, deskOrderQuantities, playDeskFilterHref, readPlayDeskLocation } from "../../client/src/pages/aperture/AperturePlayDesk";

const now = 1_800_000_000_000;
const query = (data: unknown, error: Error | null = null) => ({ data, error, isLoading: false, isFetching: false, dataUpdatedAt: now, refetch: fixture.refetch });
const attention = (overrides: Partial<ApertureAttentionInput> = {}) => deriveApertureAttention({
  now, mission: null, underwriting: null, evidenceTasks: [], orders: [], activePlays: [], pendingReviews: [], monitoringFindings: [],
  checks: { state: "complete", asOf: now, monitoring: "on_demand" }, ...overrides,
}, null);
const order = (overrides: Record<string, unknown> = {}) => ({
  id: 12, runId: 360001, candidateId: 240002, accountId: 3, accountLabel: "Alpaca Paper — UAT",
  symbol: "MGM261120C00040000", underlyingSymbol: "MGM", instrumentType: "long_call",
  status: "submitted", intent: "open", qty: 4, filledQty: 0, brokerOrderId: "paper-12", dispatchError: null,
  plannedRiskCents: 42000, updatedAt: now, ...overrides,
});
const render = () => renderToStaticMarkup(React.createElement(AperturePlayDesk));

beforeEach(() => {
  vi.stubGlobal("React", React);
  fixture.search = "";
  fixture.navigate.mockClear();
  fixture.refetch.mockClear();
  fixture.queries = {
    desk: query({ orders: [], activePlays: [], attention: attention() }),
    runs: query([]), plays: query({ plays: [] }), outcomes: query([]),
  };
});

describe("Play Desk operator journeys (rendered page, no APIs)", () => {
  it("does not turn a failed research query into an all-clear", () => {
    fixture.queries.runs = query(undefined, new Error("Research unavailable"));
    const html = render();
    expect(html).not.toContain("You are clear");
    expect(html).not.toContain("No play needs a decision right now");
    expect(html).toContain("Research status unavailable");
  });

  it("shows every critical issue above instrument and stage filters", () => {
    const orders = [order({ dispatchError: "No dispatch receipt" }), order({ id: 13, symbol: "NU", instrumentType: "shares", status: "approved" })];
    fixture.queries.desk = query({ orders, activePlays: [], attention: attention({ orders: orders as any }) });
    fixture.search = "instrument=puts&stage=choose";
    const html = render();
    expect(html).toContain("Reconcile MGM261120C00040000 paper dispatch");
    expect(html).toContain("Submit NU to the named paper broker");
    expect(html).toContain("2 critical issues outside these filters");
    expect(html.indexOf("Submit NU to the named paper broker")).toBeLessThan(html.indexOf('aria-label="Filter by workflow stage"'));
  });

  it("opens the exact active play despite filters and same-symbol order deduplication", () => {
    const play = { id: 77, accountId: 3, accountLabel: "Alpaca Paper — UAT", symbol: "MGM261120C00040000", instrumentType: "long_call", status: "active", thesisNote: "Recheck the recorded catalyst", horizon: "swing", asOf: now, updatedAt: now };
    fixture.search = "play=77&instrument=puts&stage=choose";
    fixture.queries.desk = query({ orders: [order()], activePlays: [play], attention: attention() });
    const html = render();
    expect(html).toContain('id="play-77"');
    expect(html).toContain("Selected play · #77");
    expect(html).toContain("Recheck the recorded catalyst");
    expect(html).toContain("Alpaca Paper — UAT");
    expect(fixture.refetch).not.toHaveBeenCalled();
    expect(fixture.navigate).not.toHaveBeenCalled();
  });

  it.each(["desk", "runs", "plays", "outcomes"])("reports a failed %s source without discarding unaffected order records", (source) => {
    const orders = [order()];
    fixture.queries.desk = query({ orders, activePlays: [], attention: attention({ orders: orders as any }) });
    fixture.queries[source] = { ...fixture.queries[source], error: new Error("Refresh interrupted") };
    const html = render();
    expect(html).toContain("status unavailable");
    expect(html).toContain("Last known records remain visible");
    expect(html).toContain("MGM · $40 Call · Nov 20, 2026");
    expect(html).not.toContain("No new action identified");
    expect(fixture.refetch).not.toHaveBeenCalled();
  });

  describe.each([true, false])("backend error disclosure with cached data = %s", (cached) => {
    it.each(["desk", "runs", "plays", "outcomes"])("hides raw %s errors while preserving source context and recovery", (source) => {
      const orders = [order()];
      fixture.queries.desk = query({ orders, activePlays: [], attention: attention({ orders: orders as any }) });
      fixture.queries[source] = {
        ...fixture.queries[source],
        data: cached ? fixture.queries[source].data : undefined,
        error: new Error("SQL_FAILURE_UAT SELECT * FROM private_account_table WHERE owner_id = 123; backend stack details"),
      };
      const html = render();
      expect(html.includes("SQL_FAILURE_UAT")).toBe(false);
      expect(html.includes("private_account_table")).toBe(false);
      expect(html.includes("backend stack details")).toBe(false);
      const label = { desk: "Play and order", runs: "Research", plays: "Play decisions", outcomes: "Scheduled review" }[source];
      expect(html).toContain(`${label} status unavailable`);
      expect(html).toContain("Retry status");
      expect(html).toContain("This is not an all-clear");
      expect(html).not.toContain("No new action identified");
      if (cached) {
        expect(html).toContain("Last known records remain visible");
        expect(html).toContain("MGM · $40 Call · Nov 20, 2026");
      } else {
        expect(html).toContain("This part of the desk could not be verified");
      }
      expect(fixture.refetch).not.toHaveBeenCalled();
      expect(fixture.navigate).not.toHaveBeenCalled();
    });
  });

  it("keeps usable order cards visible while an unrelated source is loading", () => {
    const orders = [order()];
    fixture.queries.desk = query({ orders, activePlays: [], attention: attention({ orders: orders as any }) });
    fixture.queries.runs = { ...query(undefined), isLoading: true, isFetching: true };
    const html = render();
    expect(html).toContain("Loading remaining records: research");
    expect(html).toContain("MGM · $40 Call · Nov 20, 2026");
    expect(html).toContain("—</p>");
    expect(html).not.toContain("No new action identified");
  });

  it.each(["stale", "partial", "failed", "empty"] as const)("does not give an all-clear for %s checks", (state) => {
    fixture.queries.desk.data.attention = attention({ checks: { state, asOf: now, monitoring: "on_demand" } });
    const html = render();
    expect(html).toContain(`Recorded checks: ${state}`);
    expect(html).toContain("Status is not an all-clear");
    expect(html).not.toContain("No new action identified");
  });

  it("shows partial fill quantities separately and uses the shared lifecycle label", () => {
    const orders = [order({ filledQty: 1 })];
    const shared = attention({ orders: orders as any });
    fixture.queries.desk = query({ orders, activePlays: [], attention: shared });
    const html = render();
    expect(html).toContain("Partially filled");
    expect(html).toContain("1 filled · 3 remaining");
    // The 2x2 card grid became a decision table, so these read as one line
    // rather than three labelled stat blocks. The substantive requirement is
    // unchanged: ordered, filled and remaining stay separately stated, and a
    // partial fill is never collapsed into a single "filled" number.
    expect(html).toContain("4 ordered");
    expect(html).toContain("1 filled");
    expect(html).toContain("3 remaining");
    expect(deskOrderPresentation(12, shared).label).toBe(shared.inMotion[0].stateLabel);
    expect(html).not.toContain("Position open");
  });

  it("does not label accepted-but-unfilled orders as a position", () => {
    const orders = [order()];
    fixture.queries.desk = query({ orders, activePlays: [], attention: attention({ orders: orders as any }) });
    const html = render();
    expect(html).toContain("Paper broker accepted; no fill yet");
    expect(html).toContain("Accepted order · no fill recorded");
    expect(html).not.toContain("Position open");
    expect(html).not.toContain("Open position");
  });

  it("does not infer broker acceptance for submitted orders without a broker ID", () => {
    const orders = [order({ brokerOrderId: null, dispatchError: null })];
    const shared = attention({ orders: orders as any });
    fixture.queries.desk = query({ orders, activePlays: [], attention: shared });
    const state = deskOrderPresentation(12, shared);
    const html = render();
    expect(state.label).toMatch(/pending|unresolved/i);
    expect(state.detail).toMatch(/reconcile|receipt|dispatch/i);
    expect(state.action).not.toMatch(/submit|approve/i);
    expect(html).not.toContain("Paper broker accepted; no fill yet");
    expect(html).not.toContain("Open position");
    expect(fixture.refetch).not.toHaveBeenCalled();
  });

  it("labels share loss as a modeled stop scenario rather than a guaranteed maximum", () => {
    const orders = [order({ symbol: "IWM", underlyingSymbol: "IWM", instrumentType: "shares" })];
    fixture.queries.desk = query({ orders, activePlays: [], attention: attention({ orders: orders as any }) });
    const html = render();
    expect(html).toContain("Planned loss at modeled stop");
    expect(html).toContain("Stop execution may differ from the modeled price");
    expect(html).not.toContain("Max loss");
  });

  it("answers what is at stake, what it is worth and what is deployable before any row", () => {
    const orders = [
      order({ status: "filled", filledQty: 2, plannedRiskCents: 42_000,
        latestMark: { qty: 2, avgCostCents: 258, lastPriceCents: 305, marketValueCents: 61_000, priceAsOf: Date.now() - 60_000, priceSource: "alpaca_paper" } }),
      order({ id: 13, status: "submitted", filledQty: 0, plannedRiskCents: 9_600, latestMark: null }),
    ];
    fixture.queries.desk = query({
      orders, activePlays: [], attention: attention({ orders: orders as any }),
      account: { label: "Alpaca Paper", cashCents: 500_000, buyingPowerCents: 1_200_000, lastSyncedAt: Date.now() - 60_000, syncSource: "alpaca_paper" },
    });
    const html = render();
    expect(html).toContain("data-desk-glance");
    expect(html).toContain("$516");      // at stake: 42_000 + 9_600
    expect(html).toContain("+$94.00");   // unrealized, the one markable position
    expect(html).toContain("$12,000");   // deployable buying power
    expect(html).toContain("1 of 1 open marked");
    expect(html).toContain("Find my best play");
  });

  it("refuses a deployable figure the account cannot support instead of showing zero", () => {
    const orders = [order({ status: "submitted", plannedRiskCents: 9_600 })];
    fixture.queries.desk = query({
      orders, activePlays: [], attention: attention({ orders: orders as any }),
      account: { label: "Alpaca Paper", cashCents: null, buyingPowerCents: null, lastSyncedAt: null, syncSource: null },
    });
    const html = render();
    expect(html).toContain("Not measured");
    expect(html).toContain("never reported a synced balance");
    expect(html).not.toContain(">$0<");
  });

  it("does not present a partial unrealized total as complete", () => {
    const orders = [
      order({ status: "filled", filledQty: 2,
        latestMark: { qty: 2, avgCostCents: 258, lastPriceCents: 305, marketValueCents: 61_000, priceAsOf: Date.now() - 60_000, priceSource: "alpaca_paper" } }),
      order({ id: 13, status: "filled", filledQty: 2, latestMark: null }),
    ];
    fixture.queries.desk = query({ orders, activePlays: [], attention: attention({ orders: orders as any }), account: null });
    const html = render();
    expect(html).toContain("1 of 2 open positions could not be marked");
    expect(html).toContain("No paper account is connected");
  });

  it("puts inspection one click from the scan, announced as a dialog", () => {
    const orders = [order({ status: "filled", filledQty: 4 })];
    fixture.queries.desk = query({ orders, activePlays: [], attention: attention({ orders: orders as any }) });
    const html = render();
    const $ = loadHtml(html);
    const trigger = $('[data-inspect-order="12"]');
    expect(trigger).toHaveLength(1);
    expect(trigger.attr("aria-haspopup")).toBe("dialog");
    expect(trigger.attr("aria-expanded")).toBe("false");
    expect(trigger.attr("class")).toContain("min-h-11");
    // The affordance is the instrument label itself, so the scan and the way in
    // are the same target rather than a separate column of buttons.
    expect(trigger.text()).toContain("MGM · $40 Call");
    expect(trigger.text()).toContain("inspect receipts and thesis context");
  });

  it("binds the open drawer to the URL so Back closes it and a reload reopens it", () => {
    const orders = [order({ status: "filled", filledQty: 4 })];
    fixture.queries.desk = query({ orders, activePlays: [], attention: attention({ orders: orders as any }) });
    fixture.search = "inspect=12";
    expect(readPlayDeskLocation("?inspect=12").inspectOrderId).toBe(12);
    expect(loadHtml(render())('[data-inspect-order="12"]').attr("aria-expanded")).toBe("true");
    expect(playDeskFilterHref("?inspect=12", { inspect: null })).toBe("/aperture/plays");
  });

  it("ignores an inspect id that is not a positive integer", () => {
    for (const value of ["0", "-3", "abc", "1.5", "9007199254740993"]) {
      expect(readPlayDeskLocation(`?inspect=${value}`).inspectOrderId).toBeNull();
    }
  });

  it("leaves the drawer shut for an inspect id that is not in the returned records", () => {
    const orders = [order({ status: "filled", filledQty: 4 })];
    fixture.queries.desk = query({ orders, activePlays: [], attention: attention({ orders: orders as any }) });
    fixture.search = "inspect=999";
    const html = render();
    expect(html).not.toContain("data-inspection-body");
    expect(html).toContain("data-play-row");
  });

  it("marks a filled order from the broker position and states when and from where", () => {
    const orders = [order({
      status: "filled", filledQty: 2,
      latestMark: { qty: 2, avgCostCents: 258, lastPriceCents: 305, marketValueCents: 61_000, priceAsOf: Date.now() - 60_000, priceSource: "alpaca_paper" },
    })];
    fixture.queries.desk = query({ orders, activePlays: [], attention: attention({ orders: orders as any }) });
    const html = render();
    // $610.00 market value against a $516.00 basis. The multiplier is derived
    // from the broker's own market value, never assumed to be 100.
    expect(html).toContain("+$94.00");
    expect(html).toContain("+18.2%");
    expect(html).toContain("alpaca_paper");
    expect(html).toContain(">Mark ");
    expect(html).not.toContain("Stale mark");
    expect(html).not.toContain("mark-to-market is not wired");
  });

  it("says a stale mark is stale instead of presenting it as current", () => {
    const orders = [order({
      status: "filled", filledQty: 2,
      latestMark: { qty: 2, avgCostCents: 258, lastPriceCents: 305, marketValueCents: 61_000, priceAsOf: Date.now() - 60 * 60_000, priceSource: "alpaca_paper" },
    })];
    fixture.queries.desk = query({ orders, activePlays: [], attention: attention({ orders: orders as any }) });
    const html = render();
    expect(html).toContain("+$94.00");
    expect(html).toContain("Stale mark");
  });

  it("does not report a return for an order with no recorded fill", () => {
    const orders = [order({ status: "submitted", filledQty: 0, latestMark: null })];
    fixture.queries.desk = query({ orders, activePlays: [], attention: attention({ orders: orders as any }) });
    const html = render();
    expect(html).toContain("Not measured");
    expect(html).toContain("No fill is recorded, so there is nothing to mark.");
  });

  it("separates an unreadable marks source from a position the broker does not report", () => {
    const unreadable = [order({ status: "filled", filledQty: 2, latestMark: null, markSourceUnavailable: true })];
    fixture.queries.desk = query({ orders: unreadable, activePlays: [], attention: attention({ orders: unreadable as any }) });
    expect(render()).toContain("Broker position marks are unavailable");

    const absent = [order({ status: "filled", filledQty: 2, latestMark: null })];
    fixture.queries.desk = query({ orders: absent, activePlays: [], attention: attention({ orders: absent as any }) });
    expect(render()).toContain("No open position is recorded at the broker for this play.");
  });

  it("refuses to mark a price the broker reported without a timestamp or source", () => {
    const orders = [order({
      status: "filled", filledQty: 2,
      latestMark: { qty: 2, avgCostCents: 258, lastPriceCents: 305, marketValueCents: 61_000, priceAsOf: null, priceSource: null },
    })];
    fixture.queries.desk = query({ orders, activePlays: [], attention: attention({ orders: orders as any }) });
    const html = render();
    expect(html).toContain("Not measured");
    expect(html).toContain("not a fact");
  });

  it("routes a filled order to the shared monitoring task, not a new ticket", () => {
    const orders = [order({ status: "filled", filledQty: 4 })];
    const shared = attention({ orders: orders as any });
    expect(deskOrderPresentation(12, shared).href).toBe("/aperture/run/360001/execute?candidate=240002&lifecycle=monitoring");
  });

  it("treats missing order quantities as unknown rather than zero remaining", () => {
    expect(deskOrderQuantities({ qty: 4, filledQty: null })).toEqual({ ordered: "4", filled: "Not measured", remaining: "Not measured" });
    expect(deskOrderQuantities({ qty: 4, filledQty: 1 })).toEqual({ ordered: "4", filled: "1", remaining: "3" });
    expect(deskOrderQuantities({ qty: 1, filledQty: 2 }).remaining).toBe("Not measured");
    expect(deskOrderQuantities({ qty: NaN, filledQty: 0 }).remaining).toBe("Not measured");
  });

  it("does not silently fall back to the first play for an unavailable exact ID", () => {
    fixture.search = "play=99";
    fixture.queries.desk.error = new Error("Desk read failed");
    const html = render();
    expect(html).toContain('id="play-99"');
    expect(html).toContain("this does not mean the play is closed");
    expect(html).toContain("Retry selected play");
  });

  it("keeps URL filter and identity state intact through detail and back", () => {
    const original = "instrument=puts&stage=monitor&thesis=690001&account=3";
    const selected = playDeskFilterHref(original, { play: 77 });
    expect(readPlayDeskLocation(selected.split("?")[1])).toEqual({ playFilter: "puts", stageFilter: "monitor", selectedPlayId: 77, inspectOrderId: null });
    const restored = playDeskFilterHref(selected.split("?")[1], { play: null });
    expect(restored).toBe(`/aperture/plays?${original}`);
    expect(playDeskFilterHref(original, { stage: "all" })).toBe("/aperture/plays?instrument=puts&thesis=690001&account=3");
    expect(readPlayDeskLocation("play=1e3&instrument=bad&stage=bad")).toEqual({ playFilter: "all", stageFilter: "all", selectedPlayId: null, inspectOrderId: null });
    // Opening and closing the drawer must not disturb the rest of the URL.
    const inspecting = playDeskFilterHref(original, { inspect: 12 });
    expect(readPlayDeskLocation(inspecting.split("?")[1]).inspectOrderId).toBe(12);
    expect(playDeskFilterHref(inspecting.split("?")[1], { inspect: null })).toBe(`/aperture/plays?${original}`);
  });

  it("identifies out-of-filter reviews from their order instrument instead of underlying ticker", () => {
    const shared = attention({ orders: [order({ status: "approved" })] as any });
    const task = shared.primary!;
    expect(deskAttentionOutsideFilters(task, readPlayDeskLocation("instrument=calls&stage=approve"), [order()], [])).toBe(false);
    expect(deskAttentionOutsideFilters(task, readPlayDeskLocation("instrument=puts&stage=approve"), [order()], [])).toBe(true);
  });

  it("does not infer an available action when authoritative order presentation is missing", () => {
    expect(deskOrderPresentation(12, attention())).toEqual({ label: "Status unavailable", detail: "Refresh status to recover this order's recorded next action.", action: "Refresh status", href: null });
  });
});

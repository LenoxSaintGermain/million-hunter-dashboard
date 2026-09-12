/**
 * The inspection drawer's contents.
 *
 * The body is rendered directly rather than through the Sheet: a Radix portal
 * does not survive `renderToStaticMarkup`, and a panel whose claims are only
 * checked by reading its source is not checked. The Sheet wrapper's own
 * accessibility wiring is asserted separately, on the desk's trigger.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { PlayInspectionBody, type InspectableOrder } from "../../client/src/components/aperture/PlayInspectionDrawer";

const NOW = Date.UTC(2026, 8, 11, 19, 40);

const order = (over: Partial<InspectableOrder> = {}): InspectableOrder => ({
  id: 12, runId: 360001, candidateId: 240002,
  symbol: "MGM261120C00040000", underlyingSymbol: "MGM", instrumentType: "long_call",
  optionExpirationDate: "2026-11-20", optionStrikePriceCents: 4_000,
  accountLabel: "Alpaca Paper — UAT", thesisName: "Illustrative leisure thesis",
  reason: "Illustrative recorded rationale.", side: "buy", intent: "open",
  status: "filled", qty: 1, filledQty: 1, notionalCents: 42_000, plannedRiskCents: 42_000,
  holdingPeriod: "catalyst_window", brokerOrderId: "paper-12", clientOrderId: "coid-abc",
  filledAvgPriceCents: 420, dispatchError: null, timeStopAt: NOW + 86_400_000,
  createdAt: NOW - 3_600_000, updatedAt: NOW - 60_000,
  latestMark: { qty: 1, avgCostCents: 420, lastPriceCents: 265, marketValueCents: 26_500, priceAsOf: NOW - 60_000, priceSource: "alpaca_paper" },
  monitoring: [],
  ...over,
});

const render = (props: Partial<Parameters<typeof PlayInspectionBody>[0]> = {}) => load(renderToStaticMarkup(
  React.createElement(PlayInspectionBody, {
    order: order(), stateLabel: "Open position", humanReviewAt: null,
    reviewsUnavailable: false, now: NOW, ...props,
  }),
));

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

describe("broker receipts", () => {
  it("shows the exact identifiers needed to reconcile a ticket by hand", () => {
    const text = render().text();
    expect(text).toContain("paper-12");
    expect(text).toContain("coid-abc");
    expect(text).toContain("MGM261120C00040000");
    expect(text).toContain("Alpaca Paper — UAT");
  });

  it("states the absence of each receipt instead of leaving it blank", () => {
    const text = render({ order: order({ brokerOrderId: null, clientOrderId: null, filledAvgPriceCents: null }) }).text();
    expect(text).toContain("no broker acknowledgement is recorded");
    expect(text).toContain("predates persisted idempotency keys");
    expect(text).toContain("A filled quantity without a price is not a confirmed execution");
    expect(text).not.toContain("$0.00");
  });

  it("calls a dispatch failure a transport failure, not a rejection", () => {
    const $ = render({ order: order({ dispatchError: "Receipt unavailable" }) });
    const alert = $('[role="alert"]');
    expect(alert).toHaveLength(1);
    expect(alert.text()).toContain("not a broker rejection");
    expect(alert.text()).toContain("may or may not exist at the broker");
  });
});

describe("instrument identity", () => {
  it("keeps the raw contract alongside the readable label", () => {
    const text = render().text();
    expect(text).toContain("MGM · $40 Call · Nov 20, 2026");
    expect(text).toContain("MGM261120C00040000");
    expect(text).toContain("2026-11-20");
  });

  it("omits option terms for a share ticket and keeps the modeled-stop warning", () => {
    const text = render({ order: order({ symbol: "IWM", underlyingSymbol: "IWM", instrumentType: "shares", optionExpirationDate: null, optionStrikePriceCents: null }) }).text();
    expect(text).toContain("Planned loss at modeled stop");
    expect(text).toContain("Stop execution may differ from the modeled price");
    expect(text).not.toContain("Raw OCC symbol");
  });
});

describe("thesis context", () => {
  it("shows the named thesis and the recorded rationale", () => {
    const text = render().text();
    expect(text).toContain("Illustrative leisure thesis");
    expect(text).toContain("Illustrative recorded rationale.");
  });

  it("does not let a missing rationale read as no rationale being needed", () => {
    const text = render({ order: order({ thesisName: null, reason: null }) }).text();
    expect(text).toContain("No named thesis is linked to this run.");
    expect(text).toContain("Open the full record before acting on it.");
  });

  it("keeps a time stop a review point rather than an exit", () => {
    const text = render({ order: order({ timeStopAt: null }) }).text();
    expect(text).toContain("never an automatic exit");
  });

  it("separates an unreadable review source from a recorded absence", () => {
    expect(render({ reviewsUnavailable: true }).text()).toContain("absence here does not mean no checkpoint exists");
    expect(render({ reviewsUnavailable: false }).text()).toContain("not proof that an automatic check or exit occurred");
  });
});

describe("monitoring", () => {
  it("shows a finding with its sources and check time", () => {
    const $ = render({ order: order({ monitoring: [{
      id: 24, checkType: "thesis_invalidation", finding: "Illustrative unresolved finding.",
      flagged: true, citations: ["https://example.org/fixture"], checkedAt: NOW - 60_000,
    }] }) });
    expect($.text()).toContain("Illustrative unresolved finding.");
    expect($.text()).toContain("thesis invalidation · flagged");
    expect($('a[href="https://example.org/fixture"]').attr("rel")).toBe("noopener noreferrer");
  });

  it("marks a check older than the freshness window as stale", () => {
    const $ = render({ order: order({ monitoring: [{
      id: 24, checkType: "catalyst", finding: "Illustrative finding.", checkedAt: NOW - 48 * 60 * 60_000, citations: [],
    }] }) });
    expect($.text()).toContain("· stale");
    expect($.text()).toContain("No source links recorded; this finding is unverified.");
  });

  it("refuses to render a non-http citation as a link", () => {
    const $ = render({ order: order({ monitoring: [{
      id: 24, checkType: "macro", finding: "Illustrative finding.", checkedAt: NOW, citations: ["javascript:alert(1)"],
    }] }) });
    expect($("a")).toHaveLength(0);
    expect($.text()).toContain("link unavailable");
  });

  it("says an absence of checks is not an all-clear", () => {
    expect(render().text()).toContain("That is an absence of evidence, not an all-clear.");
  });
});

describe("return and disclosure", () => {
  it("marks the position from the broker mark with its provenance", () => {
    const text = render().text();
    // basis (26_500/265)*420 = 42_000 against a 26_500 market value.
    expect(text).toContain("−$155.00");
    expect(text).toContain("alpaca_paper");
  });

  it("states that inspecting changes nothing", () => {
    expect(render().text()).toContain("acknowledges no finding, resolves no review, and moves no order");
  });
});

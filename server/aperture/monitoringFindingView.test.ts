import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { monitoringFindingVersion } from "../../shared/monitoringFinding";

const fixture = vi.hoisted(() => ({ checks: [] as any[], receipts: [] as any[], mutate: vi.fn(), refetch: vi.fn(), navigate: vi.fn(), failed: false }));
vi.mock("@/lib/trpc", () => ({ trpc: { aperture: { monitor: {
  list: { useQuery: () => ({ data: fixture.checks, isLoading: false, isError: fixture.failed, refetch: fixture.refetch }) },
  run: { useMutation: () => ({ isPending: false, mutate: fixture.mutate }) },
  reviews: {
    list: { useQuery: () => ({ data: { receipts: fixture.receipts }, isLoading: false, isError: false, refetch: fixture.refetch }) },
    record: { useMutation: () => ({ isPending: false, isError: false, mutate: fixture.mutate, reset: vi.fn() }) },
  },
} } } }));
import { MonitoringPanel } from "../../client/src/pages/aperture/ApertureExecute";
import { revealMonitoringFinding } from "../../client/src/components/aperture/MonitoringFindingReview";

const checkedAt = Date.UTC(2026, 8, 7, 18);
const check = { id: 1, runId: 360001, candidateId: 240003, checkType: "catalyst", symbol: "DKNG", checkedAt, flagged: true, finding: "Illustrative catalyst concern", citations: ["https://example.org/fixture"] };
const order = { id: 12, runId: 360001, candidateId: 240003, status: "filled", symbol: "DKNG261120P00020000", instrumentType: "long_put", underlyingSymbol: "DKNG", reason: "Illustrative recorded put rationale" };
const selection = { orderId: 12, findingId: 1, findingVersion: monitoringFindingVersion(check) };
const render = (selected: typeof selection | null = selection, selectedOrder: any = order) => renderToStaticMarkup(React.createElement(MonitoringPanel, { runId: check.runId, candidate: { id: check.candidateId, symbol: check.symbol }, order: selectedOrder, selection: selected, onOpenFinding: fixture.navigate }));

beforeEach(() => {
  vi.stubGlobal("React", React); fixture.checks = [check, { ...check, id: 4, checkType: "macro", flagged: false }]; fixture.receipts = []; fixture.failed = false;
  fixture.mutate.mockClear(); fixture.refetch.mockClear(); fixture.navigate.mockClear();
});

describe("monitoring finding decision view", () => {
  it("waits for the exact play context instead of reporting a missing finding during hydration", () => {
    fixture.checks = [];
    const html = renderToStaticMarkup(React.createElement(MonitoringPanel, {
      runId: check.runId, selection, onOpenFinding: fixture.navigate,
      contextState: "loading",
    }));
    expect(html).toContain("Loading selected play and order");
    expect(html).not.toContain("could not be matched");
    expect(html).not.toContain("No monitoring checks recorded");
    expect(html).not.toContain("Review the order status first");
    expect(fixture.mutate).not.toHaveBeenCalled();
    expect(fixture.refetch).not.toHaveBeenCalled();
  });
  it("does not turn a failed context read into missing evidence or an empty queue", () => {
    fixture.checks = [];
    const html = renderToStaticMarkup(React.createElement(MonitoringPanel, {
      runId: check.runId, selection, contextState: "failed", onOpenFinding: fixture.navigate,
      onRetryContext: fixture.refetch,
    }));
    expect(html).toContain("Selected play or order could not refresh");
    expect(html).toContain("Retry play and order");
    expect(html).not.toContain("could not be matched");
    expect(html).not.toContain("No monitoring checks recorded");
    expect(fixture.mutate).not.toHaveBeenCalled();
    expect(fixture.refetch).not.toHaveBeenCalled();
  });
  it("keeps last successful evidence visible on a context refresh failure without allowing new checks", () => {
    const html = renderToStaticMarkup(React.createElement(MonitoringPanel, {
      runId: check.runId, candidate: { id: check.candidateId, symbol: check.symbol },
      order: order as any, selection, contextState: "failed", onOpenFinding: fixture.navigate,
      onRetryContext: fixture.refetch,
    }));
    expect(html).toContain("No monitoring eligibility is confirmed");
    expect(html).toContain('data-selected-monitoring-finding="1"');
    expect(html).toContain("Illustrative catalyst concern");
    expect(html).not.toContain("Refresh sourced checks");
    expect(fixture.mutate).not.toHaveBeenCalled();
  });
  it("leads with the selected stale finding and exact put while retaining other checks without mutations", () => {
    const html = render();
    expect(html.indexOf('data-selected-monitoring-finding="1"')).toBeLessThan(html.indexOf('id="monitoring-check-4"'));
    expect(html).toContain("Unresolved finding · stale evidence");
    expect(html).toContain("DKNG · $20 Put · Nov 20, 2026");
    expect(html).toContain("Illustrative recorded put rationale");
    expect(html).toContain("What is your assessment?");
    expect(html).not.toContain("Review saved");
    expect(fixture.mutate).not.toHaveBeenCalled(); expect(fixture.refetch).not.toHaveBeenCalled(); expect(fixture.navigate).not.toHaveBeenCalled();
  });
  it("keeps the selected old version visible when a new check arrives, without duplicating it in history", () => {
    fixture.checks = [{ ...check, id: 5, checkedAt: Date.now(), flagged: false }, ...fixture.checks];
    const html = render();
    expect(html).toContain("Selected historical finding");
    expect(html.match(/id="monitoring-check-1"/g)).toHaveLength(1);
    expect(html).toContain('id="monitoring-check-5"');
    expect(html).toContain("not a current market claim");
    expect(fixture.mutate).not.toHaveBeenCalled();
  });
  it("shows a durable receipt without changing the unresolved status or auto-refreshing checks", () => {
    fixture.receipts = [{ ...selection, runId: check.runId, candidateId: check.candidateId, userId: 7, requestId: "receipt", decision: "needs_fresh_evidence", note: "Recheck the dated source.", reviewedAt: checkedAt + 1, resolved: false }];
    const html = render();
    expect(html).toContain("Review saved · Needs fresh evidence");
    expect(html).toContain("Unresolved finding · stale evidence");
    expect(html).toContain("No check was scheduled or order changed");
    expect(fixture.mutate).not.toHaveBeenCalled();
  });
  it("does not show a review form for the wrong order or a missing finding version", () => {
    for (const html of [render({ ...selection, findingId: 99 }), render(selection, { ...order, id: 13 })]) {
      expect(html).toContain("No other finding has been substituted");
      expect(html).not.toContain("What is your assessment?");
    }
    expect(fixture.mutate).not.toHaveBeenCalled();
  });
  it("retains selected evidence through a failed read without presenting an all-clear", () => {
    fixture.failed = true;
    const html = render();
    expect(html).toContain("Recorded monitoring could not load");
    expect(html).toContain('data-selected-monitoring-finding="1"');
    expect(html).toContain("Illustrative catalyst concern");
  });
  it("reveals just the selected evidence; user interaction prevents focus or scroll theft", () => {
    const evidence = { open: false }, history = { open: false };
    const element = { querySelectorAll: () => [evidence, history], focus: vi.fn(), scrollIntoView: vi.fn() };
    revealMonitoringFinding(element as any, true);
    expect(evidence.open).toBe(true); expect(history.open).toBe(false);
    expect(element.focus).not.toHaveBeenCalled(); expect(element.scrollIntoView).not.toHaveBeenCalled();
    revealMonitoringFinding(element as any);
    expect(element.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(element.scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
  });
});

import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TodayAttentionBriefing } from "../../client/src/components/aperture/TodayAttentionBriefing";
import { DailyPlayList, IntradayTrigger } from "../../client/src/components/aperture/DailyPlayList";
import { deriveApertureAttention, type ApertureAttentionInput } from "../../shared/apertureAttention";

const mocks = vi.hoisted(() => {
  const query = () => ({ data: undefined as any, isLoading: true, isFetching: true, error: null as null | { message: string }, refetch: vi.fn() });
  return { account: query(), thesis: query(), desk: query(), plays: query(), runway: query(), cockpit: query(), trigger: query(), mutate: vi.fn(), invalidate: vi.fn() };
});
vi.mock("@/lib/trpc", () => ({ trpc: {
  aperture: {
    account: { list: { useQuery: () => mocks.account } },
    cockpit: { useQuery: () => mocks.cockpit },
    desk: { summary: { useQuery: () => mocks.desk }, markSeen: { useMutation: () => ({ mutate: mocks.mutate }) } },
    play: { list: { useQuery: () => mocks.plays }, trigger: { useQuery: () => mocks.trigger }, decide: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) } },
    runway: { latest: { useQuery: () => mocks.runway } },
    ledger: { captureCurrentWindow: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) } },
  },
  thesis: { activeCapital: { useQuery: () => mocks.thesis } },
  useUtils: () => ({ aperture: { play: { list: { invalidate: mocks.invalidate } }, ledger: { list: { invalidate: mocks.invalidate } } } }),
} }));

const now = Date.UTC(2026, 8, 9, 14);
function briefing(overrides: Partial<ApertureAttentionInput> = {}) {
  return deriveApertureAttention({
    now, mission: { decisionRunId: 1, revisionId: 2, state: "complete", title: "Illustrative test mission", updatedAt: now },
    underwriting: null, evidenceTasks: [], orders: [], activePlays: [], pendingReviews: [], monitoringFindings: [],
    checks: { state: "complete", asOf: now, monitoring: "on_demand" }, ...overrides,
  }, null);
}
function render(attention = briefing(), overrides: { loading?: boolean; failed?: string } = {}) {
  return renderToStaticMarkup(createElement(TodayAttentionBriefing, {
    attention, accountLabel: "Fixture Paper", modeLabel: "Paper", loading: false, failed: null,
    onOpen: vi.fn(), onRetry: vi.fn(), onNewMission: vi.fn(), ...overrides,
  }));
}

describe("Today component rendering against deterministic records", () => {
  // This server-only Vitest config uses classic JSX, unlike Vite's client plugin.
  beforeAll(() => vi.stubGlobal("React", React));
  afterAll(() => vi.unstubAllGlobals());
  beforeEach(() => {
    for (const query of [mocks.account, mocks.thesis, mocks.desk, mocks.plays, mocks.runway, mocks.cockpit, mocks.trigger]) {
      query.data = undefined; query.isLoading = true; query.isFetching = true; query.error = null;
    }
    mocks.mutate.mockClear();
  });

  const rawFailure = "SQL_UAT_SENTINEL: select private_payload from internal_table; /api/trpc failed at db.ts:401";

  it("never prints raw query failures in the briefing or research queue", () => {
    for (const query of [mocks.account, mocks.thesis, mocks.desk, mocks.plays]) {
      query.isLoading = false; query.isFetching = false; query.error = { message: rawFailure };
    }
    mocks.desk.data = { attention: briefing() };
    const html = renderToStaticMarkup(createElement(DailyPlayList, { onNewMission: vi.fn(), onNewResearch: vi.fn(), onOpenRun: vi.fn() }));
    expect(html).not.toContain("SQL_UAT_SENTINEL");
    expect(html).not.toContain("private_payload");
    expect(html).toContain("Research queue could not be refreshed");
    expect(html).toContain("Retry research queue");
    expect(html).not.toContain("No new action identified in recorded status");
  });

  it("sanitizes the failed prop even if the caller sends a raw API error", () => {
    const html = render(briefing(), { failed: rawFailure });
    expect(html).not.toContain("SQL_UAT_SENTINEL");
    expect(html).toContain("Retry status refresh");
    expect(html).not.toContain("No new action identified in recorded status");
  });

  it("sanitizes trigger read failures without implying confirmation", () => {
    mocks.trigger.isLoading = false; mocks.trigger.error = { message: rawFailure };
    const html = renderToStaticMarkup(createElement(IntradayTrigger, { runId: 1, candidateId: 2, holdingPeriod: "intraday" }));
    expect(html).not.toContain("SQL_UAT_SENTINEL");
    expect(html).toContain("Trigger could not be verified");
    expect(html).toContain("Refresh trigger evidence");
    expect(html).toContain("No entry confirmation is implied");
  });

  it.each(["failed", "partial", "stale"] as const)("sanitizes %s read reasons carried by shared attention", state => {
    const result = briefing({ checks: { state, asOf: now, monitoring: "on_demand", error: rawFailure } });
    expect(JSON.stringify(result)).not.toContain("SQL_UAT_SENTINEL");
    expect(result.quiet).toBe(false);
    expect(result.primary?.actionLabel).toBe("Refresh status");
  });

  it("does not expose stored underwriting or dispatch exceptions as operator copy", () => {
    const result = briefing({
      underwriting: { decisionRunId: 1, revisionId: 2, state: "failed", error: rawFailure, updatedAt: now },
      orders: [{ id: 9, runId: 10, candidateId: 11, symbol: "MGM", status: "submitted", qty: 1, filledQty: 0, brokerOrderId: null, dispatchError: rawFailure, updatedAt: now }],
    });
    expect(JSON.stringify(result)).not.toContain("SQL_UAT_SENTINEL");
    expect(result.primary?.kind).toBe("dispatch_unresolved");
    expect(render(result)).toContain("Reconcile dispatch");
  });

  it("shows a no-trade reopening condition without sending an empty portfolio to monitoring", () => {
    const html = render(briefing({ underwriting: { decisionRunId: 1, revisionId: 2, state: "complete", outcome: "no_trade", reopenCondition: "Portfolio headroom restored", updatedAt: now } }));
    expect(html).toContain("No-trade reopening condition");
    expect(html).toContain("Portfolio headroom restored");
    expect(html).not.toContain("Review monitoring");
  });

  it("omits Next checkpoint when no-trade has no recorded review or reopening condition", () => {
    const html = render(briefing({ underwriting: { decisionRunId: 1, revisionId: 2, state: "complete", outcome: "no_trade", updatedAt: now } }));
    expect(html).not.toContain("Next checkpoint");
    expect(html).not.toContain("Review monitoring");
  });

  it("does not render a cached all-clear after refresh failure", () => {
    const html = render(briefing(), { failed: "Orders temporarily unavailable" });
    expect(html).toContain("Current status could not be verified");
    expect(html).toContain("Last successful records remain below");
    expect(html).not.toContain("No new action identified in recorded status");
    expect(html).toContain("Retry status refresh");
  });

  it("does not render a cached all-clear while a refresh is running", () => {
    const html = render(briefing(), { loading: true });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Refreshing recorded status");
    expect(html).not.toContain("No new action identified in recorded status");
  });

  it.each(["partial", "stale", "empty", "loading", "failed"] as const)("renders a recovery instead of no action for %s", state => {
    const html = render(briefing({ checks: { state, asOf: now, monitoring: "on_demand" } }));
    expect(html).not.toContain("No new action identified in recorded status");
    expect(html).toContain("Refresh status");
  });

  it("shows a ready playbook and its reason once, with the exact research destination", () => {
    const html = render(briefing({ underwriting: { decisionRunId: 1, revisionId: 2, state: "complete", outcome: "plays", resultSummary: "Two conditional choices fit the recorded mission", updatedAt: now } }));
    expect(html).toContain("Two conditional choices fit the recorded mission");
    expect(html.match(/data-attention-key="underwriting:1:complete"/g)).toHaveLength(1);
    expect(html).toContain("Validate a play to enter evidence review");
    expect(html).not.toContain("No new action identified in recorded status");
  });

  it("does not mount a collapsed result as a displayed/seen item", () => {
    const html = render(briefing({ underwriting: { decisionRunId: 1, revisionId: 2, state: "complete", outcome: "no_trade", resultSummary: "Hidden result detail", updatedAt: now } }));
    expect(html).toContain("Current status");
    expect(html).not.toContain("Hidden result detail");
    expect(html).not.toContain('data-attention-key="underwriting:1:complete"');
  });

  it("renders other critical issues in the open, not inside the optional change disclosure", () => {
    const html = render(briefing({
      orders: [{ id: 9, runId: 10, candidateId: 11, symbol: "MGM", status: "submitted", qty: 1, filledQty: 0, dispatchError: "Unresolved dispatch", updatedAt: now }],
      monitoringFindings: [{ id: 4, orderId: 19, runId: 20, candidateId: 21, symbol: "WBD", kind: "invalidation", finding: "Recorded catalyst changed", checkedAt: now }],
    }));
    expect(html).toContain("Reconcile MGM paper dispatch");
    expect(html).toContain("Recorded catalyst changed");
    expect(html).toContain("All authorized plays, regardless of thesis or instrument filters");
    expect(html).not.toContain("Run updated checks");
  });

  it("renders receipt-less submission as critical reconciliation without an error string", () => {
    const html = render(briefing({ orders: [{ id: 9, runId: 10, candidateId: 11, symbol: "MGM", status: "submitted", qty: 3, filledQty: 1, brokerOrderId: null, dispatchError: "", updatedAt: now }] }));
    expect(html).toContain("Dispatch unresolved");
    expect(html).toContain("Reconcile dispatch");
    expect(html).toContain("1 filled · 2 remaining");
    expect(html).not.toContain("Paper broker accepted");
    expect(html).not.toContain("No new action identified in recorded status");
  });

  it("does not call an empty research list a new cash decision", () => {
    mocks.plays.data = { plays: [], inMotionPlayCount: 0, expiredPlayCount: 0 };
    mocks.plays.isLoading = false; mocks.plays.isFetching = false;
    const html = renderToStaticMarkup(createElement(DailyPlayList, { onNewMission: vi.fn(), onNewResearch: vi.fn(), onOpenRun: vi.fn() }));
    expect(html).toContain("No research candidate awaiting a choice");
    expect(html).toContain("An empty queue does not record a cash decision");
    expect(html).not.toContain("CASH · $0 risk");
    expect(html).not.toContain("No active Capital thesis");
    expect(html).toContain("Loading active thesis");
    expect(html).toContain("Loading paper account");
    expect(html).not.toContain("Account not selected");
    expect(html).not.toContain("No execution account selected");
  });

  it("renders a failed research query as unavailable, never as an empty/cash state", () => {
    mocks.plays.isLoading = false; mocks.plays.isFetching = false; mocks.plays.error = { message: "Queue unavailable" };
    const html = renderToStaticMarkup(createElement(DailyPlayList, { onNewMission: vi.fn(), onNewResearch: vi.fn(), onOpenRun: vi.fn() }));
    expect(html).toContain("Research queue could not be refreshed");
    expect(html).toContain("An unavailable queue is not an empty queue");
    expect(html).not.toContain("No research candidate awaiting a choice");
    expect(html).not.toContain("CASH · $0 risk");
  });
});

import { OPERATING_INVARIANT } from "../../shared/operatingInvariant";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { arbitrateTodayRead, deriveApertureAttention, type ApertureAttentionInput, type ApertureAttentionItem } from "../../shared/apertureAttention";

const fixture = vi.hoisted(() => ({ search: "", queries: {} as Record<string, any>, navigate: vi.fn(), refetch: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/aperture/plays", fixture.navigate], useSearch: () => fixture.search }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: any) => children }));
vi.mock("@/lib/trpc", () => ({ trpc: { aperture: {
  desk: { summary: { useQuery: () => fixture.queries.desk } },
  run: { list: { useQuery: () => fixture.queries.runs } },
  play: { list: { useQuery: () => fixture.queries.plays } },
  runway: { pending: { useQuery: () => fixture.queries.outcomes } },
} } }));
import AperturePlayDesk from "../../client/src/pages/aperture/AperturePlayDesk";
import { AttentionDecisionCard } from "../../client/src/components/aperture/AttentionDecisionCard";
import { Button } from "../../client/src/components/ui/button";

const now = Date.UTC(2026, 8, 9, 18);
const query = (data: unknown) => ({ data, error: null, isLoading: false, isFetching: false, dataUpdatedAt: now, refetch: fixture.refetch });
const orders = [
  { id: 12, runId: 360001, candidateId: 240003, accountId: 3, accountLabel: "Illustrative Paper", symbol: "DKNG261120P00020000", instrumentType: "long_put" as const, status: "submitted" as const, qty: 1, filledQty: 0, brokerOrderId: null, dispatchError: "Receipt unavailable", updatedAt: now },
  { id: 13, runId: 360001, candidateId: 240002, accountId: 3, accountLabel: "Illustrative Paper", symbol: "MGM261120C00040000", instrumentType: "long_call" as const, status: "filled" as const, qty: 1, filledQty: 1, brokerOrderId: "fixture-13", dispatchError: null, updatedAt: now },
];
const input = (): ApertureAttentionInput => ({
  now, mission: null, underwriting: null, evidenceTasks: [], orders, activePlays: [],
  pendingReviews: [{ id: 17, kind: "gate_review", dueAt: now - 60_000, updatedAt: now, title: "Illustrative gate review", href: "/aperture/decision/8/revision/9" }],
  monitoringFindings: [{ id: 24, orderId: 13, runId: 360001, candidateId: 240002, symbol: "MGM", kind: "material_change", checkType: "catalyst", checkedAt: now - 90_000_000, finding: "Illustrative unresolved catalyst finding; not a live market claim.", citations: ["https://example.org/fixture"], rationale: "Illustrative call rationale" }],
  checks: { state: "stale", asOf: now, monitoring: "on_demand" },
});
const render = () => load(renderToStaticMarkup(React.createElement(AperturePlayDesk)));
const visibleText = (html: string) => { const $ = load(html); $("details").remove(); return $.text(); };

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.clearAllMocks();
  fixture.search = "";
  fixture.queries = {
    desk: query({ orders, activePlays: [], attention: deriveApertureAttention(input(), null) }),
    runs: query([]), plays: query({ plays: [] }), outcomes: query([]),
  };
});

describe("Play Desk compact attention — illustrative records, no API calls", () => {
  it("keeps the read-only header compact without losing refresh scope or stale warnings", () => {
    const $ = render();
    const header = $('header[data-desk-header]');
    expect(header.find('h1').text()).toBe('Play Desk');
    expect(header.attr('class')).toContain('flex-wrap');
    expect(header.find('button').attr('class')).toContain('min-h-11');
    expect(header.find('button').attr('aria-describedby')).toBe('desk-refresh-scope');
    expect($('#desk-refresh-scope time').attr('datetime')).toBe(new Date(now).toISOString());
    expect($('#desk-refresh-scope').text()).toContain('Refresh reads records only; no new checks.');
    expect($('h1')).toHaveLength(1);
    expect($.text()).not.toContain('Choose a play, move a paper ticket');
    expect($.text()).toContain('Recorded checks: stale. Status is not an all-clear.');
    expect(fixture.refetch).not.toHaveBeenCalled();
  });

  it.each(["", "instrument=shares", "instrument=puts&stage=choose", "instrument=calls&stage=approve"])("keeps one primary and every critical row exposed for %s", (search) => {
    fixture.search = search;
    const $ = render();
    const briefing = arbitrateTodayRead({ briefing: fixture.queries.desk.data.attention, refreshing: false, failed: false }).layout!;
    expect($("#desk-attention [data-attention-layout=primary]")).toHaveLength(1);
    expect($("#desk-critical [data-attention-layout=compact]")).toHaveLength(briefing.otherCritical.length);
    for (const item of [briefing.primary, ...briefing.otherCritical]) {
      const card = $(`[data-attention-key="${item.key}"]`);
      expect(card).toHaveLength(1);
      expect(card.parents("details,[hidden]")).toHaveLength(0);
      const glance = visibleText($.html(card));
      expect(glance).toContain(item.title);
      expect(glance).toContain(item.reason);
      expect(glance).toContain(item.actionLabel);
    }
    expect($("#desk-attention [data-attention-key]").length).toBeGreaterThan(1);
    expect(fixture.navigate).not.toHaveBeenCalled();
    expect(fixture.refetch).not.toHaveBeenCalled();
  });

  it("preserves the out-of-filter count and keeps secondary rows before the filters", () => {
    fixture.search = "instrument=shares&stage=choose";
    const $ = render();
    expect($("#desk-attention").text()).toContain("3 critical issues outside these filters");
    expect($("#desk-attention").text()).toContain("Show all plays and stages");
    expect($.html().indexOf('id="desk-critical"')).toBeLessThan($.html().indexOf('aria-label="Filter by workflow stage"'));
  });

  it("keeps dispatch uncertainty and anti-duplicate instructions outside disclosures", () => {
    const $ = render();
    const glance = visibleText($.html($("#desk-attention")));
    expect(glance).toContain("Broker acceptance is not confirmed. Do not submit a duplicate order.");
  });

  it("exposes recorded check time and due time without expanding Evidence", () => {
    const $ = render();
    const checked = $('#desk-critical time[data-attention-time="checked"]');
    const deadline = $('#desk-critical time[data-attention-time="deadline"]');
    expect(checked.attr("datetime")).toBe(new Date(now - 90_000_000).toISOString());
    expect(deadline.attr("datetime")).toBe(new Date(now - 60_000).toISOString());
    expect(checked.parents("details")).toHaveLength(0);
    expect(deadline.parents("details")).toHaveLength(0);
    expect($("#desk-critical details a").attr("href")).toBe("https://example.org/fixture");
  });

  it("uses one-column reading order until desktop and wrapping 44px actions", () => {
    const $ = render();
    const rows = $("#desk-critical [data-attention-layout=compact]");
    expect(rows.length).toBeGreaterThan(0);
    rows.each((_, row) => {
      expect($(row).find("[data-attention-row]").attr("class")).toContain("grid-cols-1");
      expect($(row).find("[data-attention-row]").attr("class")).toContain("lg:grid-cols-");
      $(row).find("button,summary").each((__, control) => {
        expect($(control).attr("class")).toContain("min-h-11");
      });
      expect($(row).find("button").attr("class")).toContain("h-auto");
      expect($(row).find("button").attr("class")).toContain("whitespace-normal");
      expect($(row).find("h3").attr("class")).toContain("text-base");
      expect($(row).find("[class*=truncate],[class*=line-clamp]")).toHaveLength(0);
    });
  });

  it("keeps arbitrary warnings visible, even when they resemble routine copy", () => {
    const item: ApertureAttentionItem = { ...fixture.queries.desk.data.attention.otherCritical[0], consequence: "Account snapshot is stale. Do not submit to Illustrative Paper until refreshed." };
    const html = renderToStaticMarkup(React.createElement(AttentionDecisionCard, { item, compact: true, onOpen: fixture.navigate }));
    expect(visibleText(html)).toContain(item.consequence);
  });

  it.each(["empty", "partial", "stale", "failed"] as const)("does not turn %s checks into an all-clear or conceal existing critical records", (state) => {
    fixture.queries.desk.data.attention = deriveApertureAttention({ ...input(), checks: { state, asOf: now, monitoring: "on_demand" } }, null);
    const $ = render();
    const glance = visibleText($.html());
    expect(glance).not.toContain("No new action identified");
    expect(glance).toContain("not an all-clear");
    expect($('[data-attention-key="order:12:dispatch"]')).toHaveLength(1);
    expect($('[data-attention-key="review:17"]').parents("details,[hidden]")).toHaveLength(0);
    expect(fixture.refetch).not.toHaveBeenCalled();
  });

  it("does not manufacture critical rows for an empty returned record set", () => {
    fixture.queries.desk.data = { orders: [], activePlays: [], attention: deriveApertureAttention({ ...input(), orders: [], monitoringFindings: [], pendingReviews: [], checks: { state: "empty", asOf: null, monitoring: "on_demand" } }, null) };
    const $ = render();
    expect($("#desk-critical")).toHaveLength(0);
    expect(visibleText($.html())).toContain("not an all-clear");
    expect(visibleText($.html())).not.toContain("No new action identified");
  });

  it("keeps the last recorded critical issues visible during a refresh", () => {
    fixture.queries.desk.isFetching = true;
    const $ = render();
    expect(visibleText($.html())).toContain("Loading status; existing records stay visible.");
    expect($('[data-attention-key="order:12:dispatch"]').parents("details,[hidden]")).toHaveLength(0);
    expect(visibleText($.html())).toContain("Do not submit a duplicate order.");
    expect(fixture.refetch).not.toHaveBeenCalled();
  });

  it.each([true, false])("exposes missing source and timestamp uncertainty before Evidence for compact=%s", (compact) => {
    const item: ApertureAttentionItem = { ...fixture.queries.desk.data.attention.otherCritical.find((item: ApertureAttentionItem) => item.evidence), evidence: { finding: "Illustrative unsourced finding", citations: [], checkedAt: NaN, rationale: null } };
    const html = renderToStaticMarkup(React.createElement(AttentionDecisionCard, { item, compact, prominent: !compact, onOpen: fixture.navigate }));
    const glance = visibleText(html);
    expect(glance).toContain("No source links recorded; finding unverified.");
    expect(glance).toContain("Check time not recorded.");
    expect(glance).not.toContain("Invalid Date");
  });

  it.each([true, false])("a busy compact=%s action has visible associated explanation without hiding its warning", (compact) => {
    const item: ApertureAttentionItem = { ...fixture.queries.desk.data.attention.otherCritical[0], consequence: "Do not resubmit: broker acceptance is unresolved." };
    const $ = load(renderToStaticMarkup(React.createElement(AttentionDecisionCard, { item, compact, prominent: !compact, busy: true, onOpen: fixture.navigate })));
    const action = $("button").first();
    expect(action.attr("aria-disabled")).toBe("true");
    const explanation = $(`[id="${action.attr("aria-describedby")}"]`);
    expect(explanation.attr("role")).toBe("status");
    expect(explanation.parents("details,[hidden]")).toHaveLength(0);
    expect(explanation.text()).toContain("Refreshing this task.");
    expect(visibleText($.html())).toContain(item.consequence);
    expect(fixture.navigate).not.toHaveBeenCalled();
  });

  // Superseded deliberately. The row used to repeat the no-automation warning,
  // which put the same sentence in the viewport three or four times and pushed
  // the decision down. The claim is not dropped: OPERATING_INVARIANT states it
  // once for the whole workspace, and the full sentence stays on the row behind
  // its disclosure. Only exactly-known routine copy defers this way - see
  // shared/operatingInvariant.test.ts.
  it("defers the repeated no-automation warning to the workspace banner, keeping it on the row behind Evidence", () => {
    const $ = render();
    const row = $('[data-attention-key="review:17"]');
    expect(visibleText($.html(row))).not.toContain("Human review; no automatic check or exit.");
    expect(row.find("details").text()).toContain("This is a human checkpoint, not proof that an automatic check or exit occurred.");
    // The claim itself must still be made somewhere the operator sees it.
    expect(OPERATING_INVARIANT).toMatch(/automatically/i);
  });

  it("opening the exact row only calls navigation; a busy row cannot dispatch an action", () => {
    const item = fixture.queries.desk.data.attention.otherCritical[0];
    const findButton = (node: React.ReactNode): React.ReactElement<any> | undefined => {
      if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return;
      if (node.type === Button) return node;
      return React.Children.toArray(node.props.children).map(findButton).find(Boolean);
    };
    const tree = AttentionDecisionCard({ item, compact: true, onOpen: fixture.navigate });
    expect(fixture.navigate).not.toHaveBeenCalled();
    findButton(tree)!.props.onClick();
    expect(fixture.navigate).toHaveBeenCalledTimes(1);
    expect(fixture.navigate).toHaveBeenCalledWith(item.href);
    const busy = AttentionDecisionCard({ item, compact: true, onOpen: fixture.navigate, busy: true });
    findButton(busy)!.props.onClick();
    expect(fixture.navigate).toHaveBeenCalledTimes(1);
    expect(fixture.refetch).not.toHaveBeenCalled();
  });
});

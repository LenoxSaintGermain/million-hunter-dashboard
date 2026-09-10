import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deriveApertureAttention } from "../../shared/apertureAttention";

const fixture = vi.hoisted(() => ({ search: "", queries: {} as Record<string, any>, buttons: [] as any[], navigate: vi.fn(), refetch: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/aperture/plays", fixture.navigate], useSearch: () => fixture.search }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: any) => children }));
vi.mock("@/lib/trpc", () => ({ trpc: { aperture: {
  desk: { summary: { useQuery: () => fixture.queries.desk } },
  run: { list: { useQuery: () => fixture.queries.runs } },
  play: { list: { useQuery: () => fixture.queries.plays } },
  runway: { pending: { useQuery: () => fixture.queries.outcomes } },
} } }));
vi.mock("@/components/ui/button", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../client/src/components/ui/button")>();
  // Capture the page's actual event handler while rendering the real Button.
  // This tests the native disabled seam and asynchronous guard, not browser focus.
  return { ...actual, Button: (props: any) => {
    fixture.buttons.push(props);
    return React.createElement(actual.Button, props);
  } };
});
import AperturePlayDesk from "../../client/src/pages/aperture/AperturePlayDesk";

const now = Date.UTC(2026, 8, 9, 18);
const order = { id: 12, runId: 360001, candidateId: 240003, accountId: 3, accountLabel: "Illustrative Paper", symbol: "DKNG261120P00020000", instrumentType: "long_put" as const, status: "submitted" as const, qty: 1, filledQty: 0, brokerOrderId: null, dispatchError: "Illustrative unresolved dispatch", updatedAt: now };
const query = (data: unknown) => ({ data, error: null, isLoading: false, isFetching: false, dataUpdatedAt: now, refetch: fixture.refetch });
function render() {
  fixture.buttons = [];
  return load(renderToStaticMarkup(React.createElement(AperturePlayDesk)));
}
function text(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return text(node.props.children);
  return "";
}
const action = (label: string) => fixture.buttons.find(button => text(button.children) === label);
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.clearAllMocks();
  fixture.search = "";
  fixture.refetch.mockReset().mockResolvedValue({});
  const attention = deriveApertureAttention({ now, mission: null, underwriting: null, evidenceTasks: [], orders: [order], activePlays: [], pendingReviews: [], monitoringFindings: [], checks: { state: "partial", asOf: now, monitoring: "on_demand" } }, null);
  fixture.queries = { desk: query({ orders: [order], activePlays: [], attention }), runs: query([]), plays: query({ plays: [] }), outcomes: query([]) };
});

describe("Play Desk keyboard recovery contract — rendered native controls and real page handlers", () => {
  it("keeps the header refresh in the tab sequence while busy instead of natively disabling it", () => {
    const idle = render();
    expect(idle("[data-desk-header] button").attr("disabled")).toBeUndefined();
    fixture.queries.desk.isFetching = true;
    const $ = render();
    const button = $("[data-desk-header] button");
    expect(button.attr("disabled")).toBeUndefined();
    expect(button.attr("aria-disabled")).toBe("true");
    expect(button.attr("tabindex")).not.toBe("-1");
    expect(button.text()).toBe("Refreshing…");
    expect(button.attr("aria-describedby")).toBe("desk-refresh-scope");
    expect($("#desk-refresh-scope").attr("role")).toBe("status");
    expect($("#desk-refresh-scope").text()).toContain("Loading status; existing records stay visible.");
  });

  it.each(["desk", "runs", "plays", "outcomes"])("blocks repeated activation while %s is fetching without losing critical uncertainty", async (source) => {
    fixture.search = "instrument=shares&stage=choose";
    fixture.queries[source].isFetching = true;
    const $ = render();
    await action("Refreshing…").onClick();
    expect(fixture.refetch).not.toHaveBeenCalled();
    const warning = $('[data-attention-key="order:12:dispatch"] p')
      .filter((_, node) => $(node).text().includes("Do not submit a duplicate order."));
    expect(warning).toHaveLength(1);
    // Assert on the warning itself: an exposed card could still hide its warning
    // inside Evidence. This is structural disclosure coverage, not computed CSS.
    const hidden = "details,[hidden],[aria-hidden=true],[inert],.hidden,.sr-only";
    expect(warning.is(hidden)).toBe(false);
    expect(warning.parents(hidden)).toHaveLength(0);
    expect($("#desk-attention").text()).toContain("1 critical issue outside these filters");
    expect(fixture.navigate).not.toHaveBeenCalled();
    expect($.text()).not.toContain("No new action identified");
  });

  it("guards a second queued activation before query state has repainted", async () => {
    const wait = deferred();
    fixture.refetch.mockReturnValue(wait.promise);
    render();
    const refresh = action("Refresh status").onClick;
    const first = refresh();
    const second = refresh();
    const callsBeforeRelease = fixture.refetch.mock.calls.length;
    wait.resolve();
    await Promise.all([first, second]);
    expect(callsBeforeRelease).toBe(4);
    await refresh();
    expect(fixture.refetch).toHaveBeenCalledTimes(8);
    expect(fixture.navigate).not.toHaveBeenCalled();
  });

  it("retains the guard until every source settles, even if one fails first", async () => {
    const sources = [deferred(), deferred(), deferred(), deferred()];
    Object.values(fixture.queries).forEach((query: any, index) => { query.refetch = vi.fn(() => sources[index].promise); });
    render();
    const refresh = action("Refresh status").onClick;
    const first = refresh();
    const caught = first.catch(() => undefined);
    sources[0].reject(new Error("Illustrative transport failure"));
    await Promise.resolve();
    await Promise.resolve();
    const second = refresh();
    const counts = Object.values(fixture.queries).map((query: any) => query.refetch.mock.calls.length);
    sources.slice(1).forEach(source => source.resolve());
    await Promise.all([caught, second.catch(() => undefined)]);
    expect(counts).toEqual([1, 1, 1, 1]);
    await expect(first).resolves.toBeUndefined();
  });

  it("keeps status and selected-play recovery focusable with associated progress text", async () => {
    fixture.search = "play=99";
    fixture.queries.runs.error = new Error("Illustrative research failure");
    fixture.queries.desk.isFetching = true;
    const $ = render();
    for (const label of ["Retry status", "Retry selected play"]) {
      const button = $("button").filter((_, node) => $(node).text() === label);
      expect(button.attr("disabled")).toBeUndefined();
      expect(button.attr("aria-disabled")).toBe("true");
      const description = $(`[id="${button.attr("aria-describedby")}"]`);
      expect(description.text()).toContain("Loading status");
      expect(description.parents("details,[hidden]")).toHaveLength(0);
      await action(label).onClick();
    }
    expect(fixture.refetch).not.toHaveBeenCalled();
    expect($.text()).toContain("This is not an all-clear.");
  });

  it("uses the combined refresh state for source recovery without blocking exact-record navigation", async () => {
    fixture.queries.outcomes.isFetching = true;
    fixture.queries.desk.data.attention.sourceIssues = [
      { source: "orders", label: "Order status", state: "failed", impact: "Broker acceptance is unresolved.", lastSuccessAt: now, recovery: "refresh_status", actionLabel: "Retry order status", href: null },
      { source: "monitoring", label: "Selected play checks", state: "stale", impact: "Recorded checks are stale.", lastSuccessAt: now, recovery: "review_checks", actionLabel: "Review DKNG checks", href: "/aperture/run/360001/execute?candidate=240003&lifecycle=monitoring" },
    ];
    const $ = render();
    const recovery = action("Refreshing status…");
    expect(recovery["aria-disabled"]).toBe(true);
    await recovery.onClick();
    expect(fixture.refetch).not.toHaveBeenCalled();
    const inspect = action("Review DKNG checks");
    expect(inspect["aria-disabled"]).toBe(false);
    inspect.onClick();
    expect(fixture.navigate).toHaveBeenCalledWith("/aperture/run/360001/execute?candidate=240003&lifecycle=monitoring");
    expect($.text()).toContain("Broker acceptance is unresolved.");
    expect($.text()).toContain("Recorded checks are stale.");
  });

  it("leaves a recoverable failed query and its old critical task visible after refresh settles", async () => {
    render();
    await action("Refresh status").onClick();
    fixture.queries.desk.error = new Error("Illustrative refresh failure");
    const $ = render();
    expect($.text()).toContain("Last known records remain visible");
    expect($.text()).not.toContain("No new action identified");
    expect($('[data-attention-key="order:12:dispatch"]')).toHaveLength(1);
    const retry = $("button").filter((_, node) => $(node).text() === "Retry status");
    expect(retry.attr("aria-disabled")).toBe("false");
    await action("Retry status").onClick();
    expect(fixture.refetch).toHaveBeenCalledTimes(8);
    expect(fixture.navigate).not.toHaveBeenCalled();
  });
});

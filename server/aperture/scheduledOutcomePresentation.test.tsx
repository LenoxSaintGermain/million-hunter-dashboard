import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({ mutate: vi.fn(), refetch: vi.fn(), data: [] as any[], error: false, loading: false, states: null as unknown[] | null }));
vi.mock("react", async original => {
  const actual = await original<typeof React>();
  return { ...actual, useState: (value: unknown) => f.states ? [f.states.shift(), vi.fn()] : actual.useState(value) };
});
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ aperture: { runway: { pending: { invalidate: vi.fn() } }, desk: { summary: { invalidate: vi.fn() } }, cockpit: { invalidate: vi.fn() } } }),
  aperture: { playOutcome: {
    list: { useQuery: () => ({ data: f.data, isError: f.error, isLoading: f.loading, refetch: f.refetch }) },
    record: { useMutation: () => ({ mutate: f.mutate, isPending: false, error: null }) },
  } },
} }));
import { ScheduledPlayOutcomeReview, ScheduledOutcomeForm } from "../../client/src/components/aperture/ScheduledPlayOutcomeReview";
const row = { status: "due", canRecord: true, result: null, evidenceVersion: "a".repeat(64), evidence: {
  reviewId: 4, runId: 780001, decisionRunId: 8, revisionId: 9, orderId: 12, candidateId: 630001, dueAt: 100,
  reviewBasis: "Review at the declared horizon.", orders: [{ id: 12, symbol: "RWM", side: "sell", intent: "close", status: "filled", filledQty: 10, filledAvgPriceCents: null, updatedAt: 90 }],
} };
const render = () => load(renderToStaticMarkup(<ScheduledPlayOutcomeReview runId={780001} candidateId={630001} />));
beforeEach(() => { vi.stubGlobal("React", React); vi.clearAllMocks(); f.states = null; f.data = [structuredClone(row)]; f.error = false; f.loading = false; });
describe("inline scheduled outcome review", () => {
  it("submits only the selected evidence version after explicit note and confirmation", () => {
    function findForm(node: any): any {
      if (!React.isValidElement(node)) return null;
      if (node.type === "form") return node;
      return React.Children.toArray((node.props as any).children).map(findForm).find(Boolean);
    }
    for (const [note, confirm] of [["", false], ["An operator-written review note.", false], ["An operator-written review note.", true]] as const) {
      f.states = [note, confirm, false];
      const tree = ScheduledOutcomeForm({ review: row as any, onSaved: vi.fn() });
      findForm(tree).props.onSubmit({ preventDefault: vi.fn() });
      expect(f.mutate).toHaveBeenCalledTimes(confirm ? 1 : 0);
    }
    expect(f.mutate).toHaveBeenCalledWith({ runId: 780001, reviewId: 4, evidenceVersion: "a".repeat(64), note: "An operator-written review note.", confirm: true });
  });
  it("opens with an empty note and unchecked confirmation, never mutating on view", () => {
    const $ = render();
    expect($("textarea").text()).toBe("");
    expect($("input[checked]")).toHaveLength(0);
    expect($("button[type=submit]").attr("disabled")).toBeDefined();
    expect($("details").attr("open")).toBeUndefined();
    expect($.text()).toContain("Average fill: Not recorded");
    expect($.text()).toContain("do not establish a matched round trip");
    expect(f.mutate).not.toHaveBeenCalled();
  });
  it("renders the saved note without a replacement form", () => {
    f.data[0] = { ...row, status: "resolved", canRecord: false, result: { note: "Evidence reviewed; P&L still unknown.", recordedAt: 200 } };
    const $ = render();
    expect($.text()).toContain("Evidence reviewed; P&L still unknown.");
    expect($.text()).toContain("Orders and positions are unchanged");
    expect($("textarea,button[type=submit]")).toHaveLength(0);
  });
  it("does not render another candidate's review or a control for ineligible evidence", () => {
    f.data[0].evidence.candidateId = 5;
    expect(render()("textarea")).toHaveLength(0);
    f.data = [{ ...structuredClone(row), canRecord: false }];
    expect(render().text()).toContain("until the scheduled time and a recorded fill");
    expect(render()("button[type=submit]")).toHaveLength(0);
  });
  it("distinguishes loading, unavailable, and no bound review without auto-dismissal", () => {
    f.loading = true; expect(render()("[role=status]").text()).toContain("Loading");
    f.loading = false; f.error = true; expect(render()("[role=alert]").text()).toContain("Nothing was resolved");
    f.error = false; f.data = []; expect(render().text()).toContain("does not establish that its outcome is resolved");
    expect(f.mutate).not.toHaveBeenCalled();
  });
});

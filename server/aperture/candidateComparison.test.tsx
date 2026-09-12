import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { CandidateComparison, candidateInspectionHref } from "../../client/src/components/aperture/CandidateComparison";
const state = vi.hoisted(() => ({ search: "", data: null as any, mutate: vi.fn(), inspected: vi.fn() }));
vi.mock("wouter", () => ({ useRoute: () => [true, { id: "99" }], useLocation: () => ["/aperture/run/99", vi.fn()], useSearch: () => state.search }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: any) => children }));
vi.mock("@/components/aperture/PlayRecipeCard", () => ({ PlayRecipeCard: ({ candidate, proposalBlockedReason }: any) => {
  state.inspected(candidate.id); return <p>Plan for {candidate.symbol}: {proposalBlockedReason}</p>;
} }));
vi.mock("@/components/aperture/DecisionFocusCard", () => ({ DecisionFocusCard: () => null }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: any) => open ? children : null,
  SheetContent: ({ children }: any) => <aside>{children}</aside>,
  SheetHeader: ({ children }: any) => <header>{children}</header>,
  SheetTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock("@/lib/trpc", () => {
  const mutation = { useMutation: () => ({ mutate: state.mutate, isPending: false }) };
  return { trpc: { useUtils: () => ({}), aperture: {
    run: { get: { useQuery: () => ({ data: state.data, isLoading: false, refetch: vi.fn() }) }, retry: mutation, followUp: mutation, evidence: { review: mutation } },
    macro: { refresh: mutation }, generateMemo: mutation,
  } } };
});
import CandidateBoard from "../../client/src/pages/aperture/CandidateBoard";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
const candidates = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, symbol: `FIX${i + 1}`, role: "core", compositeScore: 70, confidenceScore: 0.7, verifyFields: ["C: Price / earnings", "Option chain and contract terms"] }));
function render(reviews: any[] = []) {
  return load(renderToStaticMarkup(<CandidateComparison candidates={candidates} reviews={reviews} leadId={1} inspectedId={12} onInspect={vi.fn()} />));
}

describe("candidate comparison", () => {
  it("exposes all twelve choices without sequential navigation", () => {
    const $ = render();
    expect($("[data-candidate-row]")).toHaveLength(12);
    expect($("button[aria-label='Inspect FIX12']")).toHaveLength(1);
    expect($.text()).not.toMatch(/Previous|Next candidate/);
  });
  it("only clears the reviewed candidate's evidence; contract checks remain downstream", () => {
    const $ = render([{ candidateId: 12, checkLabel: "C: Price / earnings", status: "confirmed" }]);
    expect($("[data-candidate-row='12']").text()).toContain("Ticket checks next");
    expect($("[data-candidate-row='1']").text()).toContain("1 check remains");
    expect($.text()).not.toContain("Ready to submit");
  });
  it("keeps a declined answer visible on the row", () => {
    expect(render([{ candidateId: 12, checkLabel: "C: Price / earnings", status: "not_confirmed" }])("[data-candidate-row='12']").text()).toContain("Evidence declined");
  });
  it("does not treat a legacy acknowledgement as a completed check", () => {
    expect(render([{ candidateId: 12, checkLabel: "C: Price / earnings", status: "reviewed" }])("[data-candidate-row='12']").text()).toContain("1 check remains");
  });
  it("announces the selected row and its dialog", () => {
    const button = render()("button[aria-label='Inspect FIX12']");
    expect(button.attr("aria-expanded")).toBe("true");
    expect(button.attr("aria-haspopup")).toBe("dialog");
  });
  it("preserves run, candidate and unrelated context across inspection and close", () => {
    const open = candidateInspectionHref(99, "thesis=8&view=play", 12);
    expect(open).toBe("/aperture/run/99?thesis=8&view=play&candidate=12&inspect=1");
    expect(candidateInspectionHref(99, open.split("?")[1]!, null)).toBe("/aperture/run/99?thesis=8&view=play&candidate=12&inspect=0");
  });
});

describe("comparison in the real run workspace", () => {
  function board(search: string) {
    state.search = search;
    vi.stubGlobal("window", { location: { search } });
    state.data = { run: { id: 99, status: "completed" }, candidates, evidenceReviews: [], macroFacts: [] };
    state.inspected.mockClear(); state.mutate.mockClear();
    return load(renderToStaticMarkup(<CandidateBoard />));
  }
  it("opens the list without constructing a play or invoking mutations", () => {
    expect(board("")("[data-candidate-row]")).toHaveLength(12);
    expect(state.inspected).not.toHaveBeenCalled();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("opens the exact deep-linked candidate immediately, never the lead first", () => {
    const $ = board("?candidate=12");
    expect($.text()).toContain("Plan for FIX12");
    expect(state.inspected.mock.calls).toEqual([[12]]);
    expect($.text()).toContain("Review the required evidence");
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("keeps an unavailable candidate explicit instead of opening another plan", () => {
    expect(board("?candidate=999").text()).toContain("linked candidate is unavailable");
    expect(state.inspected).not.toHaveBeenCalled();
  });
  it("closing retains candidate context without constructing a plan", () => {
    board("?candidate=12&inspect=0");
    expect(state.inspected).not.toHaveBeenCalled();
    expect(state.mutate).not.toHaveBeenCalled();
  });
});

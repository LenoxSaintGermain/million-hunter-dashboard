import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import CandidateBoard, { EvidenceQuestionReview } from "../../client/src/pages/aperture/CandidateBoard";
import { CapitalThesisWorkspace } from "../../client/src/components/aperture/CapitalThesisWorkspace";
import { EMPTY_EVIDENCE_QUESTION } from "../../shared/evidenceQuestion";

function elements(node: React.ReactNode): React.ReactElement<any>[] {
  return React.Children.toArray(node).flatMap((child) => React.isValidElement<{ children?: React.ReactNode }>(child) ? [child, ...elements(child.props.children)] : []);
}

const fixture = vi.hoisted(() => ({
  mutate: vi.fn(), navigate: vi.fn(), refetch: vi.fn(),
  candidate: { id: 540002, symbol: "MYRG", role: "remainder", compositeScore: 33, confidenceScore: null,
    verifyFields: ["C: Price / earnings", "C: Price / sales"], memoStatus: "ok",
    memo: { thesis: "Illustrative general company research. This is not a valuation observation." }, citations: [] },
}));
vi.mock("wouter", () => ({ useRoute: () => [true, { id: "690001" }], useLocation: () => ["/aperture/run/690001", fixture.navigate], useSearch: () => "?candidate=540002&view=evidence" }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: any) => children }));
vi.mock("@/lib/trpc", () => {
  const mutation = { useMutation: () => ({ mutate: fixture.mutate, mutateAsync: fixture.mutate, isPending: false }) };
  return { trpc: {
    useUtils: () => ({}),
    thesis: { list: { useQuery: () => ({ data: [], isLoading: false }) }, createCapital: mutation, setActiveCapital: mutation, useInAperture: mutation },
    aperture: { run: { get: { useQuery: () => ({ data: { run: { id: 690001, status: "completed" }, candidates: [fixture.candidate], evidenceReviews: [], macroFacts: [], thesisContext: null }, isLoading: false, refetch: fixture.refetch }) }, retry: mutation, followUp: mutation, evidence: { review: mutation, factDraft: { useQuery: () => ({ data: undefined, isFetching: false, refetch: fixture.refetch }) } } }, macro: { refresh: mutation }, generateMemo: mutation },
  } };
});

describe("stakeholder evidence and thesis entry", () => {
  beforeAll(() => { vi.stubGlobal("React", React); vi.stubGlobal("window", { location: { search: "?view=evidence" } }); });
  afterAll(() => vi.unstubAllGlobals());
  it("does not ask for blind confirmation of an unexplained valuation label", () => {
    const $ = load(renderToStaticMarkup(React.createElement(CandidateBoard)));
    expect($("h2").toArray().map((element) => $(element).text())).not.toContain("C: Price / earnings");
    expect($.text()).toContain("Observation not supplied");
    expect($.text()).toContain("Criterion not supplied");
    expect($.text()).toContain("As of: not supplied");
    expect($.text()).toContain("Source not supplied");
    expect($("button").filter((_, element) => $(element).text().includes("Confirmed · clear this gate")).attr("disabled")).toBeDefined();
    expect($("button").filter((_, element) => $(element).text() === "Not applicable").attr("disabled")).toBeDefined();
    expect($("button").filter((_, element) => $(element).text() === "Need more evidence").attr("disabled")).toBeUndefined();
    expect(fixture.mutate).not.toHaveBeenCalled();
  });
  it("starts a new thesis empty, with guidance outside the saved statement", () => {
    const $ = load(renderToStaticMarkup(React.createElement(CapitalThesisWorkspace)));
    expect($("textarea[aria-label='Thesis statement']").val()).toBe("");
    expect($("textarea[aria-label='Thesis statement']").attr("placeholder")).toBeTruthy();
    expect($("button").filter((_, element) => $(element).text().startsWith("Save")).toArray()).toHaveLength(2);
    $("button").filter((_, element) => $(element).text().startsWith("Save")).each((_, element) => expect($(element).attr("disabled")).toBeDefined());
    expect($.text()).toContain("at least 20 characters");
    expect(fixture.mutate).not.toHaveBeenCalled();
  });
  it("guards the confirmation callback itself, not only the button appearance", () => {
    const onReview = vi.fn();
    const tree = EvidenceQuestionReview({ symbol: "MYRG", checkLabel: "C: Price / earnings", draft: EMPTY_EVIDENCE_QUESTION, pending: false, now: Date.parse("2026-09-09"), onChange: vi.fn(), onReview });
    for (const label of ["Confirmed · clear this gate", "Not applicable"]) {
      const button = elements(tree).find((element) => element.props.children === label)!;
      button.props.onClick();
    }
    expect(onReview).not.toHaveBeenCalled();
    elements(tree).find((element) => element.props.children === "Need more evidence")!.props.onClick();
    expect(onReview).toHaveBeenCalledOnce();
    expect(onReview.mock.calls[0][0]).toBe("needs_follow_up");
  });
  it("sends only an explicit evidence answer with operator provenance, never an order", () => {
    const onReview = vi.fn();
    const draft = { observation: "Illustrative 12× trailing P/E", asOf: "2026-09-08", criterion: "Illustrative sourced peer comparison, not a new risk threshold", sourceUrl: "https://example.com/fixture", note: "Supports the recorded comparison." };
    const props = { symbol: "MYRG", checkLabel: "C: Price / earnings", draft, pending: false, now: Date.parse("2026-09-09"), onChange: vi.fn(), onReview };
    const tree = EvidenceQuestionReview(props);
    expect(onReview).not.toHaveBeenCalled();
    elements(tree).find((element) => element.props.children === "Confirmed · clear this gate")!.props.onClick();
    expect(onReview).toHaveBeenCalledOnce();
    expect(onReview.mock.calls[0][0]).toBe("confirmed");
    expect(onReview.mock.calls[0][1]).toContain("Operator-entered evidence; not independently verified.");
    const pending = EvidenceQuestionReview({ ...props, pending: true });
    elements(pending).find((element) => element.props.children === "Confirmed · clear this gate")!.props.onClick();
    expect(onReview).toHaveBeenCalledOnce();
    expect(fixture.mutate).not.toHaveBeenCalled();
  });
});

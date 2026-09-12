/**
 * Research as a list, not a newspaper.
 *
 * Measured on production 2026-09-12: 8.3 screens, 1,830 words, 32.7 words per
 * interactive control — the densest surface in the product, because every
 * journey rendered three explanatory cards with a full sentence each. These
 * tests pin both halves: the row stays short, and nothing the prose carried was
 * thrown away — it moved into the drawer.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ search: "", navigate: vi.fn(), runs: [] as any[], pending: [] as any[] }));
vi.mock("wouter", () => ({ useLocation: () => ["/aperture/runs", fixture.navigate], useSearch: () => fixture.search }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: any) => children }));
vi.mock("@/lib/trpc", () => ({ trpc: { aperture: {
  run: { list: { useQuery: () => ({ data: fixture.runs, isLoading: false, refetch: vi.fn() }) } },
  runway: { pending: { useQuery: () => ({ data: fixture.pending }) } },
} } }));

import ApertureRuns, { actionFor, readResearchInspect, researchHref } from "../../client/src/pages/aperture/ApertureRuns";
import { ResearchJourneyBody } from "../../client/src/components/aperture/ResearchJourneyDrawer";

const now = Date.UTC(2026, 8, 12, 14, 0);

/** Two chapters of one question, shaped as buildResearchJourneys consumes them. */
const run = (id: number, over: Record<string, unknown> = {}) => ({
  id, thesisId: 5, thesisName: "AI infrastructure demand", status: "completed",
  candidateCount: 6, createdAt: now - 86_400_000, droppedNote: null, candidates: [], ...over,
});

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

const render = () => load(renderToStaticMarkup(React.createElement(ApertureRuns)));

describe("the row stays short", () => {
  it("renders one row per journey, not a stack of explanatory cards", () => {
    fixture.search = "";
    fixture.runs = [run(1), run(2, { droppedNote: "Follow-up research from run #1 · 4 symbols deferred" })];
    const $ = render();
    expect($("[data-journey-row]")).toHaveLength(1); // two chapters, one question
    const row = $("[data-journey-row]").first();
    // A row is a scan line: no paragraph of guidance belongs on it.
    expect(row.text().length).toBeLessThan(200);
    expect(row.text()).not.toContain("You can research more without clearing every check");
    expect(row.text()).not.toContain("Open the priority candidate");
  });

  it("keeps the page's own prose off the surface too", () => {
    fixture.runs = [run(1)];
    const text = render().text();
    expect(text).not.toContain("One question. One connected research trail.");
    expect(text).not.toContain("not a raw list of brief IDs");
    // The one claim that must never move: this page cannot create an order.
    expect(text).toContain("never create or submit an order");
  });

  it("collapses scheduled decisions instead of stacking them above the list", () => {
    fixture.runs = [run(1)];
    fixture.pending = [{ id: 9, kind: "gate_review", dueAt: now, decisionRunId: 3, revisionId: 4, gateLabel: "Portfolio-gap deployment", thesisName: "AI infrastructure demand", revisionVersion: 2, reviewBasis: "recorded" }];
    const $ = render();
    expect($("details[data-pending-decisions]")).toHaveLength(1);
    expect($.text()).toContain("a recorded checkpoint is not proof that a check ran");
    fixture.pending = [];
  });
});

describe("inspection carries what the row dropped", () => {
  const journey = {
    rootId: 1, thesisId: 5, thesisName: "AI infrastructure demand",
    runs: [run(1), run(2)], latest: run(2), symbolsReviewed: 12, evidenceCandidates: 6,
    remainingDeferred: 4, state: "more_research_available" as const, nextLabel: "Review",
  };
  const body = (over: Partial<typeof journey> = {}) => load(renderToStaticMarkup(React.createElement(ResearchJourneyBody, {
    journey: { ...journey, ...over }, stateLabel: "More evidence available",
    action: actionFor({ ...journey, ...over }), onOpenChapter: vi.fn(),
  })));

  it("keeps every sentence the cards used to carry", () => {
    const text = body().text();
    expect(text).toContain("12 symbols reviewed");
    expect(text).toContain("4 still available to research");
    expect(text).toContain("6 candidates");
    expect(text).toContain("You can research more without clearing every check first.");
    expect(text).toContain("See the current lead first.");
  });

  it("says a deferred symbol was set aside on purpose, not missed", () => {
    expect(body().text()).toContain("set aside deliberately; they are not failures");
  });

  it("does not let a candidate read as a recommendation", () => {
    const text = body().text();
    expect(text).toContain("A candidate is not a recommendation");
    expect(text).toContain("none of this creates an order");
  });

  it("states that a closed revision cannot prepare a proposal", () => {
    expect(body({ state: "paper_stage_declined" }).text()).toContain("closed to paper-proposal preparation");
  });

  it("lists every chapter and marks the latest", () => {
    const $ = body();
    expect($("[data-journey-chapter]")).toHaveLength(2);
    expect($("[data-journey-chapter='2']").text()).toContain("latest");
  });

  it("says that opening a journey changes nothing", () => {
    expect(body().text()).toContain("records no review, starts no research, and creates no order");
  });
});

describe("the drawer is URL-bound like the Play Desk", () => {
  it("announces the trigger as a dialog and reflects the open state", () => {
    fixture.runs = [run(1)];
    fixture.search = "";
    expect(render()("[data-inspect-journey='1']").attr("aria-expanded")).toBe("false");
    fixture.search = "inspect=1";
    const $ = render();
    expect($("[data-inspect-journey='1']").attr("aria-expanded")).toBe("true");
    expect($("[data-inspect-journey='1']").attr("aria-haspopup")).toBe("dialog");
  });

  it("ignores an id that is not a positive integer", () => {
    for (const value of ["0", "-1", "abc", "1.5"]) expect(readResearchInspect(`?inspect=${value}`)).toBeNull();
    expect(readResearchInspect("?inspect=7")).toBe(7);
  });

  it("leaves unrelated params untouched when opening and closing", () => {
    expect(researchHref("thesis=5", 1)).toBe("/aperture/runs?thesis=5&inspect=1");
    expect(researchHref("thesis=5&inspect=1", null)).toBe("/aperture/runs?thesis=5");
  });

  it("leaves the drawer shut for a journey that is not in the returned records", () => {
    fixture.runs = [run(1)];
    fixture.search = "inspect=999";
    expect(render()("[data-journey-body]")).toHaveLength(0);
  });
});

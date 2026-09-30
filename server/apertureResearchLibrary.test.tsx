import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { load } from "cheerio";
import { buildResearchJourneys } from "../shared/runWorkspace";
// This repository's Vitest transform uses the classic JSX runtime.
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());

const fixture = vi.hoisted(() => ({
  search: "", runs: [] as any[], theses: [] as any[], loading: false,
  error: null as Error | null, contextError: null as Error | null,
  navigate: vi.fn(), mutate: vi.fn(),
}));
vi.mock("wouter", () => ({ useLocation: () => ["/aperture/runs", fixture.navigate], useSearch: () => fixture.search }));
vi.mock("../client/src/components/DashboardLayout", () => ({ default: ({ children }: any) => <main>{children}</main> }));
vi.mock("../client/src/components/aperture/ResearchJourneyDrawer", () => ({ ResearchJourneyDrawer: ({ journey }: any) => journey ? <aside data-inspected={journey.rootId}/> : null }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ aperture: { invalidate: vi.fn() }, thesis: { invalidate: vi.fn() } }),
  thesis: { activeCapital: { useQuery: () => ({ data: { thesis: { id: 4, name: "Illustrative focus" } }, error: fixture.contextError }) } },
  aperture: {
    run: { list: { useQuery: () => ({ data: fixture.runs, isLoading: fixture.loading, error: fixture.error, refetch: vi.fn() }) } },
    runway: { pending: { useQuery: () => ({ data: [] }) } },
    thesis: {
      list: { useQuery: () => ({ data: fixture.theses, isLoading: fixture.loading, error: fixture.error, refetch: vi.fn() }) },
      activate: { useMutation: () => ({ mutate: fixture.mutate, isPending: false }) },
    },
  },
} }));
import ApertureRuns, { actionFor, readResearchInspect, researchHref } from "../client/src/pages/aperture/ApertureRuns";
import ApertureTheses from "../client/src/pages/aperture/ApertureTheses";

beforeEach(() => {
  fixture.search = ""; fixture.loading = false; fixture.error = null; fixture.contextError = null;
  fixture.runs = [{ id: 7, thesisId: 1, thesisName: "Illustrative macro hedge", status: "complete", createdAt: Date.now(), candidateCount: 2, universeCount: 8 }];
  fixture.theses = [{ id: 1, name: "Illustrative thesis", sourceCompilationId: 4, status: "active", isPrimary: false, rawText: "A saved argument, not a recommendation.", updatedAt: Date.now(), missionDefaults: { maxPlannedLossCents: 0 }, readDiagnostics: { confidenceNotes: { status: "unknown", code: "UNAVAILABLE" } }, confidenceNotes: ["Recovered verbatim from approved source."] }];
  vi.clearAllMocks();
});

it("preserves inspect and unrelated URL parameters", () => {
  expect(readResearchInspect("?inspect=7")).toBe(7);
  for (const value of ["0", "-2", "x", "1.5", "9007199254740993"]) expect(readResearchInspect("?inspect=" + value)).toBeNull();
  expect(researchHref("filter=macro_hedge&keep=yes", 7)).toBe("/aperture/runs?filter=macro_hedge&keep=yes&inspect=7");
  expect(researchHref("filter=macro_hedge&inspect=7", null)).toBe("/aperture/runs?filter=macro_hedge");
});
it("renders recorded evidence in responsive cards without claiming approval", () => {
  const html = renderToStaticMarkup(<ApertureRuns />);
  expect(html).toContain("Illustrative macro hedge");
  expect(html).toContain("Symbols reviewed");
  expect(html).toContain("Recorded evidence, not approval");
  expect(html).toContain("Select a question to inspect its evidence trail.");
  expect(html).not.toContain("<table");
  expect(fixture.mutate).not.toHaveBeenCalled();
});
it("keeps the original URL screen and inspect behavior", () => {
  fixture.search = "filter=macro_hedge&inspect=7";
  expect(renderToStaticMarkup(<ApertureRuns />)).toContain('data-inspected="7"');
  fixture.search = "filter=catalyst_14d";
  expect(renderToStaticMarkup(<ApertureRuns />)).toContain("No research journeys match");
});
it.each([
  ["researching", false, "", "in_progress", "/aperture/run/7"],
  ["failed", false, "", "needs_attention", "/aperture/run/7"],
  ["complete", true, "", "paper_stage_declined", "/aperture/run/7?view=evidence"],
  ["complete", false, "5 symbols deferred", "more_research_available", "/aperture/run/7"],
  ["complete", false, "", "ready_to_review", "/aperture/run/7?view=evidence"],
])("preserves the %s decision route", (status, paperStageDeclined, droppedNote, state, route) => {
  const journey = buildResearchJourneys([{ ...fixture.runs[0], status, paperStageDeclined, droppedNote }])[0];
  expect(journey.state).toBe(state);
  expect(actionFor(journey).route).toBe(route);
});
it("does not present a failed research read as an empty workspace", () => {
  fixture.runs = []; fixture.error = new Error("offline");
  const html = renderToStaticMarkup(<ApertureRuns />);
  expect(html).toContain("Research could not be refreshed");
  expect(html).not.toContain("No research journeys yet");
});
it("keeps missing mandate values distinct from a zero planned loss", () => {
  const html = renderToStaticMarkup(<ApertureTheses />);
  expect(html).toContain("$0.00");
  expect(html).toContain("Not set");
  expect(html).toContain("Recovered verbatim");
  expect(html).toContain("Legacy compiler notes were withheld");
  expect(html).toContain("Mandate, source &amp; focus");
  expect(html).not.toContain("65%");
  expect(html).not.toContain("headroom available");
  expect(html).not.toContain("Compile &amp; Stage");
  expect(fixture.mutate).not.toHaveBeenCalled();
});
it("bounds the card preview while preserving the exact long premise in a closed disclosure", () => {
  const premise = "Demand remains uncertain.\n\n" + "The original premise must remain available for human review. ".repeat(20);
  fixture.theses[0].rawText = premise;
  const $ = load(renderToStaticMarkup(<ApertureTheses />));
  expect($(".desk-premise-preview").text().length).toBeGreaterThan(0);
  expect($(".desk-premise-preview").text().length).toBeLessThanOrEqual(141);
  expect($(".desk-premise-preview").text()).not.toContain(premise);
  expect($(".desk-premise-disclosure").attr("open")).toBeUndefined();
  expect($(".desk-premise-disclosure summary").text()).toBe("Full premise");
  expect($(".desk-premise-disclosure .desk-full-text").text()).toBe(premise);
});
it("renders an active-context read error honestly", () => {
  fixture.contextError = new Error("offline");
  fixture.theses[0].sourceCompilationId = null;
  const html = renderToStaticMarkup(<ApertureTheses />);
  expect(html).toContain("Active context unavailable");
  expect(html).toContain('disabled=""');
});
it("keeps library error and loading distinct from empty", () => {
  fixture.theses = []; fixture.error = new Error("offline");
  expect(renderToStaticMarkup(<ApertureTheses />)).toContain("THESIS-LIST-READ");
  fixture.error = null; fixture.loading = true;
  expect(renderToStaticMarkup(<ApertureTheses />)).toContain("Loading your saved Capital contexts");
});
it("keeps canonical handoff and invalidation, without research or order mutations", () => {
  const source = readFileSync(new URL("../client/src/pages/aperture/ApertureTheses.tsx", import.meta.url), "utf8");
  expect(source).toContain('navigate("/thesis?new=1")');
  expect(source).toContain("utils.aperture.invalidate()");
  expect(source).toContain("utils.thesis.invalidate()");
  expect(source).toContain("activate.mutate({ id: thesis.id })");
  expect(source).not.toContain("compileAndStage");
});

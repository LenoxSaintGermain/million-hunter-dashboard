import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ query: {} as any, refetch: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { scan: { getStatus: { useQuery: () => ({ ...state.query, refetch: state.refetch }) } } } }));
import ScanProgress from "../client/src/components/ScanProgress";
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
it("does not claim targets were added when no listings qualified", () => {
  state.query = { data: { status: "completed", listingsFound: 0, listingsQualified: 0, dealsScored: 0 } };
  const html = renderToStaticMarkup(<ScanProgress jobId={1} />);
  expect(html).not.toContain("Targets added");
  expect(html).toContain("No listings matched");
});
it("exposes query failure rather than an endless connecting message", () => {
  state.query = { isError: true };
  const html = renderToStaticMarkup(<ScanProgress jobId={2} />);
  expect(html).toContain("Search status unavailable");
  expect(html).not.toContain("Connecting to scan engine");
  expect(state.refetch).not.toHaveBeenCalled();
});
it("does not expose persisted database errors in a failed search", () => {
  state.query = { data: { status: "failed", errorMessage: "Failed query: insert into deals params: private-thesis" } };
  const html = renderToStaticMarkup(<ScanProgress jobId={3} />);
  expect(html).not.toContain("private-thesis");
  expect(html).toContain("Search could not finish");
});

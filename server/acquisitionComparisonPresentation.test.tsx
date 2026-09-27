import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ query: {} as any, refetch: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { scan: { getThesisComparison: { useQuery: () => ({ ...state.query, refetch: state.refetch }) } } } }));
vi.mock("wouter", () => ({ Link: ({ children, href }: any) => <a href={href}>{children}</a> }));
import { AcquisitionThesisComparison } from "../client/src/components/AcquisitionThesisComparison";
afterEach(() => vi.unstubAllGlobals());
it("keeps failure distinct from no qualifying opportunities and does not retry on reads", () => {
  vi.stubGlobal("React", React); state.query = { isError: true };
  const html = renderToStaticMarkup(<AcquisitionThesisComparison jobId={1} />);
  expect(html).toContain("could not load"); expect(html).not.toContain("No candidates passed");
  expect(state.refetch).not.toHaveBeenCalled();
});
it("shows incomplete evidence and the exact next opportunity without a fabricated score", () => {
  vi.stubGlobal("React", React); state.query = { data: { thesisId: 3, createdAt: 1000, stale: true, items: [{ dealId: 4, name: "Fixture", assessmentFailed: false,
    comparison: { score: null, coveredWeight: 0, dimensions: [{ dimension: "Recurring revenue", weight: 100, score: null, explanation: "Not disclosed", evidence: [] }] } }] } };
  const html = renderToStaticMarkup(<AcquisitionThesisComparison jobId={1} />);
  expect(html).toContain("Fit incomplete"); expect(html).not.toContain("Assessed fit:");
  expect(html).toContain('href="/deal/4"'); expect(html).toContain("out of date");
  expect(html).toContain("Not established"); expect(state.refetch).not.toHaveBeenCalled();
});

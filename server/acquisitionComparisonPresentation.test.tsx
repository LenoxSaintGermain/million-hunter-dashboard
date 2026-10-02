import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ query: {} as any, refetch: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { scan: { getV2State: { useQuery: () => ({ data: null }) }, getV2Report: { useQuery: () => ({ data: [] }) }, getThesisComparison: { useQuery: () => ({ ...state.query, refetch: state.refetch }) } } } }));
vi.mock("wouter", () => ({ Link: ({ children, href }: any) => <a href={href}>{children}</a> }));
import { AcquisitionThesisComparison, AcquisitionCriterionDetail } from "../client/src/components/AcquisitionThesisComparison";
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
  expect(html).toContain("Compare evidence"); expect(html).toContain("evidence coverage");
  expect(html).not.toContain("Not disclosed"); expect(state.refetch).not.toHaveBeenCalled();
});
it("preserves every criterion and source but explains missing evidence only once", () => {
  vi.stubGlobal("React", React);
  const comparison = { dimensions: [
    { dimension: "Recurring revenue", weight: 50, score: null, contribution: null, explanation: "Repeated missing explanation", evidence: [] },
    { dimension: "Owner transition", weight: 30, score: null, contribution: null, explanation: "Repeated missing explanation", evidence: [] },
    { dimension: "History", weight: 20, score: 1, contribution: 20, explanation: "Seller reports establishment in 1990.", evidence: [{ quote: "Established:1990", sourceUrl: "https://example.org/listing" }] },
  ] } as any;
  const html = renderToStaticMarkup(<AcquisitionCriterionDetail comparison={comparison} />);
  expect(html).toContain("Recurring revenue"); expect(html).toContain("Owner transition");
  expect(html.match(/Not established/g)).toHaveLength(2);
  expect(html).not.toContain("Repeated missing explanation");
  expect(html).toContain("Established:1990"); expect(html).toContain('href="https://example.org/listing"');
  expect(html).toContain("Missing information is not a positive or neutral score");
});

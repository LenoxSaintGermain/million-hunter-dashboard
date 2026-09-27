import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
afterEach(() => vi.unstubAllGlobals());
const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock("@/components/EditorialTopNav", () => ({ default: ({ children }: any) => children }));
vi.mock("wouter", () => ({ Link: ({ children, href }: any) => <a href={href}>{children}</a> }));
vi.mock("@/lib/trpc", () => {
  const query = (data: unknown) => ({ useQuery: () => ({ data, refetch: vi.fn(), isLoading: false }) });
  const mutation = { useMutation: () => ({ mutate, isPending: false }) };
  return { trpc: {
    useUtils: () => ({}),
    dashboard: { stats: query({ dealStats: { total: 1, highPriority: 1 }, recentActivity: [{ title: "Search #1: listing screening record", detail: "Fixture not promoted: original page unavailable", createdAt: 0 }] }), macroPosture: query({}) },
    deals: { list: query([{ id: 1, name: "Illustrative indexed listing", score: 0.95, isSynthetic: false, listingUrl: "https://example.com/listing" }]), delete: mutation },
    thesis: { list: query([]) }, scout: { search: query({ results: [] }) }, scan: { trigger: mutation },
    sentinel: { list: query([]), delete: mutation, aiRefresh: mutation },
  } };
});
import Home from "../client/src/pages/Home";
it("a high score sends the operator to evidence review, not outreach or implied verification", () => {
  vi.stubGlobal("React", React);
  const html = renderToStaticMarkup(<Home />);
  expect(html).not.toContain('href="/outreach"');
  expect(html).not.toContain("HIGH CONVICTION");
  expect(html).not.toContain("validated targets");
  expect(html).toContain("Source claims need verification");
  expect(html).toContain("Review evidence");
  expect(html).toContain("Search #1: listing screening record");
  expect(html).toContain("Fixture not promoted: original page unavailable");
  expect(mutate).not.toHaveBeenCalled();
});

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ run: {} as any, orders: {} as any }));
vi.mock("wouter", () => ({ useRoute: () => [true, { id: "1" }], useLocation: () => ["/aperture/run/1/execute", vi.fn()], useSearch: () => "?candidate=2" }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: any) => children }));
vi.mock("@/lib/trpc", () => ({ trpc: { aperture: { run: { get: { useQuery: () => state.run } }, order: { list: { useQuery: () => state.orders } } } } }));
import ApertureExecute from "../../client/src/pages/aperture/ApertureExecute";
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", { location: { search: "?candidate=2" } });
  state.run = { data: { run: { id: 1 }, candidates: [{ id: 2 }] }, isLoading: false };
  state.orders = { isLoading: true };
});
afterEach(() => vi.unstubAllGlobals());
it("does not offer another ticket while the existing order query is pending", () => {
  const html = renderToStaticMarkup(React.createElement(ApertureExecute));
  expect(html).toContain("Loading your existing ticket");
  expect(html).not.toContain("No ticket created yet");
  expect(html).not.toContain("Draft Discretionary");
});
it("shows a recovery path rather than an empty order queue on failure", () => {
  state.orders = { isLoading: false, isError: true };
  const html = renderToStaticMarkup(React.createElement(ApertureExecute));
  expect(html).toContain("Ticket status unavailable");
  expect(html).toContain("Retry ticket status");
  expect(html).not.toContain("No paper proposal yet");
});

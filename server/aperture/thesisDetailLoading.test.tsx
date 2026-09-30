import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { beforeAll, afterAll, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ query: {} as any, id: "600001" }));
vi.mock("wouter", () => ({ useRoute: () => [true, { id: state.id }], useLocation: () => ["", vi.fn()] }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: any) => children }));
vi.mock("@/lib/trpc", () => {
  const mutation = { useMutation: () => ({ isPending: false, mutate: vi.fn(), mutateAsync: vi.fn() }) };
  return { trpc: { aperture: { thesis: { get: { useQuery: () => ({ ...state.query, refetch: vi.fn() }) }, create: mutation, update: mutation, compile: mutation, activate: mutation }, pipeline: { compileAndStageBestFit: mutation } } } };
});
import ThesisGraphEditor from "../../client/src/pages/aperture/ThesisGraphEditor";
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
const render = () => load(renderToStaticMarkup(<ThesisGraphEditor />));

it.each([
  { isLoading: true, isPending: true },
  { isLoading: false, data: null },
  { isLoading: false, error: new Error("Unavailable") },
])("never exposes legacy controls for unresolved detail: %j", (query) => {
  state.query = query;
  const $ = render();
  expect($("input, textarea")).toHaveLength(0);
  expect($.text()).not.toMatch(/Legacy Aperture|Update Legacy Thesis|Compile Graph Only|Compile & Stage|Thesis #600001/);
});

it("renders a loaded canonical record read-only", () => {
  state.query = { data: { id: 600001, name: "Rate Shock V1", rawText: "A saved belief", sourceCompilationId: 123, graph: null } };
  const $ = render();
  expect($.text()).toContain("Rate Shock V1");
  expect($.text()).toContain("Manage Canonical Thesis");
  expect($("input:disabled, textarea:disabled")).toHaveLength(2);
  expect($.text()).not.toContain("Update Legacy Thesis");
});

it("preserves editing for a confirmed legacy record", () => {
  state.query = { data: { id: 600001, name: "Legacy belief", rawText: "A saved belief", sourceCompilationId: null, graph: null } };
  const $ = render();
  expect($.text()).toContain("Update Legacy Thesis");
  expect($("input:disabled, textarea:disabled")).toHaveLength(0);
});

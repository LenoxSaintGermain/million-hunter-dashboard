import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { SourceExecutionEvidence } from "../../client/src/components/aperture/SourceExecutionEvidence";
const f = vi.hoisted(() => ({ cursor: 0, slots: [] as any[], query: {} as any, mutation: vi.fn(), abandon: vi.fn() }));
vi.mock("react", async original => {
  const actual = await original<typeof React>();
  const state = (initial: any) => { const i = f.cursor++; if (!(i in f.slots)) f.slots[i] = initial; return [f.slots[i], (v: any) => { f.slots[i] = v; }]; };
  return { ...actual, useState: state, useRef: (v: any) => state({ current: v })[0] };
});
vi.mock("@/lib/trpc", () => ({ trpc: { aperture: { strategy: {
  executionEvidence: { useQuery: () => f.query }, refreshExecutionEvidence: { useMutation: () => ({ mutateAsync: f.mutation }) },
  abandonExecutionEvidence: { useMutation: () => ({ mutateAsync: f.abandon }) },
} } } }));
const source = { accountId: 1, runId: 2, candidateId: 3, orderId: 4 };
function render(enabled = true): any { f.cursor = 0; return SourceExecutionEvidence({ source, refreshEnabled: enabled }); }
function nodes(v: any): any[] { return Array.isArray(v) ? v.flatMap(nodes) : v && typeof v === "object" ? [v, ...nodes(v.props?.children)] : []; }
function button(v: any, label = "Refresh paper executions") { return nodes(v).find(n => n.type === "button" && n.props.children === label); }
function copy(v: any): string { return Array.isArray(v) ? v.map(copy).join(" ") : v && typeof v === "object" ? copy(v.props?.children) : typeof v === "string" ? v : ""; }
beforeEach(() => {
  f.cursor = 0; f.slots = []; vi.clearAllMocks();
  const data = { latest: null, lastSuccessful: null, gainsVerified: false, availableCapitalCents: null };
  f.query = { data, isLoading: false, isFetching: false, error: null, refetch: vi.fn().mockResolvedValue({ data }) };
  f.mutation.mockResolvedValue({});
  f.abandon.mockResolvedValue({});
});
it("opening the panel reads only and keeps gains unverified", () => {
  expect(copy(render())).toContain("Gains not verified"); expect(f.mutation).not.toHaveBeenCalled(); expect(f.query.refetch).not.toHaveBeenCalled();
});
it.each(["disabled", "loading", "failed", "pending"])("does not refresh when %s", async mode => {
  if (mode === "loading") f.query.isLoading = true;
  if (mode === "failed") f.query.error = new Error("unavailable");
  if (mode === "pending") f.query.data.latest = { state: "pending" };
  const b = button(render(mode !== "disabled")); expect(b.props.disabled).toBe(true); await b.props.onClick(); expect(f.mutation).not.toHaveBeenCalled();
});
it("keeps the last successful count beside a failed refresh, never a cash amount", () => {
  f.query.data.latest = { state: "failed" };
  f.query.data.lastSuccessful = { receipt: { observedAt: 1000, executions: [{}, {}] } };
  expect(copy(render())).toContain("2 recorded fills"); expect(copy(render())).toContain("last refresh failed"); expect(copy(render())).toContain("Gains not verified");
});
it("shows reconciled gross proceeds without treating them as spendable profit", () => {
  f.query.data.reconciliation = { state: "matched", grossProceedsUsd: "11800", filledQuantity: "100" };
  expect(copy(render())).toContain("before fees"); expect(copy(render())).toContain("Not available profit");
  f.query.data.reconciliation = { state: "inconsistent", reason: "Order quantities differ." };
  expect(copy(render())).toContain("Order quantities differ"); expect(copy(render())).not.toContain("Recorded gross proceeds");
});
it("an uncertain refresh reconciles by read, then reuses the original request", async () => {
  f.mutation.mockRejectedValueOnce(new Error("timeout"));
  await button(render()).props.onClick(); const original = f.mutation.mock.calls[0][0];
  expect(original).toMatchObject(source); expect(original.requestId).toBeTruthy();
  expect(button(render()).props.disabled).toBe(true);
  await button(render(), "Check saved status").props.onClick(); expect(f.mutation).toHaveBeenCalledTimes(1);
  await button(render()).props.onClick(); expect(f.mutation.mock.calls[1][0]).toEqual(original);
});
it("blocks concurrent clicks before a render catches up", async () => {
  let resolve!: () => void; f.mutation.mockReturnValue(new Promise<void>(r => { resolve = r; }));
  const b = button(render()), pending = b.props.onClick(); await b.props.onClick(); expect(f.mutation).toHaveBeenCalledTimes(1); resolve(); await pending;
});
it("discard uses the exact saved pending identity, never refreshes or claims cancellation", async () => {
  f.query.data.latest = { state: "pending", requestId: "saved-request" };
  const tree = render(); expect(copy(tree)).toContain("does not stop the broker request or cancel an order");
  await button(tree, "Discard unconfirmed refresh").props.onClick();
  expect(f.abandon).toHaveBeenCalledWith({ ...source, requestId: "saved-request" });
  expect(f.mutation).not.toHaveBeenCalled(); expect(f.query.refetch).toHaveBeenCalledTimes(1);
});

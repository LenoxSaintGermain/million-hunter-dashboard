import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoveryLeadAction } from "../../client/src/components/aperture/DiscoveryLeadAction";

const f = vi.hoisted(() => ({ cursor: 0, slots: [] as any[], cleanup: null as null | (() => void),
  query: {} as any, mutation: {} as any, fetch: vi.fn(), navigate: vi.fn() }));
vi.mock("react", async original => {
  const actual = await original<typeof React>();
  const state = (initial: any) => { const i = f.cursor++; if (!(i in f.slots)) f.slots[i] = initial; return [f.slots[i], (v: any) => { f.slots[i] = v; }]; };
  return { ...actual, useState: state, useRef: (v: any) => state({ current: v })[0],
    useEffect: (effect: () => () => void) => { if (!f.cleanup) f.cleanup = effect(); } };
});
vi.mock("wouter", () => ({ useLocation: () => ["/aperture/mission", f.navigate] }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ aperture: { underwriter: { discoverySelections: { fetch: f.fetch } } } }),
  aperture: { underwriter: { discoverySelections: { useQuery: () => f.query }, selectDiscovery: { useMutation: () => f.mutation } } },
} }));
const identity = { decisionRunId: 10, decisionRevisionId: 11, discoveryReceiptId: 12, hypothesisId: "recorded-lead" };
const selected = { selectionId: 13, decisionRunId: 14, decisionRevisionId: 15,
  sourceDecisionRunId: 10, sourceRevisionId: 11, discoveryReceiptId: 12, hypothesisId: "recorded-lead" };
const link = "/aperture/decision/14/revision/15/underwrite";
function render(props: Parameters<typeof DiscoveryLeadAction>[0] = { identity }): any {
  f.cursor = 0; return DiscoveryLeadAction(props);
}
function nodes(value: any): any[] {
  return Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === "object" ? [value, ...nodes(value.props?.children)] : [];
}
function button(tree: any, label = "Underwrite this lead") { return nodes(tree).find(n => n.type === "button" && n.props.children === label); }
beforeEach(() => {
  f.cleanup?.(); f.cleanup = null; f.cursor = 0; f.slots = []; vi.clearAllMocks();
  f.query = { data: [], isLoading: false, isFetching: false, error: null, refetch: vi.fn().mockResolvedValue({ data: [], error: null }) };
  f.fetch.mockResolvedValue([]); f.mutation = { isPending: false, mutateAsync: vi.fn().mockResolvedValue(selected) };
});
describe("selected discovery action: deterministic API-boundary interaction", () => {
  it("keeps the eligibility blocker visible while saved-selection status refreshes", () => {
    f.query.isFetching = true;
    const tree = render({ identity, blockedReason: "Source capital is not verified. Inspect the source receipt." });
    expect(JSON.stringify(tree)).toContain("Source capital is not verified. Inspect the source receipt.");
    expect(JSON.stringify(tree)).toContain("Checking for a saved selection");
    expect(button(tree).props.disabled).toBe(true);
  });
  it("contains a failed automatic reconciliation after a selection timeout", async () => {
    f.mutation.mutateAsync.mockRejectedValue(new Error("timeout"));
    f.query.refetch.mockRejectedValue(new Error("read timeout"));
    await expect(button(render()).props.onClick()).resolves.toBeUndefined();
    expect(button(render()).props.disabled).toBe(true);
    expect(button(render(), "Check saved selection")).toBeDefined();
    expect(f.mutation.mutateAsync).toHaveBeenCalledOnce();
    expect(f.navigate).not.toHaveBeenCalled();
  });
  it("explains a missing selection response and exposes read-only recovery", async () => {
    f.query.data = undefined;
    const tree = render();
    expect(JSON.stringify(tree)).toContain("Saved selection is unavailable");
    expect(button(tree, "Check saved selection")).toBeDefined();
    await button(tree, "Check saved selection").props.onClick();
    expect(f.query.refetch).toHaveBeenCalledOnce();
    expect(f.mutation.mutateAsync).not.toHaveBeenCalled();
  });
  it("contains a failed recovery read and never retries the selection mutation", async () => {
    f.query.error = new Error("unavailable");
    f.query.refetch.mockRejectedValueOnce(new Error("read timeout"));
    await expect(button(render(), "Check saved selection").props.onClick()).resolves.toBeUndefined();
    expect(JSON.stringify(render())).toContain("Saved selection is still unavailable");
    expect(f.mutation.mutateAsync).not.toHaveBeenCalled();
  });
  it("renders without starting analysis or writing seen/approval/order state", () => {
    expect(button(render()).props.disabled).toBe(false);
    expect(f.fetch).not.toHaveBeenCalled(); expect(f.mutation.mutateAsync).not.toHaveBeenCalled(); expect(f.navigate).not.toHaveBeenCalled();
  });
  it.each(["loading", "failed", "missing", "refreshing"])("blocks a %s selection read with no mutation", async mode => {
    if (mode === "loading") f.query.isLoading = true;
    if (mode === "failed") f.query.error = new Error("unavailable");
    if (mode === "missing") f.query.data = undefined;
    if (mode === "refreshing") f.query.isFetching = true;
    const b = button(render()); expect(b.props.disabled).toBe(true); await b.props.onClick();
    expect(f.mutation.mutateAsync).not.toHaveBeenCalled();
  });
  it("uses the exact persisted selection as a read-only deep link", () => {
    f.query.data = [selected];
    const a = nodes(render()).find(n => n.type === "a"); expect(a.props.href).toBe(link);
    expect(f.mutation.mutateAsync).not.toHaveBeenCalled();
  });
  it("reconciles another device's selection without rerunning underwriting", async () => {
    f.fetch.mockResolvedValue([selected]); await button(render()).props.onClick();
    expect(f.navigate).toHaveBeenCalledWith(link); expect(f.mutation.mutateAsync).not.toHaveBeenCalled();
  });
  it("one click carries exact source identity into underwriting and opens its exact result", async () => {
    await button(render()).props.onClick();
    expect(f.mutation.mutateAsync).toHaveBeenCalledTimes(1); expect(f.mutation.mutateAsync).toHaveBeenCalledWith(identity); expect(f.navigate).toHaveBeenCalledWith(link);
  });
  it("a double click cannot duplicate the pending selection request", async () => {
    let resolve!: (v: any) => void; f.fetch.mockReturnValue(new Promise(r => { resolve = r; }));
    const b = button(render()), pending = b.props.onClick(); await b.props.onClick(); resolve([]); await pending;
    expect(f.fetch).toHaveBeenCalledTimes(1); expect(f.mutation.mutateAsync).toHaveBeenCalledTimes(1);
  });
  it("a timeout reconciles without replaying a write and requires a successful status check", async () => {
    f.mutation.mutateAsync.mockRejectedValue(new Error("timeout")); await button(render()).props.onClick();
    const tree = render(); expect(button(tree).props.disabled).toBe(true);
    expect(button(tree, "Check saved selection")).toBeDefined();
    expect(f.query.refetch).toHaveBeenCalledTimes(1); expect(f.mutation.mutateAsync).toHaveBeenCalledTimes(1);
    expect(f.navigate).not.toHaveBeenCalled();
  });
  it("does not navigate away from a later task when an old request completes", async () => {
    let resolve!: (v: any) => void; f.fetch.mockReturnValue(new Promise(r => { resolve = r; }));
    const pending = button(render()).props.onClick(); f.cleanup?.(); resolve([]); await pending;
    expect(f.mutation.mutateAsync).not.toHaveBeenCalled(); expect(f.navigate).not.toHaveBeenCalled();
  });
  it("does not accept a mismatched response identity", async () => {
    f.mutation.mutateAsync.mockResolvedValue({ ...selected, hypothesisId: "other" }); await button(render()).props.onClick();
    expect(f.navigate).not.toHaveBeenCalled(); expect(f.query.refetch).toHaveBeenCalledTimes(1);
  });
});

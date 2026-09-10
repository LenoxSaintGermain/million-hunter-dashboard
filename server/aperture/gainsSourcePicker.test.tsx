import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { GainsSourcePicker } from "../../client/src/components/aperture/GainsSourcePicker";
const f = vi.hoisted(() => ({ cursor: 0, slots: [] as any[], query: {} as any, choose: vi.fn(), read: vi.fn() }));
vi.mock("react", async original => {
  const actual = await original<typeof React>();
  return { ...actual, useId: () => "source-picker", useState: (initial: any) => {
    const i = f.cursor++; if (!(i in f.slots)) f.slots[i] = initial;
    return [f.slots[i], (v: any) => { f.slots[i] = v; }];
  } };
});
vi.mock("@/lib/trpc", () => ({ trpc: { aperture: { strategy: { executionSources: { useQuery: (...args: any[]) => { f.read(...args); return f.query; } } } } } }));
const source = { accountId: 1, runId: 2, candidateId: 3, orderId: 4 };
const row = { ...source, accountLabel: "Illustrative Paper", symbol: "MGM", instrumentType: "shares", underlyingSymbol: null, optionExpirationDate: null, optionStrikePriceCents: null, status: "filled", recordedAt: 1000 };
function render(disabled = false): any { f.cursor = 0; return GainsSourcePicker({ source: null, disabled, onChoose: f.choose }); }
function nodes(v: any): any[] { return Array.isArray(v) ? v.flatMap(nodes) : v && typeof v === "object" ? [v, ...nodes(v.props?.children)] : []; }
function button(v: any, label: string) { return nodes(v).find(n => n.type === "button" && n.props.children === label); }
function select(id: string) { nodes(render()).find(n => n.type === "select").props.onChange({ target: { value: id } }); }
beforeEach(() => { f.slots = []; f.cursor = 0; vi.clearAllMocks(); f.query = { data: { sources: [row], nextCursor: null }, isLoading: false, isFetching: false, error: null, refetch: vi.fn() }; });
it("reads sources without changing the draft", () => { render(); expect(f.choose).not.toHaveBeenCalled(); expect(f.read).toHaveBeenCalledWith({}, expect.objectContaining({ retry: false })); });
it("requires deliberate confirmation and carries exact identity only", () => {
  select("4"); expect(f.choose).not.toHaveBeenCalled(); button(render(), "Use this source").props.onClick(); expect(f.choose).toHaveBeenCalledWith(source);
});
it.each(["failed", "loading", "refreshing", "locked"])("blocks selection while %s", mode => {
  select("4"); if (mode === "failed") f.query.error = new Error("failed");
  if (mode === "loading") f.query.isLoading = true; if (mode === "refreshing") f.query.isFetching = true;
  const b = button(render(mode === "locked"), "Use this source"); expect(b.props.disabled).toBe(true); b.props.onClick(); expect(f.choose).not.toHaveBeenCalled();
});
it("never accepts an ID absent from the displayed owned results", () => { select("999"); expect(button(render(), "Use this source")).toBeUndefined(); expect(f.choose).not.toHaveBeenCalled(); });
it("pagination clears the pending choice and uses the server cursor", () => {
  f.query.data.nextCursor = 4; select("4"); button(render(), "Older orders").props.onClick();
  expect(button(render(), "Use this source")).toBeUndefined(); expect(f.read).toHaveBeenLastCalledWith({ beforeId: 4 }, expect.anything()); expect(f.choose).not.toHaveBeenCalled();
});

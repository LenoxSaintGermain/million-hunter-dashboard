import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { beforeEach, describe, expect, it, vi } from "vitest";
const seam = vi.hoisted(() => ({ state: [] as unknown[], index: 0, setters: [] as any[], buttons: [] as any[], ideas: {} as any, preview: {} as any,
  prepare: vi.fn(), reset: vi.fn(), navigate: vi.fn(), reload: vi.fn(), refresh: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: (initial: unknown) => {
  const index = seam.index++; const setter = vi.fn(); seam.setters[index] = setter;
  return [seam.state[index] === undefined ? initial : seam.state[index], setter];
} }));
vi.mock("wouter", () => ({ useLocation: () => ["/aperture/deploy", seam.navigate] }));
vi.mock("@/components/ui/button", () => ({ Button: (props: any) => { seam.buttons.push(props); return React.createElement("button", props); } }));
vi.mock("@/lib/trpc", () => ({ trpc: { aperture: { quickPlay: {
  list: { useQuery: () => ({ ...seam.ideas, refetch: seam.reload }) },
  preview: { useQuery: () => ({ ...seam.preview, refetch: seam.refresh }) },
  prepare: { useMutation: () => ({ mutate: seam.prepare, reset: seam.reset, isPending: false }) },
} } } }));
import { QuickPlayWorkspace } from "../../client/src/components/aperture/QuickPlayWorkspace";
const selection = { runId: 33, candidateId: 66, accountId: 11, decisionRunId: 44, decisionRevisionId: 55, budgetCents: 5000 };
const preview = () => ({ selection, symbol: "UAT", accountLabel: "Illustrative Practice", brokerId: "alpaca_paper", qty: 23, entryCents: 215,
  stopCents: 195, notionalCents: 4945, plannedLossCents: 506, targets: [], timeStopAt: 1800547200000, asOf: 1800543600000,
  tapeBasis: "Illustrative fixture tape", sources: ["https://example.com/fixture"], reason: "Illustrative hypothesis", invalidation: "Support fails", blockers: [], ready: true, fingerprint: "a".repeat(64), reviewUrl: "/aperture/run/33?candidate=66&view=evidence" });
const render = () => { seam.index = 0; seam.buttons = []; return load(renderToStaticMarkup(<QuickPlayWorkspace />)); };
const text = (children: any) => load(renderToStaticMarkup(<>{children}</>)).text();
const button = (label: string) => seam.buttons.find(button => text(button.children) === label);
beforeEach(() => {
  vi.clearAllMocks(); seam.state = []; seam.setters = [];
  seam.ideas = { data: { items: [{ selection, symbol: "UAT", accountLabel: "Illustrative Practice", sourceCount: 1, researchAt: 1800543600000, reviewUrl: "/aperture/run/33?candidate=66&view=evidence" }], withheld: 0, session: "regular", disclosure: "Saved research, not current trade approval." } };
  seam.preview = {};
});
describe("Quick Play operator decisions", () => {
  it("does not prepare or claim approval on initial display", () => {
    const $ = render();
    expect($.text()).toContain("Check prices and risk");
    expect($.text()).toContain("Practice trading");
    expect($.text()).not.toContain("Authorize Play");
    expect(seam.prepare).not.toHaveBeenCalled();
    button("Check prices and risk").onClick();
    expect(seam.setters[1]).toHaveBeenCalledWith(selection);
    expect(seam.prepare).not.toHaveBeenCalled();
  });
  it("requires practice acknowledgement and separates preparation from sending", () => {
    seam.state = [5000, selection, false]; seam.preview = { data: preview() };
    const $ = render();
    expect(button("Prepare practice order").disabled).toBe(true);
    expect($.text()).toContain("not a broker stop or take-profit order");
    expect($.text()).toContain("Approval and sending to the broker are separate actions");
    expect(seam.prepare).not.toHaveBeenCalled();
  });
  it("carries the exact reviewed identities and fingerprint only after an explicit click", () => {
    seam.state = [5000, selection, true]; seam.preview = { data: preview() };
    render(); expect(seam.prepare).not.toHaveBeenCalled();
    expect(button("Prepare practice order").disabled).toBe(false);
    button("Prepare practice order").onClick();
    expect(seam.prepare).toHaveBeenCalledWith({ ...selection, fingerprint: "a".repeat(64), acknowledgement: "PAPER" });
  });
  it("keeps failed, empty and blocked states distinct", () => {
    seam.ideas = { isError: true };
    expect(render().text()).not.toContain("No Quick Play is ready");
    expect(button("Reload ideas")).toBeDefined();
    seam.ideas = { data: { items: [], withheld: 0, session: "closed", disclosure: "Saved research" } };
    expect(render().text()).toContain("Regular trading is closed");
    seam.state = [5000, selection, true]; seam.preview = { data: { ...preview(), ready: false, blockers: ["No remaining allowance"] } };
    const $ = render();
    expect($.text()).toContain("No remaining allowance");
    expect(button("Prepare practice order").disabled).toBe(true);
  });
  it("does not prepare against an old amount during a changed-budget refresh", () => {
    seam.state = [10_000, { ...selection, budgetCents: 10_000 }, true]; seam.preview = { data: preview(), isFetching: true };
    render(); expect(button("Prepare practice order")).toBeUndefined(); expect(seam.prepare).not.toHaveBeenCalled();
  });
});

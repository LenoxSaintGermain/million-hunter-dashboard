import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ApertureUnderwriting from "../../client/src/pages/aperture/ApertureUnderwriting";
import { toast } from "sonner";

const f = vi.hoisted(() => ({ queries: {} as Record<string, any>, mutations: {} as Record<string, any>, options: {} as Record<string, any>, invalidate: vi.fn(), navigate: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof React>(),
  useState: (value: any) => [value, vi.fn()], useRef: (value: any) => ({ current: value }),
  useMemo: (fn: () => any) => fn(), useEffect: (fn: () => any) => fn(),
}));
vi.mock("wouter", () => ({ useLocation: () => ["", f.navigate], useRoute: () => [true, { decisionRunId: "10", revisionId: "11" }] }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/DashboardLayout", () => ({ default: "layout" }));
vi.mock("@/components/ui/button", () => ({ Button: "button" }));
vi.mock("@/components/aperture/PlayUnderwritingBrief", () => ({ PlayUnderwritingBrief: "brief" }));
vi.mock("@shared/isolatedUatIdentity", () => ({ readIsolatedUatCase: () => null }));
vi.mock("@/lib/trpc", () => {
  const endpoint = (name: string) => ({
    useQuery: (_input: any, options: any) => { f.options[name] = options; return f.queries[name]; },
    useMutation: () => f.mutations[name],
  });
  return { trpc: { useUtils: () => ({ aperture: { underwriter: { get: { invalidate: f.invalidate } } } }),
    aperture: { runway: { latest: endpoint("latest"), startResearch: endpoint("startResearch") },
      underwriter: Object.fromEntries(["get", "status", "retry", "run", "revise", "validatePlay"].map(name => [name, endpoint(name)])) } } };
});
function nodes(value: any): any[] {
  return Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === "object" ? [value, ...nodes(value.props?.children)] : [];
}
const result = { decisionRunId: 10, decisionRevisionId: 11, underwritingRunId: 20, underwritingRevisionId: 21,
  version: 1, asOf: 1000, objective: { deployableCapitalCents: 2500000, targetProfitCents: null,
    maxPlannedLossCents: 25000, holdingPeriods: ["swing"], instrumentPreference: "shares" } };
beforeEach(() => {
  vi.stubGlobal("React", React); vi.clearAllMocks(); f.options = {};
  f.queries = Object.fromEntries(["latest", "get", "status"].map(name => [name, { data: null, isLoading: false, error: null, refetch: vi.fn() }]));
  f.mutations = Object.fromEntries(["retry", "run", "revise", "validatePlay", "startResearch"].map(name => [name, { data: null, isPending: false, mutateAsync: vi.fn() }]));
});
describe("resumed underwriting page — actual callback boundary", () => {
  it("polls an existing running job, then refreshes its result without starting analysis", () => {
    f.queries.status.data = { state: "running" }; ApertureUnderwriting();
    expect(f.options.status.refetchInterval({ state: { data: { state: "running" } } })).toBe(3000);
    expect(f.invalidate).not.toHaveBeenCalled();
    f.queries.status.data = { state: "complete", updatedAt: 1000 }; ApertureUnderwriting();
    expect(f.invalidate).toHaveBeenCalledWith({ decisionRunId: 10 });
    expect(f.options.status.refetchInterval({ state: { data: { state: "complete" } } })).toBe(false);
    for (const mutation of Object.values(f.mutations)) expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });
  it("refuses validation of a retained result when current job status is uncertain", async () => {
    f.queries.get.data = result; f.queries.status.error = new Error("offline");
    const brief = nodes(ApertureUnderwriting()).find(node => node.type === "brief");
    expect(brief.props.busy).toBeTruthy();
    await brief.props.onValidate("play-1");
    expect(f.mutations.validatePlay.mutateAsync).not.toHaveBeenCalled();
    expect(f.mutations.startResearch.mutateAsync).not.toHaveBeenCalled();
  });
  it("refuses a previous decision revision even if its callback is invoked", async () => {
    f.queries.get.data = { ...result, decisionRevisionId: 9 }; f.queries.status.data = { state: "complete" };
    const brief = nodes(ApertureUnderwriting()).find(node => node.type === "brief");
    await brief.props.onValidate("old-play");
    expect(f.mutations.validatePlay.mutateAsync).not.toHaveBeenCalled();
  });
  it("validates once and opens research only after the exact selection returns", async () => {
    f.queries.get.data = result; f.queries.status.data = { state: "complete" };
    let finish!: (value: any) => void;
    f.mutations.validatePlay.mutateAsync.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    f.mutations.startResearch.mutateAsync.mockResolvedValue({ status: "started", runId: 30 });
    const brief = nodes(ApertureUnderwriting()).find(node => node.type === "brief");
    const pending = brief.props.onValidate("play-1");
    await brief.props.onValidate("play-1");
    expect(f.mutations.validatePlay.mutateAsync).toHaveBeenCalledTimes(1);
    expect(f.mutations.startResearch.mutateAsync).not.toHaveBeenCalled();
    finish({ decisionRunId: 10, decisionRevisionId: 11 }); await pending;
    expect(f.mutations.startResearch.mutateAsync).toHaveBeenCalledWith({ decisionRunId: 10, revisionId: 11, uatCase: undefined });
    expect(f.navigate).toHaveBeenCalledWith("/aperture/run/30?view=evidence");
    for (const name of ["run", "retry", "revise"]) expect(f.mutations[name].mutateAsync).not.toHaveBeenCalled();
  });
  it("keeps a blocked research handoff on the result without a success receipt", async () => {
    f.queries.get.data = result; f.queries.status.data = { state: "complete" };
    f.mutations.validatePlay.mutateAsync.mockResolvedValue({ decisionRunId: 10, decisionRevisionId: 11 });
    f.mutations.startResearch.mutateAsync.mockResolvedValue({ status: "blocked", message: "Research provider unavailable" });
    const brief = nodes(ApertureUnderwriting()).find(node => node.type === "brief");
    await brief.props.onValidate("play-1");
    expect(f.navigate).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Research provider unavailable", { description: "No proposal or broker order was created." });
  });
  it("does not replay a failed research dispatch or claim it created no research", async () => {
    f.queries.get.data = result; f.queries.status.data = { state: "complete" };
    f.mutations.validatePlay.mutateAsync.mockResolvedValue({ decisionRunId: 10, decisionRevisionId: 11 });
    f.mutations.startResearch.mutateAsync.mockRejectedValue(new Error("Response lost"));
    const brief = nodes(ApertureUnderwriting()).find(node => node.type === "brief");
    await brief.props.onValidate("play-1");
    expect(f.mutations.startResearch.mutateAsync).toHaveBeenCalledTimes(1);
    expect(f.navigate).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Response lost");
  });
  it("reopens persisted research after a lost response using reads only", async () => {
    f.queries.get.data = { ...result, selectedPlayId: "play-1" };
    f.queries.status.data = { state: "complete" };
    f.queries.get.refetch.mockResolvedValue({ data: f.queries.get.data });
    f.queries.latest.refetch.mockResolvedValue({ data: { latest: {
      authority: "authoritative", decisionRunId: 10, decisionRevisionId: 11, runId: 30,
    } } });
    const action = nodes(ApertureUnderwriting()).find(node => node.type === "button" && node.props.children === "Check saved research");
    expect(action).toBeDefined();
    await action.props.onClick();
    expect(f.navigate).toHaveBeenCalledWith("/aperture/run/30?view=evidence");
    for (const mutation of Object.values(f.mutations)) expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });
  it.each(["missing", "failed", "wrong-mission", "wrong-revision", "changed-play"])("does not resume %s research or replay dispatch", async failure => {
    f.queries.get.data = { ...result, selectedPlayId: "play-1" };
    f.queries.status.data = { state: "complete" };
    f.queries.get.refetch.mockResolvedValue({ data: { ...f.queries.get.data,
      selectedPlayId: failure === "changed-play" ? "play-2" : "play-1" } });
    f.queries.latest.refetch.mockResolvedValue({ error: failure === "failed" ? new Error("offline") : null,
      data: { latest: { authority: "authoritative",
        decisionRunId: failure === "wrong-mission" ? 99 : 10,
        decisionRevisionId: failure === "wrong-revision" ? 99 : 11,
        runId: failure === "missing" ? null : 30 } } });
    const action = nodes(ApertureUnderwriting()).find(node => node.type === "button" && node.props.children === "Check saved research");
    await action.props.onClick();
    expect(f.navigate).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    for (const mutation of Object.values(f.mutations)) expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });
  it("coalesces repeated recovery clicks without starting any work", async () => {
    f.queries.get.data = { ...result, selectedPlayId: "play-1" };
    f.queries.status.data = { state: "complete" };
    f.queries.get.refetch.mockResolvedValue({ data: f.queries.get.data });
    let finish!: (value: any) => void;
    f.queries.latest.refetch.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const action = nodes(ApertureUnderwriting()).find(node => node.type === "button" && node.props.children === "Check saved research");
    const pending = action.props.onClick();
    await action.props.onClick();
    expect(f.queries.latest.refetch).toHaveBeenCalledTimes(1);
    finish({ data: { latest: { authority: "authoritative", decisionRunId: 10, decisionRevisionId: 11, runId: 30 } } });
    await pending;
    expect(f.navigate).toHaveBeenCalledTimes(1);
    for (const mutation of Object.values(f.mutations)) expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });
  it("explicitly continues a saved selection with no bound run, without selecting again", async () => {
    f.queries.get.data = { ...result, selectedPlayId: "play-1" };
    f.queries.status.data = { state: "complete" };
    f.queries.get.refetch.mockResolvedValue({ data: f.queries.get.data });
    f.queries.latest.refetch.mockResolvedValue({ data: { latest: {
      authority: "authoritative", decisionRunId: 10, decisionRevisionId: 11, runId: null,
    } } });
    f.mutations.startResearch.mutateAsync.mockResolvedValue({ status: "started", runId: 30 });
    const action = nodes(ApertureUnderwriting()).find(node => node.type === "button" && node.props.children === "Continue selected research");
    expect(action).toBeDefined();
    await action.props.onClick();
    expect(f.mutations.startResearch.mutateAsync).toHaveBeenCalledWith({ decisionRunId: 10, revisionId: 11, uatCase: undefined });
    expect(f.mutations.validatePlay.mutateAsync).not.toHaveBeenCalled();
    expect(f.navigate).toHaveBeenCalledWith("/aperture/run/30?view=evidence");
  });
});

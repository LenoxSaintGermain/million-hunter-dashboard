import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyMissionDraftValues, type MissionDraftRecord, type MissionDraftValues } from "../../shared/apertureMissionDraft";
import { STALE_ACCOUNT_MS } from "../../shared/cockpitRailSummary";
import { ObjectiveMissionFlow, type ObjectiveMissionFlowProps } from "../../client/src/components/aperture/ObjectiveMissionFlow";
import { ObjectiveMissionWorkspace, type ObjectiveMissionWorkspaceProps } from "../../client/src/components/aperture/ObjectiveMissionWorkspace";
import { ObjectiveDiscoveryResult, type ObjectiveDiscoveryResultProps, type ObjectiveDiscoverySnapshot } from "../../client/src/components/aperture/ObjectiveDiscoveryResult";

// Deterministic controller hooks + real child markup, as in the existing Mission
// UI tests. These are API-boundary journeys, not browser/focus or provider tests.
const fixture = vi.hoisted(() => ({
  active: false, cursor: 0, effectCursor: 0, slots: [] as any[], deps: [] as any[],
  effects: [] as Array<() => void>, cleanups: [] as any[], queries: {} as Record<string, any>,
  mutations: {} as Record<string, any>, reads: {} as Record<string, any>, calls: {} as Record<string, any>,
}));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof React>();
  function state(initial: any) {
    const index = fixture.cursor++;
    if (!(index in fixture.slots)) fixture.slots[index] = typeof initial === "function" ? initial() : initial;
    return [fixture.slots[index], (next: any) => { fixture.slots[index] = typeof next === "function" ? next(fixture.slots[index]) : next; }];
  }
  return { ...actual,
    useState: (initial: any) => fixture.active ? state(initial) : actual.useState(initial),
    useRef: (initial: any) => fixture.active ? state({ current: initial })[0] : actual.useRef(initial),
    useMemo: (compute: () => any, deps: any[]) => fixture.active ? compute() : actual.useMemo(compute, deps),
    useEffect: (effect: () => any, deps: any[]) => {
      if (!fixture.active) return actual.useEffect(effect, deps);
      const index = fixture.effectCursor++;
      if (!fixture.deps[index] || deps.some((value, i) => !Object.is(value, fixture.deps[index][i]))) {
        fixture.deps[index] = deps;
        fixture.effects.push(() => { fixture.cleanups[index]?.(); fixture.cleanups[index] = effect(); });
      }
    },
  };
});
vi.mock("@/lib/trpc", () => {
  const endpoint = (name: string): any => ({
    useQuery: (input: unknown, options: unknown) => { fixture.calls[name] = { input, options }; return fixture.queries[name]; },
    useMutation: () => fixture.mutations[name],
    fetch: (...args: unknown[]) => fixture.reads[name](...args),
  });
  const thesis = { list: endpoint("canonical") };
  const aperture = {
    account: { list: endpoint("accounts") },
    runway: { draft: { get: endpoint("draft"), save: endpoint("save") } },
    strategy: { capabilities: endpoint("capabilities"), start: endpoint("start"), run: endpoint("run"), get: endpoint("get"), resume: endpoint("resume"), executionSources: endpoint("executionSources") },
    underwriter: { preview: endpoint("preview") },
  };
  return { trpc: { aperture, thesis, useUtils: () => ({ aperture, thesis }) } };
});

const requestId = "00000000-0000-4000-8000-000000000011";
const declarationId = "00000000-0000-4000-8000-000000000012";
const now = Date.UTC(2026, 8, 10, 18);
function values(): MissionDraftValues {
  return { ...emptyMissionDraftValues(), accountId: 31, capital: "10,000", maxLoss: "500", activeSection: 3,
    mission: "Illustrative: research uses for declared capital next month.",
    strategyContext: { schemaVersion: 1, requestId, declarationId, intent: "deploy_excess_capital",
      searchScope: "broader_permitted_universe", requestedSymbols: [], sourceOrder: null, profitReserve: "" } };
}
function record(value = values(), version = 4): MissionDraftRecord { return { id: 1, values: value, version, updatedAt: now, completedAt: null }; }
function snapshot(state: ObjectiveDiscoverySnapshot["job"]["state"] = "running"): ObjectiveDiscoverySnapshot {
  return { decisionRunId: 71, decisionRevisionId: 72, acceptedValues: values(), sourceDraftVersion: 4,
    account: { id: 31, label: "Illustrative Paper", isPaper: true, asOf: now },
    job: state === "not_started" ? { state, jobId: null, updatedAt: null, canRetry: false, message: "Illustrative persisted discovery status." }
      : { state, jobId: 81, updatedAt: now, canRetry: state === "failed" || state === "interrupted", message: "Illustrative persisted discovery status." },
    receipt: null, latestAttempt: null, history: [], usingPreviousResult: false,
    mutations: { analysisStarted: false, allocationCreated: false, orderCreated: false } };
}
function recordedSnapshot(): ObjectiveDiscoverySnapshot {
  const receipt: NonNullable<ObjectiveDiscoverySnapshot["receipt"]> = {
    id: 101, jobId: 81, attempt: 1, createdAt: now,
    request: { schemaVersion: 1, requestId, missionHash: "illustrative-mission-hash", searchScope: "broader_permitted_universe",
      universePolicy: "cited_us_security_leads", permittedUniverse: [], mission: values().mission,
      holdingPeriods: ["intraday"], instrumentPreference: "shares" },
    result: { status: "incomplete", requestId, asOf: now, contentSha256: "illustrative-content-hash", context: null,
      reviewedUniverse: [], coverageGaps: ["Illustrative retained coverage gap."], hypotheses: [], rejectedHypotheses: [],
      issues: [], sourceOrigins: [], investmentAlternatives: [], confidence: null,
      sideEffects: { providerInvoked: false, persistenceWritten: false, capitalReserved: false, orderCreated: false } },
  };
  return { ...snapshot("complete"), receipt, latestAttempt: receipt, history: [{ id: 101, attempt: 1, createdAt: now, status: "incomplete" }] };
}
function preview(input: any) {
  return { asOf: now, account: { id: input.accountId, label: "Illustrative Paper", isPaper: true, lastSyncedAt: now }, objective: input.objective,
    // Deliberately unrelated to the declarations: only this literal server
    // response, never a client formula, may supply the $12.34 effective limit.
    feasibility: { capitalBaseCents: 1_000_000, targetProfitCents: input.objective.targetProfitCents,
      targetPeriod: input.objective.targetPeriod, requiredReturnPct: 80, classification: "extreme", targetPressure: 7,
      riskBudgetCents: 1234, normalPlayRiskCents: 7500, highConvictionRiskCents: 12500,
      maxOpenRiskCents: 30_000, lossLimitCents: 40_000, assessment: "Illustrative server target assessment.", mayInfluenceSizing: false },
    portfolioRisk: { beforeCents: 1000, remainingHeadroomCents: 2345, bindingConstraint: "risk_policy_or_portfolio_headroom" },
  };
}
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const query = (data: unknown) => ({ data, error: null, isLoading: false, isFetching: false, isError: false, dataUpdatedAt: now, refetch: vi.fn() });
function elements(node: React.ReactNode): React.ReactElement<any>[] {
  return React.Children.toArray(node).flatMap(child => React.isValidElement<{ children?: React.ReactNode }>(child) ? [child, ...elements(child.props.children)] : []);
}
function text(node: React.ReactNode): string {
  return React.Children.toArray(node).map(child => React.isValidElement<{ children?: React.ReactNode }>(child) ? text(child.props.children) : String(child)).join("");
}
function harness(props: ObjectiveMissionFlowProps = {}) {
  function render() {
    for (let i = 0; i < 30; i++) {
      fixture.active = true; fixture.cursor = 0; fixture.effectCursor = 0;
      let tree: React.ReactNode;
      try { tree = ObjectiveMissionFlow(props); } finally { fixture.active = false; }
      if (!fixture.effects.length) return { tree, $: load(renderToStaticMarkup(tree)) };
      fixture.effects.splice(0).forEach(effect => effect());
    }
    throw new Error("Objective hydration did not settle");
  }
  const workspace = () => elements(render().tree).find(element => element.type === ObjectiveMissionWorkspace)!.props as ObjectiveMissionWorkspaceProps;
  const result = () => elements(render().tree).find(element => element.type === ObjectiveDiscoveryResult)!.props as ObjectiveDiscoveryResultProps;
  const click = async (label: string) => {
    const button = elements(render().tree).find(element => element.props.onClick && text(element.props.children) === label);
    expect(button, label).toBeDefined(); expect(button!.props.disabled).not.toBe(true);
    await button!.props.onClick(); return render();
  };
  return { render, workspace, result, click, change: (patch: Partial<MissionDraftValues>) => { const form = workspace(); form.onChange({ ...form.values, ...patch }); return render(); } };
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.clearAllMocks(); vi.stubGlobal("React", React);
  fixture.active = false; fixture.slots = []; fixture.deps = []; fixture.effects = []; fixture.cleanups = []; fixture.calls = {};
  fixture.queries = { draft: query(record()), accounts: query([
    { id: 31, label: "Illustrative Paper", isPaper: true, lastSyncedAt: now },
    { id: 32, label: "Other Paper", isPaper: true, lastSyncedAt: now },
    { id: 33, label: "Live excluded", isPaper: false }, { id: 34, label: "  ", isPaper: true },
  ]), canonical: query([{ id: 7001, name: "Illustrative saved thesis" }]), capabilities: query({ enabled: true, mode: "paper", monitoring: "on_demand" }), get: query(undefined) };
  fixture.reads = Object.fromEntries(["draft", "get", "resume", "preview", "accounts", "canonical", "capabilities"].map(name => [name, vi.fn().mockResolvedValue(null)]));
  fixture.reads.draft.mockImplementation(async () => fixture.queries.draft.data);
  fixture.queries.executionSources = query({ sources: [], nextCursor: null, gainsVerified: false });
  fixture.mutations = Object.fromEntries(["save", "start", "run"].map(name => [name, { isPending: false, mutateAsync: vi.fn() }]));
  fixture.reads.preview.mockImplementation(async (input: unknown) => preview(input));
  fixture.mutations.save.mutateAsync.mockImplementation(async ({ values: value, expectedVersion }: { values: MissionDraftValues; expectedVersion: number }) => record(value, expectedVersion + 1));
});
afterEach(() => { fixture.cleanups.forEach(cleanup => cleanup?.()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("connected Objective Mission", () => {
  it("saves reviewed changes before underwriting with one click and deduplicates repeated clicks", async () => {
    const view = harness(); view.render();
    view.change({ mission: "Illustrative changed question: compare uses of declared capital." });
    await view.workspace().onInspectRisk();
    const write = deferred<MissionDraftRecord>();
    fixture.mutations.save.mutateAsync.mockReturnValueOnce(write.promise);
    const action = view.workspace().onUnderwrite;
    const starting = action(); action();
    expect(fixture.mutations.save.mutateAsync).toHaveBeenCalledOnce();
    expect(fixture.mutations.start.mutateAsync).not.toHaveBeenCalled();
    const changed = view.workspace().values;
    fixture.mutations.start.mutateAsync.mockResolvedValueOnce({ ...snapshot("complete"), acceptedValues: changed, sourceDraftVersion: 5 });
    write.resolve(record(changed, 5)); await starting;
    expect(fixture.mutations.start.mutateAsync).toHaveBeenCalledOnce();
    expect(fixture.mutations.start.mutateAsync).toHaveBeenCalledWith({ requestId, expectedVersion: 5 });
    expect(fixture.mutations.run.mutateAsync).not.toHaveBeenCalled();
  });
  it.each(["rejected", "mismatched"])("does not start analysis after a %s automatic save", async mode => {
    const view = harness(); view.render();
    view.change({ mission: "Illustrative reviewed changes must remain local when saving fails." });
    await view.workspace().onInspectRisk();
    if (mode === "rejected") fixture.mutations.save.mutateAsync.mockRejectedValueOnce(new Error("Illustrative save conflict"));
    else fixture.mutations.save.mutateAsync.mockResolvedValueOnce(record(values(), 5));
    await view.workspace().onUnderwrite();
    expect(fixture.mutations.save.mutateAsync).toHaveBeenCalledOnce();
    expect(fixture.mutations.start.mutateAsync).not.toHaveBeenCalled();
    expect(fixture.mutations.run.mutateAsync).not.toHaveBeenCalled();
    expect(view.render().$.text()).toContain("Compare saved draft");
  });
  it("rechecks risk freshness after a slow automatic save", async () => {
    const view = harness(); view.render(); view.change({ mission: "Illustrative slow save must not use an expired preview." });
    await view.workspace().onInspectRisk();
    const changed = view.workspace().values;
    const write = deferred<MissionDraftRecord>(); fixture.mutations.save.mutateAsync.mockReturnValueOnce(write.promise);
    const starting = view.workspace().onUnderwrite();
    vi.setSystemTime(now + STALE_ACCOUNT_MS + 1);
    write.resolve(record(changed, 5)); await starting;
    expect(fixture.mutations.start.mutateAsync).not.toHaveBeenCalled();
  });
  it("hands a confirmed start to its exact persisted receipt route, never the new-draft URL", async () => {
    const onAccepted = vi.fn();
    const view = harness({ onAccepted } as ObjectiveMissionFlowProps);
    view.render();
    await view.workspace().onInspectRisk();
    expect(onAccepted).not.toHaveBeenCalled();
    const accepted = snapshot("complete");
    fixture.mutations.start.mutateAsync.mockResolvedValueOnce(accepted);
    await view.workspace().onUnderwrite();
    expect(onAccepted).toHaveBeenCalledOnce();
    expect(onAccepted).toHaveBeenCalledWith({
      decisionRunId: accepted.decisionRunId, revisionId: accepted.decisionRevisionId,
    });
    expect(fixture.mutations.run.mutateAsync).not.toHaveBeenCalled();
  });
  it("choosing a source preserves declarations and requires saving the changed draft", () => {
    const original = { ...values(), activeSection: 1 as const };
    const view = harness({ initialDraft: record(original) });
    const picker = view.workspace().sourcePicker as React.ReactElement<any>;
    const source = { accountId: 32, runId: 42, candidateId: 53, orderId: 64 };
    picker.props.onChoose(source);
    const next = view.workspace();
    expect(next.values.accountId).toBe(32);
    expect(next.values.capital).toBe(original.capital); expect(next.values.maxLoss).toBe(original.maxLoss);
    expect(next.values.canonicalThesisId).toBeNull();
    expect(next.values.strategyContext).toEqual({ ...original.strategyContext, intent: "redeploy_realized_gains", sourceOrder: source });
    expect(next.saveState).toBe("unsaved");
    for (const mutation of Object.values(fixture.mutations)) expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });
  it("hydrates the exact draft, lists only named owned Paper accounts, and never auto-mutates", () => {
    const original = record(); const view = harness({ initialDraft: original });
    for (let i = 0; i < 4; i++) view.render();
    expect(view.workspace().values).toEqual(original.values);
    expect(view.workspace().accounts.map(account => account.id)).toEqual([31, 32]);
    expect(view.workspace().canonicalTheses).toEqual([{ id: 7001, name: "Illustrative saved thesis" }]);
    expect(view.workspace().saveState).toBe("saved");
    expect(view.workspace().values.canonicalThesisId).toBeNull();
    for (const mutation of Object.values(fixture.mutations)) expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("saves every changed value, previews only the selected declarations, then starts the exact confirmed version once", async () => {
    const view = harness(); view.render();
    const changed = { ...values(), accountId: 32, canonicalThesisId: 7001, capital: "2,501.25", maxLoss: "125.05",
      targetProfit: "1000.99", targetPeriod: "month" as const, holdingPeriod: "swing" as const, holdingPeriods: ["swing" as const, "position" as const],
      instrument: "either" as const, mission: "Illustrative: compare next-month security ideas with these exact assumptions.",
      strategyContext: { ...values().strategyContext!, intent: "explore_opportunity" as const, searchScope: "related_opportunities" as const, requestedSymbols: [" aapl", "MSFT"], profitReserve: "100.00" } };
    view.change(changed);
    const write = deferred<MissionDraftRecord>(); fixture.mutations.save.mutateAsync.mockReturnValueOnce(write.promise);
    const saving = view.workspace().onSave(); view.render();
    expect(view.workspace().saveState).toBe("saving"); expect(view.render().$.text()).not.toContain("Saved");
    expect(fixture.mutations.save.mutateAsync).toHaveBeenCalledWith({ values: changed, expectedVersion: 4 });
    write.resolve(record(changed, 5)); await saving;
    expect(view.workspace().saveState).toBe("saved");
    await view.workspace().onInspectRisk();
    expect(fixture.reads.preview).toHaveBeenLastCalledWith({ accountId: 32, objective: {
      deployableCapitalCents: 250125, maxPlannedLossCents: 12505, targetProfitCents: 100099, targetPeriod: "month",
      holdingPeriods: ["swing", "position"], instrumentPreference: "either",
      maxPortfolioOpenRiskCents: null, weeklyLossLimitCents: null, eventRiskLimitCents: null,
    } }, { staleTime: 0 });
    expect(view.workspace().riskPreview?.feasibility.riskBudgetCents).toBe(1234);
    expect(view.render().$.text()).toContain("$12.34");
    const accepted = { ...snapshot(), acceptedValues: changed, sourceDraftVersion: 5 };
    const launch = deferred<ObjectiveDiscoverySnapshot>(); fixture.mutations.start.mutateAsync.mockReturnValueOnce(launch.promise);
    const action = view.workspace().onUnderwrite;
    const starting = action(); action();
    expect(fixture.mutations.start.mutateAsync).toHaveBeenCalledOnce();
    expect(fixture.mutations.start.mutateAsync).toHaveBeenCalledWith({ requestId, expectedVersion: 5 });
    launch.resolve(accepted); await starting;
    expect(view.result().snapshot).toEqual(accepted);
    expect(fixture.mutations.run.mutateAsync).not.toHaveBeenCalled();
  });

  it("creates empty values and stable explicit identities, but never overwrites an unfinished thesis draft without comparison", async () => {
    const thesis = record({ ...emptyMissionDraftValues(), canonicalThesisId: 7001, mission: "Illustrative unfinished thesis draft." });
    fixture.queries.draft.data = thesis;
    const view = harness({ newObjective: true }); view.render();
    const local = view.workspace().values;
    expect(local).toEqual({ ...emptyMissionDraftValues(), strategyContext: expect.objectContaining({
      requestId: expect.any(String), declarationId: expect.any(String), searchScope: "broader_permitted_universe", intent: "deploy_excess_capital",
    }) });
    expect(local.strategyContext!.requestId).not.toBe(local.strategyContext!.declarationId);
    for (let i = 0; i < 4; i++) view.render();
    expect(view.workspace().values.strategyContext).toEqual(local.strategyContext);
    await view.workspace().onSave(); expect(fixture.mutations.save.mutateAsync).not.toHaveBeenCalled();
    expect(view.render().$.text()).toContain("contains a thesis draft");
    expect(view.render().$.text()).not.toContain("Replace saved draft with my edits");
    await view.click("Compare saved draft");
    expect(view.render().$("table").text()).toContain(thesis.values.mission);
    await view.click("Replace saved draft with my edits");
    expect(fixture.mutations.save.mutateAsync).toHaveBeenCalledOnce();
    expect(fixture.mutations.save.mutateAsync).toHaveBeenCalledWith({ values: local, expectedVersion: 4, replaceStrategyContext: true });
    expect(view.workspace().saveState).toBe("saved");
  });

  it("preserves local edits on refresh and only adopts a compared remote draft, retaining the local copy", async () => {
    const view = harness(); view.render();
    const localQuestion = "Illustrative local edits should survive another device saving.";
    view.change({ mission: localQuestion });
    const remote = record({ ...values(), mission: "Illustrative remote question from a different device.", capital: "7777" }, 5);
    fixture.reads.draft.mockResolvedValue(remote);
    await view.click("Refresh saved draft");
    expect(view.workspace().values.mission).toBe(localQuestion);
    expect(view.workspace().saveState).toBe("unsaved");
    expect(view.render().$.text()).not.toContain("Use saved draft; retain local copy");
    await view.click("Compare saved draft");
    expect(view.render().$("table").text()).toContain(localQuestion);
    expect(view.render().$("table").text()).toContain(remote.values.mission);
    await view.click("Use saved draft; retain local copy");
    expect(view.workspace().values).toEqual(remote.values);
    expect(view.render().$("pre").text()).toContain(localQuestion);
    expect(fixture.mutations.save.mutateAsync).not.toHaveBeenCalled();
  });

  it("keeps a save conflict unsaved and uses only the explicitly reviewed version for replacement", async () => {
    const view = harness(); view.render(); view.change({ capital: "5555" });
    const remote = record({ ...values(), capital: "8888" }, 7);
    fixture.reads.draft.mockResolvedValue(remote);
    fixture.mutations.save.mutateAsync.mockRejectedValueOnce(new Error("CONFLICT: another device saved."));
    await view.workspace().onSave();
    expect(view.workspace().values.capital).toBe("5555");
    expect(view.workspace().saveState).toBe("failed");
    expect(view.render().$('header [role="status"]').text()).not.toBe("Saved");
    await view.workspace().onSave(); expect(fixture.mutations.save.mutateAsync).toHaveBeenCalledTimes(1);
    await view.click("Compare saved draft"); await view.click("Replace saved draft with my edits");
    expect(fixture.mutations.save.mutateAsync.mock.lastCall[0]).toMatchObject({ expectedVersion: 7, values: { capital: "5555" } });
    expect(view.workspace().saveState).toBe("saved");
  });

  it.each([false, undefined, "error"])("blocks analysis when capabilities are %s without blocking explicit draft saves", async available => {
    fixture.queries.capabilities = available === "error" ? { ...query(undefined), error: new Error("Unavailable"), isError: true }
      : query(available === undefined ? undefined : { enabled: available, mode: "paper" });
    const view = harness(); view.render(); await view.workspace().onInspectRisk();
    view.change({ mission: "Illustrative edits remain saveable while discovery is unavailable." });
    await view.workspace().onSave(); await view.workspace().onUnderwrite();
    expect(view.workspace().blockedReason).toContain("unavailable");
    expect(fixture.mutations.save.mutateAsync).toHaveBeenCalledOnce();
    expect(fixture.mutations.start.mutateAsync).not.toHaveBeenCalled();
  });

  it("invalidates a prior constraint on assumptions/account changes and never labels a failed or late preview ready", async () => {
    const view = harness(); view.render(); await view.workspace().onInspectRisk();
    expect(view.workspace().riskPreview?.status).toBe("ready");
    view.change({ capital: "20000" }); expect(view.workspace().riskPreview?.status).toBe("stale");
    fixture.reads.preview.mockRejectedValueOnce(new Error("Illustrative preview unavailable."));
    await view.workspace().onInspectRisk();
    expect(view.workspace().riskPreview?.status).toBe("failed");
    expect(view.render().$.text()).toContain("Recorded effective constraint");
    expect(view.render().$.text()).toContain("Illustrative preview unavailable");
    const pending = deferred<any>(); fixture.reads.preview.mockReturnValueOnce(pending.promise);
    const inspect = view.workspace().onInspectRisk();
    const sent = fixture.reads.preview.mock.lastCall[0];
    view.change({ accountId: 32 }); pending.resolve(preview(sent)); await inspect;
    expect(view.workspace().riskPreview?.status).not.toBe("ready");
    expect(view.render().$.text()).not.toContain("$12.34");
    await view.workspace().onInspectRisk(); expect(view.workspace().riskPreview?.accountId).toBe(32);
    fixture.queries.accounts.data = fixture.queries.accounts.data.map((account: any) => ({ ...account, lastSyncedAt: now + 5000 }));
    expect(view.workspace().riskPreview?.status).toBe("stale");
    expect(fixture.mutations.start.mutateAsync).not.toHaveBeenCalled();
  });

  it.each(["", "-1", "1e4", "1,00", "12.345", "9007199254740992"])("never sends invalid declared capital %j as a zero or inferred amount", async capital => {
    const view = harness(); view.render(); view.change({ capital });
    await view.workspace().onInspectRisk();
    expect(fixture.reads.preview).not.toHaveBeenCalled();
    expect(view.workspace().values.capital).toBe(capital);
    expect(view.render().$.text()).toContain("Enter valid declared capital");
  });

  it("reloads exact accepted base identities and polls only GET without restarting the persisted job", async () => {
    const acceptedDraft = { ...record({ ...values(), baseDecisionRunId: 71, baseDecisionRevisionId: 72 }, 5), completedAt: now };
    fixture.queries.draft.data = acceptedDraft; fixture.queries.get.data = snapshot();
    const view = harness({ initialDraft: acceptedDraft });
    expect(view.result().snapshot.acceptedValues).toEqual(values());
    expect(fixture.calls.get.input).toEqual({ decisionRunId: 71, decisionRevisionId: 72 });
    expect(fixture.calls.get.options.enabled).toBe(true);
    expect(fixture.calls.get.options.refetchInterval({ state: { data: snapshot() } })).toBe(3000);
    expect(fixture.calls.get.options.refetchInterval({ state: { data: snapshot("failed") } })).toBe(false);
    await vi.advanceTimersByTimeAsync(12_000); view.render();
    for (const mutation of Object.values(fixture.mutations)) expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("displays acceptedValues from the exact receipt, never a newer unrelated draft or canonical thesis", () => {
    fixture.queries.draft.data = record({ ...values(), mission: "Unrelated newer question must not become the receipt.", canonicalThesisId: 7001 }, 99);
    fixture.queries.get.data = snapshot();
    const view = harness({ receiptTarget: { decisionRunId: 71, revisionId: 72 } });
    expect(view.result().snapshot.acceptedValues.canonicalThesisId).toBeNull();
    expect(view.render().$('section[aria-label="Accepted Mission assumptions"]').text()).toContain(values().mission);
    expect(view.render().$('section[aria-label="Accepted Mission assumptions"]').text()).not.toContain("Unrelated newer question");
    for (const mutation of Object.values(fixture.mutations)) expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("retains a prior result on a failed GET and failed manual refresh, then clears failure on successful GET", async () => {
    fixture.queries.get.data = recordedSnapshot();
    const view = harness({ receiptTarget: { decisionRunId: 71, revisionId: 72 } });
    const previous = view.result().snapshot;
    fixture.queries.get = { ...query(undefined), error: new Error("Illustrative GET unavailable."), isError: true };
    expect(view.result().snapshot).toEqual(previous);
    expect(view.render().$.text()).toContain("Illustrative retained coverage gap.");
    expect(view.result().failure).toContain("GET unavailable");
    fixture.reads.get.mockRejectedValueOnce(new Error("Illustrative refresh failed."));
    await view.result().onRefresh();
    expect(view.result().snapshot).toEqual(previous);
    expect(view.render().$.text()).toContain("refresh failed");
    fixture.queries.get = query({ ...snapshot(), job: { ...snapshot().job, message: "Fresh persisted status." } });
    expect(view.result().failure).toBeNull();
    for (const mutation of Object.values(fixture.mutations)) expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("reconciles a start timeout by the original UUID even after the draft was replaced, without another start", async () => {
    const view = harness(); view.render(); await view.workspace().onInspectRisk();
    fixture.mutations.start.mutateAsync.mockRejectedValueOnce(new Error("TIMEOUT"));
    fixture.reads.draft.mockResolvedValue(record({ ...emptyMissionDraftValues(), mission: "Unrelated new thesis draft from another device." }, 9));
    fixture.reads.resume.mockResolvedValue(snapshot());
    await view.workspace().onUnderwrite();
    expect(fixture.reads.resume).toHaveBeenCalledWith({ requestId }, { staleTime: 0 });
    expect(fixture.reads.draft).toHaveBeenCalledWith(undefined, { staleTime: 0 });
    expect(view.result().snapshot).toEqual(snapshot());
    expect(fixture.mutations.start.mutateAsync).toHaveBeenCalledOnce();
    expect(fixture.mutations.run.mutateAsync).not.toHaveBeenCalled();
  });

  it("allows only an explicit same-UUID same-version retry after both reads prove no accepted Mission and an unchanged draft", async () => {
    const view = harness(); view.render(); await view.workspace().onInspectRisk();
    fixture.mutations.start.mutateAsync.mockRejectedValueOnce(new Error("TIMEOUT")).mockResolvedValueOnce(snapshot());
    await view.workspace().onUnderwrite();
    expect(view.render().$.text()).toContain("Retry original start");
    for (let i = 0; i < 3; i++) view.render();
    expect(fixture.mutations.start.mutateAsync).toHaveBeenCalledTimes(1);
    await view.click("Retry original start");
    expect(fixture.reads.resume).toHaveBeenCalledTimes(2);
    expect(fixture.mutations.start.mutateAsync.mock.calls).toEqual([[{ requestId, expectedVersion: 4 }], [{ requestId, expectedVersion: 4 }]]);
    expect(view.result().snapshot.acceptedValues.strategyContext?.declarationId).toBe(declarationId);
  });

  it("retains the start refusal reason after reconciling an unchanged draft", async () => {
    const view = harness(); view.render(); await view.workspace().onInspectRisk();
    fixture.mutations.start.mutateAsync.mockRejectedValueOnce(new Error("The isolated UAT discovery fixture is not configured. No Mission or provider work was started."));
    await view.workspace().onUnderwrite();
    expect(view.render().$.text()).toContain("discovery fixture is not configured");
    expect(view.render().$.text()).toContain("exact saved draft is unchanged");
    await view.click("Check saved start");
    expect(view.render().$.text()).toContain("discovery fixture is not configured");
    expect(fixture.mutations.start.mutateAsync).toHaveBeenCalledOnce();
  });

  it.each(["resume unavailable", "draft unavailable", "draft replaced", "version changed"])("never retries an uncertain start when reconciliation reports %s", async condition => {
    const view = harness(); view.render(); await view.workspace().onInspectRisk();
    fixture.mutations.start.mutateAsync.mockRejectedValueOnce(new Error("TIMEOUT"));
    if (condition === "resume unavailable") fixture.reads.resume.mockRejectedValue(new Error("Resume unavailable"));
    if (condition === "draft unavailable") fixture.reads.draft.mockRejectedValue(new Error("Draft unavailable"));
    if (condition === "draft replaced") fixture.reads.draft.mockResolvedValue(record({ ...emptyMissionDraftValues(), mission: "Illustrative replacement thesis." }, 5));
    if (condition === "version changed") fixture.reads.draft.mockResolvedValue(record(values(), 5));
    await view.workspace().onUnderwrite();
    expect(view.render().$.text()).toContain("Start outcome is unconfirmed");
    expect(view.render().$.text()).not.toContain("Retry original start");
    expect(view.workspace().values.strategyContext).toMatchObject({ requestId, declarationId });
    await view.workspace().onUnderwrite(); await view.workspace().onSave();
    expect(fixture.mutations.start.mutateAsync).toHaveBeenCalledTimes(1);
    expect(fixture.mutations.save.mutateAsync).not.toHaveBeenCalled();
  });

  it("does not retry if acceptance appears between reconciliation and clicking retry", async () => {
    const view = harness(); view.render(); await view.workspace().onInspectRisk();
    fixture.mutations.start.mutateAsync.mockRejectedValueOnce(new Error("TIMEOUT"));
    await view.workspace().onUnderwrite();
    fixture.reads.resume.mockResolvedValue(snapshot());
    await view.click("Retry original start");
    expect(view.result().snapshot.decisionRunId).toBe(71);
    expect(fixture.mutations.start.mutateAsync).toHaveBeenCalledOnce();
  });

  it("retries only the exact persisted job on explicit request after a fresh GET", async () => {
    const failed = snapshot("failed"); fixture.queries.get.data = failed; fixture.reads.get.mockResolvedValue(failed);
    fixture.mutations.run.mutateAsync.mockResolvedValue(snapshot());
    const view = harness({ receiptTarget: { decisionRunId: 71, revisionId: 72 } });
    view.render(); expect(fixture.mutations.run.mutateAsync).not.toHaveBeenCalled();
    await view.result().onRetry();
    expect(fixture.reads.get).toHaveBeenCalledWith({ decisionRunId: 71, decisionRevisionId: 72 }, { staleTime: 0 });
    expect(fixture.mutations.run.mutateAsync).toHaveBeenCalledWith({ decisionRunId: 71, decisionRevisionId: 72, retryJobId: 81 });
    expect(fixture.mutations.start.mutateAsync).not.toHaveBeenCalled();
  });

  it.each(["preview old", "account old", "account unknown", "preview future"])("does not authorize a %s effective constraint", async condition => {
    const view = harness(); view.render();
    fixture.reads.preview.mockImplementation(async (input: unknown) => {
      const result = preview(input);
      if (condition === "preview old") result.asOf = now - STALE_ACCOUNT_MS - 1;
      if (condition === "account old") result.account.lastSyncedAt = now - STALE_ACCOUNT_MS - 1;
      if (condition === "account unknown") result.account.lastSyncedAt = null as any;
      if (condition === "preview future") result.asOf = now + 60_000;
      return result;
    });
    await view.workspace().onInspectRisk();
    expect(view.workspace().riskPreview?.status).not.toBe("ready");
    await view.workspace().onUnderwrite(); expect(fixture.mutations.start.mutateAsync).not.toHaveBeenCalled();
  });

  it("expires a previously fresh constraint without an edit or mutation, including a captured start callback", async () => {
    const view = harness(); view.render(); await view.workspace().onInspectRisk();
    const start = view.workspace().onUnderwrite;
    await vi.advanceTimersByTimeAsync(STALE_ACCOUNT_MS + 1);
    await start();
    expect(view.workspace().riskPreview?.status).not.toBe("ready");
    expect(fixture.mutations.start.mutateAsync).not.toHaveBeenCalled();
  });

  it("never shows or adopts another receipt's cached snapshot when the receipt target changes", async () => {
    fixture.queries.get.data = snapshot();
    const props: ObjectiveMissionFlowProps = { receiptTarget: { decisionRunId: 71, revisionId: 72 } };
    const view = harness(props); view.render();
    const response = deferred<ObjectiveDiscoverySnapshot>(); fixture.reads.get.mockReturnValueOnce(response.promise);
    const refresh = view.result().onRefresh();
    props.receiptTarget = { decisionRunId: 91, revisionId: 92 };
    expect(view.render().$('section[aria-label="Research findings"]')).toHaveLength(0);
    expect(fixture.calls.get.input).toEqual({ decisionRunId: 91, decisionRevisionId: 92 });
    response.resolve(snapshot()); await refresh;
    expect(view.render().$('section[aria-label="Research findings"]')).toHaveLength(0);
    fixture.queries.get.data = { ...snapshot(), decisionRunId: 91, decisionRevisionId: 92, acceptedValues: { ...values(), mission: "Illustrative exact second receipt." } };
    expect(view.result().snapshot.decisionRunId).toBe(91);
    props.receiptTarget = null;
    expect(view.render().$('section[aria-label="Research findings"]')).toHaveLength(0);
  });

  it("does not reconcile, start or restart anything after leaving an in-flight start", async () => {
    const view = harness(); view.render(); await view.workspace().onInspectRisk();
    const pending = deferred<ObjectiveDiscoverySnapshot>(); fixture.mutations.start.mutateAsync.mockReturnValueOnce(pending.promise);
    const starting = view.workspace().onUnderwrite();
    fixture.cleanups.forEach(cleanup => cleanup?.());
    pending.reject(new Error("TIMEOUT after leaving")); await starting;
    expect(fixture.mutations.start.mutateAsync).toHaveBeenCalledOnce();
    expect(fixture.reads.resume).not.toHaveBeenCalled();
    expect(fixture.mutations.run.mutateAsync).not.toHaveBeenCalled();
  });

  it("does not send analysis with an unknown effective limit", async () => {
    const view = harness(); view.render();
    fixture.reads.preview.mockImplementation(async (input: unknown) => ({ ...preview(input), feasibility: { ...preview(input).feasibility, riskBudgetCents: null } }));
    await view.workspace().onInspectRisk(); await view.workspace().onUnderwrite();
    expect(view.workspace().riskPreview?.status).not.toBe("ready");
    expect(fixture.mutations.start.mutateAsync).not.toHaveBeenCalled();
  });

  it("preserves a failed run's prior findings and never automatically retries its job", async () => {
    const failed = { ...recordedSnapshot(), job: snapshot("failed").job };
    fixture.queries.get.data = failed; fixture.reads.get.mockResolvedValue(failed);
    fixture.mutations.run.mutateAsync.mockRejectedValueOnce(new Error("TIMEOUT while retrying saved job"));
    const view = harness({ receiptTarget: { decisionRunId: 71, revisionId: 72 } });
    await view.result().onRetry();
    expect(view.result().snapshot.receipt?.id).toBe(101);
    expect(view.render().$.text()).toContain("Illustrative retained coverage gap.");
    expect(view.result().failure).toContain("TIMEOUT");
    for (let i = 0; i < 4; i++) view.render();
    expect(fixture.mutations.run.mutateAsync).toHaveBeenCalledOnce();
    expect(fixture.mutations.start.mutateAsync).not.toHaveBeenCalled();
  });

  it("starts a not-started accepted job only explicitly and refuses a changed job identity", async () => {
    fixture.queries.get.data = snapshot("not_started"); fixture.reads.get.mockResolvedValue(snapshot("not_started"));
    fixture.mutations.run.mutateAsync.mockResolvedValue(snapshot());
    const view = harness({ receiptTarget: { decisionRunId: 71, revisionId: 72 } });
    view.render(); expect(fixture.mutations.run.mutateAsync).not.toHaveBeenCalled();
    await view.result().onStart();
    expect(fixture.mutations.run.mutateAsync).toHaveBeenCalledWith({ decisionRunId: 71, decisionRevisionId: 72 });
    fixture.queries.get.data = snapshot("failed");
    fixture.reads.get.mockResolvedValue({ ...snapshot(), job: { ...snapshot().job, jobId: 82 } });
    await view.result().onRetry();
    expect(fixture.mutations.run.mutateAsync).toHaveBeenCalledOnce();
  });

  it("shows readable material differences while keeping UUIDs and metadata at optional record depth", async () => {
    const view = harness(); view.render(); view.change({ capital: "2222.00", mission: "Illustrative changed question with a different capital declaration." });
    fixture.reads.draft.mockResolvedValue(record(values(), 5));
    await view.click("Refresh saved draft"); await view.click("Compare saved draft");
    const $ = view.render().$;
    expect($("table").text()).toContain("Declared capital");
    expect($("table").text()).toContain("$2222.00");
    expect($("table").text()).toContain("Research question");
    expect($("table").text()).not.toContain("strategyContext");
    expect($("table").text()).not.toContain(requestId);
    expect($("summary").text()).toContain("Exact identities and remaining changes");
  });

  it.each(["loading", "disabled", "unavailable"])("keeps a persisted Complete result readable when action capabilities are %s", async state => {
    fixture.queries.capabilities = state === "loading" ? { ...query(undefined), isLoading: true, isFetching: true }
      : state === "unavailable" ? { ...query(undefined), error: new Error("Capabilities unavailable"), isError: true }
        : query({ enabled: false, mode: "paper" });
    fixture.queries.get.data = recordedSnapshot(); fixture.reads.get.mockResolvedValue(recordedSnapshot());
    const view = harness({ receiptTarget: { decisionRunId: 71, revisionId: 72 } });
    expect(view.result().failure).toBeNull();
    expect(view.render().$('[data-discovery-status="complete"]')).toHaveLength(1);
    expect(view.result().actionBlockedReason).toBeTruthy();
    expect(view.render().$.text()).toContain("Illustrative retained coverage gap.");
    expect(view.render().$('section[aria-label="Discovery action availability"]')).toHaveLength(0);
    expect(fixture.calls.get.options.enabled).toBe(true);
    await view.result().onRefresh();
    expect(fixture.reads.get).toHaveBeenCalledOnce();
    expect(view.result().snapshot.receipt?.id).toBe(101);
    expect(fixture.mutations.start.mutateAsync).not.toHaveBeenCalled();
    expect(fixture.mutations.run.mutateAsync).not.toHaveBeenCalled();
  });

  it.each(["not_started", "failed"] as const)("shows availability separately for %s job actions and still permits read-only refresh", async state => {
    fixture.queries.capabilities.data = { enabled: false, mode: "paper" };
    fixture.queries.get.data = snapshot(state); fixture.reads.get.mockResolvedValue(snapshot(state));
    const view = harness({ receiptTarget: { decisionRunId: 71, revisionId: 72 } });
    expect(view.result().failure).toBeNull();
    expect(view.result().actionBlockedReason).toContain("unavailable");
    await view.result().onStart(); await view.result().onRetry(); await view.result().onRefresh();
    expect(fixture.reads.get).toHaveBeenCalledOnce();
    expect(fixture.mutations.run.mutateAsync).not.toHaveBeenCalled();
  });

  it("refreshes capabilities alongside the exact saved result and treats failed availability as an action block only", async () => {
    fixture.queries.get.data = recordedSnapshot(); fixture.reads.get.mockResolvedValue(recordedSnapshot());
    fixture.reads.capabilities.mockRejectedValueOnce(new Error("Capability read unavailable"));
    const view = harness({ receiptTarget: { decisionRunId: 71, revisionId: 72 } });
    await view.result().onRefresh();
    expect(fixture.reads.capabilities).toHaveBeenCalledWith(undefined, { staleTime: 0 });
    expect(view.result().failure).toBeNull();
    expect(view.result().actionBlockedReason).toBeTruthy();
    expect(view.render().$('[data-discovery-status="complete"]')).toHaveLength(1);
    fixture.reads.capabilities.mockResolvedValueOnce({ enabled: true, mode: "paper", monitoring: "on_demand" });
    await view.result().onRefresh();
    expect(view.result().actionBlockedReason).toBeNull();
    expect(fixture.mutations.run.mutateAsync).not.toHaveBeenCalled();
  });
});

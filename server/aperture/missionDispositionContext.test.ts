import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateTargetFeasibility } from "../../shared/playUnderwriting";
import { emptyMissionDraftValues } from "../../shared/apertureMissionDraft";
import { DecisionRunway } from "../../client/src/components/aperture/DecisionRunway";

// Exercise the real Mission's hydration and callbacks, then render its actual
// children. Hook state is deterministic; this is not browser/focus coverage.
const fixture = vi.hoisted(() => ({
  active: false, cursor: 0, effectCursor: 0, slots: [] as any[], deps: [] as any[],
  effects: [] as Array<() => void>, cleanups: [] as any[], queries: {} as Record<string, any>,
  mutations: {} as Record<string, any>, invalidate: vi.fn(), success: vi.fn(), openResearch: vi.fn(),
  headings: {} as Record<string, any>, lookupHeading: vi.fn(),
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  function state(initial: any) {
    const index = fixture.cursor++;
    if (!(index in fixture.slots)) fixture.slots[index] = typeof initial === "function" ? initial() : initial;
    return [fixture.slots[index], (next: any) => { fixture.slots[index] = typeof next === "function" ? next(fixture.slots[index]) : next; }] as const;
  }
  return { ...actual,
    useState: (initial: any) => fixture.active ? state(initial) : actual.useState(initial),
    useRef: (initial: any) => fixture.active ? state({ current: initial })[0] : actual.useRef(initial),
    useMemo: (compute: () => any, deps: any[]) => fixture.active ? compute() : actual.useMemo(compute, deps),
    useReducer: (reducer: any, initial: any) => {
      if (!fixture.active) return actual.useReducer(reducer, initial);
      const [value, update] = state(initial);
      return [value, (event: any) => update((current: any) => reducer(current, event))];
    },
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
vi.mock("sonner", () => ({ toast: { success: fixture.success, error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock("@/lib/trpc", () => {
  const endpoint = (name: string): any => ({
    useQuery: () => fixture.queries[name], useMutation: () => fixture.mutations[name],
    invalidate: fixture.invalidate, setData: vi.fn(), fetch: vi.fn().mockResolvedValue(null),
  });
  const thesis = { list: endpoint("canonical"), activeCapital: endpoint("active"), createCapital: endpoint("create"), useInAperture: endpoint("project") };
  const aperture = {
    thesis: { list: endpoint("capitalTheses") }, account: { list: endpoint("accounts") }, cockpit: endpoint("cockpit"),
    desk: { summary: endpoint("desk") },
    runway: { latest: endpoint("latest"), pending: endpoint("pending"), library: endpoint("library"), begin: endpoint("begin"),
      startResearch: endpoint("startResearch"), resolveCashOutcome: endpoint("resolveCash"),
      draft: { get: endpoint("draft"), save: endpoint("saveDraft"), complete: endpoint("completeDraft") } },
    underwriter: { get: endpoint("underwriting"), status: endpoint("job"), preview: endpoint("preview"), run: endpoint("run"), validatePlay: endpoint("validate") },
  };
  return { trpc: { aperture, thesis, useUtils: () => ({ aperture, thesis }) } };
});

const now = Date.UTC(2026, 8, 9, 18);
const objective = { deployableCapitalCents: 2_500_000, targetProfitCents: 600_000, targetPeriod: "week" as const, maxPlannedLossCents: 25_000, holdingPeriods: ["swing" as const], instrumentPreference: "shares" as const };
const risk = { normalPlayRiskPct: .75, highConvictionRiskPct: 1.25, maxAggregateOpenRiskPct: 3, weeklyLossLimitPct: 4, eventRiskAllocationPct: 1.5, perPlayHeadroomCents: 74_200, aggregateOpenRiskBeforeCents: 0, weeklyLossUsedCents: 0 };
const query = (data: any) => ({ data, error: null, isError: false, isLoading: false, isFetching: false, refetch: vi.fn() });
function elements(node: React.ReactNode): React.ReactElement<any>[] {
  return React.Children.toArray(node).flatMap(child => React.isValidElement<{ children?: React.ReactNode }>(child) ? [child, ...elements(child.props.children)] : []);
}
function text(node: React.ReactNode): string {
  return React.Children.toArray(node).map(child => React.isValidElement<{ children?: React.ReactNode }>(child) ? text(child.props.children) : String(child)).join("");
}
function render() {
  for (let attempt = 0; attempt < 20; attempt++) {
    fixture.active = true; fixture.cursor = 0; fixture.effectCursor = 0;
    const tree = DecisionRunway({ onNewResearch: fixture.openResearch, onOpenResearchRun: fixture.openResearch });
    fixture.active = false;
    if (!fixture.effects.length) return { tree, $: load(renderToStaticMarkup(tree)) };
    fixture.effects.splice(0).forEach(effect => effect());
  }
  throw new Error("Mission hydration did not settle");
}
const button = (tree: React.ReactNode, label: string) => elements(tree).find(element => element.props.onClick && text(element.props.children) === label)!;
function setDraft(branch: "research" | "conditional" | "cash", section: 2 | 3 = 3) {
  fixture.queries.draft.data.values.branch = branch;
  fixture.queries.draft.data.values.activeSection = section;
}
function visibleText($: ReturnType<typeof load>) {
  const glance = load($.html()); glance("[hidden],details").remove(); return glance.text();
}

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.clearAllMocks();
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", { location: { search: "" }, setTimeout, clearTimeout, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  fixture.headings = Object.fromEntries(["thesis", "risk", "review"].map(section => [`mission-section-${section}`, { focus: vi.fn(), scrollIntoView: vi.fn(), closest: vi.fn().mockReturnValue(null) }]));
  fixture.lookupHeading.mockImplementation(id => fixture.headings[id] ?? null);
  vi.stubGlobal("document", { getElementById: fixture.lookupHeading });
  fixture.active = false; fixture.slots = []; fixture.deps = []; fixture.effects = []; fixture.cleanups = [];
  fixture.queries = {
    latest: query({ activeCanonicalThesisId: 720001, latest: null }), pending: query([]),
    canonical: query([{ id: 720001, name: "Illustrative PWR", version: 1 }]),
    capitalTheses: query([{ id: 33, sourceCompilationId: 720001 }]),
    accounts: query([{ id: 3, label: "Illustrative Paper", isPaper: true, brokerId: "alpaca_paper", lastSyncedAt: now }]),
    cockpit: query({ account: { accountId: 3 }, mandate: { version: "v2", maxPlannedRiskPctPerPlay: .75 }, headroom: { lines: [] } }),
    preview: query({ account: { id: 3, lastSyncedAt: now }, asOf: now, feasibility: calculateTargetFeasibility(objective, risk), risk, portfolioRisk: { beforeCents: 0, remainingHeadroomCents: 75_000 } }),
    underwriting: query(null), job: query(null), library: query([]),
    draft: query({ id: 1, version: 4, updatedAt: now, completedAt: null, values: { ...emptyMissionDraftValues(),
      canonicalThesisId: 720001, accountId: 3, activeSection: 3, capital: "25000", maxLoss: "250", targetProfit: "6000", targetPeriod: "week",
      holdingPeriod: "swing", holdingPeriods: ["swing"], mission: "Illustrative mission to wait for verified catalyst evidence.", missionDirty: true,
      branch: "conditional", reason: "Wait for verified evidence", blocker: "Catalyst unverified", reopen: "Verify the catalyst", gateLabel: "Catalyst review",
      eligibilityReviewAt: "2026-09-10T10:00", outcomeReviewAtInput: "2026-09-11T15:00",
    } }),
  };
  fixture.mutations = Object.fromEntries(["create", "project", "begin", "startResearch", "resolveCash", "saveDraft", "completeDraft", "run", "validate"].map(name => [name, { isPending: false, error: null, data: null, mutateAsync: vi.fn() }]));
  fixture.invalidate.mockResolvedValue(undefined);
  fixture.mutations.begin.mutateAsync.mockResolvedValue({ decisionRunId: 77, revisionId: 88 });
  fixture.mutations.saveDraft.mutateAsync.mockImplementation(async ({ values }) => ({ id: 1, version: 5, updatedAt: now, completedAt: null, values }));
  fixture.mutations.completeDraft.mutateAsync.mockImplementation(async () => ({ ...fixture.queries.draft.data, completedAt: now }));
});
afterEach(() => { fixture.cleanups.forEach(cleanup => cleanup?.()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("persisted Mission disposition context", () => {
  it("reopens an accepted no-thesis objective without adopting the active thesis or starting a new action", async () => {
    const values = { ...emptyMissionDraftValues(), accountId: 3, canonicalThesisId: null,
      capital: "1200", maxLoss: "100", mission: "Illustrative: compare uses of my extra capital next month.",
      strategyContext: { schemaVersion: 1, requestId: "00000000-0000-4000-8000-000000000011", intent: "deploy_excess_capital",
        searchScope: "broader_permitted_universe", requestedSymbols: [], declarationId: "00000000-0000-4000-8000-000000000012", sourceOrder: null, profitReserve: "" } };
    fixture.queries.draft.data = { id: 1, version: 5, updatedAt: now, completedAt: now,
      values: { ...values, baseDecisionRunId: 77, baseDecisionRevisionId: 88 } };
    fixture.queries.latest.data.latest = { authority: "authoritative", contextKind: "objective", decisionRunId: 77, decisionRevisionId: 88,
      canonicalThesisId: null, capitalThesisId: null, accountId: 3, branch: "research", version: 1, createdAt: now,
      missionText: values.mission, deployableCapitalCents: 120000, maxPlannedLossCents: 10000,
      holdingPeriod: values.holdingPeriod, holdingPeriods: values.holdingPeriods,
      objectiveContext: { requestId: values.strategyContext.requestId, sourceDraftId: 1, sourceDraftVersion: 4, values } };
    const before = structuredClone(fixture.queries.latest.data);
    const view = render();
    expect(view.$("h1").text()).toBe("Capital objective saved");
    expect(view.$.text()).toContain("Mission accepted.");
    expect(view.$.text()).not.toContain("Illustrative PWR");
    expect(view.$.text()).not.toContain("Underwrite my mission");
    expect(view.$("button").text()).toBe("Return to Today");
    await vi.advanceTimersByTimeAsync(2000);
    expect(fixture.queries.latest.data).toEqual(before);
    for (const mutation of Object.values(fixture.mutations)) expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });
  it("preserves an objective-led draft without auto-assigning a thesis or exposing the unrelated Mission action", async () => {
    const values = fixture.queries.draft.data.values;
    values.canonicalThesisId = null;
    values.mission = "Illustrative: compare uses of my extra capital next month.";
    values.strategyContext = { schemaVersion: 1, requestId: "00000000-0000-4000-8000-000000000011", intent: "deploy_excess_capital", searchScope: "broader_permitted_universe", requestedSymbols: [], declarationId: "00000000-0000-4000-8000-000000000012", sourceOrder: null, profitReserve: "" };
    const before = structuredClone(fixture.queries.draft.data);
    const view = render();
    expect(view.$("h1").text()).toBe("Capital objective saved");
    expect(view.$.text()).toContain(values.mission);
    expect(view.$.text()).toContain("Illustrative Paper");
    expect(view.$.text()).not.toContain("Illustrative PWR");
    expect(view.$.text()).toContain("not available in this workspace yet");
    expect(view.$("button").text()).toBe("Return to Today");
    await vi.advanceTimersByTimeAsync(2000);
    expect(fixture.queries.draft.data).toEqual(before);
    for (const mutation of Object.values(fixture.mutations)) expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("retains the saved objective and exposes a cached-success to failed-refresh recovery without mutations", async () => {
    const values = fixture.queries.draft.data.values;
    values.canonicalThesisId = null;
    values.strategyContext = { schemaVersion: 1, requestId: "00000000-0000-4000-8000-000000000011", intent: "deploy_excess_capital", searchScope: "broader_permitted_universe", requestedSymbols: [], declarationId: null, sourceOrder: null, profitReserve: "" };
    const before = structuredClone(fixture.queries.draft.data);
    render();
    fixture.queries.draft.isError = true;
    fixture.queries.draft.error = new Error("Illustrative refresh failure");
    const view = render();
    expect(view.$("h1").text()).toBe("Capital objective saved");
    expect(view.$("[role=alert]").text()).toContain("Refresh failed");
    expect(view.$.text()).toContain(values.mission);
    await button(view.tree, "Retry loading saved context").props.onClick();
    expect(fixture.invalidate).toHaveBeenCalled();
    expect(fixture.queries.draft.data).toEqual(before);
    for (const mutation of Object.values(fixture.mutations)) expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("focuses the review heading only after the explicit section callback and preserves autosave values", async () => {
    setDraft("conditional", 2);
    const saved = structuredClone(fixture.queries.draft.data.values);
    let view = render();
    expect(fixture.lookupHeading).not.toHaveBeenCalled();
    button(view.tree, "Review mission").props.onClick();
    expect(fixture.headings["mission-section-review"].focus).not.toHaveBeenCalled();
    view = render();
    const heading = fixture.headings["mission-section-review"];
    expect(heading.focus).toHaveBeenCalledOnce();
    expect(heading.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(heading.scrollIntoView).toHaveBeenCalledOnce();
    expect(heading.scrollIntoView).toHaveBeenCalledWith({ behavior: "instant", block: "start" });
    expect(view.$("#mission-section-review").attr("tabindex")).toBe("-1");
    expect(view.$("#mission-section-review").attr("style")).toContain("scroll-margin-top:calc(var(--header-height, 4rem) + 1rem)");
    expect(view.$("#mission-section-review").parents("[hidden]")).toHaveLength(0);
    expect(view.$("#mission-disposition").text()).toContain("Conditional review · $187.50 effective risk");
    await vi.advanceTimersByTimeAsync(650);
    expect(fixture.mutations.saveDraft.mutateAsync).toHaveBeenCalledOnce();
    expect(fixture.mutations.saveDraft.mutateAsync).toHaveBeenCalledWith({ expectedVersion: 4, values: { ...saved, activeSection: 3 } });
    expect(fixture.queries.draft.data.values).toEqual(saved);
    expect(fixture.mutations.begin.mutateAsync).not.toHaveBeenCalled();
    expect(fixture.mutations.run.mutateAsync).not.toHaveBeenCalled();
  });

  it("does not scroll for hydration or provider refreshes, including after a section has been chosen", () => {
    setDraft("conditional", 2);
    let view = render();
    fixture.queries.accounts.data = [...fixture.queries.accounts.data]; view = render();
    expect(fixture.lookupHeading).not.toHaveBeenCalled();
    button(view.tree, "Review mission").props.onClick(); view = render();
    const heading = fixture.headings["mission-section-review"];
    expect(heading.focus).toHaveBeenCalledOnce();
    fixture.queries.preview.data = { ...fixture.queries.preview.data, asOf: now + 1000 }; render();
    fixture.queries.accounts.data = [...fixture.queries.accounts.data]; render();
    expect(heading.focus).toHaveBeenCalledOnce();
    expect(heading.scrollIntoView).toHaveBeenCalledOnce();
  });

  it("supports deliberate navigation to the same section and makes every section heading a focus destination", () => {
    let view = render();
    const currentSection = elements(view.tree).find(element => element.props["aria-current"] === "step")!;
    currentSection.props.onClick(); view = render();
    expect(fixture.headings["mission-section-review"].focus).toHaveBeenCalledOnce();
    elements(view.tree).find(element => element.props["aria-current"] === "step")!.props.onClick(); view = render();
    expect(fixture.headings["mission-section-review"].focus).toHaveBeenCalledTimes(2);
    for (const id of Object.keys(fixture.headings)) {
      expect(view.$(`#${id}`).attr("tabindex")).toBe("-1");
      expect(view.$(`#${id}`).attr("style")).toContain("scroll-margin-top:calc(var(--header-height, 4rem) + 1rem)");
    }
  });

  it("uses only the latest user section request and never focuses a hidden destination later", () => {
    setDraft("conditional", 2);
    let view = render();
    button(view.tree, "Review mission").props.onClick();
    const thesisTab = elements(view.tree).find(element => element.type === "button" && text(element.props.children).startsWith("1Thesis & horizon"))!;
    thesisTab.props.onClick(); view = render();
    expect(fixture.headings["mission-section-review"].focus).not.toHaveBeenCalled();
    expect(fixture.headings["mission-section-thesis"].focus).toHaveBeenCalledOnce();
    fixture.headings["mission-section-risk"].closest.mockReturnValue({ hidden: true });
    button(view.tree, "Review account & risk").props.onClick(); render();
    expect(fixture.headings["mission-section-risk"].focus).not.toHaveBeenCalled();
    fixture.headings["mission-section-risk"].closest.mockReturnValue(null);
    fixture.queries.accounts.data = [...fixture.queries.accounts.data]; render();
    expect(fixture.headings["mission-section-risk"].focus).not.toHaveBeenCalled();
  });

  it.each(["conditional", "cash"] as const)("does not present the saved target as an active %s objective", branch => {
    setDraft(branch, 2);
    const { $ } = render();
    const glance = visibleText($);
    expect(glance).not.toContain("24% per week required");
    expect(glance).not.toContain("extreme");
    expect(glance).not.toContain("Target feasibility · before underwriting");
    expect(glance).toContain("Effective risk for future research");
    expect(glance).toContain("$187.50");
    expect(glance).toContain("You entered $250");
    expect(glance).toContain("kept for research");
    expect(glance).not.toContain("Cash carries $0 risk");
    expect(fixture.mutations.begin.mutateAsync).not.toHaveBeenCalled();
  });

  it.each(["conditional", "cash"] as const)("aligns %s review summary and readiness with its actual action", branch => {
    setDraft(branch);
    const { $ } = render();
    const glance = visibleText($);
    expect(glance).not.toContain("Ready to underwrite");
    expect(glance).not.toContain("Confirm the mission before analysis");
    expect($("#mission-disposition").text()).not.toContain("$6,000 / week");
    expect(glance).toContain(branch === "conditional" ? "Ready to queue review" : "Ready to record no new trade");
    expect($("#mission-primary-action").text()).toBe(branch === "conditional" ? "Queue conditional review" : "Record no new trade");
    expect($("#mission-disposition").text()).toContain("$187.50");
    expect($("#mission-disposition").text()).toContain(branch === "conditional" ? "No proposal or broker order" : "Existing positions remain unchanged");
  });

  it("keeps the saved target through actual branch switches and restores research feasibility", () => {
    let view = render();
    for (const label of ["Preserve cash", "Hold for a condition", "Search for a play"]) {
      button(view.tree, label).props.onClick(); view = render();
    }
    expect(view.$('input[aria-label="Target profit"]').val()).toBe("6000");
    expect(view.$('select[aria-label="Target period"] option[selected]').val()).toBe("week");
    expect(view.$("#mission-disposition").text()).toContain("24% per week required · extreme");
    expect(view.$("#mission-disposition").text()).toContain("$187.50");
    expect(fixture.queries.draft.data.values.targetProfit).toBe("6000");
    Object.values(fixture.mutations).forEach(mutation => expect(mutation.mutateAsync).not.toHaveBeenCalled());
  });

  it.each(["preserve_cash", "dated_catalyst"])("does not erase the research target when applying %s", key => {
    fixture.queries.library.data = [{ key, label: "Illustrative suggested mission", missionText: "Illustrative condition requiring verified evidence.", objective: "verify_catalyst", readiness: "conditional", reasons: ["Evidence required"] }];
    setDraft("research");
    let view = render(); button(view.tree, "Apply mission parameters").props.onClick(); view = render();
    button(view.tree, "Search for a play").props.onClick(); view = render();
    expect(view.$('input[aria-label="Target profit"]').val()).toBe("6000");
    expect(view.$('select[aria-label="Target period"] option[selected]').val()).toBe("week");
    expect(fixture.mutations.run.mutateAsync).not.toHaveBeenCalled();
  });

  it.each(["conditional", "cash"] as const)("records only the %s receipt, preserving target and risk inputs", async branch => {
    setDraft(branch);
    let view = render();
    const submit = elements(view.tree).find(element => element.props.id === "mission-primary-action")!;
    expect(submit.props.disabled).toBe(false);
    await submit.props.onClick();
    const request = fixture.mutations.begin.mutateAsync.mock.calls[0][0];
    expect(request).toMatchObject({ branch, canonicalThesisId: 720001, capitalThesisId: 33, accountId: 3, targetProfitCents: 600_000, targetPeriod: "week", maxPlannedLossCents: 25_000, deployableCapitalCents: 2_500_000 });
    expect(request.reviewAt).toBe(Date.UTC(2026, 8, branch === "conditional" ? 10 : 11, branch === "conditional" ? 14 : 19));
    expect(request.namedGateLabel).toBe(branch === "conditional" ? "Catalyst review" : null);
    for (const name of ["run", "startResearch", "validate", "resolveCash", "create", "project"]) expect(fixture.mutations[name].mutateAsync).not.toHaveBeenCalled();
    expect(fixture.openResearch).not.toHaveBeenCalled();
    expect(fixture.success.mock.calls.flat().join(" ")).not.toContain("$0 risk");
    fixture.queries.latest.data.latest = { ...request, authority: "authoritative", decisionRunId: 77, decisionRevisionId: 88, version: 1, createdAt: now, binding: { canonicalThesisName: "Illustrative PWR", capitalThesisName: "Illustrative projection", accountLabel: "Illustrative Paper", mandateVersion: "v2", decisionVersion: 1 } };
    view = render();
    const glance = visibleText(view.$);
    expect(glance).toContain(branch === "conditional" ? "Conditional receipt" : "$0 new allocation. Existing positions are unchanged.");
    expect(glance).not.toContain("24% per week required");
    expect(glance).not.toContain("No paper exposure");
    expect(fixture.queries.preview.data.feasibility.riskBudgetCents).toBe(18_750);
  });
});

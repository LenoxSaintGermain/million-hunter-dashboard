import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({ getDb: vi.fn(), tape: vi.fn(), facts: vi.fn(), query: vi.fn(), optionChain: vi.fn(), preflight: vi.fn(), ready: vi.fn(), deployAsked: false, buttons: [] as any[], info: vi.fn(), navigate: vi.fn() }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => actual.useState(seam.deployAsked && initial === false ? true : initial) };
});
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("wouter", () => ({ useLocation: () => ["/aperture/deploy", seam.navigate] }));
vi.mock("sonner", () => ({ toast: { info: seam.info, error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/ui/button", async importOriginal => {
  const actual = await importOriginal<typeof import("../../client/src/components/ui/button")>();
  return { ...actual, Button: (props: React.ComponentProps<typeof actual.Button>) => {
    seam.buttons.push(props);
    return React.createElement(actual.Button, props);
  } };
});
vi.mock("../db", () => ({ getDb: seam.getDb }));
vi.mock("./providers/marketData", async (importOriginal) => ({ ...await importOriginal<typeof import("./providers/marketData")>(), fetchIntradayBars: seam.tape }));
vi.mock("./facts", async (importOriginal) => ({ ...await importOriginal<typeof import("./facts")>(), getFacts: seam.facts }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({}),
  aperture: {
    play: { construct: { useQuery: seam.query }, decide: { useMutation: () => ({}) }, ready: { useQuery: seam.ready } },
    account: { list: { useQuery: () => ({ data: [] }) }, sync: { useMutation: () => ({}) } },
    order: { create: { useMutation: () => ({}) }, optionChain: { useQuery: seam.optionChain }, preflight: { useQuery: seam.preflight } },
    quickHit: { catalog: { useQuery: () => ({ data: [], isLoading: false }) }, backtest: { useMutation: () => ({}) }, authorize: { useMutation: () => ({}) } },
  },
} }));
import { apertureRouter } from "../apertureRouter";
import { PlayRecipeCard } from "../../client/src/components/aperture/PlayRecipeCard";
import { PaperProposalForm } from "../../client/src/components/aperture/PaperProposalForm";
import ApertureDeploy from "../../client/src/pages/aperture/ApertureDeploy";

const OPEN = Date.parse("2026-09-14T13:30:00Z");
const NOW = OPEN + 34.5 * 60_000;
// Minimal replay of the reported identities/horizon, not a production DB snapshot.
// Prices/account/tape below are deterministic illustrative test values only.
function fixture(holdingPeriod: string | null = "position", playSide: string | null = null) {
  return {
    candidate: { id: 600003, runId: 750001, symbol: "VLO", playSide, verifyFields: ["Confirm economics"] },
    run: { id: 750001, userId: 7, accountId: 8, holdingPeriod, instrumentPreference: "shares", catalystDeadlineAt: OPEN + 90 * 86_400_000 },
  };
}
function database(row: ReturnType<typeof fixture> | null) {
  const results = [row ? [row] : [], [{ id: 8, isPaper: true, equityValueCents: 10_000_000 }], []];
  const select = vi.fn(() => {
    const result = results.shift() ?? [];
    const chain: any = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    for (const key of ["from", "innerJoin", "where", "limit"]) chain[key] = vi.fn(() => chain);
    return chain;
  });
  seam.getDb.mockResolvedValue({ select }); // No write methods exist at this seam.
  return select;
}
const caller = () => apertureRouter.createCaller({ user: { id: 7, role: "admin" } as any, req: {} as any, res: {} as any });
const construct = () => caller().play.construct({ runId: 750001, candidateId: 600003 });
function render(row: ReturnType<typeof fixture>, data: unknown) {
  seam.query.mockReturnValue({ data, isLoading: false, isError: false, refetch: vi.fn() });
  return load(renderToStaticMarkup(React.createElement(PlayRecipeCard, {
    ...row, reviewedChecks: ["Confirm economics"], alreadyHeld: false,
    onReviewEvidence: vi.fn(), onPrepareProposal: vi.fn(), onOpenResearch: vi.fn(),
  })));
}
function renderExecute(row: ReturnType<typeof fixture>) {
  return load(renderToStaticMarkup(React.createElement(PaperProposalForm, {
    ...row, runId: row.run.id, account: { id: 8 }, evidenceReviewComplete: true,
    onReturnToBrief: vi.fn(), onReturnToDecisionBrief: vi.fn(), onProposalCreated: vi.fn(), onCashPreserved: vi.fn(),
  })));
}
function buttonText(children: React.ReactNode): string {
  return load(renderToStaticMarkup(React.createElement(React.Fragment, null, children))).text();
}

beforeEach(() => {
  vi.clearAllMocks();
  seam.deployAsked = false;
  seam.buttons = [];
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No live network permitted"); }));
  seam.tape.mockResolvedValue({ feed: "sip", bars: Array.from({ length: 35 }, (_, i) => ({
    t: OPEN + i * 60_000, o: 100, h: 100.5, l: 99.5, c: 100, v: 5000, vw: 100,
  })) });
  seam.facts.mockResolvedValue([]);
  seam.optionChain.mockReturnValue({});
  seam.preflight.mockReturnValue({});
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("real recipe procedure and card horizon boundary", () => {
  it("returns research-only recovery for research750001 / VLO candidate600003 without a default long recipe", async () => {
    const row = fixture();
    const select = database(row);
    const result = await construct();
    expect(result.play).toBeNull();
    expect(result).toMatchObject({ recovery: { status: "research_only", holdingPeriod: "position", side: null } });
    expect(seam.tape).not.toHaveBeenCalled();
    expect(seam.facts).not.toHaveBeenCalled();
    expect(select).toHaveBeenCalledTimes(1);
    expect(row.run.holdingPeriod).toBe("position");
  });

  it("renders the procedure result as long-term research with no intraday recovery or ticket action", async () => {
    const row = fixture();
    database(row);
    const $ = render(row, await construct());
    expect($.text()).toContain("Research only");
    expect($.text()).toContain("Long term");
    expect($.text()).toContain("Direction not recorded");
    expect($.text()).not.toMatch(/opening.range|VWAP|Ready to review|assumes a long|tape required/i);
    expect($("button").map((_, button) => $(button).text()).get()).toEqual(["View research"]);
    expect(seam.query.mock.calls.at(-1)?.[1]).toMatchObject({ enabled: false });
  });

  it("still constructs and renders the existing intraday recipe for an explicitly short candidate", async () => {
    const row = fixture("intraday", "short");
    database(row);
    const result = await construct();
    expect(result.play).toMatchObject({ holdingPeriod: "intraday", side: "short", readiness: "constructed" });
    expect(seam.tape).toHaveBeenCalledTimes(1);
    const $ = render(row, result);
    expect($.text()).toContain("Ready to review");
    expect($("button").text()).toContain("Review practice order");
    expect(seam.query.mock.calls.at(-1)?.[1]).toMatchObject({ enabled: true });
  });

  it.each(["overnight", "swing", "catalyst_window", "position", "unknown", "", null])(
    "preserves %s without requesting tape, choosing a strategy, or suggesting a ticket", async holdingPeriod => {
      const row = fixture(holdingPeriod, "short");
      database(row);
      const result = await construct();
      expect(result).toMatchObject({ play: null, marketContext: { session: "unknown", referencePriceCents: null }, recovery: { holdingPeriod, side: "short", status: "research_only" } });
      expect(seam.tape).not.toHaveBeenCalled();
      expect(seam.facts).not.toHaveBeenCalled();
      const $ = render(row, result);
      expect($.text()).toContain("Recorded direction: short");
      expect($.text()).not.toMatch(/opening.range|VWAP|tape required|Resolve blocker|Ready to review/i);
      expect($("button").text()).toBe("View research");
    },
  );

  it("rejects a cached executable recipe when the original run is non-intraday, including option intent", async () => {
    database(fixture("intraday", "long"));
    const cached = await construct();
    expect(cached.play?.readiness).toBe("constructed");
    const row = fixture("position");
    row.run.instrumentPreference = "options";
    const $ = render(row, cached);
    expect($.text()).toContain("Long term");
    expect($.text()).toContain("Direction not recorded");
    expect($.text()).not.toMatch(/\$|opening.range|VWAP|long setup|Ready to review/i);
    expect($("button").text()).toBe("View research");
    expect(seam.query.mock.calls.at(-1)?.[1]).toMatchObject({ enabled: false });
  });

  it("honors persisted server recovery when the client's horizon is stale", async () => {
    database(fixture("position", "short"));
    const $ = render(fixture("intraday", "long"), await construct());
    expect($.text()).toContain("Long term");
    expect($.text()).toContain("Recorded direction: short");
    expect($("button").text()).toBe("View research");
    expect(seam.tape).not.toHaveBeenCalled();
  });

  it.each(["loading", "error", "empty"])("shows research-only recovery even while the query is %s", state => {
    seam.query.mockReturnValue({ data: undefined, isLoading: state === "loading", isError: state === "error", refetch: vi.fn() });
    const onOpenResearch = vi.fn(), onPrepareProposal = vi.fn(), onReviewEvidence = vi.fn();
    const tree = PlayRecipeCard({ ...fixture(), reviewedChecks: [], alreadyHeld: false, onOpenResearch, onPrepareProposal, onReviewEvidence });
    const $ = load(renderToStaticMarkup(tree));
    expect($.text()).toContain("Research only");
    expect($.text()).not.toMatch(/Checking available prices|Retry plan|tape required/);
    const action = React.Children.toArray(tree.props.children).find(child => React.isValidElement(child) && (child.props as any).children === "View research") as React.ReactElement<{ onClick: () => void }>;
    action.props.onClick();
    expect(onOpenResearch).toHaveBeenCalledTimes(1);
    expect(onPrepareProposal).not.toHaveBeenCalled();
    expect(onReviewEvidence).not.toHaveBeenCalled();
  });

  it("does not replace the existing missing-tape gate for intraday plays", async () => {
    const row = fixture("intraday", "long");
    database(row);
    seam.tape.mockResolvedValue({ feed: "unknown", bars: [], unavailableReason: "No minute bars available" });
    const result = await construct();
    expect(result.play).toMatchObject({ readiness: "needs_tape", entry: null, stop: null });
    expect(render(row, result)("button").text()).not.toContain("Review practice order");
  });

  it("keeps the existing non-intraday trigger procedure non-applicable without tape", async () => {
    database(fixture());
    expect(await caller().play.trigger({ runId: 750001, candidateId: 600003 })).toMatchObject({ applicable: false, state: "not_applicable", vwap: null, openingRange: null });
    expect(seam.tape).not.toHaveBeenCalled();
  });

  it("still enforces the owner-scoped lookup before returning recovery", async () => {
    database(null);
    await expect(construct()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(seam.tape).not.toHaveBeenCalled();
  });

  it("still requires operator access at the real procedure", async () => {
    const anonymous = apertureRouter.createCaller({ user: null, req: {} as any, res: {} as any });
    await expect(anonymous.play.construct({ runId: 750001, candidateId: 600003 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(seam.getDb).not.toHaveBeenCalled();
  });

  it.each(["shares", "options"])("direct Execute %s renders research recovery instead of a market-refresh loop or ticket", async instrumentPreference => {
    const row = fixture();
    row.run.instrumentPreference = instrumentPreference;
    database(row);
    seam.query.mockReturnValue({ data: await construct(), isLoading: false, isError: false });
    const $ = load(renderToStaticMarkup(React.createElement(PaperProposalForm, {
      ...row, runId: row.run.id, account: { id: 8 }, evidenceReviewComplete: true,
      onReturnToBrief: vi.fn(), onReturnToDecisionBrief: vi.fn(), onProposalCreated: vi.fn(), onCashPreserved: vi.fn(),
    })));
    expect($.text()).toContain("Research only");
    expect($.text()).toContain("Long term");
    expect($.text()).not.toMatch(/Refresh market checks|Choose from the live chain|Create paper proposal|holds above|Horizon not recorded/i);
    expect($("input, select, textarea").length).toBe(0);
    expect($("button").text()).toMatch(/research|evidence/i);
    expect(seam.optionChain.mock.calls.every(call => call[1].enabled === false)).toBe(true);
    expect(seam.preflight.mock.calls.every(call => call[1].enabled === false)).toBe(true);
    expect(seam.tape).not.toHaveBeenCalled();
  });

  it("Deploy explains a selected non-intraday research candidate instead of leaving a blank recipe", async () => {
    const row = fixture();
    database(row);
    seam.deployAsked = true; // Render the page's post-selection state.
    seam.ready.mockReturnValue({ data: { best: { ...row.candidate, candidateId: row.candidate.id, runId: row.run.id, holdingPeriod: "position" }, alternatives: [] } });
    seam.query.mockReturnValue({ data: await construct(), isLoading: false, isFetching: false, isError: false });
    const $ = load(renderToStaticMarkup(React.createElement(ApertureDeploy)));
    expect($.text()).toContain("Research only");
    expect($.text()).toContain("Long term");
    expect($.text()).not.toMatch(/Recommended deployment|holds above|Reading the recorded play/);
    expect($("button").map((_, button) => $(button).text()).get()).toContain("View research");
    expect($("button").map((_, button) => $(button).text()).get()).not.toContain("Review play");
    expect(seam.query.mock.calls.at(-1)?.[1]).toMatchObject({ enabled: false });
    seam.buttons.find(button => buttonText(button.children) === "View research").onClick();
    expect(seam.navigate).toHaveBeenCalledWith("/aperture/run/750001?candidate=600003&view=evidence");
  });

  it.each(["shares", "options"])("direct Execute retains the existing intraday %s ticket UI", async instrumentPreference => {
    const row = fixture("intraday", "short");
    row.run.instrumentPreference = instrumentPreference;
    database(row);
    // Options still permit exact, quoted manual contract entry when the source
    // horizon is supported; they need not inherit a share-sizing recipe.
    if (instrumentPreference === "options") seam.tape.mockResolvedValue({ feed: "unknown", bars: [] });
    seam.query.mockReturnValue({ data: await construct(), isLoading: false, isError: false });
    const $ = renderExecute(row);
    expect($.text()).not.toContain("Research only");
    expect($.text()).toContain("Practice order");
    expect($("input").length).toBeGreaterThan(0);
    if (instrumentPreference === "options") {
      expect($.text()).toContain("Long put");
      expect($.text()).toContain("Choose from the live chain");
    }
  });

  it.each(["cached", "loading", "error", "empty"])("direct Execute rejects unsupported horizons with %s query state", async state => {
    database(fixture("intraday", "long"));
    const cached = await construct();
    seam.query.mockReturnValue({ data: state === "cached" ? cached : undefined, isLoading: state === "loading", isError: state === "error" });
    const $ = renderExecute(fixture());
    expect($.text()).toContain("Research only");
    expect($.text()).toContain("Long term");
    expect($.text()).not.toMatch(/Refresh market checks|holds above|Horizon not recorded|Long call/);
    expect($("input, select, textarea").length).toBe(0);
    expect(seam.query.mock.calls.at(-1)?.[1]).toMatchObject({ enabled: false });
  });

  it("direct Execute honors server recovery even when the client's run horizon is stale", async () => {
    database(fixture("position", "short"));
    seam.query.mockReturnValue({ data: await construct(), isLoading: false, isError: false });
    const $ = renderExecute(fixture("intraday", "long"));
    expect($.text()).toContain("Long term");
    expect($.text()).toContain("Recorded direction: short");
    expect($("input, select, textarea").length).toBe(0);
  });

  it("the real refresh handler accepts a null recipe and explains recovery without throwing", async () => {
    database(fixture());
    const recoveryResult = await construct();
    const refetch = vi.fn().mockResolvedValue({ data: recoveryResult, isError: false });
    seam.query.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch });
    renderExecute(fixture("intraday"));
    const refresh = seam.buttons.find(button => buttonText(button.children) === "Refresh market checks");
    refresh.onClick();
    await Promise.resolve();
    await Promise.resolve();
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(seam.info).toHaveBeenCalledWith(expect.stringContaining("original horizon has not been changed"));
    seam.query.mockReturnValue({ data: recoveryResult, isLoading: false, isError: false, refetch });
    expect(renderExecute(fixture("intraday")).text()).toContain("Research only");
  });
});

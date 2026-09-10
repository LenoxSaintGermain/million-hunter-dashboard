import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyMissionDraftValues } from "../../shared/apertureMissionDraft";
import {
  ObjectiveMissionWorkspace, type MissionDraftValues, type ObjectiveMissionWorkspaceProps,
  type ObjectiveMissionRiskPreview,
} from "../../client/src/components/aperture/ObjectiveMissionWorkspace";

// Same deterministic hook + real child-render approach as
// missionDispositionContext.test.ts. No DOM emulator is installed in this repo.
// These journeys exercise controlled callbacks, not browser focus or full E2E.
const hooks = vi.hoisted(() => ({ active: false, cursor: 0, slots: [] as unknown[] }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof React>();
  return { ...actual,
    useId: () => hooks.active ? "objective-test" : actual.useId(),
    useState: (initial: unknown) => {
      if (!hooks.active) return actual.useState(initial);
      const index = hooks.cursor++;
      if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === "function" ? initial() : initial;
      return [hooks.slots[index], (next: unknown) => {
        hooks.slots[index] = typeof next === "function" ? next(hooks.slots[index]) : next;
      }];
    },
  };
});

const requestId = "00000000-0000-4000-8000-000000000011";
const declarationId = "00000000-0000-4000-8000-000000000012";
const sourceOrder = { accountId: 31, runId: 42, candidateId: 53, orderId: 64 };
const accounts = [{ id: 31, label: "Illustrative Paper", lastSyncedAt: Date.UTC(2026, 8, 10, 14) }, { id: 32, label: "Second illustrative Paper" }];
const canonicalTheses = [{ id: 7001, name: "Illustrative saved thesis" }];
function initialValues(): MissionDraftValues {
  return { ...emptyMissionDraftValues(), strategyContext: {
    schemaVersion: 1, requestId, declarationId, intent: "explore_opportunity",
    searchScope: "broader_permitted_universe", sourceOrder: null, requestedSymbols: [], profitReserve: "",
  } };
}
function completeValues(): MissionDraftValues {
  return { ...initialValues(), mission: "Illustrative: research uses for declared capital next month.",
    accountId: 31, capital: "10,000", maxLoss: "500", holdingPeriod: "swing", holdingPeriods: ["swing"], activeSection: 3 };
}
// Deliberately literal server response, not a client-derived risk fixture.
const serverPreview: ObjectiveMissionRiskPreview = {
  accountId: 31, asOf: Date.UTC(2026, 8, 10, 14), status: "ready",
  constraintExplanation: "The server reports that the account ceiling binds at $12.34, below your declared $500 loss limit.",
  measuredLimits: [{ label: "Account ceiling", valueCents: 1234, context: "Recorded server account mandate." }, { label: "Portfolio headroom", valueCents: null, context: "Not measured." }],
  feasibility: {
    capitalBaseCents: 1_000_000, targetProfitCents: 800_000, targetPeriod: "month", requiredReturnPct: 80,
    classification: "extreme", targetPressure: 7, riskBudgetCents: 1234, normalPlayRiskCents: 7500,
    highConvictionRiskCents: 12500, maxOpenRiskCents: 30_000, lossLimitCents: 40_000,
    assessment: "Illustrative server assessment: this target requires an extreme return.", mayInfluenceSizing: false,
  },
};

type ElementProps = {
  children?: React.ReactNode; id?: string; value?: unknown; disabled?: boolean;
  onClick?: () => void; onChange?: (event: { target: { value: string } }) => void;
};
function elements(node: React.ReactNode): React.ReactElement<ElementProps>[] {
  return React.Children.toArray(node).flatMap(child => React.isValidElement<ElementProps>(child)
    ? [child, ...elements(child.props.children)] : []);
}
function text(node: React.ReactNode): string {
  return React.Children.toArray(node).map(child => React.isValidElement<ElementProps>(child) ? text(child.props.children) : String(child)).join("");
}
function harness(values = initialValues(), overrides: Partial<ObjectiveMissionWorkspaceProps> = {}) {
  const onUnderwrite = vi.fn(), onSave = vi.fn(), onInspectRisk = vi.fn();
  const onChange = vi.fn((next: MissionDraftValues) => { props.values = next; props.saveState = "unsaved"; });
  const props: ObjectiveMissionWorkspaceProps = { values, accounts, canonicalTheses, saveState: "unsaved", busy: false,
    onChange, onUnderwrite, onSave, onInspectRisk, ...overrides };
  function render() {
    hooks.active = true; hooks.cursor = 0;
    let tree: React.ReactNode;
    try { tree = ObjectiveMissionWorkspace(props); } finally { hooks.active = false; }
    const html = renderToStaticMarkup(tree);
    const $ = load(html), visible = load(html);
    visible("[hidden]").remove();
    return { tree, $, visible, text: visible.text() };
  }
  function button(label: string) {
    const result = elements(render().tree).find(element => element.props.onClick && text(element.props.children) === label);
    if (!result) throw new Error(`Button not found: ${label}`);
    return result;
  }
  function click(label: string) {
    const found = button(label);
    expect(found.props.disabled, `Button disabled: ${label}`).not.toBe(true);
    found.props.onClick!();
    return render();
  }
  function set(field: string, value: string) {
    const id = `objective-test-${field}`;
    const element = elements(render().tree).find(candidate => candidate.props.id === id && candidate.props.onChange);
    if (!element) throw new Error(`Editable field not found: ${field}`);
    expect(element.props.disabled).not.toBe(true);
    element.props.onChange!({ target: { value } });
    return render();
  }
  return { props, onChange, onUnderwrite, onSave, onInspectRisk, render, button, click, set };
}

beforeEach(() => {
  hooks.active = false; hooks.cursor = 0; hooks.slots = [];
  vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in controlled setup tests"); }));
  vi.stubGlobal("localStorage", { getItem: vi.fn(() => { throw new Error("Storage forbidden"); }), setItem: vi.fn(() => { throw new Error("Storage forbidden"); }) });
});
afterEach(() => vi.unstubAllGlobals());

describe("ObjectiveMissionWorkspace controlled new-draft journeys", () => {
  it("progresses a no-thesis, no-symbol broad mission and underwrites only after explicit save confirmation and click", () => {
    const view = harness();
    view.set("mission", "Illustrative: compare uses of my declared capital next month.");
    view.set("intent", "deploy_excess_capital");
    view.set("holdingPeriod", "swing");
    view.click("Continue to account & risk");
    expect(view.props.values.activeSection).toBe(2);
    view.set("accountId", "31"); view.set("capital", "10,000"); view.set("maxLoss", "500");
    const review = view.click("Review mission");
    expect(view.props.values.activeSection).toBe(3);
    expect(view.props.values.canonicalThesisId).toBeNull();
    expect(view.props.values.strategyContext?.requestedSymbols).toEqual([]);
    expect(review.visible("#objective-test-section-1")).toHaveLength(0);
    expect(review.text).toContain("Illustrative Paper");
    expect(review.text).toContain("Paper · Declared capital $10,000");
    expect(view.button("Underwrite my mission").props.disabled).toBe(true);
    view.click("Save draft");
    expect(view.onSave).toHaveBeenCalledOnce();
    expect(view.render().text).toContain("Unsaved changes");
    expect(view.onUnderwrite).not.toHaveBeenCalled();
    view.props.saveState = "saved";
    expect(view.render().text).toContain("Builds research. No order is created or submitted.");
    expect(view.render().text).toContain("Saved");
    view.click("Underwrite my mission");
    expect(view.onUnderwrite).toHaveBeenCalledOnce();
    expect(view.props.values.strategyContext).toMatchObject({ requestId, declarationId });
  });

  it("returns missing values to their section with adjacent labelled errors", () => {
    const view = harness();
    let result = view.click("Review");
    expect(view.props.values.activeSection).toBe(1);
    expect(result.visible("#objective-test-mission").attr("aria-invalid")).toBe("true");
    expect(result.visible("#objective-test-mission").parent().text()).toContain("at least 20 characters");
    expect(result.visible("#objective-test-mission").attr("aria-describedby")).toBe("objective-test-mission-error");
    view.set("mission", "Illustrative question for a broad capital search.");
    result = view.click("Review");
    expect(view.props.values.activeSection).toBe(2);
    for (const field of ["accountId", "capital", "maxLoss"]) {
      expect(result.visible(`#objective-test-${field}`).attr("aria-invalid")).toBe("true");
      expect(result.visible(`#objective-test-${field}-error`)).toHaveLength(1);
    }
    expect(view.onUnderwrite).not.toHaveBeenCalled();
  });

  it.each(["current_thesis", "related_opportunities"] as const)("requires deliberate canonical selection for %s without changing identity", scope => {
    const view = harness(completeValues());
    view.click("Edit question & scope"); view.set("scope", scope);
    let result = view.click("Continue to account & risk");
    expect(view.props.values.activeSection).toBe(1);
    expect(result.visible("#objective-test-canonicalThesisId-error").text()).toContain("Choose a saved thesis");
    view.set("canonicalThesisId", "7001");
    result = view.click("Continue to account & risk");
    expect(view.props.values.activeSection).toBe(1);
    expect(result.visible("#objective-test-requestedSymbols-error").text()).toContain("Name the exact securities");
    expect(result.visible("#objective-test-requestedSymbols").closest("details").attr("open")).toBeDefined();
    view.set("requestedSymbols", "AAPL,BRK.B");
    result = view.click("Continue to account & risk");
    expect(view.props.values.activeSection).toBe(2);
    expect(view.props.values.strategyContext).toMatchObject({ requestId, declarationId });
  });

  it("never overwrites an existing canonical selection on intent or scope changes", () => {
    const values = { ...completeValues(), canonicalThesisId: 7001 };
    const original = structuredClone(values);
    const view = harness(values);
    view.click("Edit question & scope");
    for (const scope of ["current_thesis", "broader_permitted_universe", "related_opportunities"]) view.set("scope", scope);
    for (const intent of ["deploy_excess_capital", "review_material_change", "explore_opportunity"]) view.set("intent", intent);
    expect(view.props.values.canonicalThesisId).toBe(7001);
    expect(values).toEqual(original);
    view.set("scope", "broader_permitted_universe"); view.set("canonicalThesisId", "");
    expect(view.props.values.canonicalThesisId).toBeNull();
    expect(view.props.values.strategyContext).toMatchObject({ requestId, declarationId });
  });

  it("retains a now-unavailable canonical choice until the operator deliberately clears it", () => {
    const view = harness({ ...completeValues(), canonicalThesisId: 9999 });
    expect(view.render().text).toContain("Selected thesis unavailable");
    view.click("Edit question & scope");
    const result = view.click("Continue to account & risk");
    expect(result.visible("#objective-test-canonicalThesisId-error").text()).toContain("deliberately clear");
    expect(view.props.values.canonicalThesisId).toBe(9999);
    view.set("canonicalThesisId", ""); view.click("Continue to account & risk");
    expect(view.props.values.activeSection).toBe(2);
  });

  it("preserves secondary symbols, reveals invalid optional symbols near their field, and allows clearing them", () => {
    const view = harness(completeValues());
    view.click("Edit question & scope");
    view.set("requestedSymbols", "AAPL,");
    let result = view.click("Continue to account & risk");
    expect(view.props.values.activeSection).toBe(1);
    expect(result.visible("#objective-test-requestedSymbols-error").closest("details").attr("open")).toBeDefined();
    view.set("requestedSymbols", "AAPL,MSFT");
    view.click("Continue to account & risk"); view.click("Edit question & scope");
    expect(view.props.values.strategyContext?.requestedSymbols).toEqual(["AAPL", "MSFT"]);
    result = view.set("requestedSymbols", "");
    expect(result.visible("#objective-test-requestedSymbols-error")).toHaveLength(0);
    view.click("Continue to account & risk");
    expect(view.props.values.strategyContext?.requestedSymbols).toEqual([]);
  });

  it("round-trips every typed symbol string without trimming, uppercasing, deduplicating or rewriting separators", () => {
    const view = harness(completeValues());
    view.click("Edit question & scope");
    const typing = ["a", "aa", "aapl", "aapl,", "aapl, ", "aapl, m", "aapl, msft ", "aapl, msft ,aapl", "aapl, brk.b", "", ","];
    for (const raw of typing) {
      let result = view.set("requestedSymbols", raw);
      expect(result.visible("#objective-test-requestedSymbols").val()).toBe(raw);
      expect(view.onChange.mock.lastCall?.[0].strategyContext?.requestedSymbols.join(",")).toBe(raw);
      view.props.accounts = [...accounts]; result = view.render();
      expect(result.visible("#objective-test-requestedSymbols").val()).toBe(raw);
    }
    expect(view.onUnderwrite).not.toHaveBeenCalled();
  });

  it("does not force tickers when deliberately returning from thesis scope to broad no-thesis research", () => {
    const view = harness(completeValues());
    view.click("Edit question & scope"); view.set("scope", "current_thesis");
    view.click("Continue to account & risk");
    view.set("scope", "broader_permitted_universe");
    const result = view.click("Continue to account & risk");
    expect(view.props.values.activeSection).toBe(2);
    expect(view.props.values.canonicalThesisId).toBeNull();
    expect(view.props.values.strategyContext?.requestedSymbols).toEqual([]);
    expect(result.visible("[role=alert]").text()).not.toContain("Name the exact securities");
  });

  it("distinguishes the 8,000-character research limit from a longer saveable draft without truncation", () => {
    const values = { ...completeValues(), mission: "Illustrative: ".padEnd(8_000, "x") };
    const view = harness(values, { saveState: "saved" });
    expect(view.button("Underwrite my mission").props.disabled).toBe(false);
    view.click("Edit question & scope");
    const raw = `${values.mission}x`;
    view.set("mission", raw);
    const result = view.click("Continue to account & risk");
    expect(view.props.values.activeSection).toBe(1);
    expect(result.visible("#objective-test-mission-error").text()).toContain("8,000 characters including thesis context");
    expect(result.text).toContain("Saving a draft does not validate that combined limit");
    expect(view.props.values.mission).toBe(raw);
    view.click("Save draft"); expect(view.onSave).toHaveBeenCalledOnce();
    view.props.saveState = "saved";
    expect(view.button("Underwrite my mission").props.disabled).toBe(true);
    expect(view.onUnderwrite).not.toHaveBeenCalled();
  });

  it("retains the parent's combined thesis-context limit failure without inventing anchor size", () => {
    const values = { ...completeValues(), canonicalThesisId: 7001 };
    values.strategyContext = { ...values.strategyContext!, searchScope: "current_thesis", requestedSymbols: ["AAPL"] };
    const blockedReason = "The combined Mission and thesis context exceeds the 8,000-character research limit. Shorten the reviewed context first.";
    const view = harness(values, { saveState: "saved", blockedReason });
    expect(view.render().text).toContain(blockedReason);
    expect(view.button("Underwrite my mission").props.disabled).toBe(true);
    expect(view.props.values).toEqual(values);
    expect(view.onUnderwrite).not.toHaveBeenCalled();
  });

  it("preserves saved inputs across section changes and preserves unfinished raw amounts without forced zeros", () => {
    const values = { ...completeValues(), targetProfit: "8000.25", targetPeriod: "month" as const, instrument: "either" as const };
    const view = harness(values, { saveState: "saved" });
    view.click("Edit question & scope"); view.click("Continue to account & risk"); view.click("Review mission");
    expect(view.props.values).toEqual(values);
    view.click("Edit account & risk");
    view.set("capital", "10,000."); view.set("maxLoss", "");
    view.click("Save draft");
    expect(view.onSave).toHaveBeenCalledOnce();
    view.click("Edit question & scope"); view.click("Continue to account & risk");
    const result = view.render();
    expect(result.visible("#objective-test-capital").val()).toBe("10,000.");
    expect(result.visible("#objective-test-maxLoss").val()).toBe("");
    expect(view.props.values.targetProfit).toBe("8000.25");
  });

  it("keeps validation warnings visible in compact sections rather than hiding them", () => {
    const view = harness({ ...completeValues(), maxLoss: "" });
    view.click("Review missing values");
    const result = view.click("Edit question & scope");
    expect(result.visible("#objective-test-section-2")).toHaveLength(0);
    expect(result.visible("[role=alert]").text()).toContain("positive planned-loss limit");
    expect(view.props.values.maxLoss).toBe("");
  });

  it("does not permit a loss above declared capital, or a zero optional target", () => {
    const view = harness(completeValues());
    view.click("Edit account & risk"); view.set("maxLoss", "10001");
    expect(view.click("Review mission").visible("#objective-test-maxLoss-error").text()).toContain("within your declared capital");
    view.set("maxLoss", "500"); view.click("Edit question & scope"); view.set("targetProfit", "0");
    expect(view.click("Review").visible("#objective-test-targetProfit-error").text()).toContain("positive dollar target");
    view.set("targetProfit", ""); view.click("Review");
    expect(view.props.values.activeSection).toBe(3);
  });

  it("displays exact low server risk and extreme feasibility without deriving a new limit", () => {
    const view = harness({ ...completeValues(), targetProfit: "8000", targetPeriod: "month" }, { saveState: "saved", riskPreview: structuredClone(serverPreview) });
    const original = structuredClone(view.props.riskPreview);
    const result = view.render();
    expect(result.text).toContain("Effective constraint $12.34");
    expect(result.text).toContain(serverPreview.constraintExplanation);
    expect(result.text).toContain("Target feasibility: extreme");
    expect(result.text).toContain("80% required / month");
    expect(result.text).toContain(serverPreview.feasibility.assessment);
    expect(result.text).toContain("target never increases allowed risk");
    expect(result.text).not.toContain("$75.00");
    expect(result.visible('details').filter((_, node) => result.visible(node).text().includes("Measured limit context")).text()).toContain("Portfolio headroom: Not measured");
    view.click("Inspect effective constraint");
    expect(view.onInspectRisk).toHaveBeenCalledOnce();
    expect(view.onChange).not.toHaveBeenCalled();
    expect(view.onUnderwrite).not.toHaveBeenCalled();
    expect(view.props.riskPreview).toEqual(original);
  });

  it("does not substitute declaration or account data for an absent or wrong-account risk preview", () => {
    const view = harness(completeValues(), { riskPreview: { ...serverPreview, accountId: 32 } });
    expect(view.render().text).toContain("Effective constraint Not measured");
    expect(view.render().text).not.toContain("$12.34");
    expect(view.render().text).toContain("No permitted risk is inferred");
    view.props.riskPreview = null;
    expect(view.render().text).toContain("Effective constraint Not measured");
  });

  it.each(["failed", "loading", "stale", undefined] as const)("keeps %s preview warnings visible, labels recorded risk, and withholds readiness", status => {
    const view = harness(completeValues(), { saveState: "saved", riskPreview: { ...serverPreview, status } });
    const result = view.render();
    result.visible("details").remove();
    expect(result.visible("[role=alert]").text()).toContain("current eligibility is not confirmed");
    expect(result.visible.text()).toContain("$12.34");
    expect(result.text).toContain("Recorded effective constraint");
    expect(result.text).toContain("Recorded target feasibility");
    expect(result.text).not.toContain("Ready for your explicit request");
    expect(view.button("Underwrite my mission").props.disabled).toBe(true);
    view.button("Underwrite my mission").props.onClick!();
    expect(view.onUnderwrite).not.toHaveBeenCalled();
    view.click("Edit question & scope");
    expect(view.render().visible("[role=alert]").text()).toContain("current eligibility is not confirmed");
  });

  it("requires a timestamp even when the parent labels a preview ready", () => {
    const view = harness(completeValues(), { saveState: "saved", riskPreview: { ...serverPreview, asOf: null } });
    expect(view.render().text).toContain("freshness is unconfirmed");
    expect(view.render().text).toContain("Recorded effective constraint");
    expect(view.button("Underwrite my mission").props.disabled).toBe(true);
  });

  it("moves a ready preview to recorded-only on refresh failure without clearing declarations or dispatching", () => {
    const view = harness(completeValues(), { saveState: "saved", riskPreview: serverPreview });
    expect(view.button("Underwrite my mission").props.disabled).toBe(false);
    const original = structuredClone(view.props.values);
    view.props.riskPreview = { ...serverPreview, status: "stale" };
    expect(view.render().text).toContain("Constraint is stale");
    expect(view.button("Underwrite my mission").props.disabled).toBe(true);
    view.props.riskPreview = { ...serverPreview, status: "failed" };
    expect(view.render().text).toContain("Constraint refresh failed");
    expect(view.props.values).toEqual(original);
    expect(view.onUnderwrite).not.toHaveBeenCalled();
  });

  it("never claims Saved on a failed save and retries only explicitly", () => {
    const view = harness(completeValues());
    view.click("Save draft");
    view.props.saveState = "failed"; view.props.failure = "Illustrative save conflict: keep your edits.";
    const result = view.render();
    expect(result.visible("[role=alert]").text()).toContain("Illustrative save conflict");
    expect(result.text).not.toContain("Saved");
    expect(result.text).toContain(view.props.values.mission);
    expect(view.button("Underwrite my mission").props.disabled).toBe(true);
    view.render(); expect(view.onSave).toHaveBeenCalledTimes(1);
    view.click("Retry save"); expect(view.onSave).toHaveBeenCalledTimes(2);
    expect(view.onUnderwrite).not.toHaveBeenCalled();
  });

  it("treats a new action failure as a failure even if the parent retains its previous saved state", () => {
    const view = harness(completeValues(), { saveState: "saved", failure: "Illustrative underwriting failure." });
    expect(view.render().text).not.toContain("Saved");
    expect(view.button("Underwrite my mission").props.disabled).toBe(true);
    expect(view.render().visible("[role=alert]").text()).toContain("Illustrative underwriting failure");
  });

  it("does not initialize, save, inspect, or underwrite on mount or repeated parent renders", () => {
    const view = harness(completeValues(), { saveState: "saved" });
    for (let i = 0; i < 5; i++) {
      view.props.accounts = [...accounts]; view.props.riskPreview = { ...serverPreview, asOf: serverPreview.asOf! + i };
      view.render();
    }
    expect(view.onChange).not.toHaveBeenCalled(); expect(view.onSave).not.toHaveBeenCalled();
    expect(view.onUnderwrite).not.toHaveBeenCalled(); expect(view.onInspectRisk).not.toHaveBeenCalled();
    expect(view.props.values.strategyContext).toMatchObject({ requestId, declarationId });
    view.click("Underwrite my mission"); expect(view.onUnderwrite).toHaveBeenCalledOnce();
  });

  it("shows actual busy/loading and external blocks and guards the callback even if invoked directly", () => {
    const view = harness(completeValues(), { saveState: "saved", busy: true });
    expect(view.render().text).toContain("Underwriting is in progress");
    view.button("Underwriting…").props.onClick!();
    view.props.busy = false; view.props.loading = true;
    expect(view.render().text).toContain("Loading the draft and account choices");
    view.props.loading = false; view.props.blockedReason = "Illustrative account review is required.";
    expect(view.render().text).toContain(view.props.blockedReason);
    view.button("Underwrite my mission").props.onClick!();
    expect(view.onUnderwrite).not.toHaveBeenCalled();
  });

  it("requires a known source for redeployment, never invents one, and retains the exact reference through edits", () => {
    const view = harness(completeValues());
    view.click("Edit question & scope");
    expect(view.render().$("option[value=redeploy_realized_gains]").attr("disabled")).toBeDefined();
    view.set("intent", "redeploy_realized_gains");
    expect(view.props.values.strategyContext?.intent).toBe("explore_opportunity");
    view.props.values = { ...view.props.values, strategyContext: { ...view.props.values.strategyContext!, sourceOrder } };
    view.set("intent", "redeploy_realized_gains"); view.click("Continue to account & risk");
    let result = view.render();
    expect(result.text).toContain("Hypothetical until verified");
    expect(result.text).toContain("account #31 / run #42 / candidate #53 / order #64");
    view.set("accountId", "32"); result = view.click("Review mission");
    expect(view.props.values.activeSection).toBe(2);
    expect(result.visible("#objective-test-accountId-error").text()).toContain("different Paper account");
    expect(view.props.values.strategyContext?.sourceOrder).toEqual(sourceOrder);
    expect(view.props.values.capital).toBe("10,000");
  });

  it("does not generate absent parent identities or reuse an accepted receipt as a new draft", () => {
    const view = harness(completeValues(), { saveState: "saved" });
    view.props.values.strategyContext = null;
    expect(view.render().text).toContain("Start a new objective draft");
    expect(view.onChange).not.toHaveBeenCalled();
    view.props.values = { ...completeValues(), baseDecisionRunId: 71, baseDecisionRevisionId: 72 };
    expect(view.render().text).toContain("already accepted");
    expect(view.button("Underwrite my mission").props.disabled).toBe(true);
    expect(view.button("Save draft").props.disabled).toBe(true);
  });

  it("does not mint a missing capital declaration on an explicit intent change", () => {
    const values = completeValues(); values.strategyContext!.declarationId = null;
    const view = harness(values);
    view.click("Edit question & scope"); view.set("intent", "deploy_excess_capital");
    expect(view.props.values.strategyContext).toMatchObject({ requestId, declarationId: null });
    expect(view.render().text).toContain("parent workspace must initialize the capital declaration");
    view.click("Review"); view.props.saveState = "saved";
    expect(view.button("Underwrite my mission").props.disabled).toBe(true);
  });

  it.each(["", "-1", "12.345", "1e4", "1,00", "9007199254740992"])("keeps invalid amount %j intact and explains it at the field", amount => {
    const view = harness(completeValues());
    view.click("Edit account & risk"); view.set("capital", amount);
    const result = view.click("Review mission");
    expect(view.props.values.capital).toBe(amount);
    expect(result.visible("#objective-test-capital-error").text()).toContain("positive declared capital");
  });

  it("uses existing tokens, labels, 44px controls and no runtime side-effect surface", () => {
    const view = harness(completeValues());
    const { $ } = view.render();
    $("input,select").each((_, node) => {
      const field = $(node), id = field.attr("id");
      expect($(`label[for="${id}"]`)).toHaveLength(1);
      expect(field.attr("class")).toContain("min-h-11");
      expect(field.attr("type")).not.toBe("number");
    });
    $("button").each((_, node) => {
      expect($(node).attr("type")).toBe("button");
      expect($(node).attr("class")).toContain("min-h-11");
    });
    const source = readFileSync(new URL("../../client/src/components/aperture/ObjectiveMissionWorkspace.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/trpc|localStorage|randomUUID|scrollIntoView|window\.scroll|calculateTargetFeasibility|resolveEffectiveRiskLimit|mutateAsync/);
    expect(source).not.toMatch(/#[\da-f]{6}\b/i);
    expect(source).toContain("var(--sh-surface)");
    expect(source).toContain('from "@/components/ui/input"');
    expect(source).toContain('from "./ContextHelp"');
    expect(source).toContain('from "./DecisionVisualLanguage"');
    expect(source).not.toMatch(/32[_,]?000|32k/i);
    const css = readFileSync(new URL("../../client/src/index.css", import.meta.url), "utf8");
    const declaredTokens = new Set(Array.from(css.matchAll(/(--sh-[\w-]+)\s*:/g), match => match[1]));
    const usedTokens = new Set(Array.from(`${source}\n${$.html()}`.matchAll(/var\((--sh-[\w-]+)/g), match => match[1]));
    for (const token of Array.from(usedTokens)) expect(declaredTokens.has(token), `Undefined token: ${token}`).toBe(true);
    expect(Array.from(css.matchAll(/--sh-text-primary\s*:/g))).toHaveLength(2);
  });
});

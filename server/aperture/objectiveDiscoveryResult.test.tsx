import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyMissionDraftValues } from "../../shared/apertureMissionDraft";
import { parseStrategyDiscovery, type StrategyDiscoveryContext, type StrategyDiscoveryPayload } from "./strategyDiscovery";
import {
  ObjectiveDiscoveryResult, type ObjectiveDiscoveryResultProps, type ObjectiveDiscoverySnapshot,
} from "../../client/src/components/aperture/ObjectiveDiscoveryResult";

// A browser import must erase the router type; none of these services may load.
vi.mock("../routers", () => { throw new Error("Runtime router import forbidden"); });
vi.mock("../db", () => { throw new Error("Database access forbidden"); });
vi.mock("./strategyDiscoveryWorkflow", () => { throw new Error("Job mutations forbidden"); });
vi.mock("./strategyDiscoveryProvider", () => { throw new Error("Provider access forbidden"); });

// Frozen illustrative receipts, not market data or real investment claims.
const at = Date.UTC(2026, 8, 10, 14);
const requestId = "00000000-0000-4000-8000-000000000081";
function context(): StrategyDiscoveryContext {
  return {
    requestId, provider: "illustrative-source-adapter", asOf: at, receivedAt: at,
    searchScope: "broader_permitted_universe", universePolicy: "declared_symbols", permittedUniverse: ["DATA"],
    citations: ["https://example.test/release", "https://example.test/contract"],
    sources: [
      { id: "release", originId: "issuer-release", originUrl: "https://example.test/release", sourceName: "Illustrative issuer release", sourceUrl: "https://example.test/release", observedAt: at - 500, publishedAt: at - 600, retrievedAt: at - 100, quality: { kind: "primary", basis: "Illustrative originating issuer document" } },
      { id: "contract", originId: "contract-filing", originUrl: "https://example.test/contract", sourceName: "Illustrative contract filing", sourceUrl: "https://example.test/contract", observedAt: at - 500, publishedAt: at - 600, retrievedAt: at - 100, quality: { kind: "primary", basis: "Illustrative filed contract" } },
    ],
    providerState: { status: "available", failures: [] }, classifierState: { status: "available", failures: [] },
  };
}
function hypothesis(id = "lead-a", reject = false): StrategyDiscoveryPayload["hypotheses"][number] {
  return {
    id, title: `Illustrative ${id}`, use: "new_play", horizon: "swing",
    disposition: reject ? "reject" : "research_lead", rejectionReasons: reject ? ["outside_authorized_holding_periods"] : [],
    whyThisUse: "Research a possible change in economic participation.", whyNow: "An illustrative contract changes variable participation.",
    whyNotAlternatives: "Other connections may receive only fixed consideration.", changeCondition: "An independently checked contract establishes incremental adoption.",
    causalPath: {
      id: `path-${id}`,
      originatingSignal: { id: "signal", statement: "An issuer claims broader distribution.", assertionClass: "issuer_claim", sourceIds: ["release"],
        requiredConditions: ["Distribution reaches new customers."], unknowns: ["Incremental adoption is unverified."], contradictions: [], invalidation: "Distribution is withdrawn." },
      hops: [{ id: "economic-link", from: "Distribution", to: "Variable consideration", assertion: {
        id: "usage", statement: "Consideration may vary with incremental usage.", assertionClass: "analyst_inference", sourceIds: ["contract"],
        requiredConditions: ["Incremental usage occurs."], contradictions: ["New usage may displace existing sales."], unknowns: [], invalidation: "The contract is fixed fee.",
      }, mechanism: { kind: "variable_usage", commercialTermsStatus: "verified" },
      estimatedImpact: { basis: "modeled", amountCents: 12345, description: "Illustrative calculation: 123 units at $1 plus a $0.45 adjustment; not a forecast." },
      expectedTiming: "Next reporting period", nextFactToVerify: "Independent adoption figures", failureCondition: "No adoption occurs." }],
      affectedEntities: ["Illustrative supplier"], securityMapping: { entity: "Illustrative supplier", symbol: "DATA", status: "verified" },
      whatChangedFromExpectations: "A new contract changes participation.", counterargument: "Lower pricing may offset participation.",
      expectationsBaseline: null, technologyPermission: null, marketMeasurement: null,
      reviewAt: at + 86_400_000, expiresAt: at + 172_800_000,
    },
  };
}
function payload(hypotheses = [hypothesis()]): StrategyDiscoveryPayload {
  return { schemaVersion: 1, searchScope: "broader_permitted_universe", reviewedUniverse: ["DATA"], coverageGaps: [], hypotheses };
}
type Receipt = NonNullable<ObjectiveDiscoverySnapshot["receipt"]>;
function receipt(body = payload(), manifest = context()): Receipt {
  return {
    id: 81, jobId: 71, attempt: 1, createdAt: at + 100,
    request: { schemaVersion: 1, requestId, missionHash: "illustrative-mission-hash", searchScope: body.searchScope,
      universePolicy: "declared_symbols", permittedUniverse: ["DATA"], mission: "Illustrative: research a possible change in economic participation.",
      holdingPeriods: ["swing"], instrumentPreference: "shares" },
    result: parseStrategyDiscovery(body, manifest),
  };
}
function snapshot(record: Receipt | null = receipt()): ObjectiveDiscoverySnapshot {
  return {
    decisionRunId: 51, decisionRevisionId: 61,
    acceptedValues: { ...emptyMissionDraftValues(), accountId: 31, baseDecisionRunId: 51, baseDecisionRevisionId: 61,
      mission: "Illustrative: research a possible change in economic participation.", capital: "10000", maxLoss: "500",
      holdingPeriod: "swing", holdingPeriods: ["swing"], activeSection: 3,
      strategyContext: { schemaVersion: 1, requestId, declarationId: requestId, intent: "explore_opportunity", searchScope: "broader_permitted_universe", requestedSymbols: ["DATA"], sourceOrder: null, profitReserve: "" } },
    sourceDraftVersion: 7,
    account: { id: 31, label: "Illustrative Research Paper", isPaper: true, asOf: at - 1000 },
    job: { state: "complete", message: "The discovery receipt is recorded. Research leads are not allocations; no order was created.", jobId: 71, updatedAt: at + 100, canRetry: false },
    receipt: record, latestAttempt: record,
    history: record ? [{ id: record.id, attempt: record.attempt, createdAt: record.createdAt, status: record.result.status }] : [],
    usingPreviousResult: false,
    mutations: { analysisStarted: false, allocationCreated: false, orderCreated: false },
  };
}
function withJob(state: ObjectiveDiscoverySnapshot["job"]["state"], record: Receipt | null = null) {
  const value = snapshot(record);
  const message = {
    not_started: "No analysis is running. Review your mission before underwriting.",
    running: "Collecting cited research for the saved capital question.",
    failed: "Discovery could not finish. Inspect this job before explicitly retrying.",
    interrupted: "The analysis worker has not reported completion. Resume this analysis explicitly; no order was created.",
    complete: "The discovery receipt is recorded. Research leads are not allocations; no order was created.",
  }[state];
  value.job = state === "not_started"
    ? { state, message, jobId: null, updatedAt: null, canRetry: false }
    : { state, message, jobId: 71, updatedAt: at + 100, canRetry: state === "failed" || state === "interrupted" };
  return value;
}

// Existing SSR + explicit-element callback pattern; no browser or DOM emulator.
// This controlled component needs no hooks to simulate. Native details stay closed.
type ElementProps = { children?: React.ReactNode; disabled?: boolean; onClick?: () => void };
function elements(node: React.ReactNode): React.ReactElement<ElementProps>[] {
  return React.Children.toArray(node).flatMap(child => React.isValidElement<ElementProps>(child)
    ? [child, ...elements(child.props.children)] : []);
}
function text(node: React.ReactNode): string {
  return React.Children.toArray(node).map(child => React.isValidElement<ElementProps>(child) ? text(child.props.children) : String(child)).join("");
}
function harness(value = snapshot(), overrides: Partial<ObjectiveDiscoveryResultProps> = {}) {
  const onRefresh = vi.fn(), onRetry = vi.fn(), onStart = vi.fn();
  const props: ObjectiveDiscoveryResultProps = { snapshot: value, busy: false, onRefresh, onRetry, onStart, ...overrides };
  function render() {
    const tree = ObjectiveDiscoveryResult(props);
    const html = renderToStaticMarkup(tree), $ = load(html), visible = load(html);
    visible("details:not([open])").each((_, node) => { visible(node).children().not("summary").remove(); });
    return { tree, $, visible, text: visible.text() };
  }
  function button(label: string) {
    const found = elements(render().tree).find(element => element.type === "button" && text(element.props.children) === label);
    if (!found) throw new Error(`Button not found: ${label}`);
    return found;
  }
  function click(label: string) {
    const found = button(label);
    expect(found.props.disabled, `Button disabled: ${label}`).not.toBe(true);
    found.props.onClick!();
  }
  return { props, render, button, click, onRefresh, onRetry, onStart };
}

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  const forbidden = () => { throw new Error("Network forbidden in controlled result tests"); };
  vi.stubGlobal("fetch", vi.fn(forbidden));
  vi.spyOn(http, "request").mockImplementation(forbidden);
  vi.spyOn(http, "get").mockImplementation(forbidden);
  vi.spyOn(https, "request").mockImplementation(forbidden);
  vi.spyOn(https, "get").mockImplementation(forbidden);
});
afterEach(() => {
  for (const network of [fetch, http.request, http.get, https.request, https.get]) expect(network).not.toHaveBeenCalled();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

describe("ObjectiveDiscoveryResult controlled research findings", () => {
  it("leads with an incomplete outcome and a useful next condition, not an instruction to select a nonexistent lead", () => {
    const partial = payload([]); partial.coverageGaps = ["Illustrative missing activity evidence."];
    const view = harness(snapshot(receipt(partial)), { renderLeadAction: () => <button>Underwrite lead</button> });
    const { visible, text } = view.render();
    expect(visible("h2").text()).toBe("Research incomplete");
    expect(visible('[aria-label="Research outcome"]').text()).toContain("Reopen when:");
    expect(text).toContain("Illustrative missing activity evidence.");
    expect(text).toContain("No allocation or order is created");
    expect(text).not.toContain("Underwrite a lead");
    expect(text).not.toContain("Research recorded; review sources and conditions.");
    expect(text).not.toContain("Incomplete research record: evidence or coverage gaps remain.");
    expect(visible("details > summary").text()).toBe("Evidence & record");
    expect(view.onStart).not.toHaveBeenCalled(); expect(view.onRetry).not.toHaveBeenCalled();
  });
  it("renders the real parsed receipt, named Paper account and separate source/job clocks without investment authority", () => {
    const value = snapshot();
    expect(value.receipt?.result.status).toBe("complete");
    const view = harness(value), { $, visible, text } = view.render();
    expect($('section[aria-label="Research findings"]')).toHaveLength(1);
    expect($("h2").text()).toBe("1 research lead");
    expect(text).toContain("Paper account: Illustrative Research Paper");
    for (const time of [at - 1000, at, at + 100]) expect($(`time[datetime="${new Date(time).toISOString()}"]`).length).toBeGreaterThan(0);
    expect(visible("time")).toHaveLength(1);
    expect(visible("time").attr("datetime")).toBe(new Date(at).toISOString());
    expect(text).not.toContain("Account snapshot"); expect(text).not.toContain("Job #"); expect(text).not.toContain("Recorded 2026");
    expect(text.match(/no (?:allocation or )?order/gi)).toHaveLength(1);
    expect(text).toContain("Unverified hypotheses, not trade plays");
    expect(text).toContain("No allocation or order is created");
    expect(text).toContain("Research validation is not enabled in this release");
    expect($("button").map((_, node) => $(node).text()).get()).toEqual(["Refresh status"]);
    expect($("form,progress,pre,textarea,input,select")).toHaveLength(0);
    expect(text).not.toMatch(/zero portfolio risk|0% risk|risk-free|approved allocation|top pick|probability of profit/i);
  });

  it.each(["not_started", "running", "failed", "interrupted", "complete"] as const)("reports %s using actual job evidence, not a timer or automatic action", state => {
    const value = withJob(state, state === "complete" ? receipt() : null);
    const view = harness(value);
    for (let i = 0; i < 3; i++) {
      const result = view.render();
      expect(result.$("[data-discovery-status]").attr("data-discovery-status")).toBe(state.replace("_", "-"));
      if (["running", "failed", "interrupted"].includes(state)) expect(result.text).toContain(value.job.message);
      if (state !== "complete") expect(result.text).not.toMatch(/\bComplete\b|no opportunities|all clear|risk-free/i);
      if (state === "failed" || state === "interrupted") expect(result.visible('[role="alert"]')).toHaveLength(1);
    }
    expect(view.onRefresh).not.toHaveBeenCalled(); expect(view.onRetry).not.toHaveBeenCalled(); expect(view.onStart).not.toHaveBeenCalled();
  });

  it("updates actual progress messages without inventing a percentage, jumping focus or dispatching work", () => {
    const view = harness(withJob("running"));
    expect(view.render().text).toContain("Collecting cited research");
    view.props.snapshot = { ...view.props.snapshot, job: { state: "running", jobId: 71, canRetry: false, message: "Source review finished. Recording hypotheses and exclusions.", updatedAt: at + 500 } };
    const result = view.render();
    expect(result.text).toContain("Source review finished. Recording hypotheses and exclusions.");
    expect(result.text).not.toContain("Collecting cited research");
    expect(result.$("[autofocus],[tabindex],progress")).toHaveLength(0);
    expect(result.text).not.toMatch(/\d+%/);
    expect(view.onRetry).not.toHaveBeenCalled(); expect(view.onStart).not.toHaveBeenCalled();
    view.click("Refresh status"); expect(view.onRefresh).toHaveBeenCalledOnce();
  });

  it.each([["not_started", "Start research", "onStart"], ["failed", "Retry research", "onRetry"], ["interrupted", "Resume research", "onRetry"]] as const)("only calls the explicit %s action", (state, label, callback) => {
    const view = harness(withJob(state));
    const before = structuredClone(view.props.snapshot);
    view.render(); expect(view[callback]).not.toHaveBeenCalled();
    view.click(label); expect(view[callback]).toHaveBeenCalledOnce(); expect(view[callback]).toHaveBeenCalledWith();
    view.click("Refresh status"); expect(view.onRefresh).toHaveBeenCalledOnce(); expect(view.onRefresh).toHaveBeenCalledWith();
    view.render(); expect(view[callback]).toHaveBeenCalledOnce();
    expect(view[callback === "onStart" ? "onRetry" : "onStart"]).not.toHaveBeenCalled();
    expect(view.props.snapshot).toEqual(before);
    expect(view.props.snapshot).toMatchObject({ sourceDraftVersion: 7, acceptedValues: { baseDecisionRunId: 51, baseDecisionRevisionId: 61, strategyContext: { requestId } }, mutations: { allocationCreated: false, orderCreated: false } });
  });

  it.each(["busy", "refreshing"] as const)("guards all callbacks during %s, including direct handler invocation", flag => {
    for (const [state, action] of [["not_started", "Start research"], ["failed", "Retry research"], ["interrupted", "Resume research"]] as const) {
      const view = harness(withJob(state), { [flag]: true });
      expect(view.button(action).props.disabled).toBe(true);
      view.button(action).props.onClick!();
      const refresh = view.button(flag === "refreshing" ? "Refreshing status…" : "Refresh status");
      expect(refresh.props.disabled).toBe(true); refresh.props.onClick!();
      expect(view.onStart).not.toHaveBeenCalled(); expect(view.onRetry).not.toHaveBeenCalled(); expect(view.onRefresh).not.toHaveBeenCalled();
      expect(view.render().text).toContain(flag === "busy" ? "Request in progress; awaiting recorded job status" : "Refreshing status…");
    }
  });

  it("does not turn a busy request into a fabricated running job", () => {
    const view = harness(withJob("not_started"), { busy: true });
    expect(view.render().$("[data-discovery-status]").attr("data-discovery-status")).toBe("not-started");
    expect(view.render().text).not.toContain("Job #");
  });

  it("preserves completed findings while action availability is loading", () => {
    const view = harness(withJob("complete", receipt()), { actionBlockedReason: "Checking discovery availability." });
    expect(view.render().$("[data-discovery-status]").attr("data-discovery-status")).toBe("complete");
    expect(view.render().visible('[role="alert"]')).toHaveLength(0);
    view.click("Refresh status");
    expect(view.onRefresh).toHaveBeenCalledOnce();
    expect(view.onStart).not.toHaveBeenCalled();
  });

  it.each([["not_started", "Start research"], ["failed", "Retry research"]] as const)("blocks %s actions with availability explanation and read-only recovery", (state, label) => {
    const view = harness(withJob(state), { actionBlockedReason: "Discovery is not enabled." });
    expect(view.button(label).props.disabled).toBe(true);
    view.button(label).props.onClick!();
    expect(view.onStart).not.toHaveBeenCalled(); expect(view.onRetry).not.toHaveBeenCalled();
    expect(view.render().text).toContain("Discovery is not enabled. Refresh status");
    view.click("Refresh status"); expect(view.onRefresh).toHaveBeenCalledOnce();
  });

  it("honors server retry limits and never substitutes a new start", () => {
    const value = withJob("failed");
    value.job.canRetry = false;
    value.job.message = "Three attempts did not finish. Review the saved failure and authorize a new Mission revision before further discovery.";
    const view = harness(value), result = view.render();
    expect(result.text).toContain(value.job.message);
    expect(result.$("button").map((_, node) => result.$(node).text()).get()).toEqual(["Refresh status"]);
    view.click("Refresh status"); expect(view.onRefresh).toHaveBeenCalledOnce();
    expect(view.onRetry).not.toHaveBeenCalled(); expect(view.onStart).not.toHaveBeenCalled();
  });

  it("never starts when an external failure leaves the old not-started snapshot in place", () => {
    const view = harness(withJob("not_started"), { failure: "The request outcome is unknown; refresh the saved job first." });
    const result = view.render();
    expect(result.$("[data-discovery-status]").attr("data-discovery-status")).toBe("failed");
    expect(result.visible('[role="alert"]').text()).toContain("outcome is unknown");
    expect(view.button("Start research").props.disabled).toBe(true);
    view.button("Start research").props.onClick!(); expect(view.onStart).not.toHaveBeenCalled();
    view.click("Refresh status"); expect(view.onRefresh).toHaveBeenCalledOnce();
  });

  it("keeps a completed receipt visible during a refresh failure without a false complete/all-clear status", () => {
    const view = harness();
    const original = structuredClone(view.props.snapshot);
    view.props.failure = "Could not read the latest research status.";
    const result = view.render();
    expect(result.visible('[role="alert"]').text()).toContain(view.props.failure);
    expect(result.visible('[aria-label="Research lead summaries"]').text()).toContain("Illustrative lead-a");
    expect(result.$("[data-discovery-status]").attr("data-discovery-status")).toBe("failed");
    expect(result.text).toContain("Saved findings are retained");
    expect(result.text).not.toMatch(/\bComplete\b|all clear/);
    expect(view.props.snapshot).toEqual(original);
    expect(view.onRetry).not.toHaveBeenCalled();
  });

  it.each(["failed", "interrupted", "running"] as const)("preserves the latest successful result and the latest failed receipt while the job is %s", state => {
    const successful = receipt();
    const latest = { ...receipt(), id: 82, attempt: 2, createdAt: at + 3000, result: parseStrategyDiscovery("not JSON", context()) };
    const value = withJob(state, successful);
    value.latestAttempt = latest; value.usingPreviousResult = true;
    value.history.unshift({ id: latest.id, attempt: latest.attempt, createdAt: latest.createdAt, status: latest.result.status });
    const view = harness(value), original = structuredClone(value), result = view.render();
    expect(result.text).toContain("Previous result retained · Attempt 1");
    expect(result.text).toContain("Latest attempt has no usable replacement");
    expect(result.visible('[aria-label="Research lead summaries"] article')).toHaveLength(1);
    expect(result.text).toContain("Illustrative lead-a");
    expect(result.text).not.toContain("invalid json");
    expect(result.$("details").last().text()).toContain("invalid json");
    expect(result.$("details").last().text()).toContain("Attempt 2");
    expect(result.text).toContain("2026-09-10 14:00:00 UTC");
    expect(value).toEqual(original);
  });

  it.each([0, 1, 2, 3, 5, 12])("shows zero-to-three summaries for %i leads without ranking or dropping the rest of the record", count => {
    const hypotheses = Array.from({ length: count }, (_, index) => hypothesis(`lead-${12 - index}`));
    const value = snapshot(receipt(payload(hypotheses))), original = structuredClone(value);
    const result = harness(value).render();
    expect(result.visible('[aria-label="Research lead summaries"] article')).toHaveLength(Math.min(3, count));
    expect(result.visible('[aria-label="Research lead summaries"] h3').map((_, node) => result.visible(node).text()).get()).toEqual(hypotheses.slice(0, 3).map(item => item.title));
    expect(result.$('[aria-label="All hypotheses"] > details')).toHaveLength(count);
    expect(result.$("details[open],pre")).toHaveLength(0);
    expect(result.text).not.toContain("Illustrative lead-9");
    if (count) expect(result.text).toContain("recorded order, not a ranking");
    else expect(result.text).toContain("not a portfolio-risk assessment");
    expect(value).toEqual(original);
  });

  it("does not promote rejected or unavailable hypotheses, even when a rejected path passed structural checks", () => {
    const value = snapshot(receipt(payload([hypothesis("rejected-first", true), hypothesis("retained-lead")])));
    expect(value.receipt!.result.hypotheses[0]).toMatchObject({ disposition: "rejected", assessment: { status: "verified" } });
    const unavailable = structuredClone(value.receipt!.result.hypotheses[1]);
    unavailable.id = "unavailable-last"; unavailable.title = "Illustrative unavailable last"; unavailable.disposition = "unavailable";
    value.receipt!.result.hypotheses.push(unavailable);
    const result = harness(value).render();
    expect(result.visible('[aria-label="Research lead summaries"] h3').text()).toBe("Illustrative retained-lead");
    expect(result.text).not.toContain("Illustrative rejected-first");
    expect(result.text).not.toContain("Illustrative unavailable last");
    expect(result.$('[aria-label="All hypotheses"]').text()).toContain("Illustrative rejected-first — rejected");
    expect(result.$('[aria-label="Rejected and unavailable hypotheses"]').text()).toContain("outside authorized holding periods");
  });

  it("keeps empty, incomplete, failed parsing and missing-completed-receipt states distinct", () => {
    const empty = harness(snapshot(receipt(payload([])))).render();
    expect(empty.text).toContain("No research leads in this bounded record");
    expect(empty.text).toContain("Reopen when:");
    const partial = payload([]); partial.coverageGaps = ["Illustrative source coverage gap."];
    const incomplete = harness(snapshot(receipt(partial))).render();
    expect(incomplete.visible("h2").text()).toBe("Research incomplete");
    expect(incomplete.text).toContain("Illustrative source coverage gap");
    const invalid = { ...receipt(), result: parseStrategyDiscovery("malformed JSON", context()) };
    const failed = harness(withJob("failed", invalid)).render();
    expect(failed.text).toContain("not a successful empty search");
    expect(failed.text).not.toContain("No research leads in this bounded record");
    for (const record of [null, invalid]) {
      const missing = harness(withJob("complete", record)).render();
      expect(missing.$("[data-discovery-status]").attr("data-discovery-status")).toBe("failed");
      expect(missing.text).toContain("completed job has no usable research record");
      expect(missing.$("button").map((_, node) => missing.$(node).text()).get()).toEqual(["Refresh status"]);
    }
  });

  it("shows main uncertainty, invalidation and reopen conditions at a glance with additional conditions in each lead's disclosure", () => {
    const body = payload(), lead = body.hypotheses[0], view = harness(snapshot(receipt(body)));
    const result = view.render();
    for (const phrase of ["Incremental adoption is unverified.", lead.causalPath.counterargument, lead.causalPath.originatingSignal.invalidation, lead.changeCondition]) expect(result.text).toContain(phrase);
    expect(result.text).toContain("Needs verification:");
    expect(result.text).toContain("Evidence and conditions · 5 additional conditions");
    const leadDetails = result.$('[aria-label="Research lead summaries"] article details');
    for (const phrase of [lead.causalPath.hops[0].assertion.invalidation, lead.causalPath.hops[0].failureCondition]) {
      expect(result.text).not.toContain(phrase);
      expect(leadDetails.text()).toContain(phrase);
    }
    expect(result.text).not.toContain("Recorded impact");
    expect(result.$('[aria-label="All hypotheses"]').text()).toContain("modeled · $123.45");
    expect(result.$('[aria-label="All hypotheses"]').text()).toContain("Illustrative calculation: 123 units");
    expect(result.$('[aria-label="All hypotheses"]').text()).toContain("Independent adoption figures");
    expect(result.$("pre")).toHaveLength(0);
    expect(view.onRefresh).not.toHaveBeenCalled(); expect(view.onRetry).not.toHaveBeenCalled(); expect(view.onStart).not.toHaveBeenCalled();
  });

  it("retains the supplied baseline, measurement methodology and permission record in accessible details", () => {
    const body = payload(), path = body.hypotheses[0].causalPath;
    path.expectationsBaseline = { asOf: at - 200, commercialLaunchStatus: "announced", sourceIds: ["release"], incrementalChange: null };
    path.marketMeasurement = { kind: "reported_activity", volumeObserved: false, claimedMetrics: ["odds"], methodology: "Illustrative odds feed, not transaction volume.", coverage: "Selected venues only.", asOf: at - 100 };
    path.technologyPermission = { technicalCapabilityDocumented: true, rightsDocumented: false, jurisdictionAndProductIdentified: false, permissionStatus: "unverified", commercialLaunchStatus: "announced", adoptionObserved: false, financialImpactSupportable: false };
    const result = harness(snapshot(receipt(body))).render();
    expect(result.$('[aria-label="Expectations baseline"]').text()).toContain("Launch announced");
    expect(result.$('[aria-label="Market measurement"]').text()).toContain("Illustrative odds feed, not transaction volume.");
    expect(result.$('[aria-label="Market measurement"]').text()).toContain("Selected venues only.");
    expect(result.$('[aria-label="Technology permission record"]').text()).toContain("Rights documented: No");
    expect(result.$('[aria-label="Technology permission record"]').text()).toContain("Adoption observed: No");
    expect(result.text).not.toContain("Illustrative odds feed");
    expect(result.$('[aria-label="Market measurement"]').closest("details")).toHaveLength(1);
  });

  it("exposes real citation links and their provenance without invoking a callback on disclosure", () => {
    const view = harness(), result = view.render();
    expect(result.visible('[aria-label="Research lead summaries"] a').map((_, node) => result.visible(node).attr("href")).get()).toEqual(context().citations);
    result.$("a").each((_, node) => {
      expect(result.$(node).attr("rel")).toBe("noopener noreferrer");
      expect(result.$(node).attr("target")).toBe("_blank");
    });
    expect(result.$('[aria-label="Source manifest"]').text()).toContain("Illustrative originating issuer document");
    expect(result.$('[aria-label="Source manifest"]').text()).toContain("issuer-release");
    expect(result.$('[aria-label="Source manifest"]').text()).toContain("Observed:");
    for (const element of elements(result.tree).filter(element => element.type === "details" || element.type === "summary")) expect(element.props.onClick).toBeUndefined();
    expect(view.onStart).not.toHaveBeenCalled(); expect(view.onRetry).not.toHaveBeenCalled(); expect(view.onRefresh).not.toHaveBeenCalled();
  });

  it("reports absent source, timestamps and calculations honestly without invented links, times or zero amounts", () => {
    const body = payload();
    body.hypotheses[0].causalPath.originatingSignal.sourceIds = [];
    body.hypotheses[0].causalPath.hops[0].assertion.sourceIds = [];
    body.hypotheses[0].causalPath.hops[0].estimatedImpact = null;
    const manifest = context(); manifest.sources = []; manifest.citations = [];
    const value = snapshot(receipt(body, manifest));
    value.account.asOf = null; value.receipt!.result.asOf = null;
    const result = harness(value).render();
    expect(result.text).toContain("No eligible source citation supplied");
    expect(result.$.text()).toContain("Account snapshotNot supplied");
    expect(result.text).toContain("Research as of Not supplied");
    expect(result.$('[aria-label="Source manifest"]').text()).toContain("No source records supplied");
    expect(result.$('[aria-label="All hypotheses"]').text()).toContain("No calculation supplied");
    expect(result.$("a")).toHaveLength(0);
    expect(result.$.text()).not.toContain("$0.00");
    value.receipt!.result.context = null;
    expect(harness(value).render().text).toContain("Source manifest not supplied; provenance cannot be confirmed.");
  });

  it("retains parser exclusions and never passes unsafe source links through the presentation boundary", () => {
    const manifest = context(); manifest.sources[0].observedAt = at + 1;
    const value = snapshot(receipt(payload(), manifest));
    const result = harness(value).render();
    expect(result.$('[aria-label="All hypotheses"]').text()).toContain("Excluded source: Illustrative issuer release — source after cutoff");
    expect(result.visible("h2").text()).toBe("Research incomplete");
    expect(result.text).toContain("Coverage uncertainty:");
    for (const url of ["javascript:alert(1)", "https://name:secret@example.test", "file:///private", ""]) {
      const unsafe = snapshot();
      unsafe.receipt!.result.hypotheses[0].assessment.sources[0].sourceUrl = url;
      unsafe.receipt!.result.context!.sources[0].sourceUrl = url;
      const rendered = harness(unsafe).render();
      expect(rendered.text).toContain("source link unavailable");
      expect(rendered.$("a").map((_, node) => rendered.$(node).attr("href")).get()).not.toContain(url);
    }
  });

  it("keeps responsive, keyboard-visible controls and type-only server imports with no runtime network/order surface", () => {
    const { $ } = harness(withJob("failed", receipt())).render();
    $("button,summary").each((_, node) => {
      expect($(node).attr("class")).toContain("min-h-11");
      expect($(node).attr("class")).toContain("focus-visible:outline");
      if (node.tagName === "button") expect($(node).attr("type")).toBe("button");
    });
    const source = readFileSync(new URL("../../client/src/components/aperture/ObjectiveDiscoveryResult.tsx", import.meta.url), "utf8");
    expect(source).toContain('import type { inferRouterOutputs } from "@trpc/server"');
    expect(source).toContain('import type { AppRouter } from "../../../../server/routers"');
    expect(source).toContain('inferRouterOutputs<AppRouter>["aperture"]["strategy"]["get"]');
    expect(source).not.toMatch(/useEffect|useLayoutEffect|useQuery|useMutation|useLocation|mutateAsync|fetch\(|axios|localStorage|setInterval|setTimeout|scrollIntoView|autoFocus|\.focus\(|JSON\.stringify/);
    expect(source).not.toMatch(/hover:|#[\da-f]{6}\b/i);
    expect(source).toContain("lg:grid-cols-3"); expect(source).toContain("min-w-0");
    const css = readFileSync(new URL("../../client/src/index.css", import.meta.url), "utf8");
    const declared = new Set(Array.from(css.matchAll(/(--sh-[\w-]+)\s*:/g), match => match[1]));
    for (const match of Array.from(source.matchAll(/var\((--sh-[\w-]+)/g))) expect(declared.has(match[1]), `Undefined token: ${match[1]}`).toBe(true);
  });
});

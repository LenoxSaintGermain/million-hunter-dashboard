import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deskAttentionSourceIssues, deskMonitoringFindings } from "./deskAttentionPresentation";
import { monitoringFindingPresentation } from "../../shared/monitoringState";
import { deriveApertureAttention, type ApertureAttentionInput } from "../../shared/apertureAttention";
import { MonitoringFindingCard } from "../../client/src/components/aperture/MonitoringFindingCard";
import { AttentionSourceRecovery } from "../../client/src/components/aperture/AttentionSourceRecovery";

const now = Date.UTC(2026, 8, 9, 14);
const order = { id: 12, accountId: 3, runId: 360001, candidateId: 240003, status: "filled", reason: "Illustrative recorded protective put rationale", symbol: "DKNG261120P00020000", underlyingSymbol: "DKNG", instrumentType: "long_put" as const };
const check = { id: 4, checkType: "catalyst", symbol: "DKNG", finding: "**Illustrative stock thesis supports an upside move** [1]", flagged: true, citations: ["https://example.org/fixture"], checkedAt: now };
const byCandidate = new Map([[240003, [check]]]);
const sources = (overrides = {}) => deskAttentionSourceIssues({ orders: [order], activePlays: [], monitoringByCandidate: byCandidate, monitoringUnavailable: false, positionsUnavailable: false, now, ...overrides });
beforeEach(() => vi.stubGlobal("React", React));

describe("Desk status adapter and selected-instrument monitoring", () => {
  it("carries the exact selected instrument and all citations through the real adapter to the attention model", () => {
    const records = deskMonitoringFindings([order], byCandidate);
    expect(records[0].instrument).toMatchObject({ symbol: order.symbol, instrumentType: "long_put" });
    expect(records[0].citations).toEqual(check.citations);
    expect(records[0].rationale).toBe(order.reason);
    const input: ApertureAttentionInput = { now, mission: null, underwriting: null, evidenceTasks: [], orders: [], activePlays: [], pendingReviews: [], monitoringFindings: records, checks: { state: "complete", asOf: now, monitoring: "on_demand" } };
    const first = deriveApertureAttention(input, null);
    const before = JSON.stringify(input);
    const seen = deriveApertureAttention(input, first.baseline);
    expect(seen.primary!.title).toContain("DKNG · $20 Put · Nov 20, 2026");
    expect(seen.primary!.reason).toContain("Catalyst check flagged");
    expect(seen.primary!.evidence!.finding).toBe(check.finding);
    expect(seen.primary!.evidence!.citations).toEqual(check.citations);
    expect(seen.primary!.critical).toBe(true);
    expect(seen.changed).toEqual([]);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("does not deduplicate distinct orders sharing a candidate or erase a put's context with a call", () => {
    const call = { ...order, id: 13, symbol: "DKNG261120C00020000", instrumentType: "long_call" as const };
    const findings = deskMonitoringFindings([order, call], byCandidate);
    expect(findings.map(f => f.orderId)).toEqual([12, 13]);
    expect(findings.map(f => f.instrument!.instrumentType)).toEqual(["long_put", "long_call"]);
  });

  it.each(["pending_approval", "approved", "submitted", "cancelled", "rejected"])("does not offer unrecoverable filled-position monitoring for %s orders", status => {
    const unfilled = { ...order, status };
    expect(sources({ orders: [unfilled] })).toEqual([]);
    expect(deskMonitoringFindings([unfilled], byCandidate)).toEqual([]);
  });

  it("shows a missing per-play check set with its own recovery route, without executing it", () => {
    const issue = sources()[0];
    expect(issue).toMatchObject({ source: "monitoring", state: "missing", lastSuccessAt: now, recovery: "review_checks", href: "/aperture/run/360001/execute?candidate=240003&lifecycle=monitoring" });
    expect(issue.impact).toContain("thesis invalidation, earnings, macro");
    const onOpen = vi.fn(), onRetry = vi.fn();
    const html = renderToStaticMarkup(React.createElement(AttentionSourceRecovery, { issues: [issue], onOpen, onRetry }));
    expect(html).toContain("Review DKNG checks");
    expect(html).toContain("Refresh reads saved status only");
    expect(onOpen).not.toHaveBeenCalled(); expect(onRetry).not.toHaveBeenCalled();
  });

  it("does not call an unavailable DB read missing market evidence or invent its last successful timestamp", () => {
    const issues = sources({ monitoringUnavailable: true, positionsUnavailable: true });
    expect(issues).toHaveLength(2);
    expect(issues.map(issue => issue.source)).toEqual(["monitoring", "positions"]);
    expect(issues.every(issue => issue.lastSuccessAt === null && issue.recovery === "refresh_status")).toBe(true);
    expect(issues[1].impact).toContain("No current P&L conclusion");
  });

  it("keeps an unlinked active play's missing monitoring separate from the current account's same ticker", () => {
    const issue = sources({ activePlays: [{ id: 77, symbol: "DKNG", accountId: 99 }] }).find(issue => issue.href === "/aperture/plays?play=77");
    expect(issue?.recovery).toBe("inspect_record");
    expect(issue?.lastSuccessAt).toBeNull();
  });

  it.each(["long_put", "long_call", "shares"] as const)("does not infer %s outlook, probability, or a trade from check type or headline polarity", instrumentType => {
    const positive = monitoringFindingPresentation({ check, instrument: { ...order, instrumentType }, now });
    const negative = monitoringFindingPresentation({ check: { ...check, finding: "Negative shocking bearish headline!", checkType: "macro" }, instrument: { ...order, instrumentType }, now });
    expect(negative.implication).toBe(positive.implication);
    expect(positive.implication).not.toMatch(/bullish|bearish|guaranteed|buy|sell|recommend/i);
  });

  it("keeps unknown exact instrument and unrecorded rationale explicit", () => {
    const model = monitoringFindingPresentation({ check, now });
    expect(model.label).toContain("instrument not recorded");
    expect(model.evidence.rationale).toBeNull();
    const html = renderToStaticMarkup(React.createElement(MonitoringFindingCard, { check, now }));
    expect(html).toContain("hedge intent is not assumed");
    expect(html).toContain("Review evidence");
    expect(html).toContain("does not acknowledge or resolve");
    expect(html).not.toContain("Refresh sourced checks");
  });

  it("preserves full rationale and sources but displays an explicit stale blocker above evidence", () => {
    const onRefresh = vi.fn();
    const old = { ...check, checkedAt: now - 86_400_001, citations: [...check.citations, "javascript:alert(1)"] };
    const html = renderToStaticMarkup(React.createElement(MonitoringFindingCard, { check: old, instrument: order, rationale: "Illustrative recorded hedge intent", now, onRefresh }));
    expect(html).toContain("Monitoring evidence is stale");
    expect(html).toContain("Refresh sourced checks");
    expect(html).toContain("Illustrative recorded hedge intent");
    expect(html).toContain("https://example.org/fixture");
    expect(html).not.toContain("javascript:");
    expect(onRefresh).not.toHaveBeenCalled();
  });
});

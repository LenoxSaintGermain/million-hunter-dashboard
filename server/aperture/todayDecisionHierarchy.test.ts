import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TodayAttentionBriefing } from "../../client/src/components/aperture/TodayAttentionBriefing";
import { FindingEvidence } from "../../client/src/components/aperture/AttentionDecisionCard";
import type { ApertureAttentionBriefing, ApertureAttentionItem, ApertureMotionItem } from "../../shared/apertureAttention";

/**
 * Operator walkthrough, 2026-09-10, against TSL-BUILD-2026-008A §5 and its
 * Today attention model. Four observed failures on the deployed briefing:
 * secondary attention rendered as full cards competing with the primary one,
 * fifteen raw source anchors dominating the first viewport, In Motion pushed
 * below every large card, and no visible changed-since baseline line.
 */

vi.mock("@/lib/trpc", () => ({ trpc: { aperture: { desk: { markSeen: { useMutation: () => ({ mutate: vi.fn() }) } } } } }));

const now = Date.UTC(2026, 8, 10, 17);
const evidence = (citations: number) => ({
  finding: "Analyst upgrades and a $1.45B credit facility closed.",
  rationale: "Paper-only protective put.",
  checkedAt: now - 3600_000,
  citations: Array.from({ length: citations }, (_, i) => `https://example.test/source-${i + 1}`),
});

const task = (key: string, over: Partial<ApertureAttentionItem> = {}): ApertureAttentionItem => ({
  key, kind: "monitoring_finding", critical: true, title: `Review ${key}`,
  reason: "Catalyst was previously flagged for this selected put.",
  consequence: "Stock outlook alone does not establish whether this put still holds.",
  actionLabel: "Review unresolved finding", href: `/aperture/run/1?finding=${key}`,
  stateLabel: "Unresolved finding · stale evidence", deadlineAt: null, evidence: evidence(15), ...over,
} as ApertureAttentionItem);

const motion = (key: string, detail: string): ApertureMotionItem => ({
  key, symbol: "CSCO", detail, stateLabel: "Accepted · unfilled", href: `/aperture/order/${key}`,
} as ApertureMotionItem);

function briefing(over: Partial<ApertureAttentionBriefing> = {}): ApertureAttentionBriefing {
  return {
    entryState: "returning", primary: task("DKNG"),
    otherCritical: [task("MGM"), task("TLT", { kind: "review_due", actionLabel: "Review recorded outcome" })],
    otherAttention: [], readState: "complete",
    changed: [], inMotion: [motion("m1", "Accepted order · no fill recorded"), motion("m2", "Open position")],
    nextCheckpoint: null, changeHeading: "Changed since your last review",
    scopeNote: "All authorized plays.", monitoringNote: "Checks run on demand.",
    quiet: false, quietMessage: null,
    baseline: { capturedAt: now - 86_400_000, items: [] }, baselineToken: "t",
    ...over,
  } as ApertureAttentionBriefing;
}

const render = (b = briefing()) => renderToStaticMarkup(createElement(TodayAttentionBriefing, {
  attention: b, accountLabel: "Alpaca Paper — AI Thesis", modeLabel: "Paper",
  loading: false, failed: null, onOpen: vi.fn(), onRetry: vi.fn(), onNewMission: vi.fn(),
}));

describe("Today keeps one focal decision and demotes everything else", () => {
  beforeAll(() => vi.stubGlobal("React", React));
  afterAll(() => vi.unstubAllGlobals());

  it("renders exactly one primary card and gives secondary attention the compact layout", () => {
    const $ = load(render());
    expect($("[data-attention-layout='primary']")).toHaveLength(1);
    // Before: secondary items used the full card layout and competed visually.
    expect($("[data-attention-layout='card']")).toHaveLength(0);
    expect($("[data-attention-layout='compact']").length).toBeGreaterThanOrEqual(2);
  });

  it("puts In Motion above the secondary attention sections", () => {
    const html = render();
    const inMotion = html.indexOf("In motion");
    const otherCritical = html.indexOf("Other critical issues");
    expect(inMotion).toBeGreaterThan(-1);
    expect(otherCritical).toBeGreaterThan(-1);
    expect(inMotion).toBeLessThan(otherCritical);
  });

  it("states the changed-since baseline even when nothing changed", () => {
    const text = load(render(briefing({ changed: [] }))).text();
    expect(text).toContain("Changed since your last review");
    expect(text).toMatch(/Nothing changed|no change/i);
  });

  it("keeps the first-baseline wording distinct from a delta", () => {
    const text = load(render(briefing({ changed: [], changeHeading: "Current status" }))).text();
    expect(text).toContain("Current status");
    expect(text).not.toContain("Changed since your last review");
  });
});

describe("Provenance stays one action away without dominating the view", () => {
  beforeAll(() => vi.stubGlobal("React", React));
  afterAll(() => vi.unstubAllGlobals());

  it("collapses a long citation list behind its own counted disclosure", () => {
    const $ = load(renderToStaticMarkup(createElement(FindingEvidence, { evidence: evidence(15), expanded: true })));
    // The fifteen anchors must not sit loose in the expanded evidence body.
    const nested = $("details details");
    expect(nested).toHaveLength(1);
    expect(nested.find("summary").text()).toContain("15");
    expect(nested.find("a").length).toBe(15);
    expect(nested.attr("open")).toBeUndefined();
  });

  it("leaves a short citation list inline rather than burying three links", () => {
    const $ = load(renderToStaticMarkup(createElement(FindingEvidence, { evidence: evidence(3), expanded: true })));
    expect($("details details")).toHaveLength(0);
    expect($("a").length).toBe(3);
  });

  it("still says plainly when a finding has no recorded source", () => {
    const $ = load(renderToStaticMarkup(createElement(FindingEvidence, { evidence: evidence(0), expanded: true })));
    expect($.text()).toContain("No source links recorded");
    expect($.text()).toContain("not verified evidence");
  });
});

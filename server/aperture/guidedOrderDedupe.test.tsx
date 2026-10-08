import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ApertureAttentionBriefing, ApertureAttentionItem } from "../../shared/apertureAttention";
import { TodayAttentionBriefing } from "../../client/src/components/aperture/TodayAttentionBriefing";
import { GuidedDecisionQueue } from "../../client/src/components/aperture/GuidedDecisionQueue";

vi.mock("@/lib/trpc", () => ({ trpc: { aperture: { desk: { markSeen: { useMutation: () => ({ mutate: vi.fn() }) } } } } }));
vi.mock("@/contexts/ExperienceModeContext", () => ({ useExperienceMode: () => ({ mode: "guided", isGuided: true, isPro: false, setMode: () => {}, toggleMode: () => {} }) }));

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

const OCT_1 = Date.UTC(2026, 9, 1, 16);
const review = (symbol: string): ApertureAttentionItem => ({
  key: `review:${symbol}`, kind: "review_due", critical: true, priority: 80, title: `${symbol} outcome review`, stateLabel: "Outcome Review Due",
  reason: "Check now.", consequence: "This is a human checkpoint.", actionLabel: "Review Recorded Outcome", href: `/aperture/review/${symbol}`, deadlineAt: OCT_1,
} as ApertureAttentionItem);
const approved = (symbol: string, id: number): ApertureAttentionItem => ({
  key: `order:${id}`, kind: "approved_not_submitted", critical: true, priority: 75, symbol, title: `Send the approved ${symbol} paper order`, stateLabel: "Approved · not sent",
  reason: "You approved this paper order.", consequence: "Nothing is sent until you confirm.", actionLabel: "Review final checks", href: `/aperture/plays?stage=approve&inspect=${id}`,
  deadlineAt: null, submitState: "ready", submitBlockers: [],
} as unknown as ApertureAttentionItem);
const finding = { key: "finding:9", kind: "monitoring_finding", critical: true, priority: 90, symbol: "DKNG", title: "Review DKNG finding", stateLabel: "Unresolved finding",
  reason: "Catalyst flagged.", consequence: "Review before deciding.", actionLabel: "Review unresolved finding", href: "/aperture/run/1?finding=9", deadlineAt: null } as unknown as ApertureAttentionItem;

const briefing = (primary: ApertureAttentionItem, otherCritical: ApertureAttentionItem[]) => ({
  entryState: "returning", primary, otherCritical, otherAttention: [], readState: "complete", changed: [], inMotion: [], nextCheckpoint: null,
  changeHeading: "Current status", scopeNote: "", monitoringNote: "", quiet: false, quietMessage: null,
  baseline: { capturedAt: OCT_1, items: [] }, baselineToken: "t",
}) as unknown as ApertureAttentionBriefing;
const render = (b: ApertureAttentionBriefing) => load(renderToStaticMarkup(createElement(TodayAttentionBriefing, {
  attention: b, accountLabel: "Alpaca Paper", modeLabel: "Paper", loading: false, failed: null, onOpen: vi.fn(), onRetry: vi.fn(), onNewMission: vi.fn(),
})));
const occurrences = (text: string, needle: string) => text.split(needle).length - 1;

describe("Guided Today shows an approved order once", () => {
  it("does not repeat the order when an overdue review was the raw primary and the order was promoted to the lead (#23 + #34)", () => {
    const $ = render(briefing(review("MGM"), [approved("CSCO", 7)]));
    expect($("[data-attention-layout='primary']").text()).toContain("CSCO");
    expect($.text()).not.toContain("CSCO order:");
    // The review is still offered once, as the queue's overdue card.
    expect(occurrences($.text(), "MGM outcome review")).toBe(1);
  });

  it("still does not repeat the order when it is the raw primary", () => {
    const $ = render(briefing(approved("CSCO", 7), [review("MGM")]));
    expect($("[data-attention-layout='primary']").text()).toContain("CSCO");
    expect($.text()).not.toContain("CSCO order:");
  });

  it("keeps the queue card for an approved order that is not the lead", () => {
    const $ = render(briefing(finding, [approved("CSCO", 7), review("MGM")]));
    expect($("[data-attention-layout='primary']").text()).toContain("DKNG");
    expect($.text()).toContain("CSCO order: final checks pass");
  });

  it("queue on its own: leadKey decides what is already shown; omitted falls back to attention.primary", () => {
    const b = briefing(review("MGM"), [approved("CSCO", 7)]);
    const text = (leadKey?: string | null) => load(renderToStaticMarkup(createElement(GuidedDecisionQueue, { attention: b, onOpen: vi.fn(), leadKey })))("body").text();
    expect(text("order:7")).not.toContain("CSCO order:");
    expect(text(null)).toContain("CSCO order: final checks pass");
    expect(text(undefined)).toContain("CSCO order: final checks pass");
  });
});

import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ApertureAttentionBriefing, ApertureAttentionItem } from "../../shared/apertureAttention";
import { foldOverdueReviews, overdueReviewNudge } from "../../shared/overdueReviewNudge";
import { TodayAttentionBriefing } from "../../client/src/components/aperture/TodayAttentionBriefing";
import { GuidedDecisionQueue } from "../../client/src/components/aperture/GuidedDecisionQueue";

const mode = vi.hoisted(() => ({ guided: false }));
vi.mock("@/lib/trpc", () => ({ trpc: { aperture: { desk: { markSeen: { useMutation: () => ({ mutate: vi.fn() }) } } } } }));
vi.mock("@/contexts/ExperienceModeContext", () => ({ useExperienceMode: () => ({ mode: mode.guided ? "guided" : "pro", isGuided: mode.guided, isPro: !mode.guided, setMode: () => {}, toggleMode: () => {} }) }));

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

const OCT_1 = Date.UTC(2026, 9, 1, 16);
const review = (symbol: string, dueAt: number, over: Partial<ApertureAttentionItem> = {}): ApertureAttentionItem => ({
  key: `review:${symbol}`, kind: "review_due", critical: true, priority: 80, title: `${symbol} outcome review`,
  stateLabel: "Outcome Review Due", reason: "Check now.", consequence: "This is a human checkpoint.",
  actionLabel: "Review Recorded Outcome", href: `/aperture/review/${symbol}`, deadlineAt: dueAt, updatedAt: dueAt, ...over,
} as ApertureAttentionItem);
const order = { key: "order:7", kind: "ready_for_paper_review", critical: true, priority: 85, title: "Review the exact CSCO ticket", stateLabel: "Ready for paper review",
  reason: "A paper proposal exists.", consequence: "Review does not submit it.", actionLabel: "Review exact ticket", href: "/aperture/plays?inspect=7", deadlineAt: null } as ApertureAttentionItem;

describe("overdue reviews fold into one quiet nudge", () => {
  it("orders reviews oldest first and offers only the oldest review's action", () => {
    const nudge = overdueReviewNudge([review("DKNG", OCT_1 + 3_600_000), order, review("MGM", OCT_1), review("MGM", OCT_1)])!;
    expect(nudge.count).toBe(2);
    expect(nudge.next.key).toBe("review:MGM");
    expect(nudge.title).toBe("Reviews overdue · 2");
    expect(nudge.summary).toBe("Oldest: MGM outcome review · due Oct 1. Then 1 more: DKNG outcome review.");
    expect(nudge.actionLabel).toBe("Review Recorded Outcome");
    expect(overdueReviewNudge([order])).toBeNull();
    expect(overdueReviewNudge([review("MGM", OCT_1)])!.title).toBe("Review overdue");
  });

  it("removes reviews from the ranked lists and promotes the next real decision", () => {
    const { layout, overdue } = foldOverdueReviews({ primary: review("MGM", OCT_1), otherCritical: [review("DKNG", OCT_1 + 1), order], otherAttention: [] });
    expect(overdue?.count).toBe(2);
    expect(layout?.primary?.key).toBe("order:7");
    expect(layout?.otherCritical).toEqual([]);
    const none = { primary: order, otherCritical: [], otherAttention: [] };
    expect(foldOverdueReviews(none)).toEqual({ layout: none, overdue: null });
  });
});

const briefing = (over: Partial<ApertureAttentionBriefing> = {}) => ({
  entryState: "returning", primary: review("MGM", OCT_1), otherCritical: [review("DKNG", OCT_1 + 1)], otherAttention: [], readState: "complete",
  changed: [], inMotion: [], nextCheckpoint: null, changeHeading: "Current status", scopeNote: "", monitoringNote: "", quiet: false, quietMessage: null,
  baseline: { capturedAt: OCT_1, items: [{ key: "review:MGM", fingerprint: "fp-MGM" }, { key: "review:DKNG", fingerprint: "fp-DKNG" }] }, baselineToken: "t", ...over,
}) as ApertureAttentionBriefing;
const render = (b: ApertureAttentionBriefing) => load(renderToStaticMarkup(createElement(TodayAttentionBriefing, {
  attention: b, accountLabel: "Alpaca Paper", modeLabel: "Paper", loading: false, failed: null, onOpen: vi.fn(), onRetry: vi.fn(), onNewMission: vi.fn(),
})));

describe("Today shows one overdue-review card", () => {
  it("Pro mode: one quiet card with one action instead of a critical card per review", () => {
    mode.guided = false;
    const $ = render(briefing());
    expect($("[data-overdue-reviews]")).toHaveLength(1);
    expect($("[data-overdue-reviews] button")).toHaveLength(1);
    expect($("[data-overdue-reviews] button").text()).toBe("Review Recorded Outcome");
    expect($("[data-overdue-reviews]").text()).toContain("Reviews overdue · 2");
    expect($("[data-overdue-reviews]").text()).toContain("Nothing checks, orders or exits automatically.");
    expect($("[data-attention-layout='primary']")).toHaveLength(0);
    expect($.text()).not.toContain("Other critical issues");
  });

  it("Pro mode: a real decision keeps the lead and the reviews sit below it", () => {
    mode.guided = false;
    const $ = render(briefing({ otherCritical: [review("DKNG", OCT_1 + 1), order] }));
    expect($("[data-attention-layout='primary']").text()).toContain("CSCO");
    expect($("[data-overdue-reviews]")).toHaveLength(1);
    expect($.text()).not.toContain("Other critical issues");
  });

  it("Guided mode: the queue shows the same single card, not '30-Day Thesis Checkup Due', and the briefing does not repeat it", () => {
    mode.guided = true;
    const $ = render(briefing());
    expect($("[data-overdue-reviews]")).toHaveLength(0);
    expect($.text()).not.toContain("30-Day Thesis Checkup Due");
    const queue = load(renderToStaticMarkup(createElement(GuidedDecisionQueue, { attention: briefing(), onOpen: vi.fn() })));
    expect(queue.text()).toContain("Reviews overdue · 2");
    expect(queue.text()).toContain("Oldest: MGM outcome review · due Oct 1.");
    expect(queue("button").filter((_, el) => queue(el).text() === "Review Recorded Outcome")).toHaveLength(1);
    expect(queue.text()).not.toContain("Later");
  });
});

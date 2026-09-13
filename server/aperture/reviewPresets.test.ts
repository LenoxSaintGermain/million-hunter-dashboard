import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { isPresetReviewNote, monitoringReviewPresets } from "../../shared/monitoringReviewPresets";
const fixture = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { aperture: { monitor: { reviews: {
  list: { useQuery: () => ({ data: { receipts: [] }, refetch: vi.fn() }) },
  record: { useMutation: () => ({ mutate: fixture.mutate }) },
} } } } }));
import { MonitoringFindingReview } from "../../client/src/components/aperture/MonitoringFindingReview";
import { AttentionDecisionCard } from "../../client/src/components/aperture/AttentionDecisionCard";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
describe("review note presets remain drafts, not evidence", () => {
  it("offers bounded, distinct suggestions for every supported assessment", () => {
    expect(Object.keys(monitoringReviewPresets).sort()).toEqual(["needs_fresh_evidence", "resolved", "reviewed_unresolved"]);
    for (const options of Object.values(monitoringReviewPresets)) {
      expect(options).toHaveLength(2);
      for (const option of options) {
        expect(option.note.length).toBeGreaterThanOrEqual(10);
        expect(option.note.length).toBeLessThanOrEqual(85);
        expect(option.note).not.toMatch(/\$|https?:|guarantee|verified outcome|sold|position closed/i);
      }
    }
  });
  it("only recognizes an unedited template, never treats custom wording as replaceable", () => {
    const note = monitoringReviewPresets.reviewed_unresolved[0].note;
    expect(isPresetReviewNote(note)).toBe(true);
    expect(isPresetReviewNote(note + " Recheck after the announcement.")).toBe(false);
    expect(isPresetReviewNote("Done with this")).toBe(false);
    expect(isPresetReviewNote("")).toBe(false);
  });
  it("does not select an assessment, fill a note or save on render", () => {
    fixture.mutate.mockClear();
    const $ = load(renderToStaticMarkup(createElement(MonitoringFindingReview, { target: { runId: 1, candidateId: 2, orderId: 3, findingId: 4, findingVersion: "v1-00000001" } })));
    expect($("input[checked]")).toHaveLength(0);
    expect($("textarea").text()).toBe("");
    expect($("button").filter((_, node) => $(node).text() === "Save review").attr("disabled")).toBeDefined();
    expect(fixture.mutate).not.toHaveBeenCalled();
  });
});

const item = { key: "finding-4", kind: "monitoring_finding", title: "Review illustrative put", reason: "The recorded catalyst needs review.", consequence: "This uncertainty affects the selected put.", critical: true, stateLabel: "Unresolved · stale evidence", actionLabel: "Review what changed", href: "/aperture/run/1", evidence: { checkedAt: NaN, citations: [], finding: "Illustrative evidence text", rationale: "Illustrative protective put" } } as any;
describe("expanded attention cards do not duplicate the inline review", () => {
  for (const compact of [false, true]) it(`preserves blockers and the heading in ${compact ? "compact" : "primary"} view`, () => {
    const $ = load(renderToStaticMarkup(createElement(AttentionDecisionCard, { item, prominent: !compact, compact, reviewOpen: true, onOpen: vi.fn() })));
    expect($("h2,h3").text()).toBe(item.title);
    expect($.text()).toContain(item.reason);
    expect($.text()).toContain(item.consequence);
    expect($.text()).toContain("No source links recorded; finding unverified");
    expect($.text()).toContain("Check time not recorded");
    expect($("button[aria-expanded=true]").text()).toBe("Close review");
    expect($("details")).toHaveLength(0);
  });
  it("restores evidence access and the normal action when closed", () => {
    const $ = load(renderToStaticMarkup(createElement(AttentionDecisionCard, { item, reviewOpen: false, onOpen: vi.fn() })));
    expect($("details")).toHaveLength(1);
    expect($("button[aria-expanded=false]").text()).toBe("Review what changed");
  });
});

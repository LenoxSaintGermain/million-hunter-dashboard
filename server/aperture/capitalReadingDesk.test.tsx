import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import CapitalDeskPreview from "../../client/src/pages/aperture/CapitalDeskPreview";

const calls = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { aperture: { desk: { markSeen: { useMutation: () => ({ mutate: calls.mutate }) } } } } }));
vi.mock("@/components/HunterPublicShell", () => ({ HunterPublicShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("wouter", () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

describe("Capital reading desk production and public UAT contract", () => {
  it("renders the actual briefing components with explicit synthetic data and no writes", () => {
    const $ = load(renderToStaticMarkup(<CapitalDeskPreview />));
    expect($(".capital-briefing-spread")).toHaveLength(1);
    expect($(".capital-position-story")).toHaveLength(3);
    expect($(".capital-thesis-receipt")).toHaveLength(1);
    expect($.text()).toContain("illustrative composite records");
    expect($.text()).toContain("−$30.00");
    expect($.text()).toContain("Stale");
    expect($.text()).toContain("Buying power is not mission allocation");
    expect(calls.mutate).not.toHaveBeenCalled();
  });
  it("keeps the source warning visible while the long recovery list is folded", () => {
    const $ = load(renderToStaticMarkup(<CapitalDeskPreview />));
    const recovery = $(".capital-source-recovery");
    expect(recovery.find("details").attr("open")).toBeUndefined();
    recovery.find("details").remove();
    expect(recovery.text()).toContain("do not establish current monitoring eligibility");
  });
  it("never presents missing cluster capacity as zero risk or a live filter", () => {
    const source = readFileSync("client/src/components/aperture/DailyPlayList.tsx", "utf8");
    expect(source).toContain("Boundary not measured");
    expect(source).toContain("Needs a verified limit");
    expect(source).not.toContain('"0% committed"');
    expect(source).not.toContain("Live Screen Active");
    expect(source).toContain("Saved research filter");
  });
  it("explicitly disables preview persistence and inline provider-backed reviews", () => {
    const source = readFileSync("client/src/components/aperture/TodayAttentionBriefing.tsx", "utf8");
    expect(source).toContain("if (previewOnly || !read.canRecordSeen");
    expect(source).toContain("if (previewOnly) { onOpen(item.href); return; }");
    const preview = readFileSync("client/src/pages/aperture/CapitalDeskPreview.tsx", "utf8");
    expect(preview).not.toMatch(/useQuery|useMutation|fetch\(/);
    expect(preview).toContain("<TodayAttentionBriefing previewOnly");
    const app = readFileSync("client/src/App.tsx", "utf8");
    const offlineRoutes = app.match(/const isOfflineDemo = (\[[^;]+\])\.includes\(location\);/)?.[1];
    expect(offlineRoutes).toBeDefined();
    expect(JSON.parse(offlineRoutes!)).toContain("/walkthrough/capital-desk");
    expect(app).toContain("{!isOfflineDemo && <OnboardingGuard />}");
  });
});

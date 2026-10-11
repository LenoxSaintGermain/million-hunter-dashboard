import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { load } from "cheerio";
import type { MacroOddMarket } from "@shared/publicIntelligence";

vi.mock("@/lib/trpc", () => ({ trpc: {} }));
vi.mock("@/components/EditorialTopNav", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
import {
  FeedView,
  Probability,
  EventMarkets,
  GoodsServices,
} from "../client/src/pages/PublicIntelligence";

describe("Public Intelligence progressive disclosure", () => {
  const markets: MacroOddMarket[] = Array.from({ length: 13 }, (_, index) => ({
    id: String(index),
    question: `Market ${index + 1}`,
    slug: `market-${index}`,
    probabilityPct: 25,
    outcomeLabel: "Yes",
    outcomes: ["Yes", "No"],
    prices: ["0.25", "0.75"],
    volume: null,
    active: true,
    closed: false,
    url: "https://example.com",
  }));
  it("shows only three markets outside a closed native disclosure", () => {
    const $ = load(renderToStaticMarkup(<EventMarkets markets={markets} />));
    expect($('[role="meter"]').not('details [role="meter"]').length).toBe(3);
    expect($('details [role="meter"]').length).toBe(10);
    expect($("details").attr("open")).toBeUndefined();
    expect($("summary").text()).toBe("Show remaining 10 markets");
    expect($("details").text()).toContain("Market 13");
  });
  it.each([0, 1, 3])(
    "omits unnecessary market disclosure for %s markets",
    count => {
      const $ = load(
        renderToStaticMarkup(<EventMarkets markets={markets.slice(0, count)} />)
      );
      expect($("details").length).toBe(0);
      expect($('[role="meter"]').length).toBe(count);
    }
  );
  it("keeps complete goods and services text behind a closed native disclosure", () => {
    const text =
      "Long source description\n".repeat(300) + "Final source sentence.";
    const $ = load(renderToStaticMarkup(<GoodsServices text={text} />));
    expect($("details").attr("open")).toBeUndefined();
    expect($("summary").text()).toBe("Goods and services");
    expect($("details p").text()).toBe(text);
  });
});

describe("Public Intelligence frontend truth states", () => {
  const feed = {
    status: "ok" as const,
    data: ["record"],
    source: "Test source",
    sourceUrl: "https://example.com/source",
    fetchedAt: "2026-10-11T12:00:00Z",
    attemptedAt: "2026-10-11T12:00:00Z",
    message: null,
  };
  const query = {
    data: feed,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  };
  const render = (overrides = {}) =>
    renderToStaticMarkup(
      <FeedView<string[]> query={{ ...query, ...overrides }}>
        {data => <div>PAYLOAD:{data.join(",")}</div>}
      </FeedView>
    );

  it("shows source provenance and fetched timestamp", () => {
    const html = render();
    expect(html).toContain('href="https://example.com/source"');
    expect(html).toContain('dateTime="2026-10-11T12:00:00Z"');
    expect(html).toContain("PAYLOAD:record");
    expect(html).toContain("Provider attempt:");
    expect(html).toContain("Refresh may use a cached response; timestamps show the provider fetch.");
    expect(html).not.toContain("Last attempt:");
  });
  it("does not misrepresent a transport error as an empty result or show old data as current", () => {
    const html = render({ error: { message: "Connection failed" } });
    expect(html).toContain("Source unavailable");
    expect(html).toContain("Connection failed");
    expect(html).toContain("Retry");
    expect(html).not.toContain("PAYLOAD");
  });
  it("distinguishes unavailable, empty, unknown and stale responses", () => {
    expect(
      render({ data: { ...feed, status: "unavailable", data: null } })
    ).toContain("Source unavailable");
    expect(render({ data: { ...feed, status: "empty", data: [] } })).toContain(
      "No matching records returned"
    );
    expect(render({ data: undefined })).toContain("Unknown — no verified data");
    const stale = render({ data: { ...feed, status: "stale" } });
    expect(stale).toContain("Stale data — not current");
    expect(stale).toContain("PAYLOAD:record");
    expect(stale).toContain("Retry");
  });
  it("blocks unsafe source URLs", () => {
    expect(
      render({ data: { ...feed, sourceUrl: "javascript:alert(1)" } })
    ).not.toContain("href=");
  });
  it.each([null, NaN, Infinity, -1, 101])(
    "does not chart invalid probability %s",
    value => {
      const html = renderToStaticMarkup(
        <Probability value={value} outcome="Yes" />
      );
      expect(html).toContain("Probability unknown");
      expect(html).not.toContain('role="meter"');
    }
  );
  it.each([0, 42.5, 100])(
    "charts valid probability %s with its outcome",
    value => {
      const html = renderToStaticMarkup(
        <Probability value={value} outcome="No" />
      );
      expect(html).toContain('role="meter"');
      expect(html).toContain(`aria-valuetext="No: ${value}%"`);
    }
  );
  it("does not chart a probability with an unknown outcome", () => {
    expect(
      renderToStaticMarkup(<Probability value={50} outcome={null} />)
    ).not.toContain('role="meter"');
  });
  it("keeps query panels scoped to active tabs and searches deliberate", () => {
    const source = readFileSync(
      new URL("../client/src/pages/PublicIntelligence.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toContain('activeTab === "macro_odds" && <MacroOdds');
    expect(source).not.toContain("text-[var(--clay)]");
    expect(source).toContain("text-[var(--sh-text-secondary)]");
    expect(source).toContain('activeTab === "forex" && <Forex');
    expect(source).toContain("activeTab === kind && <SearchFeed");
    for (const kind of ["trademarks", "contractors", "sec"])
      expect(source).toContain(
        `enabled: kind === "${kind}" && Boolean(submitted)`
      );
    expect(source).toContain("const term = input.trim()");
    expect(source).toContain('type="submit"');
    expect(source).not.toMatch(
      /100% Free|14M\+|10,400|Active Profile|On File|PendingActive|Real-time/
    );
  });
});

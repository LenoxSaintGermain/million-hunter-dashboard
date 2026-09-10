import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FindingEvidence } from "../../client/src/components/aperture/AttentionDecisionCard";
vi.stubGlobal("React", React);

const render = (finding: string, citations = ["https://example.org/announcement"]) =>
  renderToStaticMarkup(createElement(FindingEvidence, { evidence: {
    checkedAt: Date.UTC(2026, 8, 9), rationale: "Recorded rationale", finding, citations,
  } }));

describe("finding evidence rendering", () => {
  it("renders recorded emphasis without changing the evidence or review boundary", () => {
    const html = render("A **reported catalyst** remains *unverified*.[1]");
    expect(html).toContain("<strong>reported catalyst</strong>");
    expect(html).toContain("<em>unverified</em>");
    expect(html).toContain("[1]");
    expect(html).toContain("Opening evidence does not acknowledge or resolve");
    expect(html).not.toContain("<button");
  });
  it("never embeds provider HTML or remote images", () => {
    const html = render('<img src="https://example.org/tracker" onerror="alert(1)">\n\n![remote](https://example.org/pixel)\n\n<script>alert(1)</script>');
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).not.toContain('src="https://');
  });
  it("retains unsafe source slots as unavailable without exposing active URLs", () => {
    const html = render("Claims [1][2]", ["javascript:alert(1)", "https://example.org/second"]);
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("Source 1 · link unavailable");
    expect(html).toContain("Source 2");
    expect(html).toContain('href="https://example.org/second"');
  });
  it("does not turn an unsafe inline Markdown URL into an active link", () => {
    const html = render("[bad](javascript:alert%281%29) and [good](https://example.org/report)");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('href="https://example.org/report"');
  });
});

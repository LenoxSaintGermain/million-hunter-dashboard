import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CashFlowBridgeCard } from "../client/src/components/landing/CashFlowBridgeCard";
import { BoundedRiskGaugeCard } from "../client/src/components/landing/BoundedRiskGaugeCard";
import { UnifiedDeskHero } from "../client/src/components/landing/UnifiedDeskHero";

// Mock wouter Link
vi.mock("wouter", () => ({
  Link: ({ children, href, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock trpc
vi.mock("@/lib/trpc", () => ({
  trpc: {
    publicAccess: {
      requestAccess: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
          isSuccess: false,
          isError: false,
          error: null,
        }),
      },
    },
  },
}));

import LandingPage from "../client/src/pages/LandingPage";

describe("LandingPage front door architecture", () => {
  it("renders the primary institutional headline and thesis", () => {
    const html = renderToStaticMarkup(<LandingPage />);
    expect(html).toContain("Know Your Downside Before Capital Moves.");
    expect(html).toContain("The Bounded Capital Operating System");
    expect(html).toContain("Signal Hunter bounds risk and stress-tests assumptions upstream of execution");
  });

  it("features both distinct operating desks without competing for oxygen", () => {
    const html = renderToStaticMarkup(<LandingPage />);
    // Acquisition Desk portal
    expect(html).toContain("Acquisition Diligence Desk");
    expect(html).toContain("Desk A · For Searchers, Independent Sponsors &amp; Family Offices");
    expect(html).toContain("EBITDA-to-Cash-Flow Erosion");
    expect(html).toContain("DSCR Covenant Stress Testing");
    expect(html).toContain("Pre-QoE Red Team Memo");

    // Capital Aperture portal
    expect(html).toContain("Capital Aperture Desk");
    expect(html).toContain("Desk B · For Professional Allocators, Portfolio Managers &amp; Macro Desks");
    expect(html).toContain("Concentrated Sizing Boundaries");
    expect(html).toContain("Binding Invalidation Triggers");
    expect(html).toContain("Asymmetric Risk/Reward");
  });

  it("renders the Cash Flow Bridge artifact with reported SDE, deductions, and DSCR covenants", () => {
    const html = renderToStaticMarkup(<CashFlowBridgeCard />);
    expect(html).toContain("Acquisition Desk · 104-Unit Route");
    expect(html).toContain("$650,000"); // Reported SDE
    expect(html).toContain("−$65,000"); // Replacement GM wage
    expect(html).toContain("−$42,000"); // Deferred CapEx
    expect(html).toContain("−$35,000"); // Churn risk buffer
    expect(html).toContain("$508,000"); // Bankable FCF
    expect(html).toContain("1.34x");    // Baseline DSCR
    expect(html).toContain("Pass: 1.34x DSCR");
    expect(html).toContain("Covenant Intact");
    expect(html).toContain("Stress Test: Top-Line Compression");
  });

  it("renders the Bounded Risk Gauge artifact with sizing triad, invalidation trigger, and downside stop", () => {
    const html = renderToStaticMarkup(<BoundedRiskGaugeCard />);
    expect(html).toContain("Capital Aperture · Concentrated Allocation");
    expect(html).toContain("$12,500"); // Modeled sizing
    expect(html).toContain("$10K – $15K"); // Target band
    expect(html).toContain("$15,000"); // Max thesis ceiling
    expect(html).toContain("Thesis Invalidation Trigger");
    expect(html).toContain("Volume collapse &amp; closing print below 20-DMA ($42.10)");
    expect(html).toContain("−$1,649"); // Downside at stop
    expect(html).toContain("1.65%"); // Portfolio risk
    expect(html).toContain("(2.0% Cap)");
  });

  it("presents the 4 Epistemic States shared DNA", () => {
    const html = renderToStaticMarkup(<LandingPage />);
    expect(html).toContain("A Claim Is Not a Conclusion.");
    expect(html).toContain("01 · Reported");
    expect(html).toContain("02 · Modeled");
    expect(html).toContain("03 · Corroborated");
    expect(html).toContain("04 · Unknown");
    expect(html).toContain("Unknown is NEVER treated as zero or assumed to pass");
  });

  it("showcases the newly deployed Deal Document Intake Engine", () => {
    const html = renderToStaticMarkup(<LandingPage />);
    expect(html).toContain("Bring Your Own Deal Documents.");
    expect(html).toContain("Secure Tenant Upload &amp; Private Storage");
    expect(html).toContain("Page-Linked Citation &amp; OCR Extraction");
    expect(html).toContain("Upstream Pre-QoE Red Team Audit");
    expect(html).toContain("Supported Intake Documents");
    expect(html).toContain("Confidential Information Memorandums (CIM)");
  });

  it("provides qualified operator qualification form and institutional routing", () => {
    const html = renderToStaticMarkup(<LandingPage />);
    expect(html).toContain("Bring a Decision Worth Testing.");
    expect(html).toContain("Operator mandate / role");
    expect(html).toContain("Target capital / deal size");
    expect(html).toContain("Current deal, mandate, or thesis criteria");
    expect(html).toContain('href="/walkthrough"');
    expect(html).toContain('href="/walkthrough/capital-desk"');
    expect(html).toContain('href="/pricing"');
    expect(html).toContain('href="/sign-in"');
  });

  it("contains zero fabricated testimonials, synthetic customer quotes, or fake logos", () => {
    const html = renderToStaticMarkup(<LandingPage />);
    // Check against fabricated claims
    expect(html).not.toContain("5.0 stars");
    expect(html).not.toContain("Trusted by 10,000");
    expect(html).not.toContain("customer reviews");
    expect(html).not.toContain("Wall Street Journal");
    expect(html).not.toContain("Forbes");
    // Ensure all examples are clearly labeled as illustrative/composite
    expect(html).toContain("Illustrative — composite 104-unit route deal, not a real customer.");
    expect(html).toContain("Illustrative — composite options fixture, not an investment recommendation.");
  });
});

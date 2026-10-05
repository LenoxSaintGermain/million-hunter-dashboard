import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CashFlowBridgeCard } from "../client/src/components/landing/CashFlowBridgeCard";
import { BoundedRiskGaugeCard } from "../client/src/components/landing/BoundedRiskGaugeCard";
import { UnifiedDeskHero } from "../client/src/components/landing/UnifiedDeskHero";
import { HeroReconciliationHUD } from "../client/src/components/landing/HeroReconciliationHUD";
import { DocumentaryBridge } from "../client/src/components/landing/DocumentaryBridge";
import { DialecticScrollytelling } from "../client/src/components/landing/DialecticScrollytelling";
import { CaseStudySandbox } from "../client/src/components/landing/CaseStudySandbox";
import { OperatorAccessGate } from "../client/src/components/landing/OperatorAccessGate";

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

describe("LandingPage: The Sovereign Desk Architecture", () => {
  it("renders Section 1: Hero Canvas with exact Sovereign Desk positioning and copy", () => {
    const html = renderToStaticMarkup(<LandingPage />);
    // Kicker
    expect(html).toContain("DECISION ARCHITECTURE FOR PRINCIPALS &amp; ALLOCATORS");
    // Headline
    expect(html).toContain("Where high-stakes capital sets its boundaries.");
    // Subhead
    expect(html).toContain(
      "Before you sign a personal guarantee or commit a concentrated position, Signal Hunter pressure-tests claims, uncovers structural fragility, and enforces downside limits."
    );
    // Primary CTAs
    expect(html).toContain("Enter Operator Sandbox");
    expect(html).toContain("Request Desk Access");
  });

  it("renders Section 1 Visual Artifact: HeroReconciliationHUD with both desk states", () => {
    const hudHtml = renderToStaticMarkup(<HeroReconciliationHUD />);
    // Segmented tab selectors
    expect(hudHtml).toContain("Private Deal Diligence");
    expect(hudHtml).toContain("Capital Aperture");
    // State A: Private M&A mini Reconciliation HUD
    expect(hudHtml).toContain("RECONCILIATION HUD · 104-UNIT ROUTE");
    expect(hudHtml).toContain("BROKER CLAIM");
    expect(hudHtml).toContain("$650,000");
    expect(hudHtml).toContain("(92% Recurring Claim)");
    expect(hudHtml).toContain("SIGNAL AUDIT");
    expect(hudHtml).toContain("$508,000");
    expect(hudHtml).toContain("(68% True Contracted)");
    expect(hudHtml).toContain("-21.8% Multiple Adjustment");
    expect(hudHtml).toContain("1.34x (Min 1.25x)");
    expect(hudHtml).toContain("Replacement GM Wage");
    expect(hudHtml).toContain("Deferred Fleet CapEx");
    expect(hudHtml).toContain("Contract Drift Buffer");
  });

  it("renders Section 2: Documentary Bridge ('Where Math Meets Asphalt') with inspectable pins & field note", () => {
    const docHtml = renderToStaticMarkup(<DocumentaryBridge />);
    expect(docHtml).toContain("Where Math Meets Asphalt.");
    expect(docHtml).toContain("Documentary Field Report · Ground Truth");
    expect(docHtml).toContain("Spreadsheets accept any number you feed them.");

    // Inspectable crosshairs pins on canvas
    expect(docHtml).toContain("Pin 1 · Fleet Line");
    expect(docHtml).toContain("Pin 2 · Dispatch Office Window");
    expect(docHtml).toContain("14/18 Vehicles &gt; 160k Miles");
    expect(docHtml).toContain("Est. CapEx: $140,000 | Add-Back Status: REJECTED");

    // Operator Field Note sidebar & Prime Directive 1 attribution
    expect(docHtml).toContain("OPERATOR FIELD NOTE");
    expect(docHtml).toContain("The broker swore customer retention was 94%.");
    expect(docHtml).toContain("Marcus V. · Self-Funded Searcher");
    expect(docHtml).toContain("Composite Deal Audit");
    expect(docHtml).toContain("Prime Directive 1 Verified");
  });

  it("renders Section 3: The Two Desks (EBITDA Erosion Waterfall & Alignment Portrait)", () => {
    const html = renderToStaticMarkup(<LandingPage />);
    // Desk I
    expect(html).toContain("Desk I · Private M&amp;A &amp; Buyout Diligence");
    expect(html).toContain("The Cash Flow Waterfall");
    expect(html).toContain("Brokers sell pro-forma optimism. Operators inherit fixed costs.");
    expect(html).toContain("Underwritten DSCR: 1.34x (Min Covenant: 1.25x) [PASS]");

    // Desk II
    expect(html).toContain("Desk II · Capital Aperture (Liquid Allocation)");
    expect(html).toContain("The Framer Alignment Portrait");
    expect(html).toContain("An idea is just an opinion until you define the exact invalidation line.");
    expect(html).toContain("Invalidation: $42.10 | Max Downside: 1.8% NAV [BOUNDED]");
  });

  it("renders CashFlowBridgeCard with exact waterfall math", () => {
    const bridgeHtml = renderToStaticMarkup(<CashFlowBridgeCard />);
    expect(bridgeHtml).toContain("The Cash Flow Bridge");
    expect(bridgeHtml).toContain("$650,000");
    expect(bridgeHtml).toContain("−$65,000");
    expect(bridgeHtml).toContain("−$42,000");
    expect(bridgeHtml).toContain("−$35,000");
    expect(bridgeHtml).toContain("$508,000");
    expect(bridgeHtml).toContain("Pass: 1.34x DSCR");
  });

  it("renders BoundedRiskGaugeCard with exact risk limits and invalidation price", () => {
    const gaugeHtml = renderToStaticMarkup(<BoundedRiskGaugeCard />);
    expect(gaugeHtml).toContain("The Bounded Risk Gauge");
    expect(gaugeHtml).toContain("$12,500");
    expect(gaugeHtml).toContain("$10K – $15K");
    expect(gaugeHtml).toContain("$42.10");
    expect(gaugeHtml).toContain("Mandate Compliant");
  });

  it("renders Section 4: Dialectic Scrollytelling with Ingestion, Triangulation, and 3x3 DSCR Grid", () => {
    const dialecticHtml = renderToStaticMarkup(<DialecticScrollytelling />);
    expect(dialecticHtml).toContain("The Auditable Engine · 3-Step Dialectic");
    expect(dialecticHtml).toContain("A Claim Is Not a Conclusion.");

    // Step 01 Ingestion
    expect(dialecticHtml).toContain("01");
    expect(dialecticHtml).toContain("Ingestion &amp; Citation");
    expect(dialecticHtml).toContain("Extract Claims With Deterministic Bounding Boxes");
    expect(dialecticHtml).toContain("CONFIDENTIAL_OFFERING_MEMORANDUM.PDF");
    expect(dialecticHtml).toContain("BBOX #1 · CLAIMED EARNINGS");
    expect(dialecticHtml).toContain("json.reported_sde: 650000");

    // Step 02 & Step 03 selector pills
    expect(dialecticHtml).toContain("02");
    expect(dialecticHtml).toContain("Epistemic Triangulation");
    expect(dialecticHtml).toContain("03");
    expect(dialecticHtml).toContain("Downside Stress Testing");
  });

  it("renders Section 5: Case Study Sandbox with live session indicator and calculation", () => {
    const sandboxHtml = renderToStaticMarkup(<CaseStudySandbox />);
    expect(sandboxHtml).toContain("LOCAL DEMO SESSION · LIVE CALCULATION ACTIVE");
    expect(sandboxHtml).toContain("Apex Commercial Cleaning Services, LLC");
    expect(sandboxHtml).toContain("Target Case GT-001");
    expect(sandboxHtml).toContain("Simulate Revenue Shock");
    expect(sandboxHtml).toContain("Enter Full Diligence Walkthrough");
  });

  it("renders Section 5: Operator Access Gate single-column form with sovereign guarantee", () => {
    const gateHtml = renderToStaticMarkup(<OperatorAccessGate />);
    expect(gateHtml).toContain("Request Sovereign Desk Access");
    expect(gateHtml).toContain("Operating Desk Type *");
    expect(gateHtml).toContain("Current Target Asset Class *");
    expect(gateHtml).toContain("Sovereignty Guarantee:");
    expect(gateHtml).toContain(
      "Your deal documents and theses are never stored, syndicated, or used for model training."
    );
  });
});

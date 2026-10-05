import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CashFlowBridgeCard } from "../client/src/components/landing/CashFlowBridgeCard";
import { BoundedRiskGaugeCard } from "../client/src/components/landing/BoundedRiskGaugeCard";
import { CenturionHeroHeader } from "../client/src/components/landing/CenturionHeroHeader";
import { HeroReconciliationHUD } from "../client/src/components/landing/HeroReconciliationHUD";
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

describe("LandingPage: Centurion Hero & Sovereign Desk Architecture", () => {
  it("renders Section 1: Centurion Hero Header with exact pairing and manifesto hook", () => {
    const html = renderToStaticMarkup(<LandingPage />);
    // Kicker
    expect(html).toContain("DECISION ARCHITECTURE FOR PRINCIPALS &amp; ALLOCATORS");
    // Headline Pairing
    expect(html).toContain("Brokers sell EBITDA. Operators inherit the floor.");
    // Hook / One-Line Manifesto
    expect(html).toContain(
      "Signal Hunter is the sovereign due diligence operating system that stress-tests assumptions, reconciles broker claims against bankable cash, and bounds your downside before you sign."
    );
    // Primary CTAs
    expect(html).toContain("Enter Operator Sandbox");
    expect(html).toContain("Explore Diligence Desk");
    expect(html).toContain("Request Desk Access");
  });

  it("renders CenturionHeroHeader 21:9 letterbox frame with glowing crosshair HUD and failure points", () => {
    const heroHtml = renderToStaticMarkup(<CenturionHeroHeader />);
    // Image source
    expect(heroHtml).toContain('src="/industrial-depot-yard.png"');
    // HUD Telemetry
    expect(heroHtml).toContain("SYS.HUD // REV 2.4.8");
    expect(heroHtml).toContain("DILIGENCE SCAN: ACTIVE");
    // Three Failure Points on canvas and switcher
    expect(heroHtml).toContain("Fleet Line CapEx");
    expect(heroHtml).toContain("Key-Person Dispatch Desk");
    expect(heroHtml).toContain("Depot Lease Escalation");
    // Initial active failure point inspection contents
    expect(heroHtml).toContain("Add-Back: REJECTED");
    expect(heroHtml).toContain("14 of 18 Service Vans Exceed 160,000 Miles");
    // Telemetry bottom bar
    expect(heroHtml).toContain("VERIFIED DOWNSIDE FLOOR");
    expect(heroHtml).toContain("$508,000 FCF");
    expect(heroHtml).toContain("1.34x Coverage");
  });

  it("renders Section 2: The Two Desks (EBITDA Erosion Waterfall & Alignment Portrait)", () => {
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

  it("renders Section 3: Dialectic Scrollytelling with Ingestion, Triangulation, and 3x3 DSCR Grid", () => {
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

  it("renders Section 4: Case Study Sandbox with live session indicator and calculation", () => {
    const sandboxHtml = renderToStaticMarkup(<CaseStudySandbox />);
    expect(sandboxHtml).toContain("LOCAL DEMO SESSION · LIVE CALCULATION ACTIVE");
    expect(sandboxHtml).toContain("Apex Commercial Cleaning Services, LLC");
    expect(sandboxHtml).toContain("Target Case GT-001");
    expect(sandboxHtml).toContain("Simulate Revenue Shock");
    expect(sandboxHtml).toContain("Enter Full Diligence Walkthrough");
  });

  it("renders Section 4: Operator Access Gate single-column form with sovereign guarantee", () => {
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

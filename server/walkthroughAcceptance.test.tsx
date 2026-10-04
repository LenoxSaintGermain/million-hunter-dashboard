import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Walkthrough from "../client/src/pages/Walkthrough";

describe("TSL-BUILD-2026-006: Bulletproof Solo Walkthrough Acceptance", () => {
  it("renders the persistent progress header with all 8 stages", () => {
    const html = renderToStaticMarkup(<Walkthrough />);
    expect(html).toContain("Signal Hunter OS");
    expect(html).toContain("Interactive Walkthrough");
    expect(html).toContain("Step 1 of 8");

    // All 8 step pills
    expect(html).toContain("Problem");
    expect(html).toContain("What");
    expect(html).toContain("Landmine");
    expect(html).toContain("Engine");
    expect(html).toContain("Data");
    expect(html).toContain("Backtest");
    expect(html).toContain("Value");
    expect(html).toContain("CTA");
  });

  it("Step 1 establishes the diligence cost problem and pre-closing stakes", () => {
    const html = renderToStaticMarkup(<Walkthrough />);
    expect(html).toContain("Most capital allocations fail");
    expect(html).toContain("before they close");
    expect(html).toContain("$40–100K+");
    expect(html).toContain("Average diligence waste");
    expect(html).toContain("7 months");
    expect(html).toContain("Average time to uncover a fatal flaw");
    expect(html).toContain("70–90%");
  });

  it("contains zero live network hooks, trpc queries, or auth wall dependencies", async () => {
    // Audit the file content of Walkthrough.tsx directly to enforce zero API calls and zero auth hooks
    const fs = await import("fs");
    const path = await import("path");
    const walkthroughSource = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/Walkthrough.tsx"),
      "utf8"
    );

    expect(walkthroughSource).not.toContain("trpc.");
    expect(walkthroughSource).not.toContain("useQuery");
    expect(walkthroughSource).not.toContain("useMutation");
    expect(walkthroughSource).not.toContain("fetch(");
    expect(walkthroughSource).not.toContain("axios");
  });

  it("explicitly labels all demo fixtures as composite and illustrative", () => {
    const html = renderToStaticMarkup(<Walkthrough />);
    // Verify footer disclaimer
    expect(html).toContain(
      "All demos in this walkthrough are pre-computed on composite sample deals and make zero live API calls."
    );
    expect(html).toContain("No login required. No data collected.");
  });

  it("enforces Prime Directive 1 (no fake customer quotes, logos, or fabricated testimonials)", async () => {
    const html = renderToStaticMarkup(<Walkthrough />);
    const lowerHtml = html.toLowerCase();
    expect(lowerHtml).not.toContain("testimonial");
    expect(lowerHtml).not.toContain("customer review");
    expect(lowerHtml).not.toContain("5 stars");
    expect(lowerHtml).not.toContain("rated 5/5");
    expect(lowerHtml).not.toContain("trusted by 10,000+");
    expect(lowerHtml).not.toContain("verified buyer");
  });

  it("Step 3 landmine fixture includes the critical Amazon fulfillment lease cliff", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const walkthroughSource = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/Walkthrough.tsx"),
      "utf8"
    );

    // Verifies the core landmine narrative
    expect(walkthroughSource).toContain("Sunbelt Commercial Cleaning Co.");
    expect(walkthroughSource).toContain("Amazon fulfillment center");
    expect(walkthroughSource).toContain("lease expires in 11 months");
    expect(walkthroughSource).toContain("$816K in annual revenue evaporates");
    expect(walkthroughSource).toContain("The engine flagged it in seconds.");
  });

  it("Step 5 addresses data sourcing via off-market insight layer rather than generic scraping", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const walkthroughSource = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/Walkthrough.tsx"),
      "utf8"
    );

    expect(walkthroughSource).toContain("The data everyone sees — and the signals they miss.");
    expect(walkthroughSource).toContain("Public data layer — what everyone has");
    expect(walkthroughSource).toContain("The insight layer — what the engine surfaces");
    expect(walkthroughSource).toContain("Perplexity Sonar Pro");
    expect(walkthroughSource).toContain("Honest about sourcing");
  });

  it("Step 6 provides audited backtest cases with honest gap disclosure (3 of 4 caught, 1 missed)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const walkthroughSource = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/Walkthrough.tsx"),
      "utf8"
    );

    expect(walkthroughSource).toContain("Tested against deals that actually failed.");
    expect(walkthroughSource).toContain("Southeast HVAC Co.");
    expect(walkthroughSource).toContain("Midwest Logistics Broker");
    expect(walkthroughSource).toContain("Gulf Coast Pest Control");
    expect(walkthroughSource).toContain("Atlanta Staffing Agency");
    expect(walkthroughSource).toContain("3 of 4 documented failure modes caught");
    expect(walkthroughSource).toContain("undisclosed litigation");
  });

  it("Step 8 CTA functions as an optional doorway to live suite, not a blocking wall", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const walkthroughSource = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/Walkthrough.tsx"),
      "utf8"
    );

    expect(walkthroughSource).toContain("Ready to run your own pipeline?");
    expect(walkthroughSource).toContain("Enter the live suite");
    expect(walkthroughSource).toContain(
      "Deterministic demo rails remain permanently accessible without login."
    );
  });
});

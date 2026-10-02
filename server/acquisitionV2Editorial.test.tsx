import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { evaluateAcquisitionV2, extractListingEvidence, exampleMandate } from "../shared/acquisitionV2";
const fixture = vi.hoisted(() => ({ rows: [] as any[] }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { scan: {
  getV2State: { useQuery: () => ({ data: { state: "completed", capturesSaved: true, captures: fixture.rows, mandate: { version: "illustrative" }, approvedAt: "2026-09-30T12:00:00Z" } }) },
  getV2Report: { useQuery: () => ({ data: fixture.rows }) },
} } }));
import { AcquisitionV2Report, financialReading } from "../client/src/components/AcquisitionV2Report";
const evidence = (text: string) => extractListingEvidence({ text, url: "https://example.org/illustrative", fetchedAt: "2026-09-30T12:00:00Z", type: "primary" });
it("renders an editorial receipt without treating blank worksheet costs as zero", () => {
  fixture.rows = [{ url: "https://example.org/illustrative", stale: false, report: evaluateAcquisitionV2(evidence("Asking Price: $1,850,000\nSDE: $702,537\nRevenue: $2,100,000"), exampleMandate) }];
  const html = renderToStaticMarkup(<AcquisitionV2Report jobId={1}/>);
  expect(html).toContain("The story has gaps.");
  expect(html).toContain("The analytical margin");
  expect(html).toContain("Price fits. Value is still unproven.");
  expect(html).toContain("Source &amp; calculation");
  expect(html).toContain('aria-label="Screening checks"');
  expect(html).toContain('aria-label="Rule check status breakdown"');
  expect(html).toContain("Unavailable detectors have not run.");
  expect(html).toContain("Select a check. Read its basis.");
  expect(html).toContain("Incomplete subtotal. Blank costs are still unknown.");
  expect(html).toContain("Exclude this cost · $0");
  expect(html).toContain("Explicit local assumption");
  expect(html).toContain("5 assumptions to resolve");
  expect(html).toContain('aria-label="Replace the owner annual dollars"');
  expect(html).toContain('placeholder="Pencil in"');
  expect(html).toContain('type="checkbox" disabled=""');
  expect(html).not.toContain("What if the protections held?");
});
it("interprets each selection from captured inputs, preserving missing and outside-mandate states", () => {
  const report = evaluateAcquisitionV2(evidence("Asking Price: $1,850,000\nSDE: $702,537\nRevenue: $2,100,000"), exampleMandate);
  expect(financialReading(report, "ask").metric).toBe("2.63×");
  expect(financialReading(report, "sde").metric).toBe("$102,537");
  expect(financialReading(report, "revenue").metric).toBe("33.5%");
  const missing = evaluateAcquisitionV2(evidence("Revenue: $2,100,000"), exampleMandate);
  expect(financialReading(missing, "ask").metric).toBe("Unresolved");
  expect(financialReading(missing, "revenue").metric).toBe("Unresolved");
  const below = evaluateAcquisitionV2(evidence("Asking Price: $4,000,000\nSDE: $500,000"), exampleMandate);
  expect(financialReading(below, "ask").title).toContain("outside");
  expect(financialReading(below, "sde").label).toContain("Below");
});
it("keeps unresolved source captures visible without manufacturing a ledger", () => {
  fixture.rows = [{ url: "https://example.org/illustrative", state: "unresolved", reason: "Source blocked", stale: true, report: null }];
  const html = renderToStaticMarkup(<AcquisitionV2Report jobId={1}/>);
  expect(html).toContain("The source could not");
  expect(html).toContain("Source blocked");
  expect(html).toContain("Saved evidence is stale.");
  expect(html).not.toContain("Annual cash worksheet");
});
it("keeps cleared rules filled and unavailable detectors separate without opening a redundant detail", () => {
  const report = evaluateAcquisitionV2(evidence("Asking Price: $1,850,000\nSDE: $702,537\nRevenue: $2,100,000\nListing status: Active\nSBA eligible: Yes\nManagement team in place\nLargest customer: 12%\nTop 3 customers: 25%\nRecurring contracts: Yes"), exampleMandate);
  expect(report.verdict.value).toBe("PURSUE");
  fixture.rows = [{ url: report.source.url, stale: false, report }];
  const html = renderToStaticMarkup(<AcquisitionV2Report jobId={1}/>);
  expect(html).toContain('data-result="pass"');
  expect(html).toContain('data-result="unavailable"');
  expect(html).not.toContain('class="v2-gate-focus"');
  expect(html).toContain("Unavailable detectors");
});

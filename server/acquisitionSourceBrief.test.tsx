import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { AcquisitionSourceBrief } from "../client/src/components/AcquisitionSourceBrief";
it("labels a missing listing source without implying verified financials", () => {
  const html = renderToStaticMarkup(<AcquisitionSourceBrief />);
  expect(html).toContain("Listing source missing");
  expect(html).not.toContain("href=");
});
it("makes a direct source inspectable but never calls its claims verified", () => {
  const html = renderToStaticMarkup(<AcquisitionSourceBrief listingUrl="https://example.com/fixture" description="Illustrative discovery note" />);
  expect(html).toContain('href="https://example.com/fixture"');
  expect(html).toContain("not independently verified");
  expect(html).toContain("Discovery record");
});
it("does not render an unsafe source URL or present a fixture as a real deal", () => {
  const html = renderToStaticMarkup(<AcquisitionSourceBrief listingUrl="javascript:alert(1)" isSynthetic />);
  expect(html).not.toContain("href=");
  expect(html).toContain("Illustrative record");
});

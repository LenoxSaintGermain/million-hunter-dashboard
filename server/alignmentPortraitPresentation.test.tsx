import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AlignmentPortrait } from "../client/src/components/AlignmentPortrait";
import type { AlignmentMeasure } from "../shared/alignmentPortrait";

const row: AlignmentMeasure = {
  id: "cash", label: "Annual cash", value: 506000, min: 300000, max: 1000000,
  unit: "usd", basis: "reported", wanted: "Document recurring cash",
  explanation: "Seller-reported, not independently verified.",
};
const render = (measure: AlignmentMeasure, stale = false) => renderToStaticMarkup(
  <AlignmentPortrait title="Test entity" subtitle="Illustrative fixture" measures={[measure]} stale={stale} />,
);

describe("shared portrait truth and disclosure", () => {
  it("keeps reported values distinct from corroboration", () => {
    const html = render(row);
    expect(html).toContain('data-basis="reported"');
    expect(html).toContain("reported · within target");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls=');
    expect(html).toContain("never a quality score");
  });
  it.each([null, NaN, Infinity])("renders %s as a wanted condition, not zero or fact", value => {
    const html = render({ ...row, value });
    expect(html).toContain("Document recurring cash");
    expect(html).toContain("Wanted · evidence needed");
    expect(html).not.toContain('class="portrait-point"');
    expect(html).not.toContain("$0");
  });
  it("does not draw a target for incomplete bounds", () => {
    expect(render({ ...row, max: undefined })).not.toContain('class="portrait-band"');
    expect(render({ ...row, max: undefined })).toContain("no complete target range");
  });
  it("preserves stale snapshot warnings", () => {
    expect(render(row, true)).toContain("Saved snapshot is stale");
  });
});

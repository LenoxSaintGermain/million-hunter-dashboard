import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { DeskGlanceLayer } from "../../client/src/components/aperture/DeskGlanceLayer";
it("does not invent portfolio Greeks or risk clearance from order rows", () => {
  vi.stubGlobal("React", React);
  try {
    const html = renderToStaticMarkup(<DeskGlanceLayer orders={[]} account={null} attentionCount={1} onPrimary={() => {}} primaryLabel="Review" onFindBestPlay={() => {}} />);
    expect(html).not.toContain("Running within risk bands");
    expect(html).not.toContain("Delta neutral");
    expect(html).toContain("Portfolio Greeks not measured");
  } finally { vi.unstubAllGlobals(); }
});

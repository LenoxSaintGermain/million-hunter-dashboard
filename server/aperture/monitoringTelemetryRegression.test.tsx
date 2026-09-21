import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PositionSummaryBar } from "../../client/src/components/aperture/PositionSummaryBar";
import { TacticalFlankRadar } from "../../client/src/components/aperture/TacticalFlankRadar";

it("never invents option telemetry for an RWM share fill", () => {
  const html = renderToStaticMarkup(<PositionSummaryBar order={{ id: 360001, symbol: "RWM", instrumentType: "shares", qty: 1, filledQty: 1, filledAvgPriceCents: 1408 }} />);
  expect(html).toContain("RWM");
  expect(html).toContain("$14.08");
  expect(html).not.toContain("MGM");
  expect(html).not.toContain("$15.98");
  expect(html).not.toContain("34.2%");
  expect(html).not.toContain("THESIS INTACT");
  expect(html).toContain("Not measured");
});

it("missing checks cannot synthesize catalysts or establish an all-clear", () => {
  const html = renderToStaticMarkup(<TacticalFlankRadar checks={[]} runId={780001} />);
  expect(html).not.toContain("Las Vegas");
  expect(html).not.toContain("Oct 28");
  expect(html).not.toContain("INTACT");
  expect(html).toContain("Not checked");
});

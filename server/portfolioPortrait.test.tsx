import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import {
  PortfolioPortrait,
  portraitExposure,
} from "../client/src/components/aperture/PortfolioPortrait";

it("uses absolute measured exposure, not buying power or net equity", () => {
  const result = portraitExposure([
    { symbol: "LONG", marketValueCents: 300, priceAsOf: null },
    { symbol: "SHORT", marketValueCents: -100, priceAsOf: null },
    { symbol: "UNKNOWN", marketValueCents: null, priceAsOf: null },
  ]);
  expect(result.gross).toBe(400);
  expect(result.missing).toBe(1);
  expect(result.rows[0].symbol).toBe("LONG");
});
it("does not promote unknown or empty data into an all clear", () => {
  const html = renderToStaticMarkup(
    <PortfolioPortrait
      loading={false}
      failed={true}
      account={{
        label: null,
        equityValueCents: null,
        cashCents: null,
        buyingPowerCents: null,
        lastSyncedAt: null,
        isPaper: null,
      }}
      thesis={null}
      binding={null}
    />
  );
  expect(html).toContain("Exposure is unavailable");
  expect(html).toContain("Headroom needs verification");
  expect(html).toContain("Account mode unverified");
  expect(html).not.toContain("$0");
});
it("labels signed exposure, stale marks and the outlook without forecasting", () => {
  const html = renderToStaticMarkup(
    <PortfolioPortrait
      holdings={[{ symbol: "SHORT", marketValueCents: -10000, priceAsOf: 1 }]}
      loading={false}
      failed={false}
      account={{
        label: "Test",
        equityValueCents: 30000,
        cashCents: 10000,
        buyingPowerCents: 60000,
        lastSyncedAt: 1,
        isPaper: true,
      }}
      thesis="Research lens"
      binding={null}
      now={100000000}
    />
  );
  expect(html).toContain("100.0%");
  expect(html).toContain("−$100");
  expect(html).toContain("Stale or undated mark");
  expect(html).toContain("not a forecast");
  expect(html).toContain("cash excluded");
});

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  AccountExposure,
  accountMoney,
  accountStamp,
} from "../client/src/components/aperture/AccountHoldingsPortrait";

describe("account editorial evidence", () => {
  it("keeps missing, invalid and zero values distinct", () => {
    expect(accountMoney(null)).toBe("Not measured");
    expect(accountMoney(NaN)).toBe("Not measured");
    expect(accountMoney(0)).toBe("$0.00");
    expect(accountStamp(null)).toBe("Time unverified");
    expect(accountStamp(200, 100)).toBe("Time unverified");
    expect(accountStamp(1, 20_000_000)).toContain("Stale");
  });
  it("uses gross measured holdings, retaining signed values and missing evidence", () => {
    const html = renderToStaticMarkup(
      <AccountExposure
        loading={false}
        failed={false}
        holdings={[
          { symbol: "LONG", marketValueCents: 30000, priceAsOf: null },
          { symbol: "SHORT", marketValueCents: -10000, priceAsOf: 1 },
          { symbol: "UNKNOWN", marketValueCents: null, priceAsOf: null },
        ]}
      />
    );
    for (const text of [
      "75.0%",
      "25.0%",
      "-$100.00",
      "$400.00",
      "1 unmeasured",
      "Time unverified",
      "cash excluded",
    ])
      expect(html).toContain(text);
  });
  it("does not turn failures or all-missing marks into zero exposure", () => {
    const html = renderToStaticMarkup(
      <AccountExposure
        loading={false}
        failed={true}
        holdings={[
          { symbol: "UNKNOWN", marketValueCents: null, priceAsOf: null },
        ]}
      />
    );
    expect(html).toContain("Saved values may be out of date");
    expect(html).toContain("Measured gross Not measured");
    expect(html).not.toContain("$0.00");
    expect(html).not.toContain("NaN");
  });
  it("discloses long lists and distinguishes loading from empty", () => {
    expect(
      renderToStaticMarkup(<AccountExposure loading failed={false} />)
    ).toContain("Loading saved holdings");
    expect(
      renderToStaticMarkup(
        <AccountExposure loading={false} failed={false} holdings={[]} />
      )
    ).toContain("No holdings recorded");
    const html = renderToStaticMarkup(
      <AccountExposure
        loading={false}
        failed={false}
        holdings={Array.from({ length: 7 }, (_, i) => ({
          symbol: `TEST${i}`,
          marketValueCents: 100,
          priceAsOf: null,
        }))}
      />
    );
    expect(html).toContain("Show all 7 holdings");
    expect(html).not.toContain("TEST6");
  });
  it("keeps mutations behind account-specific confirmations and preserves exit review", () => {
    const page = readFileSync(
      "client/src/pages/aperture/ApertureAccounts.tsx",
      "utf8"
    );
    // create, sync, schedule, CSV import, and the UAT-E3 practice-book reset.
    // Six: the five mutations plus Disconnect for an old Alpaca row (#107).
    expect(page.match(/window\.confirm/g)).toHaveLength(6);
    expect(page).toContain("csvAccountId !== accountId");
    expect(page).toContain(
      "invalidateAccountRefreshReads(utils.aperture, variables.accountId)"
    );
    expect(page).toContain("<AccountContextPanel accountId={account.id}");
    expect(page).toContain('setCsvText(""); setCsvAccountId(account.id)');
  });
});

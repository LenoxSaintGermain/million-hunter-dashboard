import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { portraitExposure, type PortraitHolding } from "./PortfolioPortrait";

export const accountMoney = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "Not measured"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(value / 100);

export function accountStamp(
  value: number | null | undefined,
  now = Date.now()
) {
  if (value == null || !Number.isFinite(value) || value <= 0 || value > now)
    return "Time unverified";
  return `${now - value > 4 * 60 * 60 * 1000 ? "Stale · " : "Saved · "}${new Date(value).toLocaleString()}`;
}

export function AccountExposure({
  holdings,
  loading,
  failed,
}: {
  holdings?: PortraitHolding[];
  loading: boolean;
  failed: boolean;
}) {
  const [all, setAll] = useState(false);
  const exposure = portraitExposure(holdings ?? []);
  const rows = all ? exposure.rows : exposure.rows.slice(0, 5);
  return (
    <div className="account-exposure">
      <span className="account-annotation">
        Measured holdings / cash excluded
      </span>
      <h3>Where capital sits.</h3>
      {loading && <p role="status">Loading saved holdings…</p>}
      {failed && (
        <p role="alert">
          Holdings refresh failed.{" "}
          {holdings
            ? "Saved values may be out of date."
            : "Exposure unavailable."}
        </p>
      )}
      {!loading && !failed && !holdings && <p>Exposure unavailable.</p>}
      {holdings?.length === 0 && (
        <p>
          No holdings recorded. This is not confirmation of a refreshed broker
          account.
        </p>
      )}
      {!!holdings?.length && (
        <>
          <p className="account-annotation">
            Measured gross{" "}
            {exposure.missing === holdings.length
              ? "Not measured"
              : accountMoney(exposure.gross)}{" "}
            · {exposure.missing} unmeasured
          </p>
          <ul className="account-exposure-list">
            {rows.map((row, index) => {
              const measured =
                row.marketValueCents != null &&
                Number.isFinite(row.marketValueCents);
              const share =
                measured && exposure.gross > 0
                  ? (Math.abs(row.marketValueCents!) / exposure.gross) * 100
                  : null;
              return (
                <li key={`${row.symbol}-${index}`}>
                  <div>
                    <strong>{row.symbol}</strong>
                    <span>{accountMoney(row.marketValueCents)}</span>
                  </div>
                  <div>
                    <span className="account-exposure-bar" aria-hidden="true">
                      <i style={{ width: `${share ?? 0}%` }} />
                    </span>
                    <span>
                      {share == null ? "Not measured" : `${share.toFixed(1)}%`}
                    </span>
                  </div>
                  <small>{accountStamp(row.priceAsOf)}</small>
                </li>
              );
            })}
          </ul>
          {holdings.length > 5 && (
            <button
              type="button"
              className="account-more"
              onClick={() => setAll(!all)}
            >
              {all
                ? "Show fewer holdings"
                : `Show all ${holdings.length} holdings`}
            </button>
          )}
          <details>
            <summary>How to read exposure</summary>
            <p>
              Absolute recorded market values, including shorts, divided by
              measured gross holdings. Cash and missing values are excluded. Not
              allocation advice, risk, or option notional exposure.
            </p>
          </details>
        </>
      )}
    </div>
  );
}

export function AccountHoldingsPortrait({ accountId }: { accountId: number }) {
  const query = trpc.aperture.account.getPositions.useQuery({ accountId });
  return (
    <>
      <AccountExposure
        holdings={query.data}
        loading={query.isLoading}
        failed={query.isError}
      />
      {query.isError && (
        <button
          type="button"
          className="account-more"
          onClick={() => void query.refetch()}
        >
          Retry holdings
        </button>
      )}
    </>
  );
}

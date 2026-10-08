import React, { useState } from "react";
import { HoldingsComposition } from "./HoldingsComposition";
import type { CockpitHeadroomLine } from "@shared/cockpitRailSummary";
import "@/styles/portfolio-portrait.css";
import { useExperienceMode } from "@/contexts/ExperienceModeContext";
import { MicroTooltip } from "./MicroTooltip";
import { ConstraintResolverCard } from "./ConstraintResolverCard";

export type PortraitHolding = {
  symbol: string;
  marketValueCents: number | null;
  priceAsOf: number | null;
};
export function portraitExposure(holdings: PortraitHolding[]) {
  const measured = holdings.filter(
    h => h.marketValueCents != null && Number.isFinite(h.marketValueCents)
  );
  const gross = measured.reduce(
    (sum, h) => sum + Math.abs(h.marketValueCents!),
    0
  );
  return {
    gross,
    missing: holdings.length - measured.length,
    rows: [...holdings].sort(
      (a, b) =>
        Math.abs(b.marketValueCents ?? 0) - Math.abs(a.marketValueCents ?? 0)
    ),
  };
}
const money = (value: number | null) =>
  value == null || !Number.isFinite(value)
    ? "Not measured"
    : `${value < 0 ? "−" : ""}$${Math.abs(value / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const stamp = (value: number | null) =>
  value == null
    ? "Time not recorded"
    : new Date(value).toLocaleString([], {
        dateStyle: "short",
        timeStyle: "short",
      });

/**
 * One jump row to the existing places for positions, orders and limits. No new
 * pages: positions and limits are sections of this portrait; orders and open
 * plays live on the Play Desk.
 */
export const PORTRAIT_JUMPS = [
  { label: "Positions", href: "#portrait-positions" },
  { label: "Orders & open plays", href: "/aperture/plays" },
  { label: "Limits", href: "#portrait-limits" },
] as const;

/** A saved account portrait, not an allocation recommendation or forecast. */
export function PortfolioPortrait({
  holdings,
  loading,
  failed,
  account,
  thesis,
  binding,
  previewOnly = false,
  now = Date.now(),
}: {
  holdings?: PortraitHolding[];
  loading: boolean;
  failed: boolean;
  account: {
    label: string | null;
    equityValueCents: number | null;
    cashCents: number | null;
    buyingPowerCents: number | null;
    lastSyncedAt: number | null;
    isPaper: boolean | null;
    syncError?: string | null;
  };
  thesis: string | null;
  binding: CockpitHeadroomLine | null;
  now?: number;
  previewOnly?: boolean;
}) {
  const { isGuided } = useExperienceMode();
  const [selected, setSelected] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const exposure = portraitExposure(holdings ?? []);
  const rows = all ? exposure.rows : exposure.rows.slice(0, 5);
  const focus =
    exposure.rows.find(h => h.symbol === selected) ?? exposure.rows[0];
  const usage =
    binding?.usedCents != null &&
    binding.ceilingCents != null &&
    binding.ceilingCents > 0
      ? (binding.usedCents / binding.ceilingCents) * 100
      : null;
  const stale =
    account.lastSyncedAt == null ||
    now - account.lastSyncedAt > 4 * 60 * 60 * 1000;
  return (
    <section className="portfolio-portrait" aria-label="Portfolio snapshot">
      <header>
        <span className="portrait-label">
          Capital Aperture / Account portrait
        </span>
        <span>
          {account.isPaper === true
            ? "Practice account"
            : "Account mode unverified"}{" "}
          · saved snapshot
        </span>
      </header>
      {!previewOnly && (
        <nav className="portrait-jump" aria-label="Jump to positions, orders or limits">
          {PORTRAIT_JUMPS.map((jump, index) => (
            <React.Fragment key={jump.href}>
              {index > 0 && <span aria-hidden="true">·</span>}
              <a href={jump.href}>{jump.label}</a>
            </React.Fragment>
          ))}
        </nav>
      )}
      {account.syncError && (
        <p role="status" className="portrait-source">
          Account sync issue: {account.syncError}. Values below are saved
          records, not a successful refresh.
        </p>
      )}
      <div className="portrait-spread">
        <div className="portrait-value">
          <span className="portrait-label">Account value</span>
          <p className="portrait-equity">{money(account.equityValueCents)}</p>
          <p>{account.label || "Account not identified"}</p>
          <p className="portrait-time">
            {stale ? "Stale or unsynced · " : "Saved · "}
            {stamp(account.lastSyncedAt)}
          </p>
          <details className="portrait-cash-detail"><summary>Cash & buying power</summary><dl>
            <div>
              <dt><MicroTooltip termKey="cash">Cash</MicroTooltip></dt>
              <dd>{money(account.cashCents)}</dd>
            </div>
            <div>
              <dt><MicroTooltip termKey="buying_power">Broker buying power</MicroTooltip></dt>
              <dd>{money(account.buyingPowerCents)}</dd>
            </div>
          </dl>
          <small>
            Buying power may include leverage. It is not cash or permission to
            deploy.
          </small>
          </details>
        </div>
        <div className="portrait-holdings" id="portrait-positions">
          <div className="portrait-section-head">
            <div>
              <span className="portrait-label">01 / Exposure</span>
              <h2>Where capital sits.</h2>
            </div>
            {!previewOnly && <a href="/aperture/accounts">Portfolio ↗</a>}
          </div>
          <p className="portrait-caption">
            Share of measured gross holdings · cash excluded
          </p>
          {failed && (
            <p role="status">
              Holdings refresh failed.{" "}
              {holdings
                ? "Last saved values below; not current."
                : "Exposure is unavailable."}
            </p>
          )}
          {loading && <p role="status">Loading saved holdings…</p>}
          {!holdings && !loading && !failed && <p>Holdings not available.</p>}
          {holdings?.length === 0 && (
            <p>
              No holdings recorded in this snapshot. This is not verification of
              an empty brokerage account.
            </p>
          )}
          {!!holdings?.length && <HoldingsComposition holdings={holdings} />}
          <details><summary className="cursor-pointer min-h-11 py-3 text-sm">Inspect individual marks & source times</summary>
          <div className="portrait-exposures">
            {rows.map((h, i) => {
              const measured =
                h.marketValueCents != null &&
                Number.isFinite(h.marketValueCents);
              const pct =
                measured && exposure.gross > 0
                  ? (Math.abs(h.marketValueCents!) / exposure.gross) * 100
                  : null;
              return (
                <button
                  key={`${h.symbol}-${i}`}
                  type="button"
                  aria-pressed={focus === h}
                  onClick={() => setSelected(h.symbol)}
                  className="portrait-holding"
                >
                  <span className="portrait-holding-name">{h.symbol}</span>
                  <span>
                    {pct == null ? "Unmeasured" : `${pct.toFixed(1)}%`}
                  </span>
                  <span className="portrait-bar" aria-hidden="true">
                    <i style={{ width: `${pct ?? 0}%` }} />
                  </span>
                  <span className="portrait-holding-value">
                    {money(h.marketValueCents)}
                  </span>
                </button>
              );
            })}
          </div>
          {exposure.rows.length > 5 && (
            <button
              type="button"
              className="portrait-more"
              onClick={() => setAll(!all)}
            >
              {all
                ? "Show largest five"
                : `Show all ${exposure.rows.length} holdings`}
            </button>
          )}
          {exposure.missing > 0 && (
            <p>
              {exposure.missing} holding(s) unmeasured; proportions exclude
              them.
            </p>
          )}
          {focus && (
            <p className="portrait-source" aria-live="polite">
              <strong>{focus.symbol}</strong> · signed market value{" "}
              {money(focus.marketValueCents)}
              <br />
              {focus.priceAsOf == null ||
              now - focus.priceAsOf > 4 * 60 * 60 * 1000
                ? "Stale or undated mark · "
                : "Saved mark · "}
              {stamp(focus.priceAsOf)}. Gross shares use absolute values, not
              risk contribution.
            </p>
          )}
          </details>
        </div>
      </div>
      <div className="portrait-outlook">
        <section>
          <span className="portrait-label">02 / Research outlook</span>
          <h3>{thesis || "A thesis still needs a name."}</h3>
          <p>
            Selected research lens—not a forecast or a claim that these holdings
            match it.
          </p>
          {!previewOnly && <a href="/thesis?scope=capital">Review the thesis →</a>}
        </section>
        <section id="portrait-limits" data-constrained={usage != null && usage >= 85}>
          <span className="portrait-label">03 / Room for the next move</span>
          <h3>
            {usage == null
              ? "Headroom needs verification."
              : usage >= 100
                ? `${binding?.subject || "Exposure"} is at its ceiling.`
                : `${binding?.subject || "Exposure"} sets the tightest limit.`}
          </h3>
          {usage != null && (
            <>
              <div className="portrait-limit" aria-hidden="true">
                <i style={{ width: `${Math.min(100, Math.max(0, usage))}%` }} />
              </div>
              <p>
                <strong>{usage.toFixed(0)}% of ceiling used</strong> ·{" "}
                {money(binding?.usedCents ?? null)} /{" "}
                {money(binding?.ceilingCents ?? null)}
              </p>
            </>
          )}
          {isGuided && usage != null && usage >= 85 ? (
            <div className="mt-3">
              <ConstraintResolverCard
                symbol={binding?.subject || "Exposure"}
                currentValueCents={binding?.usedCents}
                ceilingValueCents={binding?.ceilingCents}
              />
            </div>
          ) : (
            <p>
              {usage == null
                ? "Missing measurements are not available capacity."
                : "Saved constraint, not portfolio allocation. Existing positions are unchanged; fresh checks still apply."}
            </p>
          )}
          {!previewOnly && <a href="/aperture/accounts">Inspect limits →</a>}
        </section>
      </div>
    </section>
  );
}

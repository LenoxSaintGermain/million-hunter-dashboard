import "@/styles/capital-limit-bars.css";
import { buildLimitBars } from "@shared/limitBars";
import type { CockpitHeadroomLine } from "@shared/cockpitRailSummary";

/** POC v3 context strip: Single order · Per play · Daily loss, from the cockpit's headroom lines only. */
export function LimitBars({ lines }: { lines: readonly CockpitHeadroomLine[] | null | undefined }) {
  const bars = buildLimitBars(lines);
  return <ul className="capital-limit-bars" aria-label="Your limits">
    {bars.map((bar) => <li key={bar.key} className="capital-limit-bar" data-limit={bar.key} data-tone={bar.tone}>
      <span className="capital-limit-bar-label">{bar.label}</span>
      <span className="capital-limit-bar-value">{bar.value}</span>
      {bar.kind === "usage" && bar.usedPct != null
        ? <span className="capital-limit-track" data-kind="usage" role="progressbar" aria-label={`${bar.label} used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(bar.usedPct)} aria-valuetext={bar.value}>
          <span className="capital-limit-fill" style={{ width: `${bar.usedPct}%` }} />
        </span>
        : <span className="capital-limit-track" data-kind={bar.kind} aria-hidden="true" />}
      <span className="capital-limit-note">{bar.note}</span>
    </li>)}
  </ul>;
}

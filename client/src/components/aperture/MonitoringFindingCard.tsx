import { Button } from "@/components/ui/button";
import { monitoringFindingPresentation, type MonitoringObservation, type MonitoringInstrumentContext } from "@shared/monitoringState";
import { FindingEvidence } from "./AttentionDecisionCard";

/** No API or read-side lifecycle writes. Caller owns an explicit, scoped refresh action. */
export function MonitoringFindingCard({ check, instrument, rationale, now, onRefresh, refreshing = false, hideImplication = false, isResolved = false }: {
  check: MonitoringObservation & { id: number; checkType?: string; symbol?: string };
  instrument?: MonitoringInstrumentContext | null;
  rationale?: string | null;
  now?: number;
  onRefresh?: () => void;
  refreshing?: boolean;
  hideImplication?: boolean;
  isResolved?: boolean;
}) {
  const model = monitoringFindingPresentation({ check, instrument, rationale, now });
  const statusLabel = isResolved
    ? `${model.checkLabel} · Review recorded`
    : `${model.checkLabel} · ${model.review.state === "unknown" ? "Not verified" : model.review.state === "flagged" ? "Needs review" : "No flagged change"}`;

  const statusColor = isResolved
    ? "rgb(52 211 153)"
    : model.review.needsReview
    ? "var(--sh-signal)"
    : "var(--sh-fg-muted)";

  const borderColor = isResolved
    ? "var(--sh-border-1)"
    : model.review.needsReview
    ? "var(--sh-signal)"
    : "var(--sh-border-1)";

  return <article id={`monitoring-check-${check.id}`} className="min-w-0 rounded-xl border p-4" style={{ borderColor, background: "var(--sh-surface)" }}>
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold" style={{ color: statusColor }}>{statusLabel}</p>
      {isResolved && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          ✓ SIGNED OFF
        </span>
      )}
    </div>
    <h3 className="mt-1 text-base font-semibold">{model.label}</h3>
    <p className="mt-2 text-sm leading-5">{model.summary}</p>
    {model.review.state === "unknown" && !isResolved && <p className="mt-1 text-sm leading-5">{model.review.reason}</p>}
    {!hideImplication && <p className="mt-2 text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>{model.implication}</p>}
    {model.review.state === "unknown" && onRefresh && <><Button variant="outline" className="mt-3 min-h-11" aria-disabled={refreshing} onClick={() => { if (!refreshing) onRefresh(); }}>{refreshing ? "Checking this play…" : "Refresh sourced checks"}</Button><p className="mt-1 text-sm" role="status">{refreshing ? "This play’s check request is in progress." : "Runs new checks for this play only. Does not change an order."}</p></>}
    <FindingEvidence evidence={model.evidence} label="Review evidence" />
  </article>;
}

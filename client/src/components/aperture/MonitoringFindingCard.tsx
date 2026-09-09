import { Button } from "@/components/ui/button";
import { monitoringFindingPresentation, type MonitoringObservation, type MonitoringInstrumentContext } from "@shared/monitoringState";
import { FindingEvidence } from "./AttentionDecisionCard";

/** No API or read-side lifecycle writes. Caller owns an explicit, scoped refresh action. */
export function MonitoringFindingCard({ check, instrument, rationale, now, onRefresh, refreshing = false }: {
  check: MonitoringObservation & { id: number; checkType?: string; symbol?: string };
  instrument?: MonitoringInstrumentContext | null;
  rationale?: string | null;
  now?: number;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const model = monitoringFindingPresentation({ check, instrument, rationale, now });
  return <article id={`monitoring-check-${check.id}`} className="min-w-0 rounded-xl border p-4" style={{ borderColor: model.review.needsReview ? "var(--sh-signal)" : "var(--sh-border-1)", background: "var(--sh-surface)" }}>
    <p className="text-xs font-semibold" style={{ color: "var(--sh-signal)" }}>{model.checkLabel} · {model.review.state === "unknown" ? "Not verified" : model.review.state === "flagged" ? "Needs review" : "No flagged change"}</p>
    <h3 className="mt-1 text-base font-semibold">{model.label}</h3>
    <p className="mt-2 text-sm leading-5">{model.summary}</p>
    {model.review.state === "unknown" && <p className="mt-1 text-sm leading-5">{model.review.reason}</p>}
    <p className="mt-2 text-sm leading-5" style={{ color: "var(--sh-fg-muted)" }}>{model.implication}</p>
    {model.review.state === "unknown" && onRefresh && <><Button variant="outline" className="mt-3 min-h-11" aria-disabled={refreshing} onClick={() => { if (!refreshing) onRefresh(); }}>{refreshing ? "Checking this play…" : "Refresh sourced checks"}</Button><p className="mt-1 text-sm" role="status">{refreshing ? "This play’s check request is in progress." : "Runs new checks for this play only. Does not change an order."}</p></>}
    <FindingEvidence evidence={model.evidence} label="Review evidence" />
  </article>;
}

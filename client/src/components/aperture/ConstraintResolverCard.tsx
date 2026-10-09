import { AlertTriangle, ShieldCheck, Sliders, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CockpitHeadroomLine } from "@shared/cockpitRailSummary";
import { MicroTooltip } from "./MicroTooltip";

interface ConstraintResolverCardProps {
  /** The measured binding limit from the cockpit. Nothing is assumed when it is missing. */
  line: CockpitHeadroomLine | null | undefined;
  onTrimReview?: () => void;
  /** Only shown when the caller has a real place to change the limit. */
  onAdjustSettings?: () => void;
  className?: string;
}

const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString()}`;

/** Limits whose excess belongs to one holding or cluster that the operator can review. */
const REVIEWABLE_SUBJECT = new Set(["position", "cluster"]);

/**
 * Resolution options for a measured limit at or over its ceiling. It renders
 * only measured values: no example symbol, amount or percentage is filled in.
 * Opening a review never sells, trims or changes a limit.
 */
export function ConstraintResolverCard({ line, onTrimReview, onAdjustSettings, className = "" }: ConstraintResolverCardProps) {
  const measured = line != null && line.usedCents != null && line.ceilingCents != null && line.ceilingCents > 0;
  if (!measured) {
    return <p role="status" className={`text-xs leading-5 text-[var(--sh-fg-3)] ${className}`}>
      This limit is not measured yet, so no resolution is suggested. Sync the broker snapshot to measure it.
    </p>;
  }
  const subject = line.subject?.trim() || line.label;
  const current = line.usedCents!;
  const ceiling = line.ceilingCents!;
  const usedPct = Math.round((current / ceiling) * 100);
  const excessCents = Math.max(0, current - ceiling);
  const reviewable = REVIEWABLE_SUBJECT.has(line.key) && line.subject != null;

  const handleTrim = () => {
    if (onTrimReview) {
      onTrimReview();
    } else if (typeof window !== "undefined") {
      window.location.assign(`/aperture/plays?stage=monitor&symbol=${encodeURIComponent(line.subject ?? "")}`);
    }
  };

  return (
    <div
      role="alert"
      className={`border border-[var(--sh-signal)] bg-[var(--sh-burnt-amber-10)] p-4 sm:p-5 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--sh-burnt-amber-20)] text-[var(--sh-signal)]">
          <AlertTriangle className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-[var(--sh-fg-1)]">
              {subject} uses {dollars(current)} of its {dollars(ceiling)} ceiling ({line.label.toLowerCase()} · {line.ceilingPct}% of account)
            </h4>
            <span className="border border-[var(--sh-signal)] px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider text-[var(--sh-signal)]">
              {usedPct}% of ceiling
            </span>
          </div>

          <p className="mt-1.5 text-xs text-[var(--sh-fg-2)] leading-relaxed">
            New exposure that relies on this limit is blocked. Existing positions are unchanged{reviewable ? "; you can choose how to resolve this:" : "."}
          </p>

          {(reviewable || onAdjustSettings) && <div className="mt-3.5 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
            {reviewable && <Button
              size="sm"
              variant="outline"
              onClick={handleTrim}
              className="min-h-9 justify-start sm:justify-center border-[var(--sh-signal)] bg-[var(--sh-surface-1)] font-medium text-xs text-[var(--sh-fg-1)] hover:bg-[var(--sh-burnt-amber-10)]"
            >
              <Scissors className="mr-1.5 h-3.5 w-3.5 text-[var(--sh-signal)]" />
              <span>
                1. <strong>Review {line.subject}</strong>{excessCents > 0 ? `: trimming at least ${dollars(excessCents)} returns it under the ceiling` : ""}
              </span>
              <span className="ml-1 text-[11px] font-semibold text-[var(--sh-signal)]">
                [Opens the position · nothing is sold]
              </span>
            </Button>}

            {onAdjustSettings && <Button
              size="sm"
              variant="ghost"
              onClick={onAdjustSettings}
              className="min-h-9 justify-start sm:justify-center text-xs text-[var(--sh-fg-2)] hover:bg-[var(--sh-burnt-amber-10)]"
            >
              <Sliders className="mr-1.5 h-3.5 w-3.5 text-[var(--sh-fg-3)]" />
              <span>{reviewable ? "2. " : ""}Review account limits</span>
            </Button>}
          </div>}

          <div className="mt-3 pt-2.5 border-t border-[var(--sh-rule-warm)] flex items-center gap-1.5 text-[11px] text-[var(--sh-fg-3)]">
            <ShieldCheck className="h-3.5 w-3.5 text-sage" />
            <span>
              Capital Aperture rule: <MicroTooltip termKey="concentration_limit">Concentration Guard</MicroTooltip> sets the {line.ceilingPct}% ceiling in the account mandate. This card can't change it.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

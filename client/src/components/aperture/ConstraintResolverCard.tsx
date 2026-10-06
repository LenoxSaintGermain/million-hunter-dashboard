import { AlertTriangle, ArrowRight, CheckCircle2, ShieldCheck, Sliders, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MicroTooltip } from "./MicroTooltip";

interface ConstraintResolverCardProps {
  symbol?: string;
  currentValueCents?: number | null;
  ceilingValueCents?: number | null;
  pctOfAccount?: number;
  ceilingPct?: number;
  excessCents?: number;
  accountEquityCents?: number;
  onTrimReview?: () => void;
  onAdjustSettings?: () => void;
  className?: string;
}

export function ConstraintResolverCard({
  symbol = "NVDA",
  currentValueCents = 1_065_800, // $10,658
  ceilingValueCents = 1_004_500, // $10,045
  pctOfAccount = 10.6,
  ceilingPct = 10.0,
  excessCents,
  accountEquityCents = 100_000_00,
  onTrimReview,
  onAdjustSettings,
  className = "",
}: ConstraintResolverCardProps) {
  const safeCurrent = currentValueCents ?? 10_658_00;
  const safeCeiling = ceilingValueCents && ceilingValueCents > 0 ? ceilingValueCents : 10_045_00;

  const formattedCurrent = `$${Math.round(safeCurrent / 100).toLocaleString()}`;
  const formattedCeiling = `$${Math.round(safeCeiling / 100).toLocaleString()}`;

  // Amount needed to trim to return comfortably into the safe zone
  const trimCents = excessCents ?? Math.max(0, safeCurrent - safeCeiling + 50_00);
  const formattedTrim = `$${Math.round(trimCents / 100).toLocaleString()}`;

  const handleTrim = () => {
    if (onTrimReview) {
      onTrimReview();
    } else if (typeof window !== "undefined") {
      window.location.assign(`/aperture/plays?stage=monitor&symbol=${encodeURIComponent(symbol)}`);
    }
  };

  const handleSettings = () => {
    if (onAdjustSettings) {
      onAdjustSettings();
    } else if (typeof window !== "undefined") {
      window.location.assign("/aperture/mission");
    }
  };

  return (
    <div
      role="alert"
      className={`rounded-xl border border-amber-300 bg-amber-50/70 p-4 sm:p-5 dark:border-amber-700/60 dark:bg-amber-950/20 shadow-xs ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {symbol} is taking up more than {ceilingPct}% of your account ({formattedCurrent} / {formattedCeiling})
            </h4>
            <span className="rounded-full bg-amber-200/70 dark:bg-amber-800/50 px-2 py-0.5 text-[10px] font-mono font-medium text-amber-900 dark:text-amber-200">
              {Math.round((safeCurrent / safeCeiling) * 100)}% of ceiling
            </span>
          </div>

          <p className="mt-1.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            To protect your account from over-concentration and keep your capital safe, you can choose how to resolve this:
          </p>

          <div className="mt-3.5 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handleTrim}
              className="min-h-9 justify-start sm:justify-center border-amber-400 bg-white dark:bg-slate-900 font-medium text-xs text-slate-900 dark:text-slate-100 hover:bg-amber-100 dark:hover:bg-amber-950/40 shadow-2xs"
            >
              <Scissors className="mr-1.5 h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>
                1. <strong>Trim {symbol}</strong> by {formattedTrim} to get back in safe zone
              </span>
              <span className="ml-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                [One-Click Trim Review]
              </span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleSettings}
              className="min-h-9 justify-start sm:justify-center text-xs text-slate-700 dark:text-slate-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/40"
            >
              <Sliders className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
              <span>
                2. Increase single-stock limit to 15% for a concentrated bet
              </span>
              <span className="ml-1 text-[11px] text-muted-foreground">[Adjust Settings]</span>
            </Button>
          </div>

          <div className="mt-3 pt-2.5 border-t border-amber-200/60 dark:border-amber-800/40 flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-sage" />
            <span>
              Capital Aperture rule: <MicroTooltip termKey="concentration_limit">Concentration Guard</MicroTooltip> prevents single-asset failure from endangering your portfolio balance.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

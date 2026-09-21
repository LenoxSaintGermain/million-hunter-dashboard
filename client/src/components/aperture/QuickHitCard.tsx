import React, { useState, useMemo } from "react";
import { trpc } from "../../lib/trpc";
import { toast } from "sonner";
import {
  type QuickHitPlay,
  calculateBudgetSizing,
} from "../../../../shared/quickHitSymphony";
import {
  Zap,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  BarChart3,
  CheckCircle2,
  Lock,
} from "lucide-react";

interface QuickHitCardProps {
  play: QuickHitPlay;
  defaultBudget?: number;
  onAuthorized?: (symbol: string) => void;
}

export const QuickHitCard: React.FC<QuickHitCardProps> = ({
  play,
  defaultBudget = 50,
  onAuthorized,
}) => {
  const [budgetUsd, setBudgetUsd] = useState<number>(defaultBudget);
  const [showBacktestDetails, setShowBacktestDetails] = useState<boolean>(false);
  const [authorized, setAuthorized] = useState<boolean>(false);

  // Dynamic budget calculation
  const sizing = useMemo(() => {
    return calculateBudgetSizing({
      budgetUsd,
      limitPriceCents: play.bracket.limitPriceCents,
      stopPriceCents: play.bracket.stopLossPriceCents,
    });
  }, [budgetUsd, play.bracket.limitPriceCents, play.bracket.stopLossPriceCents]);

  const authorizeMutation = trpc.aperture.quickHit.authorize.useMutation({
    onSuccess: (data) => {
      setAuthorized(true);
      toast.success(`Quick Hit Authorized: ${data.symbol}`, {
        description: `Order queued for ${data.sizing.shares} shares @ $${(data.bracket.limitPriceCents / 100).toFixed(2)} limit. Max risk capped at $${(data.sizing.maxCapitalAtRiskCents / 100).toFixed(2)}.`,
      });
      if (onAuthorized) onAuthorized(data.symbol);
    },
    onError: (err) => {
      toast.error(`Authorization Failed: ${err.message}`);
    },
  });

  const handleAuthorize = () => {
    authorizeMutation.mutate({
      candidatePlayId: play.id,
      symbol: play.symbol,
      budgetUsd,
      limitPriceCents: play.bracket.limitPriceCents,
      stopLossPriceCents: play.bracket.stopLossPriceCents,
      takeProfitPriceCents: play.bracket.takeProfitPriceCents,
      catalystHeadline: play.catalyst.headline,
      catalystSummary: play.catalyst.summary,
      oneSentenceHypothesis: play.oneSentenceHypothesis,
    });
  };

  const isSubFive = play.currentPriceCents < 500;
  const isMicroBadge = play.catalyst.badge === "MICRO";

  return (
    <div
      className="rounded-xl border transition-all duration-200 shadow-sm relative overflow-hidden"
      style={{
        backgroundColor: "var(--sh-surface-1)",
        borderColor: authorized ? "var(--sh-emerald)" : "var(--sh-border)",
      }}
    >
      {/* Top Accent Ribbon */}
      <div
        className="h-1 w-full"
        style={{
          backgroundColor: isMicroBadge ? "var(--sh-purple)" : "var(--sh-cyan)",
        }}
      />

      <div className="p-5 space-y-4">
        {/* Header: Symbol, Badges, Price, Spread */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-bold tracking-tight text-[var(--sh-fg-1)]">
                {play.symbol}
              </span>
              <span
                className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full border"
                style={{
                  backgroundColor: isMicroBadge
                    ? "var(--sh-purple-20)"
                    : "var(--sh-cyan-15)",
                  color: isMicroBadge ? "var(--sh-purple)" : "var(--sh-cyan)",
                  borderColor: isMicroBadge
                    ? "var(--sh-purple)"
                    : "var(--sh-cyan)",
                }}
              >
                {play.catalyst.badge}
              </span>
              {isSubFive && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--sh-surface-2)] text-[var(--sh-fg-3)] border border-[var(--sh-border)] flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Limit Only
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--sh-fg-3)] mt-0.5 font-sans">
              {play.companyName}
            </p>
          </div>

          <div className="text-right">
            <div className="font-mono text-base font-semibold text-[var(--sh-fg-1)]">
              ${(play.currentPriceCents / 100).toFixed(2)}
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[11px] font-mono text-[var(--sh-fg-3)]">
              <span>Spread {play.spreadPct.toFixed(2)}%</span>
              <span>•</span>
              <span>Vol {(play.dailyVolume / 1_000_000).toFixed(1)}M</span>
            </div>
          </div>
        </div>

        {/* Catalyst Box */}
        <div
          className="p-3 rounded-lg border text-xs space-y-1.5"
          style={{
            backgroundColor: "var(--sh-surface-2)",
            borderColor: "var(--sh-border)",
          }}
        >
          <div className="flex items-center gap-1.5 font-semibold text-[var(--sh-fg-1)]">
            <Zap className="w-3.5 h-3.5 text-[var(--sh-amber)] shrink-0" />
            <span>{play.catalyst.headline}</span>
          </div>
          <p className="text-[var(--sh-fg-3)] leading-relaxed">
            {play.catalyst.summary}
          </p>
          <div className="text-[10px] font-mono text-[var(--sh-fg-4)] flex items-center gap-1 pt-1 border-t border-[var(--sh-border)]">
            <span>Source:</span>
            <span className="font-semibold text-[var(--sh-fg-3)]">
              {play.catalyst.source}
            </span>
          </div>
        </div>

        {/* The Play Bracket: Stop / Target / R:R */}
        <div className="grid grid-cols-3 gap-2 text-center p-2.5 rounded-lg bg-[var(--sh-surface-2)] border border-[var(--sh-border)] font-mono text-xs">
          <div>
            <div className="text-[10px] text-[var(--sh-rose)] uppercase font-semibold">
              Stop-Loss
            </div>
            <div className="font-bold text-[var(--sh-fg-1)] mt-0.5">
              ${(play.bracket.stopLossPriceCents / 100).toFixed(2)}
            </div>
            <div className="text-[10px] text-[var(--sh-rose)]">
              -{play.bracket.stopLossPct.toFixed(1)}%
            </div>
          </div>

          <div className="border-x border-[var(--sh-border)]">
            <div className="text-[10px] text-[var(--sh-fg-3)] uppercase font-semibold">
              Hard Limit
            </div>
            <div className="font-bold text-[var(--sh-fg-1)] mt-0.5">
              ${(play.bracket.limitPriceCents / 100).toFixed(2)}
            </div>
            <div className="text-[10px] text-[var(--sh-cyan)]">
              {play.bracket.rewardToRiskRatio.toFixed(1)}x R:R
            </div>
          </div>

          <div>
            <div className="text-[10px] text-[var(--sh-emerald)] uppercase font-semibold">
              Take-Profit
            </div>
            <div className="font-bold text-[var(--sh-fg-1)] mt-0.5">
              ${(play.bracket.takeProfitPriceCents / 100).toFixed(2)}
            </div>
            <div className="text-[10px] text-[var(--sh-emerald)]">
              +{play.bracket.takeProfitPct.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Pre-Flight Backtest Pill & Toggle (Composer by SoFi style) */}
        {play.backtest && (
          <div className="space-y-2">
            <div
              onClick={() => setShowBacktestDetails(!showBacktestDetails)}
              className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-xs border"
              style={{
                backgroundColor: "var(--sh-surface-2)",
                borderColor: "var(--sh-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-[var(--sh-emerald)]" />
                <span className="font-mono text-[11px] font-semibold text-[var(--sh-fg-2)]">
                  Illustrative sample results:
                </span>
                <span className="font-mono font-bold text-[var(--sh-emerald)]">
                  {play.backtest.winRatePct}% Win
                </span>
                <span className="text-[var(--sh-fg-4)]">•</span>
                <span className="font-mono text-[var(--sh-rose)]">
                  {play.backtest.maxDrawdownPct}% Max DD
                </span>
              </div>
              <div className="flex items-center gap-1 text-[var(--sh-fg-3)]">
                <span className="text-[10px] font-mono">
                  {showBacktestDetails ? "Hide" : "Details"}
                </span>
                {showBacktestDetails ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </div>

            {showBacktestDetails && (
              <div
                className="p-3 rounded-lg border text-xs space-y-2 text-[var(--sh-fg-2)] font-mono animate-in fade-in duration-150"
                style={{
                  backgroundColor: "var(--sh-surface-3)",
                  borderColor: "var(--sh-border)",
                }}
              >
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[var(--sh-fg-4)]">Profit Factor:</span>{" "}
                    <span className="font-bold text-[var(--sh-fg-1)]">
                      {play.backtest.profitFactor}x
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--sh-fg-4)]">Sample Size:</span>{" "}
                    <span className="font-bold text-[var(--sh-fg-1)]">
                      {play.backtest.sampleOccurrences} events
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--sh-fg-4)]">Avg Holding:</span>{" "}
                    <span className="font-bold text-[var(--sh-fg-1)]">
                      {play.backtest.avgHoldingDays} days
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--sh-fg-4)]">Expected Return:</span>{" "}
                    <span className="font-bold text-[var(--sh-emerald)]">
                      ${play.backtest.expectedReturnPerDollar} / $1
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-[var(--sh-fg-4)] italic pt-1 border-t border-[var(--sh-border)]">
                  Simulated on historical catalyst reactions with stop/target bracket triggers. Zero API calls at demo time.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Capital Aperture Budget-Modeled Sizing */}
        <div className="space-y-2 pt-1 border-t border-[var(--sh-border)]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--sh-fg-3)] font-medium">Budget Cap:</span>
            <div className="flex items-center gap-1.5 font-mono">
              {[25, 50, 100].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setBudgetUsd(amt)}
                  className={`px-2.5 py-1 text-xs rounded border transition-all ${
                    budgetUsd === amt
                      ? "bg-[var(--sh-primary)] text-[var(--sh-primary-fg)] font-bold border-transparent"
                      : "bg-[var(--sh-surface-2)] text-[var(--sh-fg-2)] border-[var(--sh-border)] hover:bg-[var(--sh-surface-3)]"
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>

          {/* Sizing Breakdown Readout */}
          <div className="p-2.5 rounded bg-[var(--sh-surface-2)] border border-[var(--sh-border)] text-xs font-mono space-y-1">
            <div className="flex justify-between text-[var(--sh-fg-2)]">
              <span>Allocated Shares:</span>
              <span className="font-bold text-[var(--sh-fg-1)]">
                {sizing.shares} shares @ ${(play.bracket.limitPriceCents / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-[var(--sh-fg-3)]">
              <span>Capital Committed:</span>
              <span>
                ${(sizing.committedCents / 100).toFixed(2)}
                {sizing.uncommittedCents > 0 && (
                  <span className="text-[var(--sh-fg-4)] text-[10px]">
                    {" "}
                    (${(sizing.uncommittedCents / 100).toFixed(2)} cash left)
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between text-[var(--sh-rose)] font-semibold border-t border-[var(--sh-border)] pt-1 mt-1">
              <span>Planned loss at stop:</span>
              <span>-${(sizing.maxCapitalAtRiskCents / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* 1-Click Action Button */}
        {authorized ? (
          <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-[var(--sh-emerald-15)] border border-[var(--sh-emerald)] text-[var(--sh-emerald)] font-mono text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Play Authorized & Queued ({sizing.shares} shares)</span>
          </div>
        ) : (
          <button
            type="button"
            disabled
            aria-describedby={`example-only-${play.id}`}
            className="w-full py-3 px-4 rounded-lg font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:opacity-95 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--sh-primary-fg)]"
            style={{
              backgroundColor: isMicroBadge ? "var(--sh-purple)" : "var(--sh-primary)",
            }}
          >
            {authorizeMutation.isPending ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Auditing & Routing...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Example only · order unavailable</span>
              </>
            )}
          </button>
        )}

        {/* Structural Safe Guard Disclosure */}
        <div id={`example-only-${play.id}`} className="text-sm text-center text-[var(--sh-fg-4)]">
          Unverified sample data. Choose “Find a researched trade” above to review an eligible idea. No order is created here.
        </div>
      </div>
    </div>
  );
};

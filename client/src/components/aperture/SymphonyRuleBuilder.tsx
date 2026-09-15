import React, { useState } from "react";
import { trpc } from "../../lib/trpc";
import {
  type SymphonyRecipe,
  DEFAULT_SYMPHONY_RECIPES,
  type PreFlightBacktestResult,
} from "../../../../shared/quickHitSymphony";
import {
  Sliders,
  Layers,
  ArrowRight,
  Shield,
  Activity,
  Play,
  RotateCcw,
  CheckCircle,
  TrendingUp,
  AlertCircle,
  Zap,
} from "lucide-react";

interface SymphonyRuleBuilderProps {
  onRecipeSelected?: (recipe: SymphonyRecipe) => void;
}

export const SymphonyRuleBuilder: React.FC<SymphonyRuleBuilderProps> = ({
  onRecipeSelected,
}) => {
  const [selectedRecipeIndex, setSelectedRecipeIndex] = useState<number>(0);
  const [activeRecipe, setActiveRecipe] = useState<SymphonyRecipe>(
    DEFAULT_SYMPHONY_RECIPES[0]
  );
  const [backtestResult, setBacktestResult] =
    useState<PreFlightBacktestResult | null>(null);

  const backtestMutation = trpc.aperture.quickHit.backtest.useMutation({
    onSuccess: (data) => {
      setBacktestResult(data);
    },
  });

  const handleSelectTemplate = (index: number) => {
    setSelectedRecipeIndex(index);
    const chosen = DEFAULT_SYMPHONY_RECIPES[index];
    setActiveRecipe(chosen);
    setBacktestResult(null);
    if (onRecipeSelected) onRecipeSelected(chosen);
  };

  const handleRunBacktest = () => {
    backtestMutation.mutate({ recipe: activeRecipe });
  };

  return (
    <div
      className="p-6 rounded-xl border space-y-6"
      style={{
        backgroundColor: "var(--sh-surface-1)",
        borderColor: "var(--sh-border)",
      }}
    >
      {/* Header & Concept */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--sh-border)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[var(--sh-primary-15)] text-[var(--sh-fg-1)]">
              <Layers className="w-4 h-4" />
            </span>
            <h3 className="font-mono text-base font-bold text-[var(--sh-fg-1)]">
              Symphony Rule Engine (Composer-Style Modular Rules)
            </h3>
          </div>
          <p className="text-xs text-[var(--sh-fg-3)] mt-1">
            Build event-driven rules visually: Trigger → Filter → Action with instant pre-flight backtesting.
          </p>
        </div>

        {/* Template Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {DEFAULT_SYMPHONY_RECIPES.map((recipe, idx) => (
            <button
              key={recipe.id}
              type="button"
              onClick={() => handleSelectTemplate(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all whitespace-nowrap cursor-pointer ${
                selectedRecipeIndex === idx
                  ? "bg-[var(--sh-primary)] text-[var(--sh-primary-fg)] font-semibold shadow-xs"
                  : "bg-[var(--sh-surface-2)] text-[var(--sh-fg-2)] border border-[var(--sh-border)] hover:bg-[var(--sh-surface-3)]"
              }`}
            >
              {recipe.name}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Rule Flow Blocks (Trigger -> Filter -> Action) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* BLOCK 1: TRIGGER */}
        <div
          className="p-4 rounded-lg border space-y-3 relative"
          style={{
            backgroundColor: "var(--sh-surface-2)",
            borderColor: "var(--sh-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[var(--sh-cyan-15)] text-[var(--sh-cyan)] border border-[var(--sh-cyan)]">
              1. Trigger
            </span>
            <Activity className="w-4 h-4 text-[var(--sh-cyan)]" />
          </div>

          <div>
            <div className="font-mono text-sm font-bold text-[var(--sh-fg-1)]">
              {activeRecipe.trigger.label}
            </div>
            <p className="text-xs text-[var(--sh-fg-3)] mt-1">
              {activeRecipe.trigger.description}
            </p>
          </div>

          <div className="p-2.5 rounded bg-[var(--sh-surface-3)] border border-[var(--sh-border)] text-xs font-mono text-[var(--sh-fg-2)] space-y-1">
            <div>
              <span className="text-[var(--sh-fg-4)]">Trigger Type:</span>{" "}
              <span className="font-semibold text-[var(--sh-cyan)]">
                {activeRecipe.trigger.type}
              </span>
            </div>
            {activeRecipe.trigger.params.volumeSpikePct && (
              <div>
                <span className="text-[var(--sh-fg-4)]">Spike Threshold:</span>{" "}
                <span>&gt; {activeRecipe.trigger.params.volumeSpikePct}%</span>
              </div>
            )}
            {activeRecipe.trigger.params.catalystSource && (
              <div>
                <span className="text-[var(--sh-fg-4)]">Source:</span>{" "}
                <span>{activeRecipe.trigger.params.catalystSource}</span>
              </div>
            )}
          </div>
        </div>

        {/* BLOCK 2: FILTER */}
        <div
          className="p-4 rounded-lg border space-y-3 relative"
          style={{
            backgroundColor: "var(--sh-surface-2)",
            borderColor: "var(--sh-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[var(--sh-amber-15)] text-[var(--sh-amber)] border border-[var(--sh-amber)]">
              2. Filter
            </span>
            <Shield className="w-4 h-4 text-[var(--sh-amber)]" />
          </div>

          <div>
            <div className="font-mono text-sm font-bold text-[var(--sh-fg-1)]">
              Liquidity & Safety Filters
            </div>
            <p className="text-xs text-[var(--sh-fg-3)] mt-1">
              Guards against low-float traps, illiquidity, and excessive bid-ask spreads.
            </p>
          </div>

          <div className="p-2.5 rounded bg-[var(--sh-surface-3)] border border-[var(--sh-border)] text-xs font-mono text-[var(--sh-fg-2)] space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--sh-fg-4)]">Price Ceiling:</span>
              <span className="font-semibold">&lt; ${(activeRecipe.filter.maxPriceCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--sh-fg-4)]">Market Cap:</span>
              <span className="font-semibold">&lt; ${(activeRecipe.filter.maxMarketCapUsd / 1_000_000).toFixed(0)}M</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--sh-fg-4)]">Min Volume:</span>
              <span className="font-semibold">&gt; {(activeRecipe.filter.minDailyVolume / 1_000).toFixed(0)}k/day</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--sh-fg-4)]">Max Spread:</span>
              <span className="font-semibold text-[var(--sh-emerald)]">&le; {activeRecipe.filter.maxSpreadPct.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* BLOCK 3: ACTION */}
        <div
          className="p-4 rounded-lg border space-y-3 relative"
          style={{
            backgroundColor: "var(--sh-surface-2)",
            borderColor: "var(--sh-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[var(--sh-emerald-15)] text-[var(--sh-emerald)] border border-[var(--sh-emerald)]">
              3. Action
            </span>
            <Zap className="w-4 h-4 text-[var(--sh-emerald)]" />
          </div>

          <div>
            <div className="font-mono text-sm font-bold text-[var(--sh-fg-1)]">
              Automated Bracket Execution
            </div>
            <p className="text-xs text-[var(--sh-fg-3)] mt-1">
              Fixed dollar allocation with mandatory pre-calculated bracket stops.
            </p>
          </div>

          <div className="p-2.5 rounded bg-[var(--sh-surface-3)] border border-[var(--sh-border)] text-xs font-mono text-[var(--sh-fg-2)] space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--sh-fg-4)]">Budget:</span>
              <span className="font-bold text-[var(--sh-fg-1)]">${activeRecipe.action.budgetUsd}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--sh-fg-4)]">Order Type:</span>
              <span className="font-semibold uppercase text-[var(--sh-cyan)]">Hard Limit Only</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--sh-fg-4)]">Take-Profit:</span>
              <span className="font-semibold text-[var(--sh-emerald)]">+{activeRecipe.action.takeProfitPct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--sh-fg-4)]">Stop-Loss:</span>
              <span className="font-semibold text-[var(--sh-rose)]">-{activeRecipe.action.stopLossPct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pre-Flight Backtest Trigger Bar */}
      <div
        className="p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4"
        style={{
          backgroundColor: "var(--sh-surface-2)",
          borderColor: "var(--sh-border)",
        }}
      >
        <div className="text-xs text-[var(--sh-fg-3)]">
          <span className="font-mono font-semibold text-[var(--sh-fg-1)]">
            Pre-Flight Simulation:
          </span>{" "}
          Simulate this recipe across historical catalyst distributions before placing live paper capital.
        </div>

        <button
          type="button"
          disabled={backtestMutation.isPending}
          onClick={handleRunBacktest}
          className="w-full sm:w-auto px-5 py-2 rounded-lg font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 bg-[var(--sh-primary)] text-[var(--sh-primary-fg)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-xs disabled:opacity-50"
        >
          {backtestMutation.isPending ? (
            <>
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
              <span>Simulating...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              <span>Run Pre-Flight Backtest</span>
            </>
          )}
        </button>
      </div>

      {/* Pre-Flight Backtest Output Display */}
      {backtestResult && (
        <div
          className="p-5 rounded-xl border space-y-4 animate-in fade-in duration-200"
          style={{
            backgroundColor: "var(--sh-surface-2)",
            borderColor: "var(--sh-emerald)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[var(--sh-emerald)]" />
              <span className="font-mono text-sm font-bold text-[var(--sh-fg-1)]">
                Pre-Flight Backtest Results ({activeRecipe.name})
              </span>
            </div>
            <span className="text-[10px] font-mono text-[var(--sh-fg-4)]">
              {backtestResult.sampleOccurrences} historical catalyst events
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-lg bg-[var(--sh-surface-1)] border border-[var(--sh-border)]">
              <div className="text-[10px] font-mono text-[var(--sh-fg-4)] uppercase">
                Win Rate
              </div>
              <div className="font-mono text-lg font-bold text-[var(--sh-emerald)] mt-1">
                {backtestResult.winRatePct}%
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[var(--sh-surface-1)] border border-[var(--sh-border)]">
              <div className="text-[10px] font-mono text-[var(--sh-fg-4)] uppercase">
                Max Historical Drawdown
              </div>
              <div className="font-mono text-lg font-bold text-[var(--sh-rose)] mt-1">
                {backtestResult.maxDrawdownPct}%
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[var(--sh-surface-1)] border border-[var(--sh-border)]">
              <div className="text-[10px] font-mono text-[var(--sh-fg-4)] uppercase">
                Profit Factor
              </div>
              <div className="font-mono text-lg font-bold text-[var(--sh-fg-1)] mt-1">
                {backtestResult.profitFactor}x
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[var(--sh-surface-1)] border border-[var(--sh-border)]">
              <div className="text-[10px] font-mono text-[var(--sh-fg-4)] uppercase">
                Expected Return
              </div>
              <div className="font-mono text-lg font-bold text-[var(--sh-cyan)] mt-1">
                ${backtestResult.expectedReturnPerDollar} / $1
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

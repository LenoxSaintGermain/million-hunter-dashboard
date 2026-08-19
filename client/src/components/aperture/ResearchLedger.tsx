import { CalendarDays, Landmark, Info, ExternalLink, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

type LedgerFact = {
  id: number;
  factKey: string;
  valueNum: number | null;
  valueText: string | null;
  unit: string | null;
  basis: string;
  providerId: string;
  sourceName: string | null;
  sourceUrl: string | null;
  asOf: number | null;
  fetchedAt: number | null;
};

const FRED_CONTEXT: Record<string, { label: string; impact: string }> = {
  fed_funds_rate: { label: "Federal funds rate", impact: "Sets the baseline cost of cash and affects discount-rate sensitivity." },
  treasury_10y: { label: "10-year Treasury", impact: "Frames long-duration valuation pressure and the broader rate backdrop." },
  treasury_2y: { label: "2-year Treasury", impact: "Signals near-term policy expectations that can move rate-sensitive assets." },
  cpi_index: { label: "Consumer price index", impact: "Shows the inflation regime that can alter real demand and policy expectations." },
  unemployment_rate: { label: "Unemployment rate", impact: "Provides labor-market context for cyclical demand and earnings assumptions." },
  industrial_production: { label: "Industrial production", impact: "Tracks the industrial cycle relevant to cyclical revenue and operating leverage." },
  breakeven_inflation_10y: { label: "10-year inflation expectation", impact: "Shows market-implied inflation expectations and real-rate risk." },
};

function formatValue(fact: LedgerFact) {
  if (fact.valueNum == null) return fact.valueText ?? "Not reported";
  if (fact.unit === "pct") return `${fact.valueNum.toFixed(2)}%`;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(fact.valueNum);
}

function formatDate(value: number | null) {
  return value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "Observation date unavailable";
}

export function ResearchLedger({ macroFacts, onRefresh, refreshing = false }: { macroFacts: LedgerFact[]; onRefresh?: () => void; refreshing?: boolean }) {
  const fredFacts = macroFacts.filter((fact) => fact.providerId === "fred");
  return (
    <section className="space-y-4">
      <div className="rounded-xl border p-3 sm:p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4" style={{ color: "var(--sh-signal)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Research ledger · macro evidence</p>
              <span className="rounded-full px-2 py-0.5 text-[0.62rem] font-semibold tracking-[0.12em]" style={{ background: "var(--sh-signal)", color: "var(--sh-primary-fg)" }}>FRED</span>
            </div>
            <p className="mt-1 text-xs leading-5" style={{ color: "var(--sh-fg-muted)" }}>A macro snapshot for this thesis and paper portfolio. It explains the backdrop; it does not predict a trade outcome.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-xs sm:flex" style={{ color: "var(--sh-fg-muted)" }}><CalendarDays className="h-3.5 w-3.5" /> Source observation dates shown below</span>
            {onRefresh && <Button variant="outline" size="sm" disabled={refreshing} onClick={onRefresh}>{refreshing ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}{refreshing ? "Refreshing…" : "Refresh macro evidence"}</Button>}
          </div>
        </div>
      </div>

      {fredFacts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}>
          <Landmark className="mx-auto h-5 w-5" />
          <p className="mt-2 text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>No FRED observations captured for this brief yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5">FRED is connected. Build or refresh the Capital Brief to collect the latest macro snapshot into this ledger.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {fredFacts.map((fact) => {
            const context = FRED_CONTEXT[fact.factKey] ?? { label: fact.factKey.replace(/_/g, " "), impact: "Macro context captured from the Federal Reserve economic data service." };
            return <article key={fact.id} className="rounded-xl border p-3 sm:p-4" style={{ borderColor: "var(--sh-border-1)", background: "var(--sh-surface)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>{context.label}</p>
                    <TooltipProvider delayDuration={120}><Tooltip><TooltipTrigger asChild><button aria-label={`How ${context.label} affects this thesis`} className="text-muted-foreground hover:text-amber"><Info className="h-3.5 w-3.5" /></button></TooltipTrigger><TooltipContent className="max-w-[280px]"><p className="text-xs leading-5">{context.impact}</p></TooltipContent></Tooltip></TooltipProvider>
                  </div>
                  <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sh-signal)" }}>FRED · verified macro evidence</p>
                </div>
                <p className="text-xl font-semibold" style={{ color: "var(--sh-text-primary)" }}>{formatValue(fact)}</p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>
                <span>Observed {formatDate(fact.asOf)}</span>
                <span>·</span>
                <span>{fact.sourceName ?? "Federal Reserve Economic Data"}</span>
                {fact.sourceUrl && <a href={fact.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2" style={{ color: "var(--sh-signal)" }}>Source <ExternalLink className="h-3 w-3" /></a>}
              </div>
              <p className="mt-3 border-t pt-3 text-xs leading-5" style={{ borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }}><span className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>Why it matters: </span>{context.impact}</p>
            </article>;
          })}
        </div>
      )}
    </section>
  );
}

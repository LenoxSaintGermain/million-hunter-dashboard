import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import EditorialTopNav from "@/components/EditorialTopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Waves, MapPin, Zap, TrendingUp, AlertTriangle, Clock,
  DollarSign, RefreshCw, Sparkles, ChevronDown,
  Building2, Target, BatteryCharging, UtensilsCrossed,
  BedDouble, Home, Loader2, X, ExternalLink,
  Factory, Server, Truck, Sun, Landmark,
  Star, Database, Play, CheckCircle2, CircleDot,
  Search, GitBranch, Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Anchor type config ───────────────────────────────────────────────────────

const ANCHOR_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  data_center:   { icon: Server,   color: "text-cyan-400",   bg: "bg-cyan-500/10 border-cyan-500/20",   label: "Data Center" },
  logistics:     { icon: Truck,    color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",   label: "Logistics Hub" },
  manufacturing: { icon: Factory,  color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20", label: "Manufacturing" },
  energy:        { icon: Sun,      color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "Energy" },
  government:    { icon: Landmark, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", label: "Government" },
  industrial:    { icon: Building2, color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20",  label: "Industrial" },
};

const SOURCE_LABELS: Record<string, string> = {
  press_release: "Press Release",
  permit: "Permit Filing",
  edc: "EDC Announcement",
  workforce: "Workforce Signal",
  utility: "Utility Expansion",
};

// ─── Confidence bar ───────────────────────────────────────────────────────────

function ConfidenceBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[var(--bone)] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn(
            "h-full rounded-full",
            score >= 0.75 ? "bg-rose-500" : score >= 0.55 ? "bg-amber-500" : "bg-emerald-500"
          )}
        />
      </div>
      <span className={cn(
        "text-xs font-bold w-8 text-right tabular-nums",
        score >= 0.75 ? "text-rose-400" : score >= 0.55 ? "text-[var(--amber)]" : "text-[var(--sage)]"
      )}>
        {Math.round(score * 100)}
      </span>
    </div>
  );
}

// ─── Gap analysis panel ───────────────────────────────────────────────────────

function GapAnalysisPanel({ gapAnalysis }: { gapAnalysis: any }) {
  if (!gapAnalysis) return null;
  const urgencyColor = (u: string) =>
    u === "immediate" ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
    : u === "6_months" ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
    : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  const urgencyLabel = (u: string) =>
    u === "immediate" ? "Act Now" : u === "6_months" ? "6-Month Window" : "12-Month Window";

  return (
    <div className="mt-4 space-y-4">
      {gapAnalysis.analystNote && (
        <div className="rounded-xl border border-[var(--signal-gold)]/30 bg-[var(--signal-gold)]/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-[var(--signal-gold)]" />
            <span className="text-xs font-semibold text-[var(--signal-gold)] uppercase tracking-wider">Intelligence Brief</span>
          </div>
          <p className="text-sm text-[var(--ink)] leading-relaxed">{gapAnalysis.analystNote}</p>
        </div>
      )}
      {gapAnalysis.gaps?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--sh-fg-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-rose-400" />
            Critical Infrastructure Gaps
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {gapAnalysis.evChargersWithin10mi !== null && (
              <div className="flex items-center gap-3 rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-3">
                <BatteryCharging className="h-4 w-4 text-cyan-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-[var(--ink)]">EV Charging</div>
                  <div className="text-xs text-[var(--sh-fg-muted)]">{gapAnalysis.evChargersWithin10mi} chargers within 10mi</div>
                </div>
                {gapAnalysis.evChargersWithin10mi <= 2 && (
                  <Badge className="ml-auto text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/20">Gap</Badge>
                )}
              </div>
            )}
            {gapAnalysis.foodOptionsWithin5mi !== null && (
              <div className="flex items-center gap-3 rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-3">
                <UtensilsCrossed className="h-4 w-4 text-orange-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-[var(--ink)]">Food Options</div>
                  <div className="text-xs text-[var(--sh-fg-muted)]">{gapAnalysis.foodOptionsWithin5mi} options within 5mi</div>
                </div>
                {gapAnalysis.foodOptionsWithin5mi <= 3 && (
                  <Badge className="ml-auto text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/20">Gap</Badge>
                )}
              </div>
            )}
            {gapAnalysis.lodgingCapacity && (
              <div className="flex items-center gap-3 rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-3">
                <BedDouble className="h-4 w-4 text-purple-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-[var(--ink)]">Lodging</div>
                  <div className="text-xs text-[var(--sh-fg-muted)] capitalize">{gapAnalysis.lodgingCapacity} capacity</div>
                </div>
                {gapAnalysis.lodgingCapacity === "low" && (
                  <Badge className="ml-auto text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/20">Gap</Badge>
                )}
              </div>
            )}
            {gapAnalysis.housingVacancyRate && (
              <div className="flex items-center gap-3 rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-3">
                <Home className="h-4 w-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-[var(--ink)]">Housing Vacancy</div>
                  <div className="text-xs text-[var(--sh-fg-muted)]">{gapAnalysis.housingVacancyRate}</div>
                </div>
              </div>
            )}
          </div>
          {gapAnalysis.gaps.length > 0 && (
            <ul className="mt-2 space-y-1">
              {gapAnalysis.gaps.map((g: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[var(--sh-fg-muted)]">
                  <span className="text-rose-400 mt-0.5">▸</span>{g}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {gapAnalysis.plays?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--sh-fg-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <DollarSign className="h-3 w-3 text-[var(--signal-gold)]" />
            Main Street Plays
          </h4>
          <div className="space-y-3">
            {gapAnalysis.plays.map((play: any) => (
              <div key={play.rank} className="rounded-xl border border-[var(--rule)] bg-[var(--paper)] p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--signal-gold)] bg-[var(--signal-gold)]/10 rounded-full w-5 h-5 flex items-center justify-center">
                      {play.rank}
                    </span>
                    <span className="text-sm font-semibold text-[var(--ink)]">{play.title}</span>
                  </div>
                  <Badge className={cn("text-[10px] shrink-0 border", urgencyColor(play.urgency))}>
                    {urgencyLabel(play.urgency)}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--sh-fg-muted)] leading-relaxed">{play.description}</p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <DollarSign className="h-3 w-3 text-[var(--sh-fg-muted)]" />
                    <span className="text-[var(--sh-fg-muted)]">Investment:</span>
                    <span className="font-semibold text-[var(--ink)]">{play.estimatedInvestment}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <TrendingUp className="h-3 w-3 text-[var(--sh-fg-muted)]" />
                    <span className="text-[var(--sh-fg-muted)]">Cash Flow:</span>
                    <span className="font-semibold text-[var(--sage)]">{play.estimatedCashFlow}</span>
                  </div>
                </div>
                {play.capitalStackSketch && (
                  <div className="rounded-lg bg-[var(--bone)] px-3 py-2 text-xs text-[var(--sh-fg-muted)]">
                    <span className="font-semibold text-[var(--ink)]">Stack: </span>{play.capitalStackSketch}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pipeline results drawer ──────────────────────────────────────────────────

function PipelineResultsDrawer({ job }: { job: any }) {
  if (!job) return null;
  const stepIcon = (step: string, jobStep: string | null, status: string) => {
    if (status === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    if (jobStep === step && status === "running") return <Loader2 className="h-4 w-4 text-[var(--signal-gold)] animate-spin" />;
    return <CircleDot className="h-4 w-4 text-[var(--sh-fg-muted)]" />;
  };

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-[var(--rule)] bg-[var(--bone)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="h-3.5 w-3.5 text-[var(--signal-gold)]" />
        <span className="text-xs font-semibold text-[var(--signal-gold)] uppercase tracking-wider">Pipeline Results</span>
        <Badge className={cn("ml-auto text-[10px] border",
          job.status === "done" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : job.status === "error" ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
        )}>
          {job.status}
        </Badge>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 text-xs">
        {stepIcon("market_scan", job.currentStep, job.status)}
        <span className={cn("font-medium", job.currentStep === "market_scan" && job.status === "running" ? "text-[var(--signal-gold)]" : "text-[var(--sh-fg-muted)]")}>
          Market Scan
        </span>
        <div className="flex-1 h-px bg-[var(--rule)]" />
        {stepIcon("tide", job.currentStep, job.status)}
        <span className={cn("font-medium", job.currentStep === "tide" && job.status === "running" ? "text-[var(--signal-gold)]" : "text-[var(--sh-fg-muted)]")}>
          TIDE
        </span>
        <div className="flex-1 h-px bg-[var(--rule)]" />
        {stepIcon("ic", job.currentStep, job.status)}
        <span className={cn("font-medium", job.currentStep === "ic" && job.status === "running" ? "text-[var(--signal-gold)]" : "text-[var(--sh-fg-muted)]")}>
          IC Verdict
        </span>
      </div>

      {/* Market scan results */}
      {job.marketScanResults?.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-[var(--ink)] mb-2 flex items-center gap-1.5">
            <Search className="h-3 w-3" /> Market Scan — {job.marketScanResults.length} targets found
          </h5>
          <div className="space-y-2">
            {job.marketScanResults.slice(0, 3).map((r: any, i: number) => (
              <div key={i} className="rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-3">
                <div className="text-xs font-semibold text-[var(--ink)] line-clamp-1">{r.name}</div>
                <div className="text-xs text-[var(--sh-fg-muted)] mt-0.5 line-clamp-2">{r.snippet}</div>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-[var(--signal-gold)] hover:underline mt-1">
                    <ExternalLink className="h-2.5 w-2.5" /> View listing
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TIDE signals */}
      {job.tideSignals?.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-[var(--ink)] mb-2 flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-cyan-400" /> TIDE — {job.tideSignals.length} federal capital signals
          </h5>
          <div className="space-y-1">
            {job.tideSignals.map((s: any, i: number) => (
              <div key={i} className="text-xs text-[var(--sh-fg-muted)] flex items-start gap-1.5">
                <span className="text-cyan-400 mt-0.5 shrink-0">▸</span>
                <span className="line-clamp-2">{s.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IC Verdict */}
      {job.icVerdict && (
        <div className={cn("rounded-xl border p-4",
          job.icVerdict.verdict === "approve" ? "border-emerald-500/30 bg-emerald-500/5"
          : job.icVerdict.verdict === "pass" ? "border-rose-500/30 bg-rose-500/5"
          : "border-amber-500/30 bg-amber-500/5"
        )}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5 text-[var(--signal-gold)]" />
              <span className="text-xs font-semibold text-[var(--ink)] uppercase tracking-wider">IC Verdict</span>
            </div>
            <Badge className={cn("text-[10px] border font-bold",
              job.icVerdict.verdict === "approve" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : job.icVerdict.verdict === "pass" ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            )}>
              {job.icVerdict.verdict?.toUpperCase()} · {Math.round((job.icVerdict.score ?? 0) * 100)}
            </Badge>
          </div>
          <p className="text-xs text-[var(--sh-fg-muted)] leading-relaxed">{job.icVerdict.rationale}</p>
          {job.icVerdict.keyOpportunity && (
            <div className="mt-2 text-xs">
              <span className="font-semibold text-emerald-400">Opportunity: </span>
              <span className="text-[var(--sh-fg-muted)]">{job.icVerdict.keyOpportunity}</span>
            </div>
          )}
          {job.icVerdict.keyRisk && (
            <div className="mt-1 text-xs">
              <span className="font-semibold text-rose-400">Risk: </span>
              <span className="text-[var(--sh-fg-muted)]">{job.icVerdict.keyRisk}</span>
            </div>
          )}
        </div>
      )}

      {job.status === "error" && job.errorMessage && (
        <div className="text-xs text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-lg p-3">
          {job.errorMessage}
        </div>
      )}
    </div>
  );
}

// ─── Signal card ──────────────────────────────────────────────────────────────

function SignalCard({
  signal,
  expanded,
  onToggle,
  onEscalate,
  onDismiss,
  onFavorite,
  onRunPipeline,
  isEscalating,
  isFavoriting,
  isFavorited,
  pipelineJob,
  isPipelining,
}: {
  signal: any;
  expanded: boolean;
  onToggle: () => void;
  onEscalate: () => void;
  onDismiss: () => void;
  onFavorite: () => void;
  onRunPipeline: () => void;
  isEscalating: boolean;
  isFavoriting: boolean;
  isFavorited: boolean;
  pipelineJob: any;
  isPipelining: boolean;
}) {
  const anchor = ANCHOR_CONFIG[signal.anchor_type] ?? ANCHOR_CONFIG.industrial;
  const AnchorIcon = anchor.icon;
  const isAnalyzed = signal.status === "analyzed";
  const isDismissed = signal.status === "dismissed";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: isDismissed ? 0.4 : 1, y: 0 }}
      className={cn(
        "rounded-2xl border bg-[var(--paper)] overflow-hidden transition-all duration-200",
        expanded ? "border-[var(--signal-gold)]/40 shadow-lg" : "border-[var(--rule)] hover:border-[var(--signal-gold)]/20",
        isDismissed && "opacity-40"
      )}
    >
      {/* Card header */}
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={onToggle}>
        <div className={cn("rounded-xl border p-2.5 shrink-0", anchor.bg)}>
          <AnchorIcon className={cn("h-4 w-4", anchor.color)} />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--ink)] leading-snug line-clamp-2">
              {signal.project_name}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {isAnalyzed && (
                <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  Analyzed
                </Badge>
              )}
              {isFavorited && (
                <Badge className="text-[10px] bg-[var(--signal-gold)]/10 text-[var(--signal-gold)] border-[var(--signal-gold)]/20">
                  Saved
                </Badge>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onFavorite(); }}
                disabled={isFavoriting || isFavorited}
                className={cn(
                  "transition-colors",
                  isFavorited ? "text-[var(--signal-gold)]" : "text-[var(--sh-fg-muted)] hover:text-[var(--signal-gold)]"
                )}
                title={isFavorited ? "Saved to favorites" : "Save to favorites"}
              >
                <Star className={cn("h-3.5 w-3.5", isFavorited && "fill-current")} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                className="text-[var(--sh-fg-muted)] hover:text-rose-400 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-[var(--sh-fg-muted)]">
              <MapPin className="h-3 w-3" />{signal.location}
            </div>
            <Badge className={cn("text-[10px] border", anchor.bg, anchor.color)}>{anchor.label}</Badge>
            <Badge className="text-[10px] bg-[var(--bone)] text-[var(--sh-fg-muted)] border-[var(--rule)]">
              {SOURCE_LABELS[signal.source_type] ?? signal.source_type}
            </Badge>
          </div>
          {signal.estimated_scale && (
            <div className="flex items-center gap-1 text-xs text-[var(--sh-fg-muted)]">
              <Zap className="h-3 w-3 text-[var(--amber)]" />{signal.estimated_scale}
            </div>
          )}
          <ConfidenceBar score={signal.confidenceScore ?? signal.confidence_score ?? 0} />
        </div>
        <ChevronDown className={cn("h-4 w-4 text-[var(--sh-fg-muted)] shrink-0 transition-transform duration-200", expanded && "rotate-180")} />
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-[var(--rule)] pt-4 space-y-4">
              {signal.snippet && (
                <p className="text-xs text-[var(--sh-fg-muted)] leading-relaxed line-clamp-4">{signal.snippet}</p>
              )}
              {signal.source_url && (
                <a href={signal.source_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--signal-gold)] hover:underline">
                  <ExternalLink className="h-3 w-3" />View source
                </a>
              )}

              {/* Gap analysis or escalate CTA */}
              {isAnalyzed && signal.gapAnalysis ? (
                <>
                  <GapAnalysisPanel gapAnalysis={signal.gapAnalysis} />
                  {/* Pipeline CTA — only show after analysis */}
                  {isFavorited && (
                    <div className="flex items-center justify-between rounded-xl border border-dashed border-cyan-500/30 bg-cyan-500/5 p-4">
                      <div>
                        <p className="text-sm font-semibold text-[var(--ink)]">Run Cross-Tool Pipeline</p>
                        <p className="text-xs text-[var(--sh-fg-muted)] mt-0.5">
                          Market Scan → TIDE → IC Consensus on best acquisition target
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onRunPipeline(); }}
                        disabled={isPipelining || !!pipelineJob}
                        className="shrink-0 bg-cyan-600 text-white hover:bg-cyan-500 border-0"
                      >
                        {isPipelining ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Running…</>
                        ) : pipelineJob ? (
                          <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Ran</>
                        ) : (
                          <><Play className="h-3.5 w-3.5 mr-1.5" />Run Pipeline</>
                        )}
                      </Button>
                    </div>
                  )}
                  {/* Pipeline results */}
                  {pipelineJob && <PipelineResultsDrawer job={pipelineJob} />}
                </>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-dashed border-[var(--signal-gold)]/30 bg-[var(--signal-gold)]/5 p-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">Run Gap Analysis</p>
                    <p className="text-xs text-[var(--sh-fg-muted)] mt-0.5">
                      Identify infrastructure deficits and generate Main Street plays (~600 tokens)
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onEscalate(); }}
                    disabled={isEscalating || isDismissed}
                    className="shrink-0 bg-[var(--signal-gold)] text-[var(--paper)] hover:bg-[var(--signal-gold)]/90 border-0"
                  >
                    {isEscalating ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Analyzing…</>
                    ) : (
                      <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Escalate</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Favorites panel ──────────────────────────────────────────────────────────

function FavoritesPanel({ favorites, pipelineJobs }: { favorites: any[]; pipelineJobs: any[] }) {
  if (!favorites.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[var(--signal-gold)]/30 bg-[var(--signal-gold)]/5 p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Star className="h-4 w-4 text-[var(--signal-gold)] fill-current" />
        <h2 className="text-sm font-semibold text-[var(--ink)]">Saved Signals</h2>
        <Badge className="ml-auto text-[10px] bg-[var(--signal-gold)]/10 text-[var(--signal-gold)] border-[var(--signal-gold)]/20">
          {favorites.length}
        </Badge>
      </div>
      <div className="space-y-2">
        {favorites.map((fav) => {
          const job = pipelineJobs.find((j) => j.favoriteId === fav.id);
          const anchor = ANCHOR_CONFIG[fav.anchorType ?? "industrial"] ?? ANCHOR_CONFIG.industrial;
          return (
            <div key={fav.id} className="flex items-center gap-3 rounded-xl border border-[var(--rule)] bg-[var(--paper)] p-3">
              <div className={cn("rounded-lg border p-2 shrink-0", anchor.bg)}>
                <anchor.icon className={cn("h-3.5 w-3.5", anchor.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-[var(--ink)] line-clamp-1">{fav.projectName}</div>
                <div className="text-xs text-[var(--sh-fg-muted)] flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5" />{fav.location}
                </div>
              </div>
              {job ? (
                <Badge className={cn("text-[10px] border shrink-0",
                  job.status === "done" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : job.status === "error" ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                )}>
                  {job.status === "done" ? "Pipeline done" : job.status === "error" ? "Error" : "Running"}
                </Badge>
              ) : (
                <Badge className="text-[10px] bg-[var(--bone)] text-[var(--sh-fg-muted)] border-[var(--rule)] shrink-0">
                  {fav.pipelineStatus === "none" ? "Saved" : fav.pipelineStatus}
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RippleEffect() {
  const { toast } = useToast();
  const [geography, setGeography] = useState("Atlanta, GA");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [escalatingId, setEscalatingId] = useState<number | null>(null);
  const [favoritingId, setFavoritingId] = useState<number | null>(null);
  const [pipeliningFavId, setPipeliningFavId] = useState<number | null>(null);
  // Track which signal IDs have been favorited this session (by signal id → favorite id)
  const [favoritedSignals, setFavoritedSignals] = useState<Record<number, number>>({});
  // Track pipeline jobs by favorite id
  const [pipelineJobIds, setPipelineJobIds] = useState<Record<number, number>>({});

  const { data: signals = [], refetch } = trpc.ripple.list.useQuery({
    status: "all", minConfidence: 0, limit: 100,
  });

  const { data: favorites = [], refetch: refetchFavorites } = trpc.ripple.listFavorites.useQuery();
  const { data: pipelineJobs = [], refetch: refetchJobs } = trpc.ripple.listPipelineJobs.useQuery();

  // Poll pipeline jobs that are running
  const runningJobs = (pipelineJobs as any[]).filter((j) => j.status === "queued" || j.status === "running");
  const { data: polledJob } = trpc.ripple.getPipelineStatus.useQuery(
    { jobId: runningJobs[0]?.id ?? 0 },
    {
      enabled: runningJobs.length > 0,
      refetchInterval: 3000,
      onSuccess: (job: any) => {
        if (job?.status === "done" || job?.status === "error") {
          refetchJobs();
          refetchFavorites();
          toast({
            title: job.status === "done" ? "Pipeline complete" : "Pipeline error",
            description: job.status === "done"
              ? `Market Scan + TIDE + IC finished for ${(favorites as any[]).find((f) => f.id === job.favoriteId)?.projectName ?? "signal"}`
              : job.errorMessage,
            variant: job.status === "error" ? "destructive" : "default",
          });
        }
      },
    } as any
  );

  const scanMutation = trpc.ripple.scan.useMutation({
    onSuccess: (data) => {
      setIsScanning(false);
      refetch();
      if ((data as any).fromCache) {
        toast({
          title: `Cached result — ${data.signalsFound} signals`,
          description: `${(data as any).cachedAgo} · Use force refresh to re-scan`,
        });
      } else {
        toast({ title: `${data.signalsFound} signals detected`, description: data.message });
      }
    },
    onError: (err) => {
      setIsScanning(false);
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    },
  });

  const escalateMutation = trpc.ripple.escalate.useMutation({
    onSuccess: (data) => {
      setEscalatingId(null);
      refetch();
      const playCount = data.gapAnalysis?.plays?.length ?? 0;
      toast({
        title: "Gap analysis complete",
        description: `${playCount} Main Street ${playCount === 1 ? "play" : "plays"} identified`,
      });
    },
    onError: (err) => {
      setEscalatingId(null);
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    },
  });

  const dismissMutation = trpc.ripple.dismiss.useMutation({ onSuccess: () => refetch() });

  const favoriteMutation = trpc.ripple.favorite.useMutation({
    onSuccess: (data, variables) => {
      setFavoritingId(null);
      setFavoritedSignals((prev) => ({ ...prev, [variables.signalId]: data.favoriteId }));
      refetchFavorites();
      toast({ title: "Signal saved", description: "Favorited. Run the pipeline to get acquisition targets." });
    },
    onError: (err) => {
      setFavoritingId(null);
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const pipelineMutation = trpc.ripple.runPipeline.useMutation({
    onSuccess: (data, variables) => {
      setPipeliningFavId(null);
      setPipelineJobIds((prev) => ({ ...prev, [variables.favoriteId]: data.jobId }));
      refetchJobs();
      toast({ title: "Pipeline queued", description: "Market Scan → TIDE → IC running in background" });
    },
    onError: (err) => {
      setPipeliningFavId(null);
      toast({ title: "Pipeline failed", description: err.message, variant: "destructive" });
    },
  });

  const handleScan = (forceRefresh = false) => {
    if (!geography.trim()) return;
    setIsScanning(true);
    scanMutation.mutate({ geography, minConfidence: 0.35, forceRefresh });
  };

  const handleEscalate = (signalId: number) => {
    setEscalatingId(signalId);
    setExpandedId(signalId);
    escalateMutation.mutate({ signalId });
  };

  const handleFavorite = (signal: any) => {
    setFavoritingId(signal.id);
    favoriteMutation.mutate({
      signalId: signal.id,
      playsJson: signal.gapAnalysis?.plays,
      gapAnalysisJson: signal.gapAnalysis,
    });
  };

  const handleRunPipeline = (favoriteId: number) => {
    setPipeliningFavId(favoriteId);
    pipelineMutation.mutate({ favoriteId });
  };

  const activeSignals = (signals as any[]).filter((s) => s.status !== "dismissed");
  const filteredSignals = activeFilter
    ? activeSignals.filter((s) => s.anchor_type === activeFilter)
    : activeSignals;

  const anchorCounts = activeSignals.reduce((acc: Record<string, number>, s: any) => {
    acc[s.anchor_type] = (acc[s.anchor_type] ?? 0) + 1;
    return acc;
  }, {});

  const analyzedCount = activeSignals.filter((s) => s.status === "analyzed").length;
  const highConfidenceCount = activeSignals.filter((s) => (s.confidenceScore ?? s.confidence_score ?? 0) >= 0.65).length;
  const favoritesArr = favorites as any[];
  const pipelineJobsArr = pipelineJobs as any[];

  // Build a set of favorited signal IDs from DB favorites (by matching project_name)
  const favoritedProjectNames = new Set(favoritesArr.map((f) => f.projectName));

  return (
    <EditorialTopNav>
      <div className="space-y-6">
        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a] border border-[var(--rule)] p-6 md:p-8"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-amber-500/5" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <Waves className="h-5 w-5 text-cyan-400" />
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">RippleEffect Scanner</span>
              <div className="ml-auto flex items-center gap-1.5 text-xs text-white/40">
                <Database className="h-3 w-3" />
                <span>24h cache · zero tokens on repeat</span>
              </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">
              Anchor Development Intelligence
            </h1>
            <p className="text-sm text-white/60 max-w-2xl leading-relaxed">
              Detect massive industrial permits and press releases before they hit the mainstream.
              Surface the picks-and-shovels Main Street plays created by anchor developments.
              Results cached 24h — favorite a signal to run the full acquisition pipeline.
            </p>
            <div className="flex flex-wrap gap-6 mt-5">
              <div>
                <div className="text-xl font-bold text-white tabular-nums">{activeSignals.length}</div>
                <div className="text-xs text-white/50">Active Signals</div>
              </div>
              <div>
                <div className="text-xl font-bold text-cyan-400 tabular-nums">{highConfidenceCount}</div>
                <div className="text-xs text-white/50">High Confidence</div>
              </div>
              <div>
                <div className="text-xl font-bold text-[var(--signal-gold)] tabular-nums">{analyzedCount}</div>
                <div className="text-xs text-white/50">Plays Generated</div>
              </div>
              <div>
                <div className="text-xl font-bold text-emerald-400 tabular-nums">{favoritesArr.length}</div>
                <div className="text-xs text-white/50">Saved</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Scan controls */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-[var(--rule)] bg-[var(--paper)] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-[var(--signal-gold)]" />
            <h2 className="text-sm font-semibold text-[var(--ink)]">Scout a Geography</h2>
            <span className="text-xs text-[var(--sh-fg-muted)] ml-auto">8 surgical queries · no LLM until escalation</span>
          </div>
          <div className="flex gap-3">
            <Input
              value={geography}
              onChange={(e) => setGeography(e.target.value)}
              placeholder="e.g. Atlanta, GA · Charlotte, NC · Licking County, OH"
              className="flex-1 bg-[var(--bone)] border-[var(--rule)] text-[var(--ink)] placeholder:text-[var(--sh-fg-muted)]"
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
            />
            <Button
              onClick={() => handleScan(false)}
              disabled={isScanning || !geography.trim()}
              className="bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--ink)]/90 border-0 shrink-0"
            >
              {isScanning ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Scanning…</>
              ) : (
                <><Waves className="h-4 w-4 mr-2" />Run Scan</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleScan(true)}
              disabled={isScanning || !geography.trim()}
              className="shrink-0 border-[var(--rule)] text-[var(--sh-fg-muted)] hover:text-[var(--ink)]"
              title="Force refresh — bypass 24h cache"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-[var(--sh-fg-muted)] mt-3 leading-relaxed">
            Searches press release wires, EDC announcements, permit filings, workforce signals, and utility expansions.
            Results cached 24h per geography — use the refresh button to force a new scan.
          </p>
        </motion.div>

        {/* Favorites panel */}
        {favoritesArr.length > 0 && (
          <FavoritesPanel favorites={favoritesArr} pipelineJobs={pipelineJobsArr} />
        )}

        {/* Anchor type filters */}
        {Object.keys(anchorCounts).length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveFilter(null)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
                !activeFilter
                  ? "bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]"
                  : "bg-[var(--paper)] text-[var(--sh-fg-muted)] border-[var(--rule)] hover:border-[var(--ink)]/30"
              )}
            >
              All ({activeSignals.length})
            </button>
            {Object.entries(anchorCounts).map(([type, count]) => {
              const cfg = ANCHOR_CONFIG[type] ?? ANCHOR_CONFIG.industrial;
              return (
                <button
                  key={type}
                  onClick={() => setActiveFilter(activeFilter === type ? null : type)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
                    activeFilter === type
                      ? "bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]"
                      : "bg-[var(--paper)] text-[var(--sh-fg-muted)] border-[var(--rule)] hover:border-[var(--ink)]/30"
                  )}
                >
                  {cfg.label} ({count as number})
                </button>
              );
            })}
          </motion.div>
        )}

        {/* Signal queue */}
        {filteredSignals.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-dashed border-[var(--rule)] p-12 text-center">
            <Waves className="h-10 w-10 text-[var(--sh-fg-muted)] mx-auto mb-4 opacity-40" />
            <h3 className="text-sm font-semibold text-[var(--ink)] mb-2">No signals yet</h3>
            <p className="text-xs text-[var(--sh-fg-muted)] max-w-sm mx-auto">
              Enter a geography above and run a scan. The system will search 8 signal sources and surface
              anchor developments above the confidence threshold.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[var(--sh-fg-muted)] uppercase tracking-wider">
                Signal Queue — {filteredSignals.length} {filteredSignals.length === 1 ? "signal" : "signals"}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => refetch()}
                  className="text-xs text-[var(--sh-fg-muted)] hover:text-[var(--ink)] flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />Refresh
                </button>
              </div>
            </div>
            <AnimatePresence>
              {filteredSignals.map((signal: any) => {
                const isFavorited = favoritedProjectNames.has(signal.project_name) || signal.id in favoritedSignals;
                const favoriteId = favoritedSignals[signal.id] ?? favoritesArr.find((f) => f.projectName === signal.project_name)?.id;
                const pipelineJob = favoriteId ? pipelineJobsArr.find((j) => j.favoriteId === favoriteId) : null;
                return (
                  <SignalCard
                    key={signal.id}
                    signal={signal}
                    expanded={expandedId === signal.id}
                    onToggle={() => setExpandedId(expandedId === signal.id ? null : signal.id)}
                    onEscalate={() => handleEscalate(signal.id)}
                    onDismiss={() => dismissMutation.mutate({ signalId: signal.id })}
                    onFavorite={() => handleFavorite(signal)}
                    onRunPipeline={() => favoriteId && handleRunPipeline(favoriteId)}
                    isEscalating={escalatingId === signal.id}
                    isFavoriting={favoritingId === signal.id}
                    isFavorited={isFavorited}
                    pipelineJob={pipelineJob}
                    isPipelining={pipeliningFavId === favoriteId}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </EditorialTopNav>
  );
}

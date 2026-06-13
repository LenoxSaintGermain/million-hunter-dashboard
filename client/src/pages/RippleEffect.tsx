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
  DollarSign, RefreshCw, Sparkles, ChevronDown, ChevronRight,
  Building2, Target, Fuel, BatteryCharging, UtensilsCrossed,
  BedDouble, Home, ArrowUpRight, Loader2, X, ExternalLink,
  Factory, Server, Truck, Sun, Landmark,
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

// ─── Gap analysis drawer ──────────────────────────────────────────────────────

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
      {/* Analyst note */}
      {gapAnalysis.analystNote && (
        <div className="rounded-xl border border-[var(--signal-gold)]/30 bg-[var(--signal-gold)]/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-[var(--signal-gold)]" />
            <span className="text-xs font-semibold text-[var(--signal-gold)] uppercase tracking-wider">Intelligence Brief</span>
          </div>
          <p className="text-sm text-[var(--ink)] leading-relaxed">{gapAnalysis.analystNote}</p>
        </div>
      )}

      {/* Infrastructure gaps */}
      {gapAnalysis.gaps?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--sh-fg-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-rose-400" />
            Critical Infrastructure Gaps
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* EV chargers */}
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
            {/* Food options */}
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
            {/* Lodging */}
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
            {/* Housing */}
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
          {/* Text gaps */}
          {gapAnalysis.gaps.length > 0 && (
            <ul className="mt-2 space-y-1">
              {gapAnalysis.gaps.map((g: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[var(--sh-fg-muted)]">
                  <span className="text-rose-400 mt-0.5">▸</span>
                  {g}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Main Street plays */}
      {gapAnalysis.plays?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--sh-fg-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <DollarSign className="h-3 w-3 text-[var(--signal-gold)]" />
            Main Street Plays
          </h4>
          <div className="space-y-3">
            {gapAnalysis.plays.map((play: any) => (
              <div
                key={play.rank}
                className="rounded-xl border border-[var(--rule)] bg-[var(--paper)] p-4 space-y-2"
              >
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
                    <span className="font-semibold text-[var(--ink)]">Stack: </span>
                    {play.capitalStackSketch}
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

// ─── Signal card ──────────────────────────────────────────────────────────────

function SignalCard({
  signal,
  expanded,
  onToggle,
  onEscalate,
  onDismiss,
  isEscalating,
}: {
  signal: any;
  expanded: boolean;
  onToggle: () => void;
  onEscalate: () => void;
  onDismiss: () => void;
  isEscalating: boolean;
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
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={onToggle}
      >
        {/* Anchor type icon */}
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
              <MapPin className="h-3 w-3" />
              {signal.location}
            </div>
            <Badge className={cn("text-[10px] border", anchor.bg, anchor.color)}>
              {anchor.label}
            </Badge>
            <Badge className="text-[10px] bg-[var(--bone)] text-[var(--sh-fg-muted)] border-[var(--rule)]">
              {SOURCE_LABELS[signal.source_type] ?? signal.source_type}
            </Badge>
          </div>

          {signal.estimated_scale && (
            <div className="flex items-center gap-1 text-xs text-[var(--sh-fg-muted)]">
              <Zap className="h-3 w-3 text-[var(--amber)]" />
              {signal.estimated_scale}
            </div>
          )}

          <ConfidenceBar score={signal.confidenceScore ?? signal.confidence_score ?? 0} />
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 text-[var(--sh-fg-muted)] shrink-0 transition-transform duration-200",
            expanded && "rotate-180"
          )}
        />
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
              {/* Snippet */}
              {signal.snippet && (
                <p className="text-xs text-[var(--sh-fg-muted)] leading-relaxed line-clamp-4">
                  {signal.snippet}
                </p>
              )}

              {/* Source link */}
              {signal.source_url && (
                <a
                  href={signal.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--signal-gold)] hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  View source
                </a>
              )}

              {/* Gap analysis */}
              {isAnalyzed && signal.gapAnalysis ? (
                <GapAnalysisPanel gapAnalysis={signal.gapAnalysis} />
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RippleEffect() {
  const { toast } = useToast();
  const [geography, setGeography] = useState("Atlanta, GA");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [escalatingId, setEscalatingId] = useState<number | null>(null);

  const { data: signals = [], refetch } = trpc.ripple.list.useQuery({
    status: "all",
    minConfidence: 0,
    limit: 100,
  });

  const scanMutation = trpc.ripple.scan.useMutation({
    onSuccess: (data) => {
      setIsScanning(false);
      refetch();
      toast({
        title: `${data.signalsFound} signals detected`,
        description: data.message,
      });
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
        title: `Gap analysis complete`,
        description: `${playCount} Main Street ${playCount === 1 ? "play" : "plays"} identified`,
      });
    },
    onError: (err) => {
      setEscalatingId(null);
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    },
  });

  const dismissMutation = trpc.ripple.dismiss.useMutation({
    onSuccess: () => refetch(),
  });

  const handleScan = () => {
    if (!geography.trim()) return;
    setIsScanning(true);
    scanMutation.mutate({ geography, minConfidence: 0.35 });
  };

  const handleEscalate = (signalId: number) => {
    setEscalatingId(signalId);
    setExpandedId(signalId);
    escalateMutation.mutate({ signalId });
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
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">
              Anchor Development Intelligence
            </h1>
            <p className="text-sm text-white/60 max-w-2xl leading-relaxed">
              Detect massive industrial permits and press releases before they hit the mainstream. 
              Surface the picks-and-shovels Main Street plays created by anchor developments — 
              before the market prices them in.
            </p>

            {/* Stats row */}
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
              onClick={handleScan}
              disabled={isScanning || !geography.trim()}
              className="bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--ink)]/90 border-0 shrink-0"
            >
              {isScanning ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Scanning…</>
              ) : (
                <><Waves className="h-4 w-4 mr-2" />Run Scan</>
              )}
            </Button>
          </div>
          <p className="text-xs text-[var(--sh-fg-muted)] mt-3 leading-relaxed">
            Searches press release wires, EDC announcements, permit filings, workforce signals, and utility expansions.
            Keyword-scores each hit. Only escalated signals invoke the AI analyst.
          </p>
        </motion.div>

        {/* Anchor type filters */}
        {Object.keys(anchorCounts).length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex flex-wrap gap-2"
          >
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-[var(--rule)] p-12 text-center"
          >
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
              <button
                onClick={() => refetch()}
                className="text-xs text-[var(--sh-fg-muted)] hover:text-[var(--ink)] flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>
            <AnimatePresence>
              {filteredSignals.map((signal: any) => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  expanded={expandedId === signal.id}
                  onToggle={() => setExpandedId(expandedId === signal.id ? null : signal.id)}
                  onEscalate={() => handleEscalate(signal.id)}
                  onDismiss={() => dismissMutation.mutate({ signalId: signal.id })}
                  isEscalating={escalatingId === signal.id}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </EditorialTopNav>
  );
}

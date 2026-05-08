/**
 * THESIS ENGINE — Signal Hunter
 * Spec: TSL-SCI-PROD-001-A1 · Section 12
 *
 * Two-panel experience:
 *   Left  — thesis input (large textarea + template gallery)
 *   Right — STRATEGIST output review (editable structured form + Approve & Run)
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Sparkles, ChevronRight, Loader2, Trash2, Lock,
  AlertTriangle, CheckCircle2, Target, Scale, FileSearch,
  XCircle, MessageSquareWarning, TrendingUp, RotateCcw,
} from "lucide-react";

// ── Thesis Templates ──────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: "hirsch_durability",
    label: "Hirsch Durability",
    icon: "⏳",
    description: "Products needed 40 years ago and 40 years from now",
    text: "I want businesses where the product or service was needed 40 years ago and will be needed 40 years from now. Target $20–40M revenue, founder-led, with signals that the founder is hitting a management skill ceiling. Sunbelt geography. Exclude PE-owned, franchises, and VC-backed.",
  },
  {
    id: "silver_tsunami",
    label: "Silver Tsunami",
    icon: "🌊",
    description: "Baby boomer owners ready to exit",
    text: "Baby boomer business owners who are ready to retire, with no succession plan in place. Service businesses in the Southeast, under $5M revenue. Owner age 60+, business age 15+ years. No PE involvement.",
  },
  {
    id: "recurring_revenue",
    label: "Recurring Revenue",
    icon: "🔄",
    description: "Contract/subscription mix >60%",
    text: "Regional service businesses with recurring contract revenue greater than 60%, $2–10M EBITDA, second-generation or founder ownership, no PE. Prefer businesses with multi-year contracts and low customer churn.",
  },
  {
    id: "sector_rollup",
    label: "Sector Roll-up",
    icon: "🏗️",
    description: "Fragmented sector with consolidation upside",
    text: "Specialty manufacturers serving aerospace or defense primes, $5–15M EBITDA, second-generation ownership, Midwest. Fragmented sector with consolidation opportunity. Prefer businesses with proprietary processes or certifications (AS9100, ITAR).",
  },
  {
    id: "generational_transition",
    label: "Generational Transition",
    icon: "👨‍👩‍👧",
    description: "Family business succession plays",
    text: "Family-owned businesses where the founder's children are not interested in taking over. $1–8M EBITDA, any geography, essential services (HVAC, plumbing, pest control, commercial cleaning). Business age 20+ years. Owner surname match across org chart.",
  },
];

// ── Fade-in animation variant ─────────────────────────────────────────────────
const fadeIn = {
  hidden: { opacity: 0, filter: "blur(4px)", y: 8 },
  visible: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.5 } },
};

// ── Weight Bar ────────────────────────────────────────────────────────────────
function WeightBar({ weight, isCustom }: { weight: number; isCustom: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", isCustom ? "bg-amber-500" : "bg-primary")}
          style={{ width: `${weight}%` }}
        />
      </div>
      <span className={cn("text-xs font-mono tabular-nums w-8 text-right", isCustom ? "text-[var(--amber)]" : "text-primary")}>
        {weight}%
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ThesisEngine() {
  const [thesisText, setThesisText] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [compilationResult, setCompilationResult] = useState<any>(null);
  const [compilationId, setCompilationId] = useState<number | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);

  const { data: savedTheses, refetch: refetchList } = trpc.thesis.list.useQuery();
  const compileMutation = trpc.thesis.compile.useMutation({
    onSuccess: (data) => {
      setCompilationResult(data.compiled);
      setCompilationId(data.compilationId);
      setIsCompiling(false);
      toast.success(`STRATEGIST compiled: ${data.suggestedName}`);
      refetchList();
    },
    onError: (err) => {
      setIsCompiling(false);
      toast.error(err.message);
    },
  });
  const deleteMutation = trpc.thesis.delete.useMutation({
    onSuccess: () => { toast.success("Thesis deleted"); refetchList(); },
  });
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const triggerScan = trpc.scan.trigger.useMutation({
    onSuccess: (d) => {
      toast.success("Pipeline running", {
        description: `Scan job #${d.jobId} started with thesis parameters. Redirecting to Command Center…`,
        duration: 4000,
      });
      utils.dashboard.stats.invalidate();
      utils.deals.list.invalidate();
      setTimeout(() => navigate("/"), 1800);
    },
    onError: (e) => toast.error(`Scan failed: ${e.message}`),
  });
  function handleApproveAndRun() {
    if (!compilationResult) return;
    const f = compilationResult.compiledFilters ?? {};
    const targetLocations: string[] = f.geographies ?? [];
    const minCashFlow = f.cashFlowMin ?? (f.revenueMin ? Math.round(f.revenueMin * 0.35) : 500000);
    const maxMultiple = f.multipleMax ?? 5;
    const geoLabel = targetLocations.length > 0
      ? targetLocations.slice(0, 3).join(", ") + (targetLocations.length > 3 ? ` +${targetLocations.length - 3}` : "")
      : "National";
    toast.info("Thesis approved — launching scan", {
      description: `Geography: ${geoLabel} · Min cash flow: $${(minCashFlow / 1000).toFixed(0)}k · Max multiple: ${maxMultiple}x`,
      duration: 3000,
    });
    triggerScan.mutate({ targetLocations, minCashFlow, maxMultiple });
  }

  function handleTemplate(t: typeof TEMPLATES[0]) {
    setActiveTemplate(t.id);
    setThesisText(t.text);
    setCompilationResult(null);
    setCompilationId(null);
  }

  function handleCompile() {
    if (!thesisText.trim() || thesisText.length < 20) {
      toast.error("Please enter a thesis of at least 20 characters");
      return;
    }
    setIsCompiling(true);
    setCompilationResult(null);
    compileMutation.mutate({
      thesisText,
      templateUsed: activeTemplate ?? undefined,
    });
  }

  const filters = compilationResult?.compiledFilters ?? {};
  const weights: Array<{ dimension: string; weight: number; isCustom: boolean }> =
    compilationResult?.scoringWeights ?? [];
  const evidence: string[] = compilationResult?.evidenceRequirements ?? [];
  const disqualifiers: string[] = compilationResult?.autoDisqualifiers ?? [];
  const notes: string[] = compilationResult?.confidenceNotes ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ── Header ── */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow text-muted-foreground mb-1">Signal Hunter · Spec A1</p>
              <h1 className="font-display text-3xl font-bold tracking-tight">Thesis Engine</h1>
              <p className="text-muted-foreground mt-1 text-sm max-w-xl">
                Describe your investment thesis in plain language. STRATEGIST decomposes it into filters,
                custom scoring dimensions, and evidence requirements — then runs the pipeline.
              </p>
            </div>
            <Badge variant="outline" className="border-amber-500/40 text-[var(--amber)] bg-amber-500/5 text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Hunter Tier
            </Badge>
          </div>
        </motion.div>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Left: Input ── */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" transition={{ delay: 0.1 }}
            className="space-y-4">

            {/* Template Gallery */}
            <div>
              <p className="eyebrow text-muted-foreground mb-3">Start from a template</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplate(t)}
                    className={cn(
                      "text-left p-3 rounded-lg border transition-all group",
                      activeTemplate === t.id
                        ? "border-amber-500/60 bg-amber-500/5"
                        : "border-border hover:border-border/80 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{t.icon}</span>
                      <span className={cn(
                        "text-sm font-medium transition-colors",
                        activeTemplate === t.id ? "text-[var(--amber)]" : "text-foreground group-hover:text-foreground"
                      )}>
                        {t.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Thesis Textarea */}
            <div className="space-y-2">
              <p className="eyebrow text-muted-foreground">Or write your own thesis</p>
              <div className={cn(
                "relative rounded-lg border transition-all",
                thesisText.length > 0 ? "border-amber-500/40" : "border-border"
              )}>
                <Textarea
                  value={thesisText}
                  onChange={(e) => {
                    setThesisText(e.target.value);
                    if (activeTemplate) setActiveTemplate(null);
                  }}
                  placeholder={`"Businesses with products needed 40 years ago and 40 years from now, $20–40M revenue, founder-led, in the Sunbelt."\n\n"Specialty manufacturers serving aerospace primes, $5–15M EBITDA, second-generation ownership, Midwest."\n\n"Regional service businesses with recurring contract revenue >60%, owner age 60+, sub-$10M EBITDA, no PE ownership."`}
                  className="min-h-[220px] resize-none border-0 bg-transparent font-sans text-sm leading-relaxed focus-visible:ring-0 placeholder:text-muted-foreground/40"
                />
                <div className="absolute bottom-3 right-3 text-xs text-muted-foreground/40 tabular-nums">
                  {thesisText.length}/4000
                </div>
              </div>
            </div>

            {/* Compile Button */}
            <Button
              onClick={handleCompile}
              disabled={isCompiling || thesisText.length < 20}
              className={cn(
                "w-full h-11 font-medium transition-all",
                !isCompiling && thesisText.length >= 20
                  ? "bg-amber-500 hover:bg-amber-400 text-black scan-btn-idle"
                  : ""
              )}
            >
              {isCompiling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  STRATEGIST compiling…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Compile Thesis
                </>
              )}
            </Button>

            {/* Saved Theses */}
            {savedTheses && savedTheses.length > 0 && (
              <div className="space-y-2">
                <p className="eyebrow text-muted-foreground">Saved theses</p>
                <div className="space-y-1">
                  {savedTheses.map((t: any) => (
                    <div key={t.id}
                      className="flex items-center justify-between px-3 py-2 rounded-md border border-border hover:bg-muted/20 transition-colors group">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          t.status === "approved" ? "bg-emerald-500" :
                          t.status === "review" ? "bg-amber-500" : "bg-muted-foreground"
                        )} />
                        <button
                          className="text-sm text-foreground hover:text-primary truncate text-left"
                          onClick={() => {
                            setThesisText(t.thesisText);
                            setCompilationResult({
                              compiledFilters: t.compiledFilters,
                              scoringWeights: t.scoringWeights,
                              evidenceRequirements: t.evidenceRequirements,
                              autoDisqualifiers: t.autoDisqualifiers,
                              confidenceNotes: t.confidenceNotes,
                              estimatedTargetsMin: t.estimatedTargetsMin,
                              estimatedTargetsMax: t.estimatedTargetsMax,
                              estimatedCostMin: t.estimatedCostMin,
                              estimatedCostMax: t.estimatedCostMax,
                            });
                            setCompilationId(t.id);
                          }}
                        >
                          {t.name ?? "Untitled Thesis"}
                        </button>
                      </div>
                      <button
                        onClick={() => deleteMutation.mutate({ id: t.id })}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all ml-2 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* ── Right: STRATEGIST Output ── */}
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              {isCompiling && (
                <motion.div
                  key="compiling"
                  variants={fadeIn} initial="hidden" animate="visible" exit="hidden"
                  className="flex flex-col items-center justify-center h-64 rounded-xl border border-border bg-muted/10 gap-4"
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-2 border-amber-500/40 animate-ping" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">STRATEGIST is compiling</p>
                    <p className="text-xs text-muted-foreground mt-1">Decomposing thesis · 15–30 seconds</p>
                  </div>
                </motion.div>
              )}

              {!isCompiling && !compilationResult && (
                <motion.div
                  key="empty"
                  variants={fadeIn} initial="hidden" animate="visible" exit="hidden"
                  className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed border-border bg-muted/5 gap-3"
                >
                  <Target className="h-8 w-8 text-muted-foreground/30" />
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">STRATEGIST output will appear here</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Enter a thesis and click Compile Thesis
                    </p>
                  </div>
                </motion.div>
              )}

              {!isCompiling && compilationResult && (
                <motion.div
                  key="result"
                  variants={fadeIn} initial="hidden" animate="visible"
                  className="space-y-4"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="eyebrow text-amber-500/80">STRATEGIST output</p>
                      <p className="font-display text-lg font-semibold text-foreground">
                        {compilationResult.suggestedName ?? "Compiled Thesis"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Ready for review
                    </div>
                  </div>

                  {/* Universe estimate */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border bg-muted/10 p-3">
                      <p className="eyebrow text-muted-foreground mb-1">Estimated Targets</p>
                      <p className="text-xl font-bold text-foreground tabular-nums">
                        {compilationResult.estimatedTargetsMin}–{compilationResult.estimatedTargetsMax}
                      </p>
                      <p className="text-xs text-muted-foreground">qualified businesses</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/10 p-3">
                      <p className="eyebrow text-muted-foreground mb-1">Estimated Cost</p>
                      <p className="text-xl font-bold text-foreground tabular-nums">
                        ${(compilationResult.estimatedCostMin / 1000).toFixed(0)}k–${(compilationResult.estimatedCostMax / 1000).toFixed(0)}k
                      </p>
                      <p className="text-xs text-muted-foreground">to score full universe</p>
                    </div>
                  </div>

                  {/* Filters */}
                  {Object.keys(filters).length > 0 && (
                    <div className="rounded-lg border border-border bg-muted/5 p-4 space-y-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="h-3.5 w-3.5 text-primary" />
                        <p className="eyebrow text-muted-foreground">Compiled Filters</p>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                        {filters.revenueMin && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Revenue Min</span>
                            <span className="font-mono text-foreground">${(filters.revenueMin / 1000000).toFixed(1)}M</span>
                          </div>
                        )}
                        {filters.revenueMax && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Revenue Max</span>
                            <span className="font-mono text-foreground">${(filters.revenueMax / 1000000).toFixed(1)}M</span>
                          </div>
                        )}
                        {filters.businessAgeMin && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Min Age</span>
                            <span className="font-mono text-foreground">{filters.businessAgeMin}+ yrs</span>
                          </div>
                        )}
                        {filters.headcountMin && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Headcount</span>
                            <span className="font-mono text-foreground">{filters.headcountMin}–{filters.headcountMax ?? "∞"}</span>
                          </div>
                        )}
                      </div>
                      {filters.geographies && filters.geographies.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {filters.geographies.map((g: string) => (
                            <Badge key={g} variant="outline" className="text-xs px-1.5 py-0 border-primary/30 text-primary">
                              {g}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {filters.exclusions && filters.exclusions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {filters.exclusions.map((e: string) => (
                            <Badge key={e} variant="outline" className="text-xs px-1.5 py-0 border-destructive/30 text-destructive/70">
                              ✕ {e}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Scoring Weights */}
                  {weights.length > 0 && (
                    <div className="rounded-lg border border-border bg-muted/5 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Scale className="h-3.5 w-3.5 text-primary" />
                        <p className="eyebrow text-muted-foreground">Custom Scoring Weights</p>
                      </div>
                      {weights.map((w) => (
                        <div key={w.dimension} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-foreground flex items-center gap-1.5">
                              {w.dimension}
                              {w.isCustom && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500/40 text-[var(--amber)]">
                                  custom
                                </Badge>
                              )}
                            </span>
                          </div>
                          <WeightBar weight={w.weight} isCustom={w.isCustom} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Evidence Requirements */}
                  {evidence.length > 0 && (
                    <div className="rounded-lg border border-border bg-muted/5 p-4 space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <FileSearch className="h-3.5 w-3.5 text-primary" />
                        <p className="eyebrow text-muted-foreground">Evidence Requirements</p>
                      </div>
                      {evidence.map((e, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{e}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Auto-Disqualifiers */}
                  {disqualifiers.length > 0 && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                        <p className="eyebrow text-destructive/70">Auto-Disqualifiers</p>
                      </div>
                      {disqualifiers.map((d, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <XCircle className="h-3 w-3 text-destructive/60 mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{d}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Confidence Notes */}
                  {notes.length > 0 && (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquareWarning className="h-3.5 w-3.5 text-amber-500" />
                        <p className="eyebrow text-amber-500/70">Confidence Notes</p>
                      </div>
                      {notes.map((n, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <AlertTriangle className="h-3 w-3 text-amber-500/60 mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{n}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-medium"
                      onClick={handleApproveAndRun}
                      disabled={triggerScan.isPending}
                    >
                      {triggerScan.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Launching Scan…</>
                      ) : (
                        <><TrendingUp className="h-4 w-4 mr-2" />Approve & Run Pipeline</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCompilationResult(null);
                        setCompilationId(null);
                      }}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Tier Gate Banner (for non-Hunter users — placeholder) ── */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" transition={{ delay: 0.3 }}
          className="rounded-xl border border-border bg-muted/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Custom Dimension Authoring</p>
              <p className="text-xs text-muted-foreground">Create and save reusable scoring dimensions. Available on Operator tier ($35k/mo).</p>
            </div>
          </div>
          <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground text-xs shrink-0">
            Operator Only
          </Badge>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

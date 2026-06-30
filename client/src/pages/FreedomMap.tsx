import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import EditorialTopNav from "@/components/EditorialTopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import {
  Target, Zap, TrendingUp, Home, Building2, Wrench, Coins,
  MapPin, ArrowRight, Sparkles, ChevronRight, RefreshCw,
  DollarSign, Clock, Star
} from "lucide-react";
import { cn } from "@/lib/utils";

const DEAL_TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  sba_business: { icon: Building2, color: "text-[var(--sh-primary)]", bg: "bg-[var(--sh-primary-10)] border-[var(--sh-border-1)]", label: "SBA Business" },
  rental: { icon: Home, color: "text-[var(--sage)]", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Rental" },
  flip: { icon: Wrench, color: "text-[var(--sh-amber)]", bg: "bg-amber-500/10 border-amber-500/20", label: "Fix & Flip" },
  microloan: { icon: Coins, color: "text-[var(--sh-fg-muted)]", bg: "bg-[var(--sh-surface-2)] border-[var(--sh-border-1)]", label: "Microloan" },
  land_play: { icon: MapPin, color: "text-[var(--sh-red)]", bg: "bg-rose-500/10 border-rose-500/20", label: "Land Play" },
  parking_arbitrage: { icon: Target, color: "text-[var(--sh-signal)]", bg: "bg-[var(--sh-primary-10)] border-[var(--sh-border-1)]", label: "Parking Arb" },
  tad_hold: { icon: TrendingUp, color: "text-[var(--sh-amber)]", bg: "bg-amber-500/10 border-amber-500/20", label: "TAD Hold" },
};

const PRESET_PROFILES = [
  { label: "Side Hustle → FI", targetMonthlyIncome: 5000, investmentCapital: 100000, timelineYears: 3, riskTolerance: "moderate" as const, situation: "single" as const },
  { label: "Family Freedom", targetMonthlyIncome: 15000, investmentCapital: 250000, timelineYears: 5, riskTolerance: "moderate" as const, situation: "family" as const },
  { label: "Aggressive Builder", targetMonthlyIncome: 50000, investmentCapital: 500000, timelineYears: 3, riskTolerance: "aggressive" as const, situation: "married" as const },
  { label: "Conservative Wealth", targetMonthlyIncome: 8000, investmentCapital: 200000, timelineYears: 7, riskTolerance: "conservative" as const, situation: "married" as const },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

export default function FreedomMap() {
  const { toast } = useToast();
  const [step, setStep] = useState<"intake" | "generating" | "result">("intake");
  const [viewMode, setViewMode] = useState<"lifestyle" | "portfolio" | "wealth">("portfolio");
  const [result, setResult] = useState<any>(null);

  const [form, setForm] = useState({
    targetMonthlyIncome: 10000,
    currentIncome: 5000,
    investmentCapital: 200000,
    timelineYears: 3,
    riskTolerance: "moderate" as "conservative" | "moderate" | "aggressive",
    location: "Atlanta, GA",
    situation: "married" as "single" | "married" | "family",
    age: 35,
  });

  const generateMutation = trpc.freedomMap.generate.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setStep("result");
    },
    onError: (err) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
      setStep("intake");
    },
  });

  const handleGenerate = () => {
    setStep("generating");
    generateMutation.mutate(form);
  };

  const applyPreset = (preset: typeof PRESET_PROFILES[0]) => {
    setForm((f) => ({ ...f, ...preset }));
  };

  return (
    <EditorialTopNav>
      <div className="space-y-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-[var(--sh-border-1)] p-8 md:p-12"
          style={{ background: "var(--sh-surface-1)" }}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--sh-primary-10)", border: "1px solid var(--sh-border-1)" }}>
                <Target className="w-4 h-4" style={{ color: "var(--sh-signal)" }} />
              </div>
              <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: "var(--sh-signal)" }}>Freedom Map</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: "var(--sh-text-primary)", fontFamily: "var(--font-display)" }}>
              Start with where you<br />
              <span style={{ color: "var(--sh-signal)" }}>want to be.</span>
            </h1>
            <p className="text-lg max-w-2xl leading-relaxed" style={{ color: "var(--sh-text-secondary)" }}>
              Tell the system your target. It engineers the exact deal blend — business, rentals, flips,
              land plays — to get you there. Not passive. Not generic. <strong style={{ color: "var(--sh-text-primary)" }}>Your recipe.</strong>
            </p>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === "intake" && (
            <motion.div
              key="intake"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid gap-6 lg:grid-cols-3"
            >
              {/* Intake Form */}
              <div className="lg:col-span-2 space-y-6">
                {/* Preset Profiles */}
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "var(--sh-fg-muted)" }}>Quick Start Profiles</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {PRESET_PROFILES.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => applyPreset(preset)}
                        className="group relative px-3 py-2.5 rounded-xl text-left transition-all duration-200 hover:scale-[1.02]"
                        style={{
                          background: "var(--sh-surface-2)",
                          border: "1px solid var(--sh-border-1)",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--sh-signal)")}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--sh-border-1)")}
                      >
                        <div className="text-xs font-semibold" style={{ color: "var(--sh-text-primary)" }}>{preset.label}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: "var(--sh-fg-muted)" }}>{formatCurrency(preset.targetMonthlyIncome)}/mo</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Income */}
                <Card className="border-[var(--sh-border-1)]" style={{ background: "var(--sh-surface-1)" }}>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Target Monthly Income</label>
                      <span className="text-2xl font-bold" style={{ color: "var(--sh-signal)", fontFamily: "var(--font-mono)" }}>{formatCurrency(form.targetMonthlyIncome)}</span>
                    </div>
                    <Slider
                      value={[form.targetMonthlyIncome]}
                      onValueChange={([v]) => setForm((f) => ({ ...f, targetMonthlyIncome: v }))}
                      min={2000} max={100000} step={1000}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs" style={{ color: "var(--sh-fg-muted)" }}>
                      <span>$2k/mo</span><span>$50k/mo</span><span>$100k/mo</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Capital & Timeline */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-[var(--sh-border-1)]" style={{ background: "var(--sh-surface-1)" }}>
                    <CardContent className="p-5 space-y-3">
                      <label className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--sh-fg-muted)" }}>Investment Capital</label>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 shrink-0" style={{ color: "var(--sh-fg-muted)" }} />
                        <Input
                          type="number"
                          value={form.investmentCapital}
                          onChange={(e) => setForm((f) => ({ ...f, investmentCapital: Number(e.target.value) }))}
                          className="border-[var(--sh-border-1)] font-semibold"
                          style={{ background: "var(--sh-surface-2)", color: "var(--sh-text-primary)" }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-[var(--sh-border-1)]" style={{ background: "var(--sh-surface-1)" }}>
                    <CardContent className="p-5 space-y-3">
                      <label className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--sh-fg-muted)" }}>Timeline (Years)</label>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 shrink-0" style={{ color: "var(--sh-fg-muted)" }} />
                        <Input
                          type="number"
                          value={form.timelineYears}
                          onChange={(e) => setForm((f) => ({ ...f, timelineYears: Number(e.target.value) }))}
                          min={1} max={10}
                          className="border-[var(--sh-border-1)] font-semibold"
                          style={{ background: "var(--sh-surface-2)", color: "var(--sh-text-primary)" }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Risk & Situation */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--sh-fg-muted)" }}>Risk Tolerance</label>
                    <div className="flex gap-2">
                      {(["conservative", "moderate", "aggressive"] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setForm((f) => ({ ...f, riskTolerance: r }))}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all border"
                          style={form.riskTolerance === r
                            ? { background: "var(--sh-primary-10)", borderColor: "var(--sh-signal)", color: "var(--sh-signal)" }
                            : { background: "var(--sh-surface-2)", borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }
                          }
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--sh-fg-muted)" }}>Situation</label>
                    <div className="flex gap-2">
                      {(["single", "married", "family"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setForm((f) => ({ ...f, situation: s }))}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all border"
                          style={form.situation === s
                            ? { background: "var(--sh-primary-10)", borderColor: "var(--sh-signal)", color: "var(--sh-signal)" }
                            : { background: "var(--sh-surface-2)", borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }
                          }
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Location */}
                <Card className="border-[var(--sh-border-1)]" style={{ background: "var(--sh-surface-1)" }}>
                  <CardContent className="p-5 space-y-2">
                    <label className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--sh-fg-muted)" }}>Target Market</label>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 shrink-0" style={{ color: "var(--sh-fg-muted)" }} />
                      <Input
                        value={form.location}
                        onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                        placeholder="Atlanta, GA"
                        className="border-[var(--sh-border-1)]"
                        style={{ background: "var(--sh-surface-2)", color: "var(--sh-text-primary)" }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Button
                  onClick={handleGenerate}
                  size="lg"
                  className="w-full h-14 text-base font-bold rounded-xl border-0"
                  style={{ background: "var(--sh-primary)", color: "var(--sh-primary-fg)" }}
                >
                  <Sparkles className="mr-2 w-5 h-5" />
                  Engineer My Freedom Path
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>

              {/* Side Panel */}
              <div className="space-y-4">
                <Card className="border-[var(--sh-border-1)]" style={{ background: "var(--sh-surface-1)" }}>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>
                      <Zap className="w-4 h-4" style={{ color: "var(--sh-signal)" }} />
                      How it works
                    </div>
                    <div className="space-y-3">
                      {[
                        { step: "01", text: "Set your target monthly income" },
                        { step: "02", text: "Tell us your capital, timeline, and risk tolerance" },
                        { step: "03", text: "AI engineers your custom deal blend" },
                        { step: "04", text: "Get a milestone roadmap to execute" },
                      ].map((item) => (
                        <div key={item.step} className="flex items-start gap-3">
                          <span className="text-xs font-mono mt-0.5 shrink-0" style={{ color: "var(--sh-signal)" }}>{item.step}</span>
                          <span className="text-sm" style={{ color: "var(--sh-text-secondary)" }}>{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[var(--sh-border-1)]" style={{ background: "var(--sh-surface-2)" }}>
                  <CardContent className="p-6">
                    <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "var(--sh-signal)" }}>Deal Blends Available</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.values(DEAL_TYPE_CONFIG).map((cfg) => (
                        <span key={cfg.label} className={cn("text-[10px] font-semibold px-2 py-1 rounded-full border", cfg.bg, cfg.color)}>
                          {cfg.label}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs mt-3 leading-relaxed" style={{ color: "var(--sh-fg-muted)" }}>
                      Mix and match like Blackrock — but for Mainstreet. SBA loans, seller notes, TAD plays, World Cup arbitrage, and more.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {step === "generating" && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 space-y-6"
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ border: "1px solid var(--sh-border-1)", background: "var(--sh-surface-2)" }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-8 h-8" style={{ color: "var(--sh-signal)" }} />
                  </motion.div>
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold" style={{ color: "var(--sh-text-primary)" }}>Engineering your freedom path...</h3>
                <p className="text-sm" style={{ color: "var(--sh-text-secondary)" }}>Analyzing {formatCurrency(form.targetMonthlyIncome)}/mo target across deal types</p>
              </div>
              <div className="flex flex-col items-center gap-2 text-xs" style={{ color: "var(--sh-fg-muted)" }}>
                {["Calculating capital efficiency", "Modeling deal blend scenarios", "Generating milestone roadmap", "Writing your agent message"].map((msg, i) => (
                  <motion.div
                    key={msg}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.6 }}
                    className="flex items-center gap-2"
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--sh-signal)" }} />
                    {msg}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {step === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Agent Message */}
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="relative overflow-hidden rounded-2xl p-6 md:p-8"
                style={{ background: "var(--sh-surface-1)", border: "1px solid var(--sh-border-1)" }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ background: "var(--sh-primary-10)", border: "1px solid var(--sh-border-1)" }}>
                    <Sparkles className="w-5 h-5" style={{ color: "var(--sh-signal)" }} />
                  </div>
                  <div>
                    <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "var(--sh-signal)" }}>Your Co-Analyst</div>
                    <p className="text-lg leading-relaxed font-light" style={{ color: "var(--sh-text-primary)" }}>{result.agentMessage}</p>
                  </div>
                </div>
              </motion.div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Projected Monthly", value: formatCurrency(result.totalProjectedMonthly), icon: TrendingUp, color: "var(--sage)" },
                  { label: "Total Investment", value: formatCurrency(result.totalInvestmentRequired), icon: DollarSign, color: "var(--sh-primary)" },
                  { label: "Deal Components", value: `${result.recipe?.length ?? 0} assets`, icon: Building2, color: "var(--sh-signal)" },
                ].map((stat) => (
                  <Card key={stat.label} className="border-[var(--sh-border-1)]" style={{ background: "var(--sh-surface-1)" }}>
                    <CardContent className="p-4 text-center">
                      <stat.icon className="w-5 h-5 mx-auto mb-2" style={{ color: stat.color }} />
                      <div className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
                      <div className="text-xs mt-1" style={{ color: "var(--sh-fg-muted)" }}>{stat.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* View Mode Toggle */}
              <div className="flex gap-2">
                {(["portfolio", "lifestyle", "wealth"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border"
                    style={viewMode === mode
                      ? { background: "var(--sh-primary-10)", borderColor: "var(--sh-signal)", color: "var(--sh-signal)" }
                      : { background: "var(--sh-surface-2)", borderColor: "var(--sh-border-1)", color: "var(--sh-fg-muted)" }
                    }
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* Portfolio Recipe */}
              {viewMode === "portfolio" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                >
                  {result.recipe?.map((item: any, i: number) => {
                    const cfg = DEAL_TYPE_CONFIG[item.type] ?? DEAL_TYPE_CONFIG.sba_business;
                    const Icon = cfg.icon;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <Card className={cn("border transition-all hover:scale-[1.02]", cfg.bg)}>
                          <CardContent className="p-5 space-y-3">
                            <div className="flex items-start justify-between">
                              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", cfg.bg)}>
                                <Icon className={cn("w-5 h-5", cfg.color)} />
                              </div>
                              <Badge variant="outline" className={cn("text-[10px] font-bold", cfg.color, cfg.bg)}>
                                Priority {item.priority}
                              </Badge>
                            </div>
                            <div>
                              <div className="font-semibold text-sm" style={{ color: "var(--sh-text-primary)" }}>{item.label}</div>
                              <div className="text-xs mt-1 leading-relaxed" style={{ color: "var(--sh-text-secondary)" }}>{item.description}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--sh-border-1)]">
                              <div>
                                <div className="text-[10px]" style={{ color: "var(--sh-fg-muted)" }}>Monthly Income</div>
                                <div className={cn("text-sm font-bold", cfg.color)}>{formatCurrency(item.estimatedMonthlyIncome)}</div>
                              </div>
                              <div>
                                <div className="text-[10px]" style={{ color: "var(--sh-fg-muted)" }}>Investment</div>
                                <div className="text-sm font-bold" style={{ color: "var(--sh-text-primary)" }}>{formatCurrency(item.estimatedInvestment)}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs" style={{ color: "var(--sh-fg-muted)" }}>
                              <Clock className="w-3 h-3" />
                              {item.timelineMonths} months to close
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}

              {/* Milestone Timeline */}
              {viewMode === "lifestyle" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <div className="relative">
                    <div className="absolute left-6 top-0 bottom-0 w-px" style={{ background: "var(--sh-border-1)" }} />
                    <div className="space-y-6 pl-16">
                      {result.milestones?.map((m: any, i: number) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.15 }}
                          className="relative"
                        >
                          <div className="absolute -left-10 top-1 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--sh-primary-10)", border: "1px solid var(--sh-border-1)" }}>
                            <Star className="w-3.5 h-3.5" style={{ color: "var(--sh-signal)" }} />
                          </div>
                          <Card className="border-[var(--sh-border-1)]" style={{ background: "var(--sh-surface-1)" }}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="text-xs font-mono mb-1" style={{ color: "var(--sh-signal)" }}>Month {m.month}</div>
                                  <div className="font-semibold" style={{ color: "var(--sh-text-primary)" }}>{m.title}</div>
                                  <div className="text-sm mt-1" style={{ color: "var(--sh-text-secondary)" }}>{m.description}</div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-lg font-bold" style={{ color: "var(--sage)" }}>{formatCurrency(m.monthlyIncome)}</div>
                                  <div className="text-xs" style={{ color: "var(--sh-fg-muted)" }}>/month</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Wealth View */}
              {viewMode === "wealth" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <Card className="border-[var(--sh-border-1)]" style={{ background: "var(--sh-surface-1)" }}>
                    <CardContent className="p-6 space-y-4">
                      <div className="text-sm font-semibold" style={{ color: "var(--sh-text-primary)" }}>Co-Analyst Rationale</div>
                      <p className="leading-relaxed" style={{ color: "var(--sh-text-secondary)" }}>{result.rationale}</p>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--sh-border-1)]">
                        <div>
                          <div className="text-xs mb-1" style={{ color: "var(--sh-fg-muted)" }}>Annual Run Rate</div>
                          <div className="text-2xl font-bold" style={{ color: "var(--sh-text-primary)" }}>{formatCurrency(result.totalProjectedMonthly * 12)}</div>
                        </div>
                        <div>
                          <div className="text-xs mb-1" style={{ color: "var(--sh-fg-muted)" }}>Cash-on-Cash Yield</div>
                          <div className="text-2xl font-bold" style={{ color: "var(--sage)" }}>
                            {result.totalInvestmentRequired > 0
                              ? `${((result.totalProjectedMonthly * 12 / result.totalInvestmentRequired) * 100).toFixed(1)}%`
                              : "—"}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => setStep("intake")}
                  variant="outline"
                  className="gap-2 border-[var(--sh-border-1)]"
                  style={{ color: "var(--sh-text-primary)" }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Adjust Goals
                </Button>
                <Button
                  onClick={() => window.location.href = "/strategy-blender"}
                  className="gap-2 border-0"
                  style={{ background: "var(--sh-primary)", color: "var(--sh-primary-fg)" }}
                >
                  Open Strategy Blender
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </EditorialTopNav>
  );
}

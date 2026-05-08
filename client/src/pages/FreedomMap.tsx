import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import {
  Target, Zap, TrendingUp, Home, Building2, Wrench, Coins,
  MapPin, ArrowRight, Sparkles, ChevronRight, RefreshCw,
  DollarSign, Clock, Shield, Star
} from "lucide-react";
import { cn } from "@/lib/utils";

const DEAL_TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  sba_business: { icon: Building2, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: "SBA Business" },
  rental: { icon: Home, color: "text-[var(--sage)]", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Rental" },
  flip: { icon: Wrench, color: "text-[var(--amber)]", bg: "bg-amber-500/10 border-amber-500/20", label: "Fix & Flip" },
  microloan: { icon: Coins, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", label: "Microloan" },
  land_play: { icon: MapPin, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20", label: "Land Play" },
  parking_arbitrage: { icon: Target, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20", label: "Parking Arb" },
  tad_hold: { icon: TrendingUp, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", label: "TAD Hold" },
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
    <DashboardLayout>
      <div className="space-y-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a] border border-[var(--rule)] p-8 md:p-12"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Target className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-xs font-bold tracking-[0.2em] uppercase text-cyan-400">Freedom Map</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-4">
              Start with where you<br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
                want to be.
              </span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl leading-relaxed">
              Tell the AI your target. It engineers the exact deal blend — business, rentals, flips, land plays — 
              to get you there. Not passive. Not generic. <strong className="text-white">Your recipe.</strong>
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
                  <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-3">Quick Start Profiles</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {PRESET_PROFILES.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => applyPreset(preset)}
                        className="group relative px-3 py-2.5 rounded-xl bg-[var(--paper)] hover:bg-[var(--bone)] border border-[var(--rule)] hover:border-[var(--rule)] transition-all duration-300 text-left"
                      >
                        <div className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">{preset.label}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{formatCurrency(preset.targetMonthlyIncome)}/mo</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Income */}
                <Card className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-white">Target Monthly Income</label>
                      <span className="text-2xl font-bold text-cyan-400">{formatCurrency(form.targetMonthlyIncome)}</span>
                    </div>
                    <Slider
                      value={[form.targetMonthlyIncome]}
                      onValueChange={([v]) => setForm((f) => ({ ...f, targetMonthlyIncome: v }))}
                      min={2000} max={100000} step={1000}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>$2k/mo</span><span>$50k/mo</span><span>$100k/mo</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Capital & Timeline */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
                    <CardContent className="p-5 space-y-3">
                      <label className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Investment Capital</label>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
                        <Input
                          type="number"
                          value={form.investmentCapital}
                          onChange={(e) => setForm((f) => ({ ...f, investmentCapital: Number(e.target.value) }))}
                          className="bg-transparent border-[var(--rule)] text-white font-semibold"
                        />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
                    <CardContent className="p-5 space-y-3">
                      <label className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Timeline (Years)</label>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                        <Input
                          type="number"
                          value={form.timelineYears}
                          onChange={(e) => setForm((f) => ({ ...f, timelineYears: Number(e.target.value) }))}
                          min={1} max={10}
                          className="bg-transparent border-[var(--rule)] text-white font-semibold"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Risk & Situation */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Risk Tolerance</label>
                    <div className="flex gap-2">
                      {(["conservative", "moderate", "aggressive"] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setForm((f) => ({ ...f, riskTolerance: r }))}
                          className={cn(
                            "flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all border",
                            form.riskTolerance === r
                              ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                              : "bg-[var(--paper)] border-[var(--rule)] text-gray-400 hover:border-[var(--rule)]"
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Situation</label>
                    <div className="flex gap-2">
                      {(["single", "married", "family"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setForm((f) => ({ ...f, situation: s }))}
                          className={cn(
                            "flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all border",
                            form.situation === s
                              ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                              : "bg-[var(--paper)] border-[var(--rule)] text-gray-400 hover:border-[var(--rule)]"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Location */}
                <Card className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
                  <CardContent className="p-5 space-y-2">
                    <label className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Target Market</label>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                      <Input
                        value={form.location}
                        onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                        placeholder="Atlanta, GA"
                        className="bg-transparent border-[var(--rule)] text-white"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Button
                  onClick={handleGenerate}
                  size="lg"
                  className="w-full h-14 text-base font-bold bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white border-0 rounded-xl"
                >
                  <Sparkles className="mr-2 w-5 h-5" />
                  Engineer My Freedom Path
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>

              {/* Side Panel */}
              <div className="space-y-4">
                <Card className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Zap className="w-4 h-4 text-yellow-400" />
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
                          <span className="text-xs font-mono text-cyan-500 mt-0.5 shrink-0">{item.step}</span>
                          <span className="text-sm text-gray-400">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-cyan-500/5 to-purple-500/5 border-cyan-500/10">
                  <CardContent className="p-6">
                    <div className="text-xs font-bold tracking-widest uppercase text-cyan-400 mb-2">Deal Blends Available</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.values(DEAL_TYPE_CONFIG).map((cfg) => (
                        <span key={cfg.label} className={cn("text-[10px] font-semibold px-2 py-1 rounded-full border", cfg.bg, cfg.color)}>
                          {cfg.label}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-3 leading-relaxed">
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
                <div className="w-20 h-20 rounded-full border border-cyan-500/20 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-8 h-8 text-cyan-400" />
                  </motion.div>
                </div>
                <div className="absolute inset-0 rounded-full border border-cyan-500/10 animate-ping" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-white">Engineering your freedom path...</h3>
                <p className="text-gray-400 text-sm">Analyzing {formatCurrency(form.targetMonthlyIncome)}/mo target across deal types</p>
              </div>
              <div className="flex flex-col items-center gap-2 text-xs text-gray-500">
                {["Calculating capital efficiency", "Modeling deal blend scenarios", "Generating milestone roadmap", "Writing your agent message"].map((msg, i) => (
                  <motion.div
                    key={msg}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.6 }}
                    className="flex items-center gap-2"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
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
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a0a0a] to-[#111] border border-cyan-500/20 p-6 md:p-8"
              >
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-1">
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-xs font-bold tracking-widest uppercase text-cyan-400 mb-2">Your AI Advisor</div>
                    <p className="text-white text-lg leading-relaxed font-light">{result.agentMessage}</p>
                  </div>
                </div>
              </motion.div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Projected Monthly", value: formatCurrency(result.totalProjectedMonthly), icon: TrendingUp, color: "text-[var(--sage)]" },
                  { label: "Total Investment", value: formatCurrency(result.totalInvestmentRequired), icon: DollarSign, color: "text-blue-400" },
                  { label: "Deal Components", value: `${result.recipe?.length ?? 0} assets`, icon: Building2, color: "text-purple-400" },
                ].map((stat) => (
                  <Card key={stat.label} className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
                    <CardContent className="p-4 text-center">
                      <stat.icon className={cn("w-5 h-5 mx-auto mb-2", stat.color)} />
                      <div className={cn("text-xl font-bold", stat.color)}>{stat.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
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
                    className={cn(
                      "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border",
                      viewMode === mode
                        ? "bg-[var(--bone)] border-[var(--rule)] text-white"
                        : "bg-[var(--paper)] border-[var(--rule)] text-gray-500 hover:text-gray-300"
                    )}
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
                              <div className="font-semibold text-white text-sm">{item.label}</div>
                              <div className="text-xs text-gray-400 mt-1 leading-relaxed">{item.description}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--rule)]">
                              <div>
                                <div className="text-[10px] text-muted-foreground">Monthly Income</div>
                                <div className={cn("text-sm font-bold", cfg.color)}>{formatCurrency(item.estimatedMonthlyIncome)}</div>
                              </div>
                              <div>
                                <div className="text-[10px] text-muted-foreground">Investment</div>
                                <div className="text-sm font-bold text-white">{formatCurrency(item.estimatedInvestment)}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
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
                    <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500/50 via-purple-500/30 to-transparent" />
                    <div className="space-y-6 pl-16">
                      {result.milestones?.map((m: any, i: number) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.15 }}
                          className="relative"
                        >
                          <div className="absolute -left-10 top-1 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center">
                            <Star className="w-3.5 h-3.5 text-cyan-400" />
                          </div>
                          <Card className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="text-xs text-cyan-400 font-mono mb-1">Month {m.month}</div>
                                  <div className="font-semibold text-white">{m.title}</div>
                                  <div className="text-sm text-gray-400 mt-1">{m.description}</div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-lg font-bold text-[var(--sage)]">{formatCurrency(m.monthlyIncome)}</div>
                                  <div className="text-xs text-muted-foreground">/month</div>
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
                  <Card className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
                    <CardContent className="p-6 space-y-4">
                      <div className="text-sm font-semibold text-white">AI Rationale</div>
                      <p className="text-gray-400 leading-relaxed">{result.rationale}</p>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--rule)]">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Annual Run Rate</div>
                          <div className="text-2xl font-bold text-white">{formatCurrency(result.totalProjectedMonthly * 12)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Cash-on-Cash Yield</div>
                          <div className="text-2xl font-bold text-[var(--sage)]">
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
                  className="gap-2 border-[var(--rule)]"
                >
                  <RefreshCw className="w-4 h-4" />
                  Adjust Goals
                </Button>
                <Button
                  onClick={() => window.location.href = "/strategy-blender"}
                  className="gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white border-0"
                >
                  Open Strategy Blender
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

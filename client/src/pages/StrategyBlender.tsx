import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import EditorialTopNav from "@/components/EditorialTopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  Plus, Trash2, Zap, TrendingUp, Building2, Home, Wrench,
  Coins, MapPin, Target, DollarSign, BarChart3, Sparkles,
  ChevronRight, RefreshCw, Shield, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

const DEAL_TYPES = [
  { type: "sba_business", label: "SBA Business", icon: Building2, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", defaultMonthly: 8000, defaultInvestment: 300000 },
  { type: "rental", label: "Rental Property", icon: Home, color: "text-[var(--sage)]", bg: "bg-emerald-500/10 border-emerald-500/20", defaultMonthly: 1200, defaultInvestment: 80000 },
  { type: "flip", label: "Fix & Flip", icon: Wrench, color: "text-[var(--amber)]", bg: "bg-amber-500/10 border-amber-500/20", defaultMonthly: 5000, defaultInvestment: 120000 },
  { type: "microloan", label: "Microloan Fund", icon: Coins, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", defaultMonthly: 800, defaultInvestment: 50000 },
  { type: "land_play", label: "Land Play", icon: MapPin, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20", defaultMonthly: 0, defaultInvestment: 150000 },
  { type: "parking_arbitrage", label: "Parking Arb", icon: Target, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20", defaultMonthly: 3500, defaultInvestment: 95000 },
  { type: "tad_hold", label: "TAD Hold", icon: TrendingUp, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", defaultMonthly: 0, defaultInvestment: 250000 },
];

const LEVERAGE_OPTIONS = [
  { value: "cash", label: "All Cash" },
  { value: "sba", label: "SBA 7(a)" },
  { value: "seller_note", label: "Seller Note" },
  { value: "hard_money", label: "Hard Money" },
  { value: "heloc", label: "HELOC" },
];

const SCENARIO_CONFIG = {
  conservative: { label: "Conservative", multiplier: 0.75, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  base: { label: "Base Case", multiplier: 1.0, color: "text-[var(--sage)]", bg: "bg-emerald-500/10 border-emerald-500/20" },
  aggressive: { label: "Aggressive", multiplier: 1.35, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

const formatK = (v: number) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}k`;

interface RecipeItem {
  id: string;
  type: string;
  label: string;
  investment: number;
  expectedMonthly: number;
  leverage: string;
}

export default function StrategyBlender() {
  const { toast } = useToast();
  const [recipe, setRecipe] = useState<RecipeItem[]>([
    { id: "1", type: "sba_business", label: "SBA-Backed Service Business", investment: 300000, expectedMonthly: 8000, leverage: "sba" },
    { id: "2", type: "rental", label: "Cash-Flow Rental", investment: 80000, expectedMonthly: 1200, leverage: "heloc" },
  ]);
  const [scenario, setScenario] = useState<"conservative" | "base" | "aggressive">("base");
  const [analysis, setAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeLevers, setActiveLevers] = useState<Set<string>>(new Set());

  const analyzeMutation = trpc.strategyBlender.analyze.useMutation({
    onSuccess: (data) => {
      setAnalysis(data);
      setIsAnalyzing(false);
    },
    onError: (err) => {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
      setIsAnalyzing(false);
    },
  });

  const totalInvestment = useMemo(() => recipe.reduce((s, r) => s + r.investment, 0), [recipe]);
  const totalMonthly = useMemo(() => recipe.reduce((s, r) => s + r.expectedMonthly, 0), [recipe]);
  const scenarioMultiplier = SCENARIO_CONFIG[scenario].multiplier;
  const adjustedMonthly = analysis?.adjustedMonthly ?? Math.round(totalMonthly * scenarioMultiplier);

  const addDealType = (dealType: typeof DEAL_TYPES[0]) => {
    setRecipe((prev) => [...prev, {
      id: Date.now().toString(),
      type: dealType.type,
      label: dealType.label,
      investment: dealType.defaultInvestment,
      expectedMonthly: dealType.defaultMonthly,
      leverage: "cash",
    }]);
  };

  const removeItem = (id: string) => setRecipe((prev) => prev.filter((r) => r.id !== id));

  const updateItem = (id: string, field: keyof RecipeItem, value: any) => {
    setRecipe((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleAnalyze = () => {
    if (recipe.length === 0) {
      toast({ title: "Add at least one deal type", variant: "destructive" });
      return;
    }
    setIsAnalyzing(true);
    analyzeMutation.mutate({ recipe: recipe as any, scenario });
  };

  const toggleLever = (id: string) => {
    setActiveLevers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const leverSavings = useMemo(() => {
    if (!analysis?.levers) return 0;
    return analysis.levers
      .filter((l: any) => activeLevers.has(l.id))
      .reduce((s: number, l: any) => s + (l.savingsAmount ?? 0), 0);
  }, [analysis, activeLevers]);

  return (
    <EditorialTopNav>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a] border border-[var(--rule)] p-6 md:p-8"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-blue-500/5" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <BarChart3 className="w-3.5 h-3.5 text-[var(--sage)]" />
                </div>
                <span className="text-xs font-bold tracking-[0.2em] uppercase text-[var(--sage)]">Strategy Blender</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">
                Engineer your{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-blue-400">
                  deal stack.
                </span>
              </h1>
              <p className="text-gray-400 mt-2 text-sm">Mix asset types. Toggle capital levers. Move like Blackrock — on Mainstreet.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Projected Monthly</div>
                <div className="text-2xl font-bold text-[var(--sage)]">{formatCurrency(adjustedMonthly)}</div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left: Recipe Builder */}
          <div className="lg:col-span-3 space-y-4">
            {/* Scenario Toggle */}
            <div className="flex gap-2">
              {(Object.entries(SCENARIO_CONFIG) as [string, typeof SCENARIO_CONFIG.base][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setScenario(key as any)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border",
                    scenario === key ? `${cfg.bg} ${cfg.color}` : "bg-[var(--paper)] border-[var(--rule)] text-gray-500 hover:text-gray-300"
                  )}
                >
                  {cfg.label}
                </button>
              ))}
            </div>

            {/* Recipe Items */}
            <div className="space-y-3">
              <AnimatePresence>
                {recipe.map((item) => {
                  const dealType = DEAL_TYPES.find((d) => d.type === item.type) ?? DEAL_TYPES[0];
                  const Icon = dealType.icon;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, height: 0 }}
                    >
                      <Card className={cn("border transition-all", dealType.bg)}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5", dealType.bg)}>
                              <Icon className={cn("w-5 h-5", dealType.color)} />
                            </div>
                            <div className="flex-1 min-w-0 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <Input
                                  value={item.label}
                                  onChange={(e) => updateItem(item.id, "label", e.target.value)}
                                  className="bg-transparent border-[var(--rule)] text-white font-semibold text-sm h-8 px-2"
                                />
                                <button
                                  onClick={() => removeItem(item.id)}
                                  className="text-gray-600 hover:text-rose-400 transition-colors shrink-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Investment</label>
                                  <div className="flex items-center gap-1 mt-1">
                                    <span className="text-xs text-gray-500">$</span>
                                    <Input
                                      type="number"
                                      value={item.investment}
                                      onChange={(e) => updateItem(item.id, "investment", Number(e.target.value))}
                                      className="bg-transparent border-[var(--rule)] text-white text-xs h-7 px-1"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Monthly</label>
                                  <div className="flex items-center gap-1 mt-1">
                                    <span className="text-xs text-gray-500">$</span>
                                    <Input
                                      type="number"
                                      value={item.expectedMonthly}
                                      onChange={(e) => updateItem(item.id, "expectedMonthly", Number(e.target.value))}
                                      className="bg-transparent border-[var(--rule)] text-white text-xs h-7 px-1"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Leverage</label>
                                  <select
                                    value={item.leverage}
                                    onChange={(e) => updateItem(item.id, "leverage", e.target.value)}
                                    className="mt-1 w-full h-7 text-xs bg-black/40 border border-[var(--rule)] rounded text-white px-1"
                                  >
                                    {LEVERAGE_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Add Deal Types */}
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-2">Add Asset Type</p>
              <div className="flex flex-wrap gap-2">
                {DEAL_TYPES.map((dt) => {
                  const Icon = dt.icon;
                  return (
                    <button
                      key={dt.type}
                      onClick={() => addDealType(dt)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:scale-105",
                        dt.bg, dt.color
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {dt.label}
                      <Plus className="w-3 h-3 opacity-60" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Analyze Button */}
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || recipe.length === 0}
              size="lg"
              className="w-full h-12 font-bold bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-400 hover:to-blue-400 text-white border-0 rounded-xl"
            >
              {isAnalyzing ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Sparkles className="mr-2 w-4 h-4" />
                  </motion.div>
                  Engineering Capital Stack...
                </>
              ) : (
                <>
                  <Zap className="mr-2 w-4 h-4" />
                  Analyze Stack
                  <ChevronRight className="ml-2 w-4 h-4" />
                </>
              )}
            </Button>
          </div>

          {/* Right: Analysis Panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Live Totals */}
            <Card className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
              <CardContent className="p-5 space-y-3">
                <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Live Stack Summary</div>
                <div className="space-y-2">
                  {[
                    { label: "Total Investment", value: formatCurrency(totalInvestment), color: "text-white" },
                    { label: `${scenario} Monthly`, value: formatCurrency(adjustedMonthly), color: "text-[var(--sage)]" },
                    { label: "Annual Run Rate", value: formatCurrency(adjustedMonthly * 12), color: "text-blue-400" },
                    { label: "Cash-on-Cash", value: totalInvestment > 0 ? `${((adjustedMonthly * 12 / totalInvestment) * 100).toFixed(1)}%` : "—", color: "text-purple-400" },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">{row.label}</span>
                      <span className={cn("text-sm font-bold", row.color)}>{row.value}</span>
                    </div>
                  ))}
                </div>
                {analysis?.dscr && (
                  <div className="pt-2 border-t border-[var(--rule)]">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">DSCR</span>
                      <span className={cn("text-sm font-bold", analysis.dscr >= 1.25 ? "text-[var(--sage)]" : analysis.dscr >= 1.0 ? "text-[var(--amber)]" : "text-rose-400")}>
                        {analysis.dscr.toFixed(2)}x
                        <span className="text-xs font-normal ml-1 text-muted-foreground">
                          {analysis.dscr >= 1.25 ? "✓ SBA Ready" : analysis.dscr >= 1.0 ? "Borderline" : "Below Min"}
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Capital Levers */}
            {analysis?.levers && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Capital Levers</div>
                      {leverSavings > 0 && (
                        <Badge className="bg-emerald-500/10 text-[var(--sage)] border-emerald-500/20 text-xs">
                          -{formatK(leverSavings)} saved
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      {analysis.levers.map((lever: any) => (
                        <button
                          key={lever.id}
                          onClick={() => toggleLever(lever.id)}
                          className={cn(
                            "w-full text-left p-3 rounded-xl border transition-all",
                            activeLevers.has(lever.id)
                              ? "bg-emerald-500/10 border-emerald-500/30"
                              : "bg-[var(--paper)] border-[var(--rule)] hover:border-[var(--rule)]"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className={cn("text-xs font-semibold", activeLevers.has(lever.id) ? "text-emerald-300" : "text-gray-300")}>
                                {lever.title}
                              </div>
                              <div className="text-[10px] text-gray-500 mt-0.5">{lever.impact}</div>
                            </div>
                            <div className={cn(
                              "w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 transition-all",
                              activeLevers.has(lever.id) ? "bg-emerald-500 border-emerald-500" : "border-gray-600"
                            )} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Capital Stack Breakdown */}
            {analysis?.capitalStack && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
                  <CardContent className="p-5 space-y-3">
                    <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Capital Stack</div>
                    {Object.entries(analysis.capitalStack)
                      .filter(([k]) => k !== "total")
                      .map(([key, value]: [string, any]) => {
                        if (!value || value === 0) return null;
                        const total = analysis.capitalStack.total || 1;
                        const pct = Math.round((value / total) * 100);
                        const labels: Record<string, string> = { sba7a: "SBA 7(a)", sellerNote: "Seller Note", equity: "Equity", impactFund: "Impact Fund", greenStack: "Green Stack" };
                        const colors: Record<string, string> = { sba7a: "bg-blue-500", sellerNote: "bg-purple-500", equity: "bg-emerald-500", impactFund: "bg-cyan-500", greenStack: "bg-teal-500" };
                        return (
                          <div key={key}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-400">{labels[key] ?? key}</span>
                              <span className="text-white font-semibold">{formatK(value)} <span className="text-muted-foreground">({pct}%)</span></span>
                            </div>
                            <div className="h-1.5 bg-[var(--bone)] rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className={cn("h-full rounded-full", colors[key] ?? "bg-gray-500")}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Agent Insight */}
            {analysis?.agentInsight && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="bg-gradient-to-br from-emerald-500/5 to-blue-500/5 border-emerald-500/10">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-4 h-4 text-[var(--sage)] shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-300 leading-relaxed">{analysis.agentInsight}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>

        {/* 5-Year Projection Chart */}
        {analysis?.projections && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-card/50 border-[var(--rule)]" style={{ background: "var(--sh-surface-1)" }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[var(--sage)]" />
                  5-Year Projection — {SCENARIO_CONFIG[scenario].label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={analysis.projections} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cashFlowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="year" tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={(v) => `Yr ${v}`} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={(v) => formatK(v)} />
                    <Tooltip
                      contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                      labelStyle={{ color: "#fff", fontWeight: 600 }}
                      formatter={(value: any, name: string) => [formatCurrency(value), name === "cashFlow" ? "Annual Cash Flow" : name === "equity" ? "Equity Value" : "Revenue"]}
                      labelFormatter={(v) => `Year ${v}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
                    <Area type="monotone" dataKey="cashFlow" stroke="#10b981" strokeWidth={2} fill="url(#cashFlowGrad)" name="cashFlow" />
                    <Area type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} fill="url(#equityGrad)" name="equity" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </EditorialTopNav>
  );
}

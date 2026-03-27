import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import ScanProgress from "@/components/ScanProgress";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Database, Brain, Bell, Settings2, RefreshCw, Cpu, RotateCcw,
  Zap, Globe, FlaskConical, CheckCircle2,
} from "lucide-react";
import { MODULE_LABELS, MODULE_DESCRIPTIONS, MODEL_CATALOG, type AnalysisModule } from "@shared/models";

// ─── Consensus Model Config Sub-Component ─────────────────────────────────────
function ConsensusModelConfig() {
  const utils = trpc.useUtils();
  const { data: consensusData, isLoading } = trpc.models.consensusConfig.useQuery();
  const [m1, setM1] = useState("");
  const [m2, setM2] = useState("");
  const [m3, setM3] = useState("");
  const [saved, setSaved] = useState(false);

  // Sync local state when data loads
  const dataRef = useState(() => ({ loaded: false }))[0];
  if (consensusData && !dataRef.loaded) {
    dataRef.loaded = true;
    setM1(consensusData.consensus_model_1 ?? "gemini-2.5-pro");
    setM2(consensusData.consensus_model_2 ?? "gemini-2.5-flash");
    setM3(consensusData.consensus_model_3 ?? "gemini-2.5-flash-lite");
  }

  const updateConsensus = trpc.models.updateConsensus.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      utils.models.consensusConfig.invalidate();
      toast.success("Consensus models saved");
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const GEMINI_MODELS = MODEL_CATALOG.filter((m) => m.provider === "google");

  const ModelSelect = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs border-border bg-muted/20">
          <SelectValue placeholder="Select model..." />
        </SelectTrigger>
        <SelectContent>
          {GEMINI_MODELS.map((model) => (
            <SelectItem key={model.id} value={model.id} className="text-xs">
              <div className="flex items-center gap-2">
                <span>{model.label}</span>
                <span className="text-[9px] px-1 py-0.5 rounded-sm bg-blue-500/20 text-blue-400 font-medium">{model.tier}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Card className="bg-card border-border border-primary/30">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-primary" />
              Consensus Scoring Models
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              3 models run in parallel — divergence &gt;15% triggers ⚠ Review flag
            </p>
          </div>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => updateConsensus.mutate({ model1: m1, model2: m2, model3: m3 })}
            disabled={updateConsensus.isPending || isLoading}
          >
            {saved ? <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" /> : null}
            {updateConsensus.isPending ? "Saving..." : saved ? "Saved" : "Save"}
          </Button>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <ModelSelect value={m1} onChange={setM1} label="Model 1 (Strong)" />
            <ModelSelect value={m2} onChange={setM2} label="Model 2 (Fast)" />
            <ModelSelect value={m3} onChange={setM3} label="Model 3 (Lite)" />
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/50">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <p className="text-[10px] text-muted-foreground">
            Active: <span className="text-foreground font-mono">{m1}</span> · <span className="text-foreground font-mono">{m2}</span> · <span className="text-foreground font-mono">{m3}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

const SOURCES = [
  { id: "bizbuysell", label: "BizBuySell", tier: "Primary" },
  { id: "dealstream", label: "DealStream", tier: "Primary" },
  { id: "flippa", label: "Flippa", tier: "Primary" },
  { id: "quietlight", label: "Quiet Light", tier: "Premium" },
  { id: "empireflippers", label: "Empire Flippers", tier: "Premium" },
  { id: "axial", label: "Axial", tier: "Enterprise" },
  { id: "bizquest", label: "BizQuest", tier: "Primary" },
  { id: "sunbeltnetwork", label: "Sunbelt Network", tier: "Primary" },
  { id: "loopnet", label: "LoopNet", tier: "Commercial" },
  { id: "businessbroker", label: "BusinessBroker.net", tier: "Primary" },
  { id: "acquire", label: "Acquire.com", tier: "SaaS" },
];

const TIER_COLOR: Record<string, string> = {
  Primary: "bg-blue-500/20 text-blue-400",
  Premium: "bg-purple-500/20 text-purple-400",
  Enterprise: "bg-amber-500/20 text-amber-400",
  Commercial: "bg-emerald-500/20 text-emerald-400",
  SaaS: "bg-pink-500/20 text-pink-400",
};

const PROVIDER_COLOR: Record<string, string> = {
  google: "bg-blue-500/20 text-blue-400",
  openai: "bg-emerald-500/20 text-emerald-400",
  perplexity: "bg-purple-500/20 text-purple-400",
};

const TIER_ICON: Record<string, React.ReactNode> = {
  experimental: <FlaskConical className="w-3 h-3" />,
  stable: <CheckCircle2 className="w-3 h-3" />,
  fast: <Zap className="w-3 h-3" />,
  lite: <Cpu className="w-3 h-3" />,
};

const MODULE_ICON: Record<string, React.ReactNode> = {
  ownerPsychology: <Brain className="w-3.5 h-3.5 text-purple-400" />,
  digitalAudit: <Globe className="w-3.5 h-3.5 text-blue-400" />,
  redTeam: <Zap className="w-3.5 h-3.5 text-red-400" />,
  capitalStack: <Settings2 className="w-3.5 h-3.5 text-amber-400" />,
  investmentMemo: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  dealScoring: <Cpu className="w-3.5 h-3.5 text-primary" />,
  marketScan: <Database className="w-3.5 h-3.5 text-muted-foreground" />,
};

// ─── Re-Watch Onboarding Button ─────────────────────────────────────────────────────────
function ReWatchButton() {
  const [, navigate] = useLocation();
  const [done, setDone] = useState(false);
  const reset = trpc.user.resetOnboarding.useMutation({
    onSuccess: () => {
      setDone(true);
      // Clear the session flag so the guard redirects on next navigation
      sessionStorage.removeItem("onboarding_checked");
      toast.success("Onboarding reset — redirecting to lobby");
      setTimeout(() => {
        window.location.href = "/lobby";
      }, 800);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 text-xs shrink-0 border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
      onClick={() => reset.mutate()}
      disabled={reset.isPending || done}
    >
      {reset.isPending ? (
        <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
      ) : (
        <RotateCcw className="w-3 h-3 mr-1.5" />
      )}
      {done ? "Redirecting..." : "Re-watch Briefing"}
    </Button>
  );
}

const TABS = [
  { id: "sources", label: "Data Sources", icon: Database },
  { id: "engine", label: "AI Engine", icon: Brain },
  { id: "filters", label: "Filters", icon: Settings2 },
  { id: "notifications", label: "Alerts", icon: Bell },
  { id: "general", label: "General", icon: Settings2 },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("sources");
  const [enabledSources, setEnabledSources] = useState<Set<string>>(
    new Set(["bizbuysell", "dealstream", "flippa", "quietlight", "empireflippers"])
  );
  const [minCashFlow, setMinCashFlow] = useState([500000]);
  const [maxMultiple, setMaxMultiple] = useState([4.5]);
  const [autoScore, setAutoScore] = useState(true);
  const [autoMemo, setAutoMemo] = useState(false);
  const [notifyOnRedFlag, setNotifyOnRedFlag] = useState(true);
  const [notifyOnHighScore, setNotifyOnHighScore] = useState(true);

  const utils = trpc.useUtils();

  // Model config queries
  const { data: catalogData, isLoading: catalogLoading } = trpc.models.catalog.useQuery();
  const { data: configData, isLoading: configLoading } = trpc.models.config.useQuery();

  const updateModel = trpc.models.update.useMutation({
    onSuccess: () => {
      toast.success("Model updated");
      utils.models.config.invalidate();
    },
    onError: (e) => toast.error(`Failed to update model: ${e.message}`),
  });

  const resetDefaults = trpc.models.resetDefaults.useMutation({
    onSuccess: () => {
      toast.success("All models reset to defaults");
      utils.models.config.invalidate();
    },
    onError: (e) => toast.error(`Reset failed: ${e.message}`),
  });

  const [activeScanJobId, setActiveScanJobId] = useState<number | null>(null);

  const triggerScan = trpc.scan.trigger.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      if (data.jobId) setActiveScanJobId(data.jobId);
    },
    onError: (e) => toast.error(`Scan failed: ${e.message}`),
  });

  const toggleSource = (id: string) => {
    setEnabledSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const MODULES = Object.keys(MODULE_LABELS) as AnalysisModule[];

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">System Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Configure the Signal Hunter acquisition engine</p>
        </div>
        <Button
          size="sm"
          className="h-9 text-xs"
          onClick={() => triggerScan.mutate({ sources: Array.from(enabledSources), minCashFlow: minCashFlow[0], maxMultiple: maxMultiple[0] })}
          disabled={triggerScan.isPending || activeScanJobId !== null}
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${triggerScan.isPending ? "animate-spin" : ""}`} />
          {triggerScan.isPending ? "Starting..." : activeScanJobId ? "Scan Running..." : "Trigger Scan Now"}
        </Button>
      </div>

      {/* Scan Progress Panel */}
      {activeScanJobId !== null && (
        <ScanProgress
          jobId={activeScanJobId}
          onComplete={() => {
            setActiveScanJobId(null);
            utils.dashboard.stats.invalidate();
            utils.deals.list.invalidate();
          }}
          onRetry={() => {
            setActiveScanJobId(null);
            triggerScan.mutate({ sources: Array.from(enabledSources), minCashFlow: minCashFlow[0], maxMultiple: maxMultiple[0] });
          }}
        />
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border/50 pb-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "text-foreground border-primary bg-primary/5"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/30"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Data Sources */}
      {activeTab === "sources" && (
        <div className="grid gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Market Scan Sources</CardTitle>
              </div>
              <CardDescription className="text-xs">{enabledSources.size} of {SOURCES.length} sources active</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {SOURCES.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => toggleSource(source.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                      enabledSources.has(source.id)
                        ? "border-primary/50 bg-primary/10"
                        : "border-border bg-muted/20 opacity-50"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-medium text-foreground">{source.label}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${TIER_COLOR[source.tier]}`}>
                        {source.tier}
                      </span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${enabledSources.has(source.id) ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: AI Engine */}
      {activeTab === "engine" && (
        <div className="grid gap-4">
          {/* Header card */}
          <Card className="bg-gradient-to-br from-primary/10 via-card to-card border-primary/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" />
                    Third Signal AI Engine
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-lg">
                    Each analysis module runs on an independently configurable AI model.
                    Experimental Gemini models have generous rate limits — use them freely.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-border shrink-0"
                  onClick={() => resetDefaults.mutate()}
                  disabled={resetDefaults.isPending}
                >
                  <RotateCcw className={`w-3 h-3 mr-1.5 ${resetDefaults.isPending ? "animate-spin" : ""}`} />
                  Reset Defaults
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Module cards */}
          {(catalogLoading || configLoading) ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {MODULES.map((module) => {
                const currentModelId = configData?.[module]?.modelId ?? "";
                const currentModel = catalogData?.find((m) => m.id === currentModelId);
                const isEnabled = configData?.[module]?.enabled ?? true;

                return (
                  <Card key={module} className={`bg-card border-border transition-opacity ${!isEnabled ? "opacity-50" : ""}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center shrink-0 mt-0.5">
                          {MODULE_ICON[module]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-xs font-semibold text-foreground">{MODULE_LABELS[module]}</p>
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={(checked) => {
                                updateModel.mutate({ module, modelId: currentModelId, enabled: checked });
                              }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
                            {MODULE_DESCRIPTIONS[module]}
                          </p>
                          <Select
                            value={currentModelId}
                            onValueChange={(modelId) => {
                              updateModel.mutate({ module, modelId, enabled: isEnabled });
                            }}
                            disabled={!isEnabled}
                          >
                            <SelectTrigger className="h-8 text-xs border-border bg-muted/20">
                              <SelectValue placeholder="Select model..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              {/* Group by provider */}
                              {["google", "openai", "perplexity"].map((provider) => {
                                const providerModels = catalogData?.filter((m) => m.provider === provider) ?? [];
                                if (!providerModels.length) return null;
                                return (
                                  <div key={provider}>
                                    <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                      {provider === "google" ? "Google Gemini" : provider === "openai" ? "OpenAI" : "Perplexity"}
                                    </div>
                                    {providerModels.map((model) => (
                                      <SelectItem key={model.id} value={model.id} className="text-xs">
                                        <div className="flex items-center gap-2">
                                          <span>{model.label}</span>
                                          <span className={`text-[9px] px-1 py-0.5 rounded-sm font-medium ${PROVIDER_COLOR[model.provider]}`}>
                                            {model.tier}
                                          </span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </div>
                                );
                              })}
                            </SelectContent>
                          </Select>

                          {/* Current model metadata */}
                          {currentModel && (
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-sm font-medium ${PROVIDER_COLOR[currentModel.provider]}`}>
                                {TIER_ICON[currentModel.tier]}
                                {currentModel.tier}
                              </span>
                              <span className="text-[9px] text-muted-foreground">
                                {(currentModel.contextWindow / 1000).toFixed(0)}k ctx
                              </span>
                              <span className="text-[9px] text-muted-foreground">
                                {(currentModel.outputLimit / 1000).toFixed(0)}k out
                              </span>
                              {currentModel.supportsGrounding && (
                                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-sm">
                                  grounded
                                </span>
                              )}
                              {currentModel.notes && (
                                <span className="text-[9px] text-muted-foreground/60 italic truncate max-w-[180px]">
                                  {currentModel.notes}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Consensus Scoring Models */}
          <ConsensusModelConfig />

          {/* Model catalog summary */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground">Available Models ({catalogData?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {catalogData?.map((model) => (
                  <Badge
                    key={model.id}
                    variant="secondary"
                    className={`text-[10px] px-2 py-0.5 font-mono ${PROVIDER_COLOR[model.provider]}`}
                  >
                    {model.id}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Filters */}
      {activeTab === "filters" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-amber-400" /> Scoring Filters
              </CardTitle>
              <CardDescription className="text-xs">Minimum thresholds for deal qualification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Min. Annual Cash Flow</Label>
                  <span className="text-xs font-bold text-foreground">${(minCashFlow[0] / 1000).toFixed(0)}k</span>
                </div>
                <Slider value={minCashFlow} onValueChange={setMinCashFlow} min={100000} max={2000000} step={50000} />
                <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>$100k</span><span>$2M</span></div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Max. EBITDA Multiple</Label>
                  <span className="text-xs font-bold text-foreground">{maxMultiple[0].toFixed(1)}x</span>
                </div>
                <Slider value={maxMultiple} onValueChange={setMaxMultiple} min={1} max={10} step={0.5} />
                <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>1x</span><span>10x</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" /> AI Automation
              </CardTitle>
              <CardDescription className="text-xs">Configure Gemini-powered automation triggers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { id: "auto-score", label: "Auto-Score New Deals", desc: "Run scoring on every new listing found", value: autoScore, set: setAutoScore },
                { id: "auto-memo", label: "Auto-Generate Memos", desc: "Generate investment memos for deals scoring >0.75", value: autoMemo, set: setAutoMemo },
              ].map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <Switch checked={item.value} onCheckedChange={item.set} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Notifications */}
      {activeTab === "notifications" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-400" /> Notifications
              </CardTitle>
              <CardDescription className="text-xs">Alert preferences for deal pipeline events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { id: "red-flag", label: "Red Flag Alerts", desc: "Notify when Red Team kill probability exceeds 70%", value: notifyOnRedFlag, set: setNotifyOnRedFlag },
                { id: "high-score", label: "High-Score Alerts", desc: "Notify when a deal scores above 0.80", value: notifyOnHighScore, set: setNotifyOnHighScore },
              ].map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <Switch checked={item.value} onCheckedChange={item.set} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: General */}
      {activeTab === "general" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Onboarding */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Globe className="w-4 h-4 text-violet-400" /> Onboarding
              </CardTitle>
              <CardDescription className="text-xs">
                Re-watch the Signal Hunter briefing videos at any time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground">Investor Briefing</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs">
                    Two chapters: Zero-Tax Arbitrage and the Mainstreet Investor OS. Share with co-investors or replay before a pitch.
                  </p>
                </div>
                <ReWatchButton />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}

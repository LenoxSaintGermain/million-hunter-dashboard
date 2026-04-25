import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Search, Plus, AlertTriangle, ArrowUpRight,
  Building2, MapPin, DollarSign, TrendingUp, Zap,
  X, Target, SlidersHorizontal, ChevronDown, ChevronUp,
  Radar, Globe, Loader2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import ScanProgress from "@/components/ScanProgress";

// ── Preset location groups ─────────────────────────────────────────────────
const LOCATION_PRESETS = [
  { label: "Atlanta Metro", cities: ["Atlanta, GA", "Marietta, GA", "Alpharetta, GA", "Decatur, GA"] },
  { label: "Southeast", cities: ["Atlanta, GA", "Charlotte, NC", "Nashville, TN", "Birmingham, AL"] },
  { label: "Sun Belt", cities: ["Atlanta, GA", "Dallas, TX", "Houston, TX", "Tampa, FL", "Charlotte, NC"] },
  { label: "National", cities: [] }, // empty = no location filter
];

const SOURCE_OPTIONS = [
  { id: "bizbuysell", label: "BizBuySell" },
  { id: "dealstream", label: "DealStream" },
  { id: "quietlight", label: "Quiet Light" },
  { id: "empireflippers", label: "Empire Flippers" },
  { id: "flippa", label: "Flippa" },
];

function ScoreBar({ score }: { score: any }) {
  const v = score == null ? null : parseFloat(String(score));
  if (v == null || isNaN(v)) return <span className="text-muted-foreground text-xs">—</span>;
  const pct = Math.round(v * 100);
  const color = v >= 0.8 ? "bg-emerald-500" : v >= 0.65 ? "bg-amber-500" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("text-xs font-mono font-bold w-10 text-right tabular-nums",
        v >= 0.8 ? "text-emerald-500" : v >= 0.65 ? "text-amber-500" : "text-destructive"
      )}>{v.toFixed(3)}</span>
    </div>
  );
}

const stageColor: Record<string, string> = {
  new: "bg-muted/60 text-muted-foreground",
  scanning: "bg-blue-500/20 text-blue-400",
  qualified: "bg-primary/20 text-primary",
  high_priority: "bg-emerald-500/20 text-emerald-400",
  in_diligence: "bg-amber-500/20 text-amber-400",
  loi_sent: "bg-purple-500/20 text-purple-400",
  under_contract: "bg-orange-500/20 text-orange-400",
  closed: "bg-emerald-600/30 text-emerald-300",
  passed: "bg-muted/30 text-muted-foreground/60",
};

export default function Scan() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [showConfig, setShowConfig] = useState(true);
  const [form, setForm] = useState({ name: "", industry: "", location: "", askingPrice: "", revenue: "", cashFlow: "" });

  // ── Scan config state ──────────────────────────────────────────────────
  const [targetLocations, setTargetLocations] = useState<string[]>(["Atlanta, GA"]);
  const [locationInput, setLocationInput] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>(["bizbuysell", "dealstream", "quietlight"]);
  const [minCashFlow, setMinCashFlow] = useState(500000);
  const [maxMultiple, setMaxMultiple] = useState(5);
  const [activePreset, setActivePreset] = useState("Atlanta Metro");
  const [activeScanJobId, setActiveScanJobId] = useState<number | null>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);

  const { data: deals, isLoading, refetch } = trpc.deals.list.useQuery({ limit: 100 });
  const triggerScan = trpc.scan.trigger.useMutation({
    onSuccess: (r) => {
      toast.success(`Scan launched — ${r.message}`);
      if (r.jobId) setActiveScanJobId(r.jobId);
      setShowConfig(false);
      refetch();
    },
    onError: (e) => toast.error(`Scan failed: ${e.message}`),
  });
  const scoreDeal = trpc.deals.score.useMutation({
    onSuccess: (d) => { toast.success(`Scored: ${parseFloat(String(d.score)).toFixed(3)}`); refetch(); },
  });
  const createDeal = trpc.deals.create.useMutation({
    onSuccess: () => {
      toast.success("Deal added");
      setAddOpen(false);
      setForm({ name: "", industry: "", location: "", askingPrice: "", revenue: "", cashFlow: "" });
      refetch();
    },
  });

  const addLocation = (city: string) => {
    const trimmed = city.trim();
    if (!trimmed || targetLocations.includes(trimmed)) return;
    setTargetLocations(prev => [...prev, trimmed]);
    setLocationInput("");
  };

  const removeLocation = (city: string) => setTargetLocations(prev => prev.filter(l => l !== city));

  const applyPreset = (preset: typeof LOCATION_PRESETS[0]) => {
    setActivePreset(preset.label);
    setTargetLocations(preset.cities);
  };

  const toggleSource = (id: string) => {
    setSelectedSources(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleScan = () => {
    if (selectedSources.length === 0) {
      toast.error("Select at least one marketplace source");
      return;
    }
    triggerScan.mutate({
      sources: selectedSources,
      minCashFlow,
      maxMultiple,
      targetLocations: targetLocations.length > 0 ? targetLocations : undefined,
    });
  };

  const filtered = (deals ?? []).filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.location ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (d.industry ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (n: number | null | undefined) => {
    if (n == null) return "—";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
    return `$${n}`;
  };

  return (
    <DashboardLayout>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Radar className="w-5 h-5 text-primary" />
            Market Scan
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {(deals ?? []).length} deal{(deals ?? []).length !== 1 ? "s" : ""} in pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs border-border gap-1.5"
            onClick={() => setShowConfig(v => !v)}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Scan Config
            {showConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
          <Button variant="outline" size="sm" className="h-9 text-xs border-border" onClick={() => setAddOpen(true)}>
            <Plus className="w-3 h-3 mr-1.5" />
            Add Deal
          </Button>
        </div>
      </div>

      {/* ── Scan Configuration Panel ──────────────────────────────────────── */}
      {showConfig && (
        <Card className="bg-card border-border border-primary/20 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Scan Configuration
              </CardTitle>
              <span className="text-[11px] text-muted-foreground">Define WHERE and WHAT to scan</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Location targeting — the key missing piece */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  Target Markets
                  <span className="text-[10px] font-normal text-muted-foreground ml-1">— scan will focus on these locations</span>
                </Label>
                {targetLocations.length === 0 && (
                  <span className="text-[10px] text-amber-500 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    National (no location filter)
                  </span>
                )}
              </div>

              {/* Preset chips */}
              <div className="flex flex-wrap gap-1.5">
                {LOCATION_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      "text-[11px] px-2.5 py-1 rounded-full border transition-all duration-150 font-medium",
                      activePreset === preset.label
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/30 text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Active location tags */}
              {targetLocations.length > 0 && (
                <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                  {targetLocations.map(loc => (
                    <span
                      key={loc}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20"
                    >
                      <MapPin className="w-2.5 h-2.5" />
                      {loc}
                      <button
                        onClick={() => removeLocation(loc)}
                        className="ml-0.5 hover:text-destructive transition-colors"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Custom location input */}
              <div className="flex gap-2">
                <Input
                  ref={locationInputRef}
                  placeholder="Add city, e.g. Nashville, TN"
                  className="h-8 text-xs bg-background border-border flex-1"
                  value={locationInput}
                  onChange={e => setLocationInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { addLocation(locationInput); }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-3 border-border"
                  onClick={() => addLocation(locationInput)}
                  disabled={!locationInput.trim()}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Sources */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Marketplace Sources</Label>
              <div className="flex flex-wrap gap-1.5">
                {SOURCE_OPTIONS.map(src => (
                  <button
                    key={src.id}
                    onClick={() => toggleSource(src.id)}
                    className={cn(
                      "text-[11px] px-2.5 py-1 rounded-full border transition-all duration-150 font-medium",
                      selectedSources.includes(src.id)
                        ? "bg-primary/15 text-primary border-primary/40"
                        : "bg-muted/20 text-muted-foreground border-border hover:border-muted-foreground/40"
                    )}
                  >
                    {src.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Financial filters */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-primary" />
                  Min Cash Flow
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="h-8 text-xs bg-background border-border"
                    value={minCashFlow}
                    onChange={e => setMinCashFlow(Number(e.target.value))}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">${(minCashFlow / 1000).toFixed(0)}k</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  Max Multiple
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.5"
                    className="h-8 text-xs bg-background border-border"
                    value={maxMultiple}
                    onChange={e => setMaxMultiple(Number(e.target.value))}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">{maxMultiple}x</span>
                </div>
              </div>
            </div>

            {/* Launch button */}
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <div className="text-[11px] text-muted-foreground">
                {targetLocations.length > 0
                  ? `Scanning ${targetLocations.length} market${targetLocations.length > 1 ? "s" : ""} · ${selectedSources.length} source${selectedSources.length > 1 ? "s" : ""}`
                  : `National scan · ${selectedSources.length} source${selectedSources.length > 1 ? "s" : ""}`
                }
              </div>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 px-4"
                onClick={handleScan}
                disabled={triggerScan.isPending || selectedSources.length === 0}
              >
                {triggerScan.isPending ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />Launching...</>
                ) : (
                  <><Radar className="w-3 h-3" />Launch Scan</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Scan Progress ─────────────────────────────────────────────────── */}
      {activeScanJobId && (
        <ScanProgress
          jobId={activeScanJobId}
          onComplete={() => { refetch(); }}
          onRetry={() => setActiveScanJobId(null)}
        />
      )}

      {/* ── Search + Results ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filter by name, location, or industry..."
            className="pl-9 bg-card border-border h-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : !filtered.length ? (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <Building2 className="w-12 h-12 text-muted-foreground/20 mb-4" />
              <p className="text-sm font-medium text-muted-foreground">
                {search ? "No deals match your filter" : "No deals in pipeline yet"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {search ? "Try a different search term" : "Configure your target markets above and launch a scan"}
              </p>
              {!search && (
                <Button size="sm" className="mt-4 h-8 text-xs gap-1.5" onClick={() => setShowConfig(true)}>
                  <Target className="w-3 h-3" />
                  Configure Scan
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((deal) => (
              <Card key={deal.id} className="bg-card border-border hover:border-primary/40 transition-all duration-200 group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Link href={`/deal/${deal.id}`}>
                        <CardTitle className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors cursor-pointer line-clamp-2">
                          {deal.name}
                        </CardTitle>
                      </Link>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {deal.location && (
                          <div className="flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5 text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">{deal.location}</span>
                          </div>
                        )}
                        {deal.opportunityZone && (
                          <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0 h-4 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">OZ</span>
                        )}
                        {deal.tadDistrict && (
                          <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0 h-4 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">TAD</span>
                        )}
                      </div>
                    </div>
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium shrink-0", stageColor[deal.stage] ?? "bg-muted text-muted-foreground")}>
                      {deal.stage.replace(/_/g, " ")}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "Revenue", value: fmt(deal.revenue) },
                      { label: "Cash Flow", value: fmt(deal.cashFlow) },
                      { label: "Asking", value: fmt(deal.askingPrice) },
                    ].map((f) => (
                      <div key={f.label} className="bg-muted/30 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">{f.label}</p>
                        <p className="text-xs font-semibold text-foreground mt-0.5">{f.value}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">AI Score</span>
                      {deal.redFlagCount != null && deal.redFlagCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-destructive">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {deal.redFlagCount} flags
                        </span>
                      )}
                    </div>
                    <ScoreBar score={deal.score} />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-[11px] border-border"
                      onClick={() => scoreDeal.mutate({ id: deal.id })}
                      disabled={scoreDeal.isPending}
                    >
                      <Zap className="w-2.5 h-2.5 mr-1" />
                      Score
                    </Button>
                    <Link href={`/deal/${deal.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full h-7 text-[11px] border-border">
                        <ArrowUpRight className="w-2.5 h-2.5 mr-1" />
                        War Room
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Add Deal Dialog ───────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Add Deal Manually</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {[
              { key: "name", label: "Business Name *", placeholder: "e.g. Metro HVAC Atlanta" },
              { key: "industry", label: "Industry", placeholder: "e.g. HVAC, Logistics" },
              { key: "location", label: "Location", placeholder: "e.g. Atlanta, GA" },
              { key: "revenue", label: "Annual Revenue ($)", placeholder: "e.g. 1500000" },
              { key: "cashFlow", label: "Cash Flow / SDE ($)", placeholder: "e.g. 500000" },
              { key: "askingPrice", label: "Asking Price ($)", placeholder: "e.g. 2000000" },
            ].map((f) => (
              <div key={f.key}>
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Input
                  className="mt-1 bg-background border-border h-9 text-sm"
                  placeholder={f.placeholder}
                  value={(form as any)[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={!form.name || createDeal.isPending}
              onClick={() => createDeal.mutate({
                name: form.name,
                industry: form.industry || undefined,
                location: form.location || undefined,
                revenue: form.revenue ? Number(form.revenue) : undefined,
                cashFlow: form.cashFlow ? Number(form.cashFlow) : undefined,
                askingPrice: form.askingPrice ? Number(form.askingPrice) : undefined,
              })}
            >
              {createDeal.isPending ? "Adding..." : "Add Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

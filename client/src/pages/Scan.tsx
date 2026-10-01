import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import EditorialTopNav from "@/components/EditorialTopNav";
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
import { AlignmentPortrait } from "@/components/AlignmentPortrait";

const finiteAmount = (value: unknown): number | null => {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// ── Preset location groups ─────────────────────────────────────────────────
const LOCATION_PRESETS = [
  { label: "Miami / FLL", cities: ["Miami, FL", "Fort Lauderdale, FL", "Boca Raton, FL", "Pompano Beach, FL"] },
  { label: "South Florida", cities: ["Miami, FL", "Fort Lauderdale, FL", "West Palm Beach, FL", "Naples, FL", "Fort Myers, FL"] },
  { label: "Florida", cities: ["Miami, FL", "Fort Lauderdale, FL", "Tampa, FL", "Orlando, FL", "Jacksonville, FL"] },
  { label: "Sun Belt", cities: ["Miami, FL", "Dallas, TX", "Houston, TX", "Atlanta, GA", "Charlotte, NC"] },
  { label: "\uD83C\uDFDB\uFE0F Wingate Corridor", cities: ["Chicago, IL", "Indianapolis, IN", "Columbus, OH", "Louisville, KY", "Nashville, TN", "Charlotte, NC", "Atlanta, GA"] },
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
  high_priority: "bg-emerald-500/20 text-[var(--sage)]",
  in_diligence: "bg-amber-500/20 text-[var(--amber)]",
  loi_sent: "bg-purple-500/20 text-purple-400",
  under_contract: "bg-orange-500/20 text-orange-400",
  closed: "bg-emerald-600/30 text-emerald-300",
  passed: "bg-muted/30 text-muted-foreground/60",
};

export default function Scan() {
  const { user } = useAuth();
  const canSource = Boolean(user);
  const queryString = useSearch();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(queryString).get("add") === "1") setAddOpen(true);
  }, [queryString]);
  const [showConfig, setShowConfig] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", location: "", askingPrice: "", revenue: "", cashFlow: "" });

  // ── Scan config state ──────────────────────────────────────────────────
  const [targetLocations, setTargetLocations] = useState<string[]>(["Miami, FL", "Fort Lauderdale, FL"]);
  const [locationInput, setLocationInput] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>(["bizbuysell", "dealstream", "quietlight"]);
  const [minCashFlow, setMinCashFlow] = useState(500000);
  const [maxMultiple, setMaxMultiple] = useState(5);
  const [activePreset, setActivePreset] = useState("Miami / FLL");
  const [activeScanJobId, setActiveScanJobId] = useState<number | null>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);

  // Off-Market Scout state
  const [showOffMarket, setShowOffMarket] = useState(false);
  const [offMarketResults, setOffMarketResults] = useState<Array<{
    name: string; industry: string; location: string;
    estimatedRevenue: number; estimatedCashFlow: number; estimatedAskingPrice: number;
    offMarketSignal: string; acquisitionAngle: string; urgencyScore: number; contactStrategy: string;
  }>>([]);

  const { data: deals, isLoading, isError, refetch } = trpc.deals.list.useQuery({ limit: 100 });
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
    onError: (e) => toast.error(`Scoring failed: ${e.message}`),
  });

  const createDeal = trpc.deals.create.useMutation({
    onError: (e) => toast.error(`Could not add deal: ${e.message}`),
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
    if (!canSource) return;
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
    <EditorialTopNav>
      <div className="scan-edition">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="hunter-eyebrow">{canSource ? "Market Scan / Experimental sourcing desk" : "Your private deal pipeline"}</p>
          <h1 className="scan-edition-title">
            Find the next question.
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
              Labs
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isError ? "Pipeline unavailable" : isLoading ? "Reading your pipeline…" : `${(deals ?? []).length} saved opportunities`}
          </p>
          {/* runScanPipeline now fetches REAL listings via Perplexity sonar-pro with
              real listing URLs — verify financials against each source before acting. */}
          <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
            Saved inventory, not a fresh availability check. Verify each source before acting.
          </p>
        </div>
        <div className="flex gap-2">
          {canSource && <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs border-border gap-1.5"
            onClick={() => setShowConfig(v => !v)}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Scan Config
            {showConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>}
          <Button variant="outline" size="sm" className="h-9 text-xs border-border" onClick={() => setAddOpen(true)}>
            <Plus className="w-3 h-3 mr-1.5" />
            Add Deal
          </Button>
        </div>
      </div>

      {/* ── Scan Configuration Panel ──────────────────────────────────────── */}
      {!canSource && <p className="border-l-2 border-amber px-4 py-3 text-sm text-muted-foreground">Automatic sourcing is unavailable for this account while private sourcing jobs are being enabled. Use Add Deal to build your own pipeline.</p>}
      {canSource && showConfig && (
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

      <div className="scan-discovery-link"><div><span className="hunter-eyebrow">Beyond the listing</span><p>Looking off-market?</p></div><Link href="/off-market">Open the discovery desk <ArrowUpRight size={16}/></Link></div>

      {/* ── Scan Progress ─────────────────────────────────────────────────── */}
      {canSource && activeScanJobId && (
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
        ) : isError ? (
          <div role="alert" className="deal-source-receipt">The pipeline could not be loaded. <button onClick={() => refetch()}>Try again</button></div>
        ) : !filtered.length ? (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <Building2 className="w-12 h-12 text-muted-foreground/20 mb-4" />
              <p className="text-sm font-medium text-muted-foreground">
                {search ? "No targets match your filter" : "Validation queue is empty"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {search ? "Try a different search term" : canSource ? "Configure your target markets above and run a scan to populate the queue" : "Add a business you are considering. Its details stay in your private pipeline."}
              </p>
              {!search && (
                <Button size="sm" className="mt-4 h-8 text-xs gap-1.5" onClick={() => canSource ? setShowConfig(true) : setAddOpen(true)}>
                  <Target className="w-3 h-3" />
                  {canSource ? "Configure Scan" : "Add Deal"}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="scan-profile-feed">
            {filtered.map((deal, index) => <article key={deal.id} className="scan-opportunity">
              <header><div className="scan-monogram" aria-hidden="true">{deal.name.split(/\s+/).slice(0, 2).map(word => word[0]).join("")}</div><div><p className="hunter-eyebrow">{String(index + 1).padStart(2, "0")} / {deal.industry || "Industry not recorded"}</p><h2><Link href={`/deal/${deal.id}`}>{deal.name}</Link></h2><p className="scan-location">{deal.location || "Location not disclosed"} · {deal.stage.replace(/_/g, " ")}</p></div></header>
              <AlignmentPortrait compact title="The numbers. The next questions." subtitle={deal.isSynthetic ? "Illustrative — composite deal, not a real customer" : "Saved figures · reported, not independently verified"} measures={[
                { id: "asking", label: "Asking price", value: finiteAmount(deal.askingPrice), unit: "usd", basis: "reported", wanted: "An asking price", explanation: "Saved asking price. Verify current availability and price against the original listing." },
                { id: "cash", label: "Annual cash flow", value: finiteAmount(deal.cashFlow), unit: "usd", basis: "reported", wanted: "Reconciled earnings", explanation: "Reported annual cash flow. Request tax returns and reconcile owner pay and add-backs." },
                { id: "revenue", label: "Annual revenue", value: finiteAmount(deal.revenue), unit: "usd", basis: "reported", wanted: "Revenue records", explanation: "Reported revenue, not audited financials. Its period and basis need verification." },
                { id: "multiple", label: "Price / cash flow", value: finiteAmount(deal.askingPrice) != null && (finiteAmount(deal.cashFlow) ?? 0) > 0 ? finiteAmount(deal.askingPrice)! / finiteAmount(deal.cashFlow)! : null, unit: "multiple", basis: "modeled", wanted: "Price & earnings", explanation: "Asking price divided by reported annual cash flow. This arithmetic is not a quality or return score." },
              ]}/>
              <div className="scan-profile-foot">
                <p>{deal.redFlagCount != null ? `${deal.redFlagCount} recorded flags · review their basis` : "Risk flags not recorded"}<small>Screening score: {finiteAmount(deal.score)?.toFixed(3) ?? "not available"} · not thesis fit or verified quality.</small></p>
                <Link className="hunter-cta" href={`/deal/${deal.id}`}>Read the opportunity <ArrowUpRight size={16}/></Link>
                <button className="scan-rescore" disabled={scoreDeal.isPending} onClick={() => scoreDeal.mutate({ id: deal.id })}>Re-score</button>
              </div>
            </article>)}
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
      </div>
    </EditorialTopNav>
  );
}

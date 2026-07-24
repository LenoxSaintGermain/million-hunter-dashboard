import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Building2,
  MapPin,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Landmark,
  Layers,
  Wind,
  BarChart3,
  Plus,
  ExternalLink,
  ChevronRight,
  Star,
  Clock,
  ArrowUpRight,
  Filter,
  Zap,
} from "lucide-react";

// ─── Wingate Thesis Constants ─────────────────────────────────────────────────
const WINGATE_CRITERIA = [
  { id: "yearBuilt", label: "Pre-1945 Construction", icon: Clock, weight: 20, description: "Character-defining age for NR eligibility" },
  { id: "isHistoric", label: "National Register Listed", icon: Landmark, weight: 25, description: "Confirmed NR listing unlocks 20% federal HTC" },
  { id: "historicRegisterEligible", label: "NR Eligible", icon: Star, weight: 15, description: "Eligible = path to tax credit arbitrage" },
  { id: "isStabilized", label: "Stabilized / Leased-Up", icon: CheckCircle2, weight: 20, description: "No renovation risk — cash flow on Day 1" },
  { id: "hasAirRights", label: "Air Rights / H&BU Potential", icon: Wind, weight: 10, description: "Vertical or lot expansion optionality" },
  { id: "capRate", label: "Cap Rate ≥ 6%", icon: BarChart3, weight: 10, description: "Minimum yield threshold for stabilized hold" },
];

const TARGET_STATES = ["IL", "IN", "OH", "KY", "TN", "NC", "SC", "GA"];
const TARGET_STATE_LABELS: Record<string, string> = {
  IL: "Chicago / Midwest", IN: "Indianapolis", OH: "Columbus / Cleveland",
  KY: "Louisville", TN: "Nashville / Memphis", NC: "Charlotte / Raleigh",
  SC: "Charleston / Columbia", GA: "Atlanta / Savannah",
};

// ─── Wingate Score Calculator ─────────────────────────────────────────────────
function calcWingateScore(asset: any): { score: number; breakdown: { id: string; label: string; pass: boolean; weight: number }[] } {
  const breakdown = WINGATE_CRITERIA.map((c) => {
    let pass = false;
    if (c.id === "yearBuilt") pass = asset.yearBuilt != null && asset.yearBuilt <= 1945;
    else if (c.id === "isHistoric") pass = !!asset.isHistoric;
    else if (c.id === "historicRegisterEligible") pass = !!asset.historicRegisterEligible || !!asset.isHistoric;
    else if (c.id === "isStabilized") pass = !!asset.isStabilized;
    else if (c.id === "hasAirRights") pass = !!asset.hasAirRights;
    else if (c.id === "capRate") pass = asset.capRate != null && Number(asset.capRate) >= 0.06;
    return { ...c, pass };
  });
  const score = breakdown.reduce((sum, b) => sum + (b.pass ? b.weight : 0), 0);
  return { score, breakdown };
}

// ─── Asset Card ───────────────────────────────────────────────────────────────
function WingateAssetCard({ asset, onSelect }: { asset: any; onSelect: (a: any) => void }) {
  const { score, breakdown } = calcWingateScore(asset);
  const aiScore = asset.aiScore != null ? parseFloat(String(asset.aiScore)) : null;
  const capRate = asset.capRate != null ? parseFloat(String(asset.capRate)) : null;

  const tier =
    score >= 80 ? { label: "Prime", color: "text-amber-400 border-amber-400/30 bg-amber-400/10" } :
    score >= 55 ? { label: "Qualified", color: "text-violet-400 border-violet-400/30 bg-violet-400/10" } :
    score >= 30 ? { label: "Review", color: "text-sky-400 border-sky-400/30 bg-sky-400/10" } :
                  { label: "Disqualified", color: "text-muted-foreground border-border bg-muted/20" };

  return (
    <div
      onClick={() => onSelect(asset)}
      className="group relative flex flex-col gap-3 p-4 rounded-xl border border-border bg-card hover:border-amber-500/30 hover:bg-amber-500/3 transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate group-hover:text-amber-400 transition-colors">{asset.name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground">{asset.city}, {asset.state}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", tier.color)}>{tier.label}</span>
          <span className="text-[11px] font-mono font-bold text-amber-400">{score}/100</span>
        </div>
      </div>

      {/* Wingate criteria pills */}
      <div className="flex flex-wrap gap-1">
        {breakdown.map((b) => (
          <span
            key={b.id}
            className={cn(
              "inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border",
              b.pass
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-muted/20 text-muted-foreground/50 border-border/50"
            )}
          >
            {b.pass ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
            {b.label.split(" ")[0]}
          </span>
        ))}
      </div>

      {/* Financials */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/50">
        <div>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Ask</p>
          <p className="text-xs font-semibold">{asset.askingPrice ? `$${(asset.askingPrice / 1e6).toFixed(2)}M` : "—"}</p>
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Cap Rate</p>
          <p className={cn("text-xs font-semibold", capRate && capRate >= 0.06 ? "text-emerald-400" : "")}>
            {capRate ? `${(capRate * 100).toFixed(1)}%` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">AI Score</p>
          <p className={cn("text-xs font-semibold", aiScore && aiScore >= 0.75 ? "text-amber-400" : "")}>
            {aiScore ? aiScore.toFixed(3) : "—"}
          </p>
        </div>
      </div>

      {/* Year built + occupancy */}
      {(asset.yearBuilt || asset.occupancyRate != null) && (
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {asset.yearBuilt && <span>Est. {asset.yearBuilt}</span>}
          {asset.occupancyRate != null && (
            <span className={cn("font-medium", asset.occupancyRate >= 0.85 ? "text-violet-400" : "text-amber-500/70")}>
              {(asset.occupancyRate * 100).toFixed(0)}% occ.
            </span>
          )}
          {asset.stories && <span>{asset.stories}F</span>}
        </div>
      )}
    </div>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────
function WingateDetailDrawer({ asset, onClose }: { asset: any; onClose: () => void }) {
  const { score, breakdown } = calcWingateScore(asset);
  const scoreAsset = trpc.scout.scoreAsset.useMutation({
    onSuccess: (r) => toast.success(`AI Score: ${r.score.toFixed(3)} — ${r.summary}`),
    onError: (e) => toast.error(`Scoring failed: ${e.message}`),
  });
  const [, navigate] = useLocation();

  const capRate = asset.capRate != null ? parseFloat(String(asset.capRate)) : null;
  const aiScore = asset.aiScore != null ? parseFloat(String(asset.aiScore)) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 p-6 pb-4 bg-card border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-amber-400 tracking-widest uppercase">🏛️ Wingate</span>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                score >= 80 ? "text-amber-400 border-amber-400/30 bg-amber-400/10" :
                score >= 55 ? "text-violet-400 border-violet-400/30 bg-violet-400/10" :
                "text-muted-foreground border-border bg-muted/20"
              )}>
                {score >= 80 ? "Prime" : score >= 55 ? "Qualified" : score >= 30 ? "Review" : "Disqualified"}
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground">{asset.name}</h2>
            <p className="text-sm text-muted-foreground">{asset.address}, {asset.city}, {asset.state}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none mt-1">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Wingate Score Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Wingate Score</p>
              <span className="text-2xl font-black text-amber-400 font-mono">{score}<span className="text-sm text-muted-foreground">/100</span></span>
            </div>
            <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden mb-4">
              <div
                className={cn("h-full rounded-full transition-all", score >= 80 ? "bg-amber-400" : score >= 55 ? "bg-violet-400" : "bg-muted-foreground/40")}
                style={{ width: `${score}%` }}
              />
            </div>
            <div className="space-y-2">
              {breakdown.map((b) => {
                const criteria = WINGATE_CRITERIA.find((c) => c.id === b.id);
                return (
                  <div key={b.id} className="flex items-center gap-3">
                    <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0", b.pass ? "bg-emerald-500/20" : "bg-muted/30")}>
                      {b.pass
                        ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        : <XCircle className="w-3 h-3 text-muted-foreground/50" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-medium", b.pass ? "text-foreground" : "text-muted-foreground/60")}>{b.label}</p>
                      {criteria && <p className="text-[10px] text-muted-foreground/50">{criteria.description}</p>}
                    </div>
                    <span className={cn("text-[10px] font-bold", b.pass ? "text-emerald-400" : "text-muted-foreground/40")}>
                      {b.pass ? `+${b.weight}` : `+0`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Financials */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Financials</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Asking Price", value: asset.askingPrice ? `$${(asset.askingPrice / 1e6).toFixed(2)}M` : "—" },
                { label: "Cap Rate", value: capRate ? `${(capRate * 100).toFixed(2)}%` : "—", highlight: capRate && capRate >= 0.06 },
                { label: "NOI", value: asset.noi ? `$${(asset.noi / 1e3).toFixed(0)}k/yr` : "—" },
                { label: "Occupancy", value: asset.occupancyRate != null ? `${(asset.occupancyRate * 100).toFixed(0)}%` : "—", highlight: asset.occupancyRate >= 0.85 },
                { label: "Year Built", value: asset.yearBuilt ?? "—" },
                { label: "Stories", value: asset.stories ?? "—" },
                { label: "Sq Ft", value: asset.squareFootage ? asset.squareFootage.toLocaleString() : "—" },
                { label: "Lot Sq Ft", value: asset.lotSqFt ? asset.lotSqFt.toLocaleString() : "—" },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="p-3 rounded-lg bg-muted/20 border border-border">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
                  <p className={cn("text-sm font-semibold mt-0.5", highlight ? "text-emerald-400" : "")}>{String(value)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* H&BU Notes */}
          {asset.higherAndBetterUseNotes && (
            <div className="p-3 rounded-lg bg-sky-500/5 border border-sky-500/20">
              <p className="text-xs font-semibold text-sky-400 mb-1">Higher-and-Better-Use Notes</p>
              <p className="text-xs text-muted-foreground">{asset.higherAndBetterUseNotes}</p>
            </div>
          )}

          {/* AI Score */}
          {aiScore != null && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-primary">AI Score</p>
                <span className="text-lg font-black text-primary font-mono">{aiScore.toFixed(3)}</span>
              </div>
              {asset.aiScoreSummary && <p className="text-xs text-muted-foreground mt-1">{asset.aiScoreSummary}</p>}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              onClick={() => scoreAsset.mutate({ id: asset.id })}
              disabled={scoreAsset.isPending}
            >
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              {scoreAsset.isPending ? "Scoring..." : "Run AI Score"}
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => navigate(`/scout`)}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Open in Scout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Add Dialog ─────────────────────────────────────────────────────────
function WingateQuickAdd({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", address: "", city: "", state: "IL",
    askingPrice: "", capRate: "", noi: "", squareFootage: "",
    yearBuilt: "", stories: "", occupancyRate: "", lotSqFt: "",
    isHistoric: false, historicRegisterEligible: false,
    isStabilized: true, hasAirRights: false,
    higherAndBetterUseNotes: "",
    propertyType: "mixed_use" as const,
  });

  const create = trpc.scout.create.useMutation({
    onSuccess: () => {
      toast.success("Asset added to Wingate pipeline");
      onCreated();
      onClose();
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const handleSubmit = () => {
    if (!form.name || !form.address || !form.city) return toast.error("Name, address, and city are required");
    create.mutate({
      name: form.name,
      address: form.address,
      city: form.city,
      state: form.state,
      propertyType: form.propertyType,
      askingPrice: form.askingPrice ? parseFloat(form.askingPrice) : undefined,
      capRate: form.capRate ? parseFloat(form.capRate) / 100 : undefined,
      noi: form.noi ? parseFloat(form.noi) : undefined,
      squareFootage: form.squareFootage ? parseInt(form.squareFootage) : undefined,
      yearBuilt: form.yearBuilt ? parseInt(form.yearBuilt) : undefined,
      stories: form.stories ? parseInt(form.stories) : undefined,
      occupancyRate: form.occupancyRate ? parseFloat(form.occupancyRate) / 100 : undefined,
      lotSqFt: form.lotSqFt ? parseInt(form.lotSqFt) : undefined,
      isHistoric: form.isHistoric,
      historicRegisterEligible: form.historicRegisterEligible,
      isStabilized: form.isStabilized,
      hasAirRights: form.hasAirRights,
      higherAndBetterUseNotes: form.higherAndBetterUseNotes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>🏛️</span> Add Wingate Asset
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto py-2">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Property Name *</Label>
            <Input className="h-8 text-sm bg-muted/30 border-border" placeholder="e.g. 1920s Mixed-Use Loft Block" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Address *</Label>
            <Input className="h-8 text-sm bg-muted/30 border-border" placeholder="123 Main St" value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">City *</Label>
            <Input className="h-8 text-sm bg-muted/30 border-border" placeholder="Chicago" value={form.city} onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">State</Label>
            <Select value={form.state} onValueChange={(v) => setForm(p => ({ ...p, state: v }))}>
              <SelectTrigger className="h-8 text-sm bg-muted/30 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s} — {TARGET_STATE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Asking Price ($)</Label>
            <Input className="h-8 text-sm bg-muted/30 border-border" placeholder="2500000" value={form.askingPrice} onChange={(e) => setForm(p => ({ ...p, askingPrice: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cap Rate (%)</Label>
            <Input className="h-8 text-sm bg-muted/30 border-border" placeholder="7.2" value={form.capRate} onChange={(e) => setForm(p => ({ ...p, capRate: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Year Built</Label>
            <Input className="h-8 text-sm bg-muted/30 border-border" placeholder="1928" value={form.yearBuilt} onChange={(e) => setForm(p => ({ ...p, yearBuilt: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Occupancy (%)</Label>
            <Input className="h-8 text-sm bg-muted/30 border-border" placeholder="95" value={form.occupancyRate} onChange={(e) => setForm(p => ({ ...p, occupancyRate: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Stories</Label>
            <Input className="h-8 text-sm bg-muted/30 border-border" placeholder="3" value={form.stories} onChange={(e) => setForm(p => ({ ...p, stories: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Lot Sq Ft</Label>
            <Input className="h-8 text-sm bg-muted/30 border-border" placeholder="12000" value={form.lotSqFt} onChange={(e) => setForm(p => ({ ...p, lotSqFt: e.target.value }))} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">H&BU Notes</Label>
            <Input className="h-8 text-sm bg-muted/30 border-border" placeholder="Air rights, adjacent lot, zoning overlay..." value={form.higherAndBetterUseNotes} onChange={(e) => setForm(p => ({ ...p, higherAndBetterUseNotes: e.target.value }))} />
          </div>
          <div className="col-span-2 flex flex-wrap gap-4 pt-1">
            {([
              { key: "isHistoric", label: "NR Listed" },
              { key: "historicRegisterEligible", label: "NR Eligible" },
              { key: "isStabilized", label: "Stabilized" },
              { key: "hasAirRights", label: "Air Rights" },
            ] as const).map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`wq-${key}`}
                  checked={(form as any)[key]}
                  onChange={(e) => setForm(p => ({ ...p, [key]: e.target.checked }))}
                  className="w-4 h-4 accent-primary"
                />
                <Label htmlFor={`wq-${key}`} className="text-xs cursor-pointer">{label}</Label>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="border-border">Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={create.isPending} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
            {create.isPending ? "Adding..." : "Add to Pipeline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Wingate Dashboard ───────────────────────────────────────────────────
export default function Wingate() {
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [filterState, setFilterState] = useState<string>("all");
  const [filterTier, setFilterTier] = useState<"all" | "prime" | "qualified" | "review">("all");

  const { data: allAssets, isLoading, refetch } = trpc.scout.list.useQuery();

  // Filter to Wingate-relevant assets (historic or stabilized or pre-1945)
  const wingateAssets = useMemo(() => {
    if (!allAssets) return [];
    return allAssets.filter((a: any) =>
      a.isHistoric || a.historicRegisterEligible || a.isStabilized ||
      (a.yearBuilt && a.yearBuilt <= 1945) || a.hasAirRights
    );
  }, [allAssets]);

  const filteredAssets = useMemo(() => {
    let list = wingateAssets;
    if (filterState !== "all") list = list.filter((a: any) => a.state === filterState);
    if (filterTier !== "all") {
      list = list.filter((a: any) => {
        const { score } = calcWingateScore(a);
        if (filterTier === "prime") return score >= 80;
        if (filterTier === "qualified") return score >= 55 && score < 80;
        if (filterTier === "review") return score >= 30 && score < 55;
        return true;
      });
    }
    return [...list].sort((a: any, b: any) => calcWingateScore(b).score - calcWingateScore(a).score);
  }, [wingateAssets, filterState, filterTier]);

  // KPI stats
  const stats = useMemo(() => {
    if (!wingateAssets.length) return { total: 0, prime: 0, avgCapRate: null, pipelineValue: 0 };
    const prime = wingateAssets.filter((a: any) => calcWingateScore(a).score >= 80).length;
    const capRates = wingateAssets.filter((a: any) => a.capRate != null).map((a: any) => parseFloat(String(a.capRate)));
    const avgCapRate = capRates.length ? capRates.reduce((s, v) => s + v, 0) / capRates.length : null;
    const pipelineValue = wingateAssets.reduce((s: number, a: any) => s + (a.askingPrice ?? 0), 0);
    return { total: wingateAssets.length, prime, avgCapRate, pipelineValue };
  }, [wingateAssets]);

  // States represented in pipeline
  const statesInPipeline = useMemo(() => {
    const s = new Set(wingateAssets.map((a: any) => a.state));
    return TARGET_STATES.filter((st) => s.has(st));
  }, [wingateAssets]);

  return (
    <DashboardLayout>
      {/* ── Page Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Landmark className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-bold text-amber-400 tracking-widest uppercase">Wingate Thesis</span>
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Historic Building Command Center</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Pre-1945 · Stabilized · National Register eligible · Higher-and-Better-Use optionality · Midwest–SE corridor
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="bg-amber-500 hover:bg-amber-600 text-black font-semibold shrink-0"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Asset
        </Button>
      </div>

      {/* ── Thesis Brief ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* KPI Strip */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Assets", value: stats.total, icon: Building2, color: "text-foreground" },
            { label: "Prime (80+)", value: stats.prime, icon: Star, color: "text-amber-400" },
            { label: "Avg Cap Rate", value: stats.avgCapRate ? `${(stats.avgCapRate * 100).toFixed(1)}%` : "—", icon: TrendingUp, color: "text-emerald-400" },
            { label: "Pipeline Value", value: stats.pipelineValue ? `$${(stats.pipelineValue / 1e6).toFixed(1)}M` : "—", icon: BarChart3, color: "text-violet-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn("w-4 h-4", color)} />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
              </div>
              <p className={cn("text-2xl font-black font-mono", color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* Criteria Checklist */}
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/3">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-wide mb-3">Wingate Criteria (100 pts)</p>
          <div className="space-y-1.5">
            {WINGATE_CRITERIA.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <c.icon className="w-3 h-3 text-amber-400/70 shrink-0" />
                  <span className="text-[11px] text-muted-foreground">{c.label}</span>
                </div>
                <span className="text-[10px] font-bold text-amber-400/70">{c.weight}pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Target Geography ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 mr-2">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Target Markets:</span>
        </div>
        {TARGET_STATES.map((s) => {
          const active = statesInPipeline.includes(s);
          return (
            <button
              key={s}
              onClick={() => setFilterState(filterState === s ? "all" : s)}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all",
                filterState === s
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                  : active
                  ? "bg-muted/30 text-foreground border-border hover:border-amber-500/30"
                  : "bg-muted/10 text-muted-foreground/40 border-border/40"
              )}
            >
              {s}
              {active && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
            </button>
          );
        })}
      </div>

      {/* ── Main Content: Asset Grid + Scoring Panel ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Asset Grid (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            {(["all", "prime", "qualified", "review"] as const).map((tier) => (
              <button
                key={tier}
                onClick={() => setFilterTier(tier)}
                className={cn(
                  "px-3 py-1 rounded-full text-[11px] font-semibold border transition-all capitalize",
                  filterTier === tier
                    ? tier === "prime" ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      : tier === "qualified" ? "bg-violet-500/20 text-violet-400 border-violet-500/30"
                      : tier === "review" ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
                      : "bg-muted/40 text-foreground border-border"
                    : "bg-muted/20 text-muted-foreground border-border hover:border-amber-500/20"
                )}
              >
                {tier === "all" ? `All (${filteredAssets.length})` : tier === "prime" ? `🌟 Prime` : tier === "qualified" ? `✓ Qualified` : `⚠ Review`}
              </button>
            ))}
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-44 rounded-xl bg-muted/20 animate-pulse" />
              ))}
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Landmark className="w-10 h-10 text-amber-400/30 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">No Wingate assets in pipeline yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                Add a pre-1945 stabilized building or import from Scout to start your historic building thesis.
              </p>
              <Button
                size="sm"
                className="mt-4 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add First Asset
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredAssets.map((asset: any) => (
                <WingateAssetCard key={asset.id} asset={asset} onSelect={setSelectedAsset} />
              ))}
            </div>
          )}
        </div>

        {/* Right Panel: Scoring Guide + Geography Intelligence */}
        <div className="space-y-4">
          {/* Scoring Breakdown Guide */}
          <div className="p-4 rounded-xl border border-border bg-card">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Score Tiers</p>
            <div className="space-y-2">
              {[
                { tier: "Prime", range: "80–100", color: "text-amber-400 bg-amber-400/10 border-amber-400/20", desc: "Full thesis match — move immediately" },
                { tier: "Qualified", range: "55–79", color: "text-violet-400 bg-violet-400/10 border-violet-400/20", desc: "Strong fit — run AI score + diligence" },
                { tier: "Review", range: "30–54", color: "text-sky-400 bg-sky-400/10 border-sky-400/20", desc: "Partial fit — verify missing criteria" },
                { tier: "Disqualified", range: "0–29", color: "text-muted-foreground bg-muted/20 border-border", desc: "Does not meet Wingate thesis" },
              ].map(({ tier, range, color, desc }) => (
                <div key={tier} className={cn("p-2.5 rounded-lg border", color)}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-bold">{tier}</span>
                    <span className="text-[10px] font-mono opacity-70">{range}</span>
                  </div>
                  <p className="text-[10px] opacity-70">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Auto-Disqualifiers */}
          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/3">
            <p className="text-xs font-bold text-rose-400 uppercase tracking-wide mb-3">Auto-Disqualifiers</p>
            <div className="space-y-1.5">
              {[
                "Built post-1960 (no historic character)",
                "Vacancy > 30% (renovation risk)",
                "Cap rate < 5% (yield compression)",
                "No path to NR eligibility",
                "Active code violations / liens",
                "Outside Midwest–SE corridor",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <XCircle className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" />
                  <span className="text-[11px] text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Requirements */}
          <div className="p-4 rounded-xl border border-border bg-card">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Evidence Required</p>
            <div className="space-y-1.5">
              {[
                { label: "NR nomination letter or SHPO determination", icon: CheckCircle2 },
                { label: "Current rent roll (stabilized proof)", icon: CheckCircle2 },
                { label: "Title search — no deed restrictions on air rights", icon: CheckCircle2 },
                { label: "Phase I ESA (pre-1945 buildings)", icon: AlertTriangle },
                { label: "Zoning overlay confirmation", icon: CheckCircle2 },
                { label: "HTC eligibility pre-screen", icon: Star },
              ].map(({ label, icon: Icon }) => (
                <div key={label} className="flex items-start gap-2">
                  <Icon className="w-3 h-3 text-muted-foreground/60 shrink-0 mt-0.5" />
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Quick Actions</p>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start border-border text-xs"
              onClick={() => window.location.href = "/scout"}
            >
              <Building2 className="w-3.5 h-3.5 mr-2 text-amber-400" />
              Browse All Scout Assets
              <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start border-border text-xs"
              onClick={() => window.location.href = "/thesis"}
            >
              <Layers className="w-3.5 h-3.5 mr-2 text-amber-400" />
              Open Thesis Engine
              <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start border-border text-xs"
              onClick={() => window.location.href = "/opportunity-radar"}
            >
              <ArrowUpRight className="w-3.5 h-3.5 mr-2 text-amber-400" />
              Opportunity Radar
              <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      {selectedAsset && (
        <WingateDetailDrawer asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
      <WingateQuickAdd
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => refetch()}
      />
    </DashboardLayout>
  );
}

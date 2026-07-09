import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import EditorialTopNav from "@/components/EditorialTopNav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import {
  Building2, MapPin, DollarSign, TrendingUp, Zap, Plus, Search,
  Filter, SlidersHorizontal, RefreshCw, ChevronDown, ChevronUp,
  Loader2, BarChart3, CheckCircle2, ArrowRight, Link2, Sparkles,
  ExternalLink, CheckCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type PropertyType = "office" | "industrial" | "retail" | "mixed_use" | "land" | "warehouse" | "flex";
type AssetStatus = "new" | "reviewing" | "qualified" | "rejected" | "acquired";

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  office: "Office",
  industrial: "Industrial",
  retail: "Retail",
  mixed_use: "Mixed Use",
  land: "Land",
  warehouse: "Warehouse",
  flex: "Flex",
};

const STATUS_COLORS: Record<AssetStatus, string> = {
  new: "bg-muted/50 text-muted-foreground border-border",
  reviewing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  qualified: "bg-emerald-500/10 text-[var(--sage)] border-emerald-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  acquired: "bg-primary/10 text-primary border-primary/20",
};

const PROPERTY_TYPE_COLORS: Record<PropertyType, string> = {
  office: "bg-violet-500/10 text-violet-400",
  industrial: "bg-orange-500/10 text-orange-400",
  retail: "bg-sky-500/10 text-sky-400",
  mixed_use: "bg-pink-500/10 text-pink-400",
  land: "bg-lime-500/10 text-lime-600",
  warehouse: "bg-amber-500/10 text-amber-500",
  flex: "bg-teal-500/10 text-teal-400",
};

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

// ─── Import From URL Dialog ─────────────────────────────────────────────────────
function ImportFromUrlDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: (id: number) => void }) {
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<"input" | "importing" | "done">("input");
  const [result, setResult] = useState<any>(null);

  const importMutation = trpc.scout.importFromUrl.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setStep("done");
    },
    onError: (e) => {
      toast.error(`Import failed: ${e.message}`);
      setStep("input");
    },
  });

  const handleImport = () => {
    if (!url.trim()) return toast.error("Please enter a listing URL");
    try { new URL(url); } catch { return toast.error("Please enter a valid URL (include https://)"); }
    setStep("importing");
    importMutation.mutate({ url: url.trim() });
  };

  const handleDone = () => {
    if (result?.id) onImported(result.id);
    onClose();
    setUrl("");
    setStep("input");
    setResult(null);
  };

  const ext = result?.extracted ?? {};
  const scoreColor = result?.score >= 0.8 ? "text-emerald-600" : result?.score >= 0.65 ? "text-amber-600" : "text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={() => { if (step !== "importing") { onClose(); setStep("input"); setUrl(""); setResult(null); } }}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            Import from Listing URL
          </DialogTitle>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Paste a LoopNet, BizBuySell, CoStar, Crexi, or any commercial listing URL.
              The AI will extract all available property data and auto-score the asset.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Listing URL</Label>
              <Input
                className="h-9 text-sm bg-muted/30 border-border font-mono"
                placeholder="https://www.loopnet.com/Listing/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleImport()}
                autoFocus
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["loopnet.com", "bizbuysell.com", "crexi.com", "costar.com"].map((site) => (
                <span key={site} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/40 text-muted-foreground border border-border">
                  {site}
                </span>
              ))}
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full border-2 border-primary/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Analyzing listing...</p>
              <p className="text-xs text-muted-foreground mt-1">Scraping page · Extracting fields · AI scoring</p>
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Fetching page data</span>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-4 py-2">
            {/* Success header */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Asset imported successfully</p>
                <p className="text-[10px] text-emerald-600/70 truncate">{result.message}</p>
              </div>
              <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </a>
            </div>

            {/* Extracted data preview */}
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">{ext.name ?? result.extracted?.name ?? "Property"}</p>
              {(ext.address || ext.city) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {[ext.address, ext.city, ext.state, ext.zip].filter(Boolean).join(", ")}
                </p>
              )}
              <div className="grid grid-cols-3 gap-2 mt-2">
                {ext.askingPrice && (
                  <div className="text-center p-2 rounded bg-card border border-border">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Asking</p>
                    <p className="text-xs font-bold text-foreground">
                      {ext.askingPrice >= 1_000_000 ? `$${(ext.askingPrice / 1_000_000).toFixed(2)}M` : `$${(ext.askingPrice / 1000).toFixed(0)}k`}
                    </p>
                  </div>
                )}
                {ext.capRate && (
                  <div className="text-center p-2 rounded bg-card border border-border">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Cap Rate</p>
                    <p className="text-xs font-bold text-foreground">{(ext.capRate * 100).toFixed(2)}%</p>
                  </div>
                )}
                {result.score != null && (
                  <div className="text-center p-2 rounded bg-card border border-border">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">AI Score</p>
                    <p className={cn("text-xs font-bold", scoreColor)}>{parseFloat(String(result.score)).toFixed(3)}</p>
                  </div>
                )}
              </div>
              {result.summary && (
                <p className="text-[10px] text-muted-foreground italic leading-relaxed mt-1">{result.summary}</p>
              )}
              {ext.highlights?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {ext.highlights.slice(0, 4).map((h: string, i: number) => (
                    <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-primary/10 text-primary border border-primary/20">{h}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "input" && (
            <>
              <Button variant="outline" size="sm" onClick={onClose} className="border-border">Cancel</Button>
              <Button size="sm" onClick={handleImport} disabled={!url.trim()}>
                <Sparkles className="w-3 h-3 mr-1.5" />
                Analyze & Import
              </Button>
            </>
          )}
          {step === "importing" && (
            <Button size="sm" disabled>
              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              Importing...
            </Button>
          )}
          {step === "done" && (
            <Button size="sm" onClick={handleDone}>
              <CheckCircle2 className="w-3 h-3 mr-1.5" />
              View in Scout
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Asset Dialog ─────────────────────────────────────────────────────────
function AddAssetDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [form, setForm] = useState({
    name: "", address: "", city: "Miami", state: "FL", zip: "",
    propertyType: "retail" as PropertyType,
    squareFootage: "", askingPrice: "", capRate: "", noi: "",
    leaseType: "" as "nnn" | "gross" | "modified_gross" | "vacant" | "",
    zoning: "", opportunityZone: false, tadDistrict: "", sourceUrl: "",
  });

  const create = trpc.scout.create.useMutation({
    onSuccess: (newAsset) => {
      toast.success("Asset added — AI scoring in progress...");
      onCreated(newAsset.id);
      onClose();
      setForm({ name: "", address: "", city: "Miami", state: "FL", zip: "", propertyType: "retail", squareFootage: "", askingPrice: "", capRate: "", noi: "", leaseType: "", zoning: "", opportunityZone: false, tadDistrict: "", sourceUrl: "" });
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const handleSubmit = () => {
    if (!form.name || !form.address) return toast.error("Name and address are required");
    create.mutate({
      name: form.name,
      address: form.address,
      city: form.city,
      state: form.state,
      zip: form.zip || undefined,
      propertyType: form.propertyType,
      squareFootage: form.squareFootage ? parseInt(form.squareFootage) : undefined,
      askingPrice: form.askingPrice ? parseFloat(form.askingPrice) : undefined,
      capRate: form.capRate ? parseFloat(form.capRate) / 100 : undefined,
      noi: form.noi ? parseFloat(form.noi) : undefined,
      leaseType: form.leaseType || undefined,
      zoning: form.zoning || undefined,
      opportunityZone: form.opportunityZone,
      tadDistrict: form.tadDistrict || undefined,
      sourceUrl: form.sourceUrl || undefined,
    });
  };

  const fields = [
    { key: "name", label: "Property Name *", placeholder: "e.g. Westside Retail Strip" },
    { key: "address", label: "Street Address *", placeholder: "e.g. 123 Brickell Ave" },
    { key: "city", label: "City", placeholder: "Miami" },
    { key: "state", label: "State", placeholder: "FL" },
    { key: "zip", label: "ZIP Code", placeholder: "30303" },
    { key: "squareFootage", label: "Square Footage", placeholder: "5000" },
    { key: "askingPrice", label: "Asking Price ($)", placeholder: "1200000" },
    { key: "capRate", label: "Cap Rate (%)", placeholder: "6.5" },
    { key: "noi", label: "NOI ($/yr)", placeholder: "78000" },
    { key: "zoning", label: "Zoning", placeholder: "C-1" },
    { key: "tadDistrict", label: "TAD District", placeholder: "Westside TAD" },
    { key: "sourceUrl", label: "Listing URL", placeholder: "https://loopnet.com/..." },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Add Commercial Asset
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          {fields.map((f) => (
            <div key={f.key} className={cn("space-y-1", f.key === "name" || f.key === "address" || f.key === "sourceUrl" ? "col-span-2" : "")}>
              <Label className="text-xs text-muted-foreground">{f.label}</Label>
              <Input
                className="h-8 text-sm bg-muted/30 border-border"
                placeholder={f.placeholder}
                value={(form as any)[f.key]}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
              />
            </div>
          ))}

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Property Type</Label>
            <Select value={form.propertyType} onValueChange={(v) => setForm((p) => ({ ...p, propertyType: v as PropertyType }))}>
              <SelectTrigger className="h-8 text-sm bg-muted/30 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROPERTY_TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Lease Type</Label>
            <Select value={form.leaseType} onValueChange={(v) => setForm((p) => ({ ...p, leaseType: v as any }))}>
              <SelectTrigger className="h-8 text-sm bg-muted/30 border-border">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nnn">NNN</SelectItem>
                <SelectItem value="gross">Gross</SelectItem>
                <SelectItem value="modified_gross">Modified Gross</SelectItem>
                <SelectItem value="vacant">Vacant</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border">
            <input
              type="checkbox"
              id="oz-check"
              checked={form.opportunityZone}
              onChange={(e) => setForm((p) => ({ ...p, opportunityZone: e.target.checked }))}
              className="w-4 h-4 accent-primary"
            />
            <Label htmlFor="oz-check" className="text-sm cursor-pointer">
              Located in an <span className="text-[var(--sage)] font-semibold">Opportunity Zone</span>
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="border-border">Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Plus className="w-3 h-3 mr-1.5" />}
            Add Asset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Asset Card ──────────────────────────────────────────────────────────────────────────────────
function AssetCard({ asset, onStatusChange, isAutoScoring = false }: { asset: any; onStatusChange: () => void; isAutoScoring?: boolean }) {
  const [, navigate] = useLocation();
  const scoreAsset = trpc.scout.scoreAsset.useMutation({
    onSuccess: (r) => {
      toast.success(`AI Score: ${r.score.toFixed(3)} — ${r.summary?.slice(0, 80)}...`);
      onStatusChange();
    },
    onError: (e) => toast.error(`Scoring failed: ${e.message}`),
  });

  const updateStatus = trpc.scout.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); onStatusChange(); },
    onError: (e) => toast.error(`Update failed: ${e.message}`),
  });

  const runPipeline = trpc.agents.runPipeline.useMutation({
    onSuccess: () => { /* pipeline running in background */ },
    onError: () => { /* non-blocking — deal still navigates */ },
  });

  const convertToDeal = trpc.scout.convertToDeal.useMutation({
    onSuccess: (r) => {
      toast.success(`Deal created — Third Signal analysis starting...`);
      if (r.dealId) {
        // Fire-and-forget: auto-trigger the full ADK pipeline so War Room opens with analysis in progress
        runPipeline.mutate({ dealId: r.dealId });
        navigate(`/deal/${r.dealId}`);
      }
    },
    onError: (e) => toast.error(`Conversion failed: ${e.message}`),
  });

  const pt = asset.propertyType as PropertyType;
  const st = asset.status as AssetStatus;

  return (
    <div className={cn("relative overflow-hidden rounded-xl border transition-all duration-200 group", isAutoScoring ? "border-primary/50 ring-1 ring-primary/20" : "border-[var(--sh-border)] hover:border-[var(--sh-primary)]/30")} style={{ background: "var(--sh-surface-1)" }}>
      {/* Auto-scoring shimmer overlay */}
      {isAutoScoring && (
        <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 rounded-lg">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <div className="w-3 h-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <span className="text-xs font-medium text-primary">AI Scoring...</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Third Signal analysis in progress</p>
        </div>
      )}
      <div className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {asset.name}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <div className="flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">{asset.city}, {asset.state}</span>
              </div>
              {asset.opportunityZone && (
                <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0 h-4 rounded-full bg-emerald-500/15 text-[var(--sage)] border border-emerald-500/20">OZ</span>
              )}
              {asset.tadDistrict && (
                <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0 h-4 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">TAD</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border", STATUS_COLORS[st])}>
              {st.replace(/_/g, " ")}
            </span>
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium", PROPERTY_TYPE_COLORS[pt] ?? "bg-muted text-muted-foreground")}>
              {PROPERTY_TYPE_LABELS[pt] ?? pt}
            </span>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 space-y-3">
        {/* Financials grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Asking", value: fmt(asset.askingPrice) },
            { label: "Cap Rate", value: asset.capRate ? `${(asset.capRate * 100).toFixed(1)}%` : "—" },
            { label: "NOI", value: fmt(asset.noi) },
          ].map((f) => (
            <div key={f.label} className="rounded-lg p-2" style={{ background: "var(--sh-surface-2)" }}>
              <p className="text-[10px] text-muted-foreground">{f.label}</p>
              <p className="text-xs font-semibold text-foreground mt-0.5">{f.value}</p>
            </div>
          ))}
        </div>

        {/* Size + zoning */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {asset.squareFootage && (
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />{asset.squareFootage.toLocaleString()} sqft
            </span>
          )}
          {asset.zoning && (
            <span className="flex items-center gap-1">
              <Filter className="w-3 h-3" />Zone {asset.zoning}
            </span>
          )}
          {asset.leaseType && (
            <span className="uppercase font-medium text-[10px] px-1.5 py-0.5 rounded bg-muted/50">{asset.leaseType}</span>
          )}
        </div>

        {/* AI Score display */}
        {asset.aiScore != null && (() => { const score = parseFloat(String(asset.aiScore)); return (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/15">
            <BarChart3 className="w-3 h-3 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs text-muted-foreground">AI Score: </span>
              <span className={cn("text-sm font-bold", score >= 0.75 ? "text-[var(--sage)]" : score >= 0.6 ? "text-[var(--amber)]" : "text-muted-foreground")}>
                {score.toFixed(3)}
              </span>
            </div>
            <CheckCircle2 className="w-3 h-3 text-[var(--sage)] shrink-0" />
          </div>
        ); })()}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-[11px] border-border"
            onClick={() => scoreAsset.mutate({ id: asset.id })}
            disabled={scoreAsset.isPending}
          >
            {scoreAsset.isPending ? <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" /> : <Zap className="w-2.5 h-2.5 mr-1" />}
            AI Score
          </Button>
          <Select
            value={asset.status}
            onValueChange={(v) => updateStatus.mutate({ id: asset.id, status: v as AssetStatus })}
          >
            <SelectTrigger className="flex-1 h-7 text-[11px] border-border bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="reviewing">Reviewing</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="acquired">Acquired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Convert to Deal — shown for qualified assets */}
        {(asset.status === "qualified" || (asset.aiScore != null && parseFloat(String(asset.aiScore)) >= 0.70)) && (
          <Button
            size="sm"
            className="w-full h-7 text-[11px] border-0 mt-1" style={{ background: "var(--sh-primary)", color: "var(--sh-primary-fg)" }}
            onClick={() => convertToDeal.mutate({ id: asset.id })}
            disabled={convertToDeal.isPending}
          >
            {convertToDeal.isPending
              ? <Loader2 className="w-2.5 h-2.5 mr-1.5 animate-spin" />
              : <TrendingUp className="w-2.5 h-2.5 mr-1.5" />}
            {convertToDeal.isPending ? "Converting..." : "Convert to Deal → War Room"}
          </Button>
        )}
       </div>
    </div>
  );
}
// ─── Main Scout Page ──────────────────────────────────────────────────────────
export default function Scout() {
  const [search, setSearch] = useState("");
  const [filterOZ, setFilterOZ] = useState(false);
  const [filterTAD, setFilterTAD] = useState(false);
  const [filterType, setFilterType] = useState<PropertyType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<AssetStatus | "all">("all");
  const [sortBy, setSortBy] = useState<"capRate" | "askingPrice" | "aiScore" | "createdAt">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [autoScoringId, setAutoScoringId] = useState<number | null>(null);

  const autoScore = trpc.scout.scoreAsset.useMutation({
    onSuccess: (r) => {
      toast.success(`Auto-scored: ${parseFloat(String(r.score)).toFixed(3)} — ${r.summary?.slice(0, 60)}...`);
      setAutoScoringId(null);
      refetch();
    },
    onError: () => { setAutoScoringId(null); refetch(); },
  });

  const { isAuthenticated } = useAuth();
  const { data: assets, isLoading, refetch } = trpc.scout.list.useQuery({ limit: 100 }, { enabled: isAuthenticated });

  const filtered = useMemo(() => {
    if (!assets) return [];
    let list = [...assets];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        (a.address ?? "").toLowerCase().includes(q)
      );
    }
    if (filterOZ) list = list.filter((a) => a.opportunityZone);
    if (filterTAD) list = list.filter((a) => !!a.tadDistrict);
    if (filterType !== "all") list = list.filter((a) => a.propertyType === filterType);
    if (filterStatus !== "all") list = list.filter((a) => a.status === filterStatus);

    list.sort((a, b) => {
      const av = (a as any)[sortBy] ?? -Infinity;
      const bv = (b as any)[sortBy] ?? -Infinity;
      return sortDir === "desc" ? bv - av : av - bv;
    });

    return list;
  }, [assets, search, filterOZ, filterTAD, filterType, filterStatus, sortBy, sortDir]);

  const stats = useMemo(() => {
    if (!assets) return null;
    const qualified = assets.filter((a) => a.status === "qualified").length;
    const ozCount = assets.filter((a) => a.opportunityZone).length;
    const totalValue = assets.reduce((s, a) => s + (a.askingPrice ?? 0), 0);
    const avgCap = assets.filter((a) => a.capRate).reduce((s, a, _, arr) => s + (a.capRate ?? 0) / arr.length, 0);
    return { total: assets.length, qualified, ozCount, totalValue, avgCap };
  }, [assets]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortBy(field); setSortDir("desc"); }
  };

  return (
    <EditorialTopNav>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Asset Scout
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Commercial real estate pipeline — OZ/TAD-aware, AI-scored
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 border-border" onClick={() => refetch()}>
            <RefreshCw className="w-3 h-3 mr-1.5" />Refresh
          </Button>
          <Button variant="outline" size="sm" className="h-8 border-border" onClick={() => setImportOpen(true)}>
            <Link2 className="w-3 h-3 mr-1.5" />Import URL
          </Button>
          <Button size="sm" className="h-8" onClick={() => setAddOpen(true)}>
            <Plus className="w-3 h-3 mr-1.5" />Add Asset
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Assets", value: stats.total.toString(), icon: Building2, color: "text-primary" },
            { label: "Qualified", value: stats.qualified.toString(), icon: CheckCircle2, color: "text-[var(--sage)]" },
            { label: "In OZ", value: stats.ozCount.toString(), icon: TrendingUp, color: "text-[var(--sage)]" },
            { label: "Pipeline Value", value: fmt(stats.totalValue), icon: DollarSign, color: "text-primary" },
          ].map((k) => (
            <Card key={k.label} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <k.icon className={cn("w-3.5 h-3.5", k.color)} />
                </div>
                <p className="text-xl font-bold text-foreground">{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm bg-muted/30 border-border"
                placeholder="Search by name, city, address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* OZ/TAD filter chips */}
            <button
              onClick={() => setFilterOZ((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                filterOZ
                  ? "bg-emerald-500/20 text-[var(--sage)] border-emerald-500/30"
                  : "bg-muted/30 text-muted-foreground border-border hover:border-emerald-500/30"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              OZ Only
            </button>
            <button
              onClick={() => setFilterTAD((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                filterTAD
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                  : "bg-muted/30 text-muted-foreground border-border hover:border-blue-500/30"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              TAD Only
            </button>

            {/* Property type */}
            <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
              <SelectTrigger className="h-8 w-[130px] text-xs bg-muted/30 border-border">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(PROPERTY_TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status */}
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
              <SelectTrigger className="h-8 w-[120px] text-xs bg-muted/30 border-border">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="reviewing">Reviewing</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="acquired">Acquired</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort */}
            <div className="flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
              {(["capRate", "askingPrice", "aiScore"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => toggleSort(f)}
                  className={cn(
                    "inline-flex items-center gap-0.5 px-2 py-1 rounded text-[11px] font-medium border transition-all",
                    sortBy === f
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-muted/20 text-muted-foreground border-border hover:border-primary/20"
                  )}
                >
                  {f === "capRate" ? "Cap Rate" : f === "askingPrice" ? "Price" : "AI Score"}
                  {sortBy === f && (sortDir === "desc" ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronUp className="w-2.5 h-2.5" />)}
                </button>
              ))}
            </div>

            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} assets</span>
          </div>
        </CardContent>
      </Card>

      {/* Asset Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardHeader className="pb-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2 mt-1" /></CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-3 gap-2">{Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-12 rounded-lg" />)}</div>
                <Skeleton className="h-7 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground/20 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">No assets found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {assets?.length === 0 ? "Add your first commercial asset to start scouting" : "Try adjusting your filters"}
            </p>
            {assets?.length === 0 && (
              <Button size="sm" className="mt-4 h-8" onClick={() => setAddOpen(true)}>
                <Plus className="w-3 h-3 mr-1.5" />Add First Asset
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((asset) => (
            <AssetCard key={asset.id} asset={asset} onStatusChange={() => refetch()} isAutoScoring={asset.id === autoScoringId} />
          ))}
        </div>
      )}

      <AddAssetDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(id) => {
          setAutoScoringId(id);
          refetch();
          // Auto-trigger AI scoring on the newly created asset
          autoScore.mutate({ id });
        }}
      />

      <ImportFromUrlDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(id) => {
          setAutoScoringId(id);
          refetch();
          toast.success("Asset imported and scored — check Scout for results");
        }}
      />
    </EditorialTopNav>
  );
}

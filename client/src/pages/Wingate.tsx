import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import EditorialTopNav from "@/components/EditorialTopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Landmark, MapPin, Plus, Play, Trash2, Zap, CheckCircle2, XCircle,
  AlertTriangle, ShieldCheck, Gauge, Building2, Star, Filter, Loader2, Search, FileText,
} from "lucide-react";

// ─── Types (mirror server/scoring/historicScore.ts) ──────────────────────────
type Factor = { label: string; points: number; max: number; note?: string; verify?: boolean };
type Dimension = { key: string; label: string; score: number; max: number; factors: Factor[] };
type HistoricScore = {
  dimA: number; dimB: number; dimC: number; dimD: number; dimE: number; dimF: number; dimG: number;
  compositeScore: number; penalties: number; bonuses: number; confidenceScore: number; rankScore: number;
  assetTier: "tier1" | "tier2" | "tier3" | "archive" | "fasttrack";
  marketTier: "A" | "B" | "C"; dispositionCode: string | null; verifyFields: string[]; hardStopFailed: string | null;
  scorecard: { dimensions: Dimension[]; penalties: Factor[]; bonuses: Factor[]; strengths: string[]; risks: string[]; marketNote: string; sourceNote: string };
};
type ScoredAsset = Record<string, any> & { historicScore: HistoricScore };

const TIER_META: Record<HistoricScore["assetTier"], { label: string; cls: string }> = {
  tier1:     { label: "Tier 1",     cls: "text-amber-400 border-amber-400/40 bg-amber-400/10" },
  fasttrack: { label: "Fast-Track", cls: "text-rose-400 border-rose-400/40 bg-rose-400/10" },
  tier2:     { label: "Tier 2",     cls: "text-violet-400 border-violet-400/40 bg-violet-400/10" },
  tier3:     { label: "Tier 3",     cls: "text-sky-400 border-sky-400/40 bg-sky-400/10" },
  archive:   { label: "Archive",    cls: "text-muted-foreground border-border bg-muted/20" },
};

const ASSET_STATUSES = ["new", "reviewing", "qualified", "rejected", "acquired"] as const;
type AssetStatus = typeof ASSET_STATUSES[number];

const fmtMoney = (n?: number | null) =>
  n == null ? "—" : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}k` : `$${n}`;

// ─── Ranked pipeline card ─────────────────────────────────────────────────────
function RankedCard({ rank, asset, onSelect }: { rank: number; asset: ScoredAsset; onSelect: (a: ScoredAsset) => void }) {
  const s = asset.historicScore;
  const tier = TIER_META[s.assetTier];
  const gatesPass = s.dimA >= 12 && s.dimB >= 12;
  const flags: string[] = [];
  if (asset.isHistoric) flags.push("NR Listed");
  else if (asset.historicRegisterEligible) flags.push("NR Eligible");
  if (asset.opportunityZone) flags.push("OZ");
  if (asset.isStabilized) flags.push("Stabilized");
  if (asset.hasAirRights) flags.push("Air Rights");

  return (
    <div
      onClick={() => onSelect(asset)}
      className="group relative flex flex-col gap-2.5 p-4 rounded-xl border border-border bg-card hover:border-amber-500/40 transition-all cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center shrink-0 w-9">
          <span className="text-[10px] text-muted-foreground font-mono">#{rank}</span>
          <span className="text-lg font-black text-amber-400 font-mono leading-none">{Math.round(s.rankScore)}</span>
          <span className="text-[8px] text-muted-foreground uppercase tracking-wide">rank</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate group-hover:text-amber-400">{asset.name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground">{asset.city}, {asset.state}</span>
            <span className={cn("text-[9px] font-bold px-1 rounded border ml-1",
              s.marketTier === "A" ? "text-emerald-400 border-emerald-400/30" :
              s.marketTier === "B" ? "text-sky-400 border-sky-400/30" : "text-muted-foreground border-border")}>
              MKT {s.marketTier}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", tier.cls)}>{tier.label}</span>
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="text-muted-foreground">C<span className="text-foreground font-bold">{s.compositeScore}</span></span>
            <span className={cn(s.confidenceScore >= 0.8 ? "text-emerald-400" : s.confidenceScore >= 0.5 ? "text-amber-400" : "text-rose-400")}>
              {Math.round(s.confidenceScore * 100)}%✓
            </span>
          </div>
        </div>
      </div>

      {/* Gate + flags + verify */}
      <div className="flex flex-wrap items-center gap-1">
        <span className={cn("inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border",
          s.dimA >= 12 ? "text-emerald-400 border-emerald-400/25 bg-emerald-400/5" : "text-rose-400 border-rose-400/25 bg-rose-400/5")}>
          A {s.dimA}{s.dimA >= 12 ? "✓" : "✗"}
        </span>
        <span className={cn("inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border",
          s.dimB >= 12 ? "text-emerald-400 border-emerald-400/25 bg-emerald-400/5" : "text-rose-400 border-rose-400/25 bg-rose-400/5")}>
          B {s.dimB}{s.dimB >= 12 ? "✓" : "✗"}
        </span>
        {flags.map((f) => (
          <span key={f} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400/90">{f}</span>
        ))}
        {s.verifyFields.length > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <AlertTriangle className="w-2.5 h-2.5" /> VERIFY {s.verifyFields.length}
          </span>
        )}
        {s.dispositionCode && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-400">{s.dispositionCode}</span>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-2 pt-1 border-t border-border/50 text-center">
        <div><p className="text-[8px] text-muted-foreground uppercase">Ask</p><p className="text-[11px] font-semibold">{fmtMoney(asset.askingPrice)}</p></div>
        <div><p className="text-[8px] text-muted-foreground uppercase">Cap</p><p className="text-[11px] font-semibold">{asset.capRate ? `${(asset.capRate * 100).toFixed(1)}%` : "—"}</p></div>
        <div><p className="text-[8px] text-muted-foreground uppercase">Built</p><p className="text-[11px] font-semibold">{asset.yearBuilt ?? "—"}</p></div>
        <div><p className="text-[8px] text-muted-foreground uppercase">Not gated</p><p className={cn("text-[11px] font-semibold", gatesPass ? "text-emerald-400" : "text-rose-400")}>{gatesPass ? "pass" : "fail"}</p></div>
      </div>

      <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-amber-400/70 group-hover:text-amber-400 transition-colors">
        <FileText className="w-3 h-3" /> Full A–G dossier →
      </div>
    </div>
  );
}

// ─── Full A–G scorecard drawer ────────────────────────────────────────────────
function ScorecardDrawer({ asset, onClose, onRescored }: { asset: ScoredAsset; onClose: () => void; onRescored: () => void }) {
  const s = asset.historicScore;
  const tier = TIER_META[s.assetTier];
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<AssetStatus>((asset.status as AssetStatus) ?? "new");
  const aiScore = trpc.scout.scoreAsset.useMutation({
    onSuccess: (r) => toast.success(`AI narrative: ${r.summary}`),
    onError: (e) => toast.error(e.message),
  });
  const convertToDeal = trpc.scout.convertToDeal.useMutation({
    onSuccess: (r) => {
      toast.success("Promoted to Deal Room");
      navigate(r.dealId ? `/deal/${r.dealId}` : "/memos");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateStatus = trpc.scout.updateStatus.useMutation({
    onSuccess: () => toast.success("Asset status updated"),
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 p-5 pb-3 bg-card border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold text-amber-400 tracking-widest uppercase">🏛 Wingate scorecard</span>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", tier.cls)}>{tier.label}</span>
              <span className="text-[10px] text-muted-foreground">Market {s.marketTier}</span>
            </div>
            <h2 className="text-lg font-bold text-foreground">{asset.name}</h2>
            <p className="text-sm text-muted-foreground">{asset.address}, {asset.city}, {asset.state}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Score headline */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Rank Score", value: Math.round(s.rankScore), sub: "composite × confidence", color: "text-amber-400" },
              { label: "Composite", value: s.compositeScore, sub: `+${s.bonuses} bonus · −${s.penalties} pen`, color: "text-foreground" },
              { label: "Confidence", value: `${Math.round(s.confidenceScore * 100)}%`, sub: `${5 - s.verifyFields.length}/5 verified`, color: s.confidenceScore >= 0.8 ? "text-emerald-400" : "text-amber-400" },
            ].map((m) => (
              <div key={m.label} className="p-3 rounded-lg bg-muted/20 border border-border text-center">
                <p className={cn("text-2xl font-black font-mono", m.color)}>{m.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{m.label}</p>
                <p className="text-[9px] text-muted-foreground/60">{m.sub}</p>
              </div>
            ))}
          </div>

          {s.hardStopFailed && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2">
              <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div><p className="text-xs font-semibold text-rose-400">Hard stop{s.dispositionCode ? ` · ${s.dispositionCode}` : ""}</p><p className="text-[11px] text-muted-foreground">{s.hardStopFailed}</p></div>
            </div>
          )}

          {/* A–G dimensions */}
          <div className="space-y-2">
            {s.scorecard.dimensions.map((d) => {
              const gated = d.key === "A" || d.key === "B";
              const gateOk = d.score >= 12;
              return (
                <details key={d.key} className="group rounded-lg border border-border bg-muted/10">
                  <summary className="flex items-center gap-2 p-2.5 cursor-pointer list-none">
                    <span className="text-[11px] font-bold text-amber-400 w-4">{d.key}</span>
                    <span className="text-xs font-medium text-foreground flex-1">{d.label}</span>
                    {gated && <span className={cn("text-[9px] font-bold px-1 rounded", gateOk ? "text-emerald-400" : "text-rose-400")}>{gateOk ? "gate ✓" : "gate ✗"}</span>}
                    <span className="text-xs font-mono font-bold text-foreground">{d.score}<span className="text-muted-foreground">/{d.max}</span></span>
                  </summary>
                  <div className="px-2.5 pb-2.5 space-y-1">
                    {d.factors.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", f.points > 0 ? "bg-emerald-400" : "bg-muted-foreground/30")} />
                        <span className="flex-1 text-muted-foreground">{f.label}{f.note ? ` — ${f.note}` : ""}</span>
                        {f.verify && <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />}
                        <span className="font-mono text-muted-foreground">{f.points}/{f.max}</span>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>

          {/* Penalties / bonuses */}
          {(s.scorecard.penalties.length > 0 || s.scorecard.bonuses.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/5">
                <p className="text-[10px] font-bold text-rose-400 uppercase mb-1">Penalties</p>
                {s.scorecard.penalties.length ? s.scorecard.penalties.map((p, i) => (
                  <p key={i} className="text-[10px] text-muted-foreground">−{p.points} {p.label}</p>
                )) : <p className="text-[10px] text-muted-foreground/50">none</p>}
              </div>
              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Alpha bonuses</p>
                {s.scorecard.bonuses.length ? s.scorecard.bonuses.map((b, i) => (
                  <p key={i} className="text-[10px] text-muted-foreground">+{b.points} {b.label}</p>
                )) : <p className="text-[10px] text-muted-foreground/50">none</p>}
              </div>
            </div>
          )}

          {/* Verify list */}
          {s.verifyFields.length > 0 && (
            <div className="p-3 rounded-lg border border-amber-500/25 bg-amber-500/5">
              <p className="text-[10px] font-bold text-amber-400 uppercase mb-1">Unverified critical fields ({s.verifyFields.length}/5) — capped below Tier 1</p>
              {s.verifyFields.map((v) => <p key={v} className="text-[11px] text-muted-foreground">• {v}</p>)}
            </div>
          )}

          {/* Strengths / risks */}
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Strengths</p>{s.scorecard.strengths.length ? s.scorecard.strengths.map((x, i) => <p key={i} className="text-[11px] text-muted-foreground">✓ {x}</p>) : <p className="text-[10px] text-muted-foreground/50">—</p>}</div>
            <div><p className="text-[10px] font-bold text-rose-400 uppercase mb-1">Risks</p>{s.scorecard.risks.length ? s.scorecard.risks.map((x, i) => <p key={i} className="text-[11px] text-muted-foreground">! {x}</p>) : <p className="text-[10px] text-muted-foreground/50">—</p>}</div>
          </div>

          <p className="text-[10px] text-muted-foreground/60 italic">{s.scorecard.marketNote} · {s.scorecard.sourceNote}</p>

          <div className="space-y-2 pt-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Next actions</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="flex-1 min-w-[145px] border-amber-500/30 text-amber-400" onClick={() => aiScore.mutate({ id: asset.id })} disabled={aiScore.isPending}>
                <Zap className="w-3.5 h-3.5 mr-1.5" />{aiScore.isPending ? "Generating…" : "AI narrative"}
              </Button>
              <Button size="sm" variant="outline" className="flex-1 min-w-[165px] border-amber-500/30 text-amber-400" onClick={() => convertToDeal.mutate({ id: asset.id })} disabled={convertToDeal.isPending}>
                {convertToDeal.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Landmark className="w-3.5 h-3.5 mr-1.5" />}
                {convertToDeal.isPending ? "Promoting…" : "Promote to Deal Room"}
              </Button>
              <Select
                value={status}
                onValueChange={(nextStatus) => { const next = nextStatus as AssetStatus; setStatus(next); updateStatus.mutate({ id: asset.id, status: next }); }}
                disabled={updateStatus.isPending}
              >
                <SelectTrigger className="h-9 min-w-[130px] flex-1 text-xs border-amber-500/30 bg-transparent text-amber-400">
                  <SelectValue placeholder="Set status" />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" className="flex-1 min-w-[70px] bg-amber-500 hover:bg-amber-600 text-black font-semibold" onClick={() => { onRescored(); onClose(); }}>
                Done
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Quick-add intake (scores on create) ──────────────────────────────────────
function QuickAdd({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", address: "", city: "", state: "OH", askingPrice: "", capRate: "", squareFootage: "", yearBuilt: "", stories: "", occupancyRate: "", lotSqFt: "", higherAndBetterUseNotes: "", isHistoric: false, historicRegisterEligible: false, isStabilized: true, hasAirRights: false });
  const score = trpc.scout.scoreHistoric.useMutation();
  const create = trpc.scout.create.useMutation({
    onSuccess: async (r) => { try { await score.mutateAsync({ id: r.id }); } catch { /* non-fatal */ } toast.success("Asset added + scored"); onCreated(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const STATES = ["OH", "IN", "KY", "TN", "GA", "SC", "NC", "AL", "MO", "IL", "KS"];
  const submit = () => {
    if (!form.name || !form.address || !form.city) return toast.error("Name, address, city required");
    create.mutate({
      name: form.name, address: form.address, city: form.city, state: form.state, propertyType: "mixed_use",
      askingPrice: form.askingPrice ? parseFloat(form.askingPrice) : undefined,
      capRate: form.capRate ? parseFloat(form.capRate) / 100 : undefined,
      squareFootage: form.squareFootage ? parseInt(form.squareFootage) : undefined,
      yearBuilt: form.yearBuilt ? parseInt(form.yearBuilt) : undefined,
      stories: form.stories ? parseInt(form.stories) : undefined,
      occupancyRate: form.occupancyRate ? parseFloat(form.occupancyRate) / 100 : undefined,
      lotSqFt: form.lotSqFt ? parseInt(form.lotSqFt) : undefined,
      higherAndBetterUseNotes: form.higherAndBetterUseNotes || undefined,
      isHistoric: form.isHistoric, historicRegisterEligible: form.historicRegisterEligible, isStabilized: form.isStabilized, hasAirRights: form.hasAirRights,
    });
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader><DialogTitle className="flex items-center gap-2">🏛 Add Historic Asset</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto py-2">
          <Field className="col-span-2" label="Property Name *" v={form.name} on={(v) => setForm(p => ({ ...p, name: v }))} ph="1908 Masonic Temple" />
          <Field className="col-span-2" label="Address *" v={form.address} on={(v) => setForm(p => ({ ...p, address: v }))} ph="123 Main St" />
          <Field label="City *" v={form.city} on={(v) => setForm(p => ({ ...p, city: v }))} ph="Columbus" />
          <div className="space-y-1"><Label className="text-xs">State</Label>
            <Select value={form.state} onValueChange={(v) => setForm(p => ({ ...p, state: v }))}>
              <SelectTrigger className="h-8 text-sm bg-muted/30 border-border"><SelectValue /></SelectTrigger>
              <SelectContent>{STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Field label="Asking Price ($)" v={form.askingPrice} on={(v) => setForm(p => ({ ...p, askingPrice: v }))} ph="630000" />
          <Field label="Cap Rate (%)" v={form.capRate} on={(v) => setForm(p => ({ ...p, capRate: v }))} ph="6.5" />
          <Field label="Sq Ft" v={form.squareFootage} on={(v) => setForm(p => ({ ...p, squareFootage: v }))} ph="18000" />
          <Field label="Lot Sq Ft" v={form.lotSqFt} on={(v) => setForm(p => ({ ...p, lotSqFt: v }))} ph="30000" />
          <Field label="Year Built" v={form.yearBuilt} on={(v) => setForm(p => ({ ...p, yearBuilt: v }))} ph="1908" />
          <Field label="Stories" v={form.stories} on={(v) => setForm(p => ({ ...p, stories: v }))} ph="3" />
          <Field label="Occupancy (%)" v={form.occupancyRate} on={(v) => setForm(p => ({ ...p, occupancyRate: v }))} ph="0 (vacant)" />
          <Field className="col-span-2" label="H&BU Notes" v={form.higherAndBetterUseNotes} on={(v) => setForm(p => ({ ...p, higherAndBetterUseNotes: v }))} ph="Air rights, corner lot, OZ tract…" />
          <div className="col-span-2 flex flex-wrap gap-4 pt-1">
            {([["isHistoric", "NR Listed"], ["historicRegisterEligible", "NR Eligible"], ["isStabilized", "Stabilized"], ["hasAirRights", "Air Rights"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={(form as any)[k]} onChange={(e) => setForm(p => ({ ...p, [k]: e.target.checked }))} className="w-4 h-4 accent-amber-500" />{l}
              </label>
            ))}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="border-border">Cancel</Button>
          <Button size="sm" onClick={submit} disabled={create.isPending || score.isPending} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
            {create.isPending || score.isPending ? "Adding…" : "Add + Score"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function Field({ label, v, on, ph, className }: { label: string; v: string; on: (v: string) => void; ph?: string; className?: string }) {
  return <div className={cn("space-y-1", className)}><Label className="text-xs">{label}</Label><Input className="h-8 text-sm bg-muted/30 border-border" placeholder={ph} value={v} onChange={(e) => on(e.target.value)} /></div>;
}

// ─── Main command page ────────────────────────────────────────────────────────
export default function Wingate() {
  const urlThesis = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("thesis") : null;
  const [compilationId, setCompilationId] = useState<number | null>(urlThesis ? Number(urlThesis) : null);
  const [selected, setSelected] = useState<ScoredAsset | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [filterState, setFilterState] = useState("all");
  const [filterTier, setFilterTier] = useState<"all" | "tier1" | "tier2" | "tier3">("all");
  const [searchText, setSearchText] = useState("");

  const theses = trpc.thesis.list.useQuery();
  const search = trpc.scout.search.useQuery(
    { compilationId: compilationId ?? undefined },
    { refetchOnWindowFocus: false },
  );
  const utils = trpc.useUtils();
  const rescoreSave = trpc.scout.scoreHistoric.useMutation({
    onSuccess: (r) => { toast.success(`Scored + saved ${r.scored} assets`); search.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const bulkArchive = trpc.scout.bulkArchive.useMutation({
    onSuccess: (r) => { toast.success(`Archived ${r.archived} assets`); setClearOpen(false); search.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const bulkDelete = trpc.scout.bulkDelete.useMutation({
    onSuccess: (r) => { toast.success(`Deleted ${r.deleted} assets`); setClearOpen(false); search.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const results: ScoredAsset[] = (search.data?.results ?? []) as any;
  const states = useMemo(() => Array.from(new Set(results.map(a => a.state))).sort(), [results]);
  const filtered = useMemo(() => results.filter(a => {
    if (filterState !== "all" && a.state !== filterState) return false;
    if (filterTier !== "all" && a.historicScore.assetTier !== filterTier && !(filterTier === "tier1" && a.historicScore.assetTier === "fasttrack")) return false;
    if (searchText.trim() && !`${a.name} ${a.city} ${a.state} ${a.address ?? ""}`.toLowerCase().includes(searchText.trim().toLowerCase())) return false;
    return true;
  }), [results, filterState, filterTier, searchText]);

  const stats = useMemo(() => {
    const tier1 = results.filter(a => a.historicScore.assetTier === "tier1" || a.historicScore.assetTier === "fasttrack").length;
    const conf = results.length ? results.reduce((s, a) => s + a.historicScore.confidenceScore, 0) / results.length : 0;
    const value = results.reduce((s, a) => s + (a.askingPrice ?? 0), 0);
    const needVerify = results.filter(a => a.historicScore.verifyFields.length > 0).length;
    return { total: results.length, tier1, conf, value, needVerify };
  }, [results]);

  const activeThesis = theses.data?.find((t: any) => t.id === compilationId);
  const escalations = results.filter(a => a.historicScore.assetTier === "fasttrack");

  return (
    <EditorialTopNav>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Landmark className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-bold text-amber-400 tracking-widest uppercase">Wingate · Historic Adaptive Reuse</span>
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Thesis Command</h1>
          <p className="text-xs text-muted-foreground mt-1">Select a thesis → run → ranked assets by the A–G protocol (gates · confidence · rank score).</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={compilationId ? String(compilationId) : "none"} onValueChange={(v) => setCompilationId(v === "none" ? null : Number(v))}>
            <SelectTrigger className="h-9 w-56 text-xs bg-muted/30 border-border"><SelectValue placeholder="All assets (no thesis)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">All assets (no thesis filter)</SelectItem>
              {(theses.data ?? []).map((t: any) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name || `${t.templateUsed ?? "thesis"} #${t.id}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-9 bg-amber-500 hover:bg-amber-600 text-black font-semibold" onClick={() => rescoreSave.mutate({ all: true, compilationId: compilationId ?? undefined })} disabled={rescoreSave.isPending}>
            {rescoreSave.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />}Run &amp; Save
          </Button>
          {search.isError ? (
            <span className="text-xs text-rose-400 max-w-[220px] truncate" title={search.error.message}>{search.error.message}</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
              {search.isFetching || rescoreSave.isPending ? <><Loader2 className="w-3 h-3 animate-spin" />Ranking…</> : <>{search.data?.count ?? 0} assets ranked{activeThesis ? ` · ${activeThesis.name || activeThesis.templateUsed}` : ""}</>}
            </span>
          )}
          <Button size="sm" variant="outline" className="h-9 border-border" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-1.5" />Add</Button>
          <Button size="sm" variant="outline" className="h-9 border-rose-500/30 text-rose-400 hover:bg-rose-500/10" onClick={() => setClearOpen(true)}><Trash2 className="w-4 h-4 mr-1.5" />Clear</Button>
        </div>
      </div>

      {activeThesis && (
        <div className="mb-4 px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/5 text-[11px] text-muted-foreground">
          Filtering by thesis <span className="text-amber-400 font-semibold">{activeThesis.name || activeThesis.templateUsed}</span> — {search.data?.count ?? 0} matching assets scored.
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {[
          { label: "Assets", value: stats.total, icon: Building2, color: "text-foreground" },
          { label: "Tier 1 / Fast-Track", value: stats.tier1, icon: Star, color: "text-amber-400" },
          { label: "Avg Confidence", value: `${Math.round(stats.conf * 100)}%`, icon: ShieldCheck, color: stats.conf >= 0.75 ? "text-emerald-400" : "text-amber-400" },
          { label: "Need Verify", value: stats.needVerify, icon: AlertTriangle, color: "text-amber-400" },
          { label: "Pipeline Value", value: fmtMoney(stats.value), icon: Gauge, color: "text-violet-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="p-3 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-1.5 mb-1"><Icon className={cn("w-3.5 h-3.5", color)} /><p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p></div>
            <p className={cn("text-xl font-black font-mono", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Escalations */}
      {escalations.length > 0 && (
        <div className="mb-4 p-3 rounded-xl border border-rose-500/25 bg-rose-500/5">
          <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wide mb-2">⏱ Fast-Track escalations — 24h SLA</p>
          <div className="flex flex-wrap gap-2">
            {escalations.map(a => (
              <button key={a.id} onClick={() => setSelected(a)} className="text-[11px] px-2 py-1 rounded-lg border border-rose-500/30 bg-card hover:border-rose-400 text-foreground">
                {a.name} <span className="text-muted-foreground">· rank {Math.round(a.historicScore.rankScore)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search assets by name, city, state, or address…"
          className="pl-9 h-9 bg-muted/20 border-border text-sm"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        {(["all", "tier1", "tier2", "tier3"] as const).map(t => (
          <button key={t} onClick={() => setFilterTier(t)} className={cn("px-3 py-1 rounded-full text-[11px] font-semibold border capitalize",
            filterTier === t ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-muted/20 text-muted-foreground border-border")}>
            {t === "all" ? `All (${filtered.length})` : t === "tier1" ? "Tier 1" : t === "tier2" ? "Tier 2" : "Tier 3"}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-1" />
        <button onClick={() => setFilterState("all")} className={cn("px-2 py-1 rounded-full text-[10px] font-bold border", filterState === "all" ? "bg-muted/40 text-foreground border-border" : "bg-muted/20 text-muted-foreground border-border")}>All states</button>
        {states.map(s => (
          <button key={s} onClick={() => setFilterState(filterState === s ? "all" : s)} className={cn("px-2 py-1 rounded-full text-[10px] font-bold border", filterState === s ? "bg-amber-500/20 text-amber-400 border-amber-500/40" : "bg-muted/20 text-muted-foreground border-border")}>{s}</button>
        ))}
      </div>

      {/* Ranked grid */}
      {search.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-40 rounded-xl bg-muted/20 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Landmark className="w-10 h-10 text-amber-400/30 mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">No historic assets in the pipeline yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">Add a pre-1945 building, or import one in Scout. It scores against the A–G protocol on entry.</p>
          <Button size="sm" className="mt-4 bg-amber-500 hover:bg-amber-600 text-black font-semibold" onClick={() => setAddOpen(true)}><Plus className="w-3.5 h-3.5 mr-1.5" />Add First Asset</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((a, i) => <RankedCard key={a.id} rank={i + 1} asset={a} onSelect={setSelected} />)}
        </div>
      )}

      {/* Modals */}
      {selected && <ScorecardDrawer asset={selected} onClose={() => setSelected(null)} onRescored={() => search.refetch()} />}
      <QuickAdd open={addOpen} onClose={() => setAddOpen(false)} onCreated={() => search.refetch()} />
      <Dialog open={clearOpen} onOpenChange={(v) => !v && setClearOpen(false)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="text-rose-400">Clear the asset pipeline?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{results.length} assets currently loaded. Archive keeps them (reversible); Delete is permanent.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="border-border" onClick={() => setClearOpen(false)}>Cancel</Button>
            <Button variant="outline" size="sm" className="border-amber-500/40 text-amber-400" disabled={bulkArchive.isPending} onClick={() => bulkArchive.mutate({ all: true })}>Archive all</Button>
            <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white" disabled={bulkDelete.isPending} onClick={() => bulkDelete.mutate({ all: true, confirm: true })}>Delete all</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EditorialTopNav>
  );
}

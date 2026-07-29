import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { getAssetClass, listAssetClasses, classSupportsModule } from "@shared/assetClasses";
import { isTutorialAsset } from "@shared/tutorial";
import { formatAskingPrice } from "@shared/pricing";
import { GraduationCap } from "lucide-react";
import type { AssetClass, FieldDef } from "@shared/assetClasses";
import EditorialTopNav from "@/components/EditorialTopNav";
import InvestorLayout from "@/components/InvestorLayout";
import { useAuth } from "@/_core/hooks/useAuth";
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
  ScoreHeadline, HardStopBanner, EconomicsPanel, SectionLabel, TIER_META,
  type ScoredAsset, type HistoricScore,
} from "@/components/AssetDossierSections";
import {
  Landmark, Boxes, MapPin, Plus, Play, Trash2, Zap, CheckCircle2, XCircle,
  AlertTriangle, ShieldCheck, Gauge, Building2, Star, Filter, Loader2, Search, FileText, ExternalLink,
} from "lucide-react";

const ASSET_CLASS_ICONS: Record<string, typeof Landmark> = { Landmark, Boxes };
type IntakeValue = string | boolean;
type ParsedIntakeValue = string | number | boolean | undefined;

function initialIntakeForm(assetClass: AssetClass): Record<string, IntakeValue> {
  const values: Record<string, IntakeValue> = { name: "", address: "", city: "", state: "OH" };
  assetClass.fields.forEach((field) => {
    values[field.key] = field.type === "boolean" ? field.key === "isStabilized" : "";
  });
  return values;
}

function parseIntakeValue(field: FieldDef, value: IntakeValue): ParsedIntakeValue {
  if (field.type === "boolean") return value === true;
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (field.type === "number" || field.type === "currency") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (field.type === "year") {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (field.type === "percent") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed / 100 : undefined;
  }
  return value;
}

function asOptionalNumber(value: ParsedIntakeValue): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function asOptionalString(value: ParsedIntakeValue): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asBoolean(value: ParsedIntakeValue): boolean {
  return value === true;
}

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
          {isTutorialAsset(asset as any) ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber/50 bg-amber/10 text-amber inline-flex items-center gap-1">
              <GraduationCap className="w-2.5 h-2.5" /> Tutorial
            </span>
          ) : (
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", tier.cls)}>{tier.label}</span>
          )}
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
        <div><p className="text-[8px] text-muted-foreground uppercase">Ask</p><p className="text-[11px] font-semibold">{formatAskingPrice(asset.askingPrice).display}</p></div>
        <div><p className="text-[8px] text-muted-foreground uppercase">Cap</p><p className="text-[11px] font-semibold">{asset.capRate ? `${(asset.capRate * 100).toFixed(1)}%` : "—"}</p></div>
        <div><p className="text-[8px] text-muted-foreground uppercase">Built</p><p className="text-[11px] font-semibold">{asset.yearBuilt ?? "—"}</p></div>
        <div><p className="text-[8px] text-muted-foreground uppercase">Not gated</p><p className={cn("text-[11px] font-semibold", gatesPass ? "text-emerald-400" : "text-rose-400")}>{gatesPass ? "pass" : "fail"}</p></div>
      </div>

      {/* Economics teaser — the money math, visible before opening the dossier */}
      {asset.economics?.headline?.incentiveEquity != null && (
        <div className="flex items-center gap-3 pt-1 border-t border-border/50 text-[10px]">
          <span className="text-muted-foreground">Incentives <span className="font-mono font-bold text-emerald-400">{fmtMoney(asset.economics.headline.incentiveEquity)}</span></span>
          {(() => {
            const cov = asset.economics.metrics?.find((m: any) => m.key === "incentiveCoverage");
            return cov?.value != null ? (
              <span className="text-muted-foreground">Coverage <span className={cn("font-mono font-bold", cov.value >= 0.4 ? "text-emerald-400" : "text-amber-400")}>{Math.round(cov.value * 100)}%</span></span>
            ) : null;
          })()}
          {(() => {
            const u = asset.economics.metrics?.find((m: any) => m.key === "unitYield");
            return u?.value != null ? <span className="text-muted-foreground">~{u.value} units</span> : null;
          })()}
        </div>
      )}

      <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-amber-400/70 group-hover:text-amber-400 transition-colors">
        <FileText className="w-3 h-3" /> Full A–G dossier + economics →
      </div>
    </div>
  );
}

// ─── Full A–G scorecard drawer ────────────────────────────────────────────────
/**
 * Quick-scan preview. Deliberately shallow: the numbers that decide whether to
 * keep reading, then a door to the full-page dossier (/wingate/asset/:id) which
 * carries the same weight as the business Deal Room. Everything rendered here
 * uses the shared dossier sections, so preview and page never drift.
 */
function ScorecardDrawer({ asset, onClose, onRescored }: { asset: ScoredAsset; onClose: () => void; onRescored: () => void }) {
  const s = asset.historicScore;
  const cls = getAssetClass(asset.assetClass);
  const has = (m: Parameters<typeof classSupportsModule>[1]) => classSupportsModule(cls, m);
  const tier = TIER_META[s.assetTier];
  const [, navigate] = useLocation();
  const dossierHref = `/wingate/asset/${asset.id}`;
  const createShare = trpc.assetShare.createToken.useMutation({
    onSuccess: (r) => {
      navigator.clipboard?.writeText(`${window.location.origin}/asset-share/${r.token}`);
      toast.success("Share link copied — expires in 30 days");
    },
    onError: (e) => toast.error(e.message),
  });

  const gates = [
    { key: "A", label: "Historic qualification", score: s.dimA },
    { key: "B", label: "Development envelope", score: s.dimB },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-xl max-h-[88vh] overflow-y-auto bg-paper border border-rule shadow-2xl" onClick={(e) => e.stopPropagation()}>

        <div className="sticky top-0 z-10 bg-paper border-b border-rule px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Quick scan</span>
                {isTutorialAsset(asset as any) ? (
                  <span className="font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border border-amber/50 bg-amber/10 text-amber uppercase tracking-widest inline-flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" /> Tutorial
                  </span>
                ) : (
                  <span className={cn("font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border uppercase tracking-widest", tier.cls)}>{tier.label}</span>
                )}
                <span className="font-eyebrow text-eyebrow text-muted-foreground">Market {s.marketTier}</span>
              </div>
              <h2 className="font-card-title text-[26px] text-ink leading-tight">{asset.name}</h2>
              <p className="font-body-base text-[13px] text-muted-foreground mt-1">
                {String(asset.address).trim() === String(asset.name).trim()
                  ? `${asset.city}, ${asset.state}`
                  : `${asset.address}, ${asset.city}, ${asset.state}`}
              </p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-ink text-xl leading-none shrink-0">✕</button>
          </div>
        </div>

        <div className="px-6 py-6 space-y-6">
          {isTutorialAsset(asset as any) && (
            <p className="font-body-base text-[12px] text-muted-foreground leading-relaxed border-l-2 border-amber/50 pl-3">
              A worked example, not a real listing — open the full dossier for the guided tour of how
              scoring, gates, and economics work.
            </p>
          )}

          <ScoreHeadline s={s} dense />

          <HardStopBanner s={s} />

          {/* Tier-1 gates — the pass/fail that matters most at a glance */}
          <div>
            <SectionLabel className="mb-3">Tier-1 gates</SectionLabel>
            <div className="divide-y divide-rule border-t border-b border-rule">
              {gates.map((g) => (
                <div key={g.key} className="py-2.5 flex items-baseline gap-3">
                  <span className="font-eyebrow text-eyebrow text-amber w-4">{g.key}</span>
                  <span className="flex-1 font-body-base text-[13px] text-ink">{g.label}</span>
                  <span className={cn("font-eyebrow text-eyebrow uppercase tracking-widest", g.score >= 12 ? "text-sage" : "text-clay")}>
                    {g.score >= 12 ? "pass" : "fail"}
                  </span>
                  <span className="font-data-mono text-[12px] text-muted-foreground w-10 text-right">{g.score}/20</span>
                </div>
              ))}
            </div>
          </div>

          {has("economics") && asset.economics && <EconomicsPanel economics={asset.economics} dense />}

          {s.scorecard.risks.length > 0 && (
            <div>
              <SectionLabel className="mb-2">Top risks</SectionLabel>
              {s.scorecard.risks.slice(0, 3).map((r, i) => (
                <p key={i} className="font-body-base text-[13px] text-ink/80 leading-relaxed mb-1">
                  <span className="text-clay">!</span> {r}
                </p>
              ))}
            </div>
          )}

          {s.verifyFields.length > 0 && (
            <p className="font-body-base text-[12px] text-muted-foreground">
              {s.verifyFields.length} of 5 critical fields unverified — {s.verifyFields.join(", ")}.
            </p>
          )}
        </div>

        <div className="sticky bottom-0 bg-paper border-t border-rule px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => { onRescored(); navigate(dossierHref); }}
            className="flex-1 flex items-center justify-center gap-2 bg-ink text-bone font-eyebrow text-eyebrow px-4 py-2.5 rounded-full hover:opacity-90 transition-all uppercase tracking-widest">
            <FileText className="w-3 h-3" />
            Open full dossier
          </button>
          <button
            onClick={() => createShare.mutate({ assetId: asset.id })}
            disabled={createShare.isPending}
            className="flex items-center gap-2 border border-rule font-eyebrow text-eyebrow px-4 py-2.5 rounded-full hover:border-amber/40 hover:text-amber transition-all uppercase tracking-widest">
            {createShare.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
            Share
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick-add intake (scores on create) ──────────────────────────────────────
function QuickAdd({ open, onClose, onCreated, assetClass }: { open: boolean; onClose: () => void; onCreated: () => void; assetClass: string }) {
  const selectedClass = getAssetClass(assetClass);
  const [form, setForm] = useState<Record<string, IntakeValue>>(() => initialIntakeForm(selectedClass));
  const score = trpc.scout.scoreHistoric.useMutation();
  const create = trpc.scout.create.useMutation({
    onSuccess: async (r) => { try { await score.mutateAsync({ id: r.id }); } catch { /* non-fatal */ } toast.success("Asset added + scored"); onCreated(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  useEffect(() => {
    setForm(initialIntakeForm(selectedClass));
  }, [selectedClass]);
  const STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];
  const groups = useMemo(() => {
    const grouped = new Map<string, FieldDef[]>();
    selectedClass.fields.forEach((field) => {
      const group = field.group ?? "Details";
      grouped.set(group, [...(grouped.get(group) ?? []), field]);
    });
    return Array.from(grouped, ([label, fields]) => ({ label, fields }));
  }, [selectedClass]);
  const valueFor = (key: string): IntakeValue => form[key] ?? "";
  const textValueFor = (key: string): string => {
    const value = valueFor(key);
    return typeof value === "string" ? value : "";
  };
  const submit = () => {
    const name = valueFor("name");
    const address = valueFor("address");
    const city = valueFor("city");
    const state = valueFor("state");
    if (typeof name !== "string" || !name || typeof address !== "string" || !address || typeof city !== "string" || !city) {
      return toast.error("Name, address, city required");
    }

    const parsedFields: Record<string, ParsedIntakeValue> = {};
    selectedClass.fields.forEach((field) => {
      parsedFields[field.key] = parseIntakeValue(field, valueFor(field.key));
    });

    const baseInput = {
      name,
      address,
      city,
      state: typeof state === "string" ? state : "",
      propertyType: "mixed_use" as const,
      assetClass: selectedClass.id,
    };

    if (selectedClass.id === "historic") {
      create.mutate({
        ...baseInput,
        askingPrice: asOptionalNumber(parsedFields.askingPrice),
        capRate: asOptionalNumber(parsedFields.capRate),
        squareFootage: asOptionalNumber(parsedFields.squareFootage),
        yearBuilt: asOptionalNumber(parsedFields.yearBuilt),
        stories: asOptionalNumber(parsedFields.stories),
        occupancyRate: asOptionalNumber(parsedFields.occupancyRate),
        lotSqFt: asOptionalNumber(parsedFields.lotSqFt),
        higherAndBetterUseNotes: asOptionalString(parsedFields.higherAndBetterUseNotes),
        isHistoric: asBoolean(parsedFields.isHistoric),
        historicRegisterEligible: asBoolean(parsedFields.historicRegisterEligible),
        isStabilized: asBoolean(parsedFields.isStabilized),
        hasAirRights: asBoolean(parsedFields.hasAirRights),
      });
    } else {
      create.mutate({ ...baseInput, classMetadata: parsedFields });
    }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader><DialogTitle className="flex items-center gap-2">Add {selectedClass.label}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto py-2">
          <Field className="col-span-2" label="Property Name *" v={textValueFor("name")} on={(v) => setForm(p => ({ ...p, name: v }))} ph="Property name" />
          <Field className="col-span-2" label="Address *" v={textValueFor("address")} on={(v) => setForm(p => ({ ...p, address: v }))} ph="123 Main St" />
          <Field label="City *" v={textValueFor("city")} on={(v) => setForm(p => ({ ...p, city: v }))} ph="City" />
          <div className="space-y-1"><Label className="text-xs">State</Label>
            <Select value={textValueFor("state") || "OH"} onValueChange={(v) => setForm(p => ({ ...p, state: v }))}>
              <SelectTrigger className="h-8 text-sm bg-muted/30 border-border"><SelectValue /></SelectTrigger>
              <SelectContent>{STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {groups.map(({ label, fields }) => (
            <div key={label} className="col-span-2 space-y-2 pt-2 first:pt-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
              <div className="grid grid-cols-2 gap-3">
                {fields.map((field) => (
                  <IntakeField key={field.key} field={field} value={valueFor(field.key)} onChange={(value) => setForm(p => ({ ...p, [field.key]: value }))} />
                ))}
              </div>
            </div>
          ))}
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
function IntakeField({ field, value, onChange }: { field: FieldDef; value: IntakeValue; onChange: (value: IntakeValue) => void }) {
  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-xs cursor-pointer self-end min-h-8">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-amber-500" />
        {field.label}
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-1">
        <Label className="text-xs">{field.label}</Label>
        <Select value={typeof value === "string" ? value : ""} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-sm bg-muted/30 border-border"><SelectValue placeholder={field.placeholder ?? `Select ${field.label.toLowerCase()}`} /></SelectTrigger>
          <SelectContent>{(field.options ?? []).map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs">{field.label}</Label>
      <Input
        className="h-8 text-sm bg-muted/30 border-border"
        type={field.type === "number" || field.type === "currency" || field.type === "percent" || field.type === "year" ? "number" : "text"}
        step={field.type === "percent" || field.type === "currency" || field.type === "number" ? "any" : undefined}
        placeholder={field.placeholder}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
function Field({ label, v, on, ph, className }: { label: string; v: string; on: (v: string) => void; ph?: string; className?: string }) {
  return <div className={cn("space-y-1", className)}><Label className="text-xs">{label}</Label><Input className="h-8 text-sm bg-muted/30 border-border" placeholder={ph} value={v} onChange={(e) => on(e.target.value)} /></div>;
}

// ─── Main command page ────────────────────────────────────────────────────────
export default function Wingate() {
  const urlThesis = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("thesis") : null;
  const [assetClass, setAssetClass] = useState(() => {
    const urlClass = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("class") : null;
    return getAssetClass(urlClass).id;
  });
  const [compilationId, setCompilationId] = useState<number | null>(urlThesis ? Number(urlThesis) : null);
  const [selected, setSelected] = useState<ScoredAsset | null>(null);
  const openDossier = (a: ScoredAsset) => setSelected(a);
  const closeDossier = () => setSelected(null);
  const [addOpen, setAddOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [filterState, setFilterState] = useState("all");
  const [filterTier, setFilterTier] = useState<"all" | "tier1" | "tier2" | "tier3">("all");
  const [searchText, setSearchText] = useState("");

  const theses = trpc.thesis.list.useQuery();
  const search = trpc.scout.search.useQuery(
    { compilationId: compilationId ?? undefined, assetClass },
    { refetchOnWindowFocus: false },
  );
  const utils = trpc.useUtils();
  // Client (investor) view: render inside the investor shell — never expose
  // operator tooling — and default to the thesis they chose during intake.
  const { user } = useAuth();
  const isInvestor = (user as any)?.role === "investor";
  const Shell = isInvestor ? InvestorLayout : EditorialTopNav;
  const dna = trpc.investor.getDnaStatus.useQuery(undefined, { enabled: isInvestor });
  useEffect(() => {
    const urlClass = new URLSearchParams(window.location.search).get("class");
    const saved = (dna.data as any)?.assetClass;
    if (!urlClass && saved && saved !== assetClass) setAssetClass(getAssetClass(saved).id);
  }, [dna.data]);
  const rescoreSave = trpc.scout.scoreHistoric.useMutation({
    onSuccess: (r) => { toast.success(`Scored + saved ${r.scored} assets`); search.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const research = trpc.scout.researchAssets.useMutation({
    onSuccess: (r: any) => { toast.success(r?.message ?? "Sourced real assets"); search.refetch(); },
    onError: (e: any) => toast.error(e.message),
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
  const selectedClass = getAssetClass(assetClass);
  const AssetIcon = ASSET_CLASS_ICONS[selectedClass.icon] ?? Landmark;

  return (
    <Shell>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AssetIcon className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-bold text-amber-400 tracking-widest uppercase">Wingate · {selectedClass.shortLabel}</span>
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">{selectedClass.label} — Thesis Command</h1>
          <p className="text-xs text-muted-foreground mt-1">{selectedClass.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={assetClass} onValueChange={setAssetClass}>
            <SelectTrigger className="h-9 w-52 text-xs bg-muted/30 border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {listAssetClasses().map((classConfig) => (
                <SelectItem key={classConfig.id} value={classConfig.id}>{classConfig.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          {!isInvestor && (
            <Button size="sm" variant="outline" className="h-9 border-border" onClick={() => research.mutate({ assetClass, limit: 6 })} disabled={research.isPending} title="Find real listings via sonar-pro">
              {research.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Search className="w-4 h-4 mr-1.5" />}
              {research.isPending ? "Sourcing…" : "Source real"}
            </Button>
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
              <button key={a.id} onClick={() => openDossier(a)} className="text-[11px] px-2 py-1 rounded-lg border border-rose-500/30 bg-card hover:border-rose-400 text-foreground">
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
        placeholder="Filter this pipeline — name, city, state…"
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
          <AssetIcon className="w-10 h-10 text-amber-400/30 mb-3" />
          {isInvestor ? (
            <>
              <p className="text-sm font-semibold text-foreground">Your {selectedClass.label} pipeline is being assembled</p>
              <p className="text-xs text-muted-foreground mt-2 max-w-sm leading-relaxed">
                {selectedClass.description}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-3 max-w-sm">
                Your operator is sourcing and verifying properties against this thesis. Every asset that appears here has been scored, gated, and confidence-rated — nothing is shown until it has been checked.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-muted-foreground">No {selectedClass.shortLabel.toLowerCase()} assets in the pipeline yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">Source real listings via research, add one manually, or import in Scout. Everything scores against the active thesis on entry.</p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" className="border-border" onClick={() => research.mutate({ assetClass, limit: 6 })} disabled={research.isPending}>
                  {research.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Search className="w-3.5 h-3.5 mr-1.5" />}
                  {research.isPending ? "Sourcing…" : "Source real listings"}
                </Button>
                <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold" onClick={() => setAddOpen(true)}><Plus className="w-3.5 h-3.5 mr-1.5" />Add manually</Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((a, i) => <RankedCard key={a.id} rank={i + 1} asset={a} onSelect={openDossier} />)}
        </div>
      )}

      {/* Modals */}
      {selected && <ScorecardDrawer asset={selected} onClose={closeDossier} onRescored={() => search.refetch()} />}
      <QuickAdd assetClass={assetClass} open={addOpen} onClose={() => setAddOpen(false)} onCreated={() => search.refetch()} />
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
    </Shell>
  );
}

/**
 * Thesis Studio — /theses
 *
 * From the Wingate call: criteria editing was admin-only, buried in per-agent
 * system prompts. Chad needs the dials himself — his own thesis, plus one per
 * client type ("Wingate 2" = his criteria minus the storey cap).
 *
 * Every dial previews live against the real pipeline, so turning a knob shows
 * "17 of 56 match" and the top reasons the rest fail, before anything is saved.
 * Clients can create and edit their OWN theses here without gaining any write
 * access to the pipeline itself — the server scopes that by ownership.
 */
import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import EditorialTopNav from "@/components/EditorialTopNav";
import InvestorLayout from "@/components/InvestorLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { listAssetClasses, getAssetClass } from "@shared/assetClasses";
import { toast } from "sonner";
import { Loader2, Plus, Copy, Trash2, SlidersHorizontal, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/** The dials, with the defaults the scorer uses when a thesis says nothing. */
const DIALS = [
  { key: "maxYearBuilt", label: "Built no later than", help: "Vintage ceiling. Chad's core thesis is 1945.", def: 1945, min: 1800, max: 2025, unit: "" },
  { key: "minYearBuilt", label: "Built no earlier than", help: "Leave blank for no floor.", def: null, min: 1600, max: 2025, unit: "" },
  { key: "maxStories", label: "Max stories", help: "Above grade. Buildings taller than this are hard-stopped.", def: 4, min: 1, max: 20, unit: "" },
  { key: "gateA", label: "Gate A — historic qualification", help: "Minimum score of 20 to clear Tier 1.", def: 12, min: 0, max: 20, unit: "/20" },
  { key: "gateB", label: "Gate B — development envelope", help: "Minimum score of 20 to clear Tier 1.", def: 12, min: 0, max: 20, unit: "/20" },
  { key: "tier1MinComposite", label: "Tier 1 composite floor", help: "Composite needed for the top tier.", def: 75, min: 0, max: 100, unit: "/100" },
  { key: "tier2MinComposite", label: "Tier 2 composite floor", def: 60, min: 0, max: 100, unit: "/100" },
  { key: "archiveBelowComposite", label: "Archive below", help: "Anything under this is out of the thesis entirely.", def: 45, min: 0, max: 100, unit: "/100" },
] as const;

const TOGGLES = [
  { key: "requireTriplingPath", label: "Require a tripling path", help: "Off means the building is bought for itself, not the FAR.", def: true },
  { key: "allowPriorHtc", label: "Allow prior HTC syndication", help: "On means a previously-credited building is still in play.", def: false },
] as const;

type Draft = {
  id?: number;
  name: string;
  description: string;
  clientLabel: string;
  assetClass: string;
  assignedUserId: number | null;
  overrides: Record<string, any>;
};

const emptyDraft = (assetClass: string): Draft => ({
  name: "", description: "", clientLabel: "", assetClass, assignedUserId: null, overrides: {},
});

export default function ThesisStudio() {
  const { user } = useAuth();
  const isClient = (user as any)?.role === "investor" || (user as any)?.role === "insurance";
  const Shell = isClient ? InvestorLayout : EditorialTopNav;

  const [assetClass, setAssetClass] = useState("historic");
  const [draft, setDraft] = useState<Draft | null>(null);

  const variants = trpc.thesisVariant.list.useQuery({ assetClass });
  const clients = trpc.thesisVariant.assignableUsers.useQuery(undefined, { enabled: !isClient });

  const save = trpc.thesisVariant.save.useMutation({
    onSuccess: () => { toast.success("Thesis saved"); setDraft(null); variants.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.thesisVariant.remove.useMutation({
    onSuccess: () => { toast.success("Thesis removed"); variants.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  // Live dry-run of the draft's dials against the real pipeline.
  const preview = trpc.thesisVariant.preview.useQuery(
    { assetClass: draft?.assetClass ?? assetClass, overrides: draft?.overrides ?? {} },
    { enabled: !!draft, refetchOnWindowFocus: false },
  );

  const setDial = (key: string, raw: string) => {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d.overrides };
      if (raw === "") delete next[key];
      else next[key] = Number(raw);
      return { ...d, overrides: next };
    });
  };
  const setToggle = (key: string, v: boolean, def: boolean) => {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d.overrides };
      if (v === def) delete next[key];       // don't store a value equal to the default
      else next[key] = v;
      return { ...d, overrides: next };
    });
  };

  const changedCount = useMemo(() => Object.keys(draft?.overrides ?? {}).length, [draft]);

  return (
    <Shell>
      <div className="max-w-[1280px] mx-auto w-full px-6 lg:px-10 py-10">

        <div className="flex items-start justify-between gap-6 flex-wrap border-b border-rule pb-8 mb-8">
          <div className="max-w-2xl">
            <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-2 inline-flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber" /> Thesis studio
            </p>
            <h1 className="font-hero-h1 text-[clamp(2rem,4vw,3rem)] text-ink leading-[1.05] mb-3">
              Your criteria, your dials
            </h1>
            <p className="font-body-base text-body-base text-muted-foreground leading-relaxed">
              One thesis per client or client type. A building that fails one still surfaces as a
              match for another — so widen a dial rather than throwing the deal away.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Select value={assetClass} onValueChange={setAssetClass}>
              <SelectTrigger className="h-9 w-[210px] text-xs border-rule bg-transparent"><SelectValue /></SelectTrigger>
              <SelectContent>
                {listAssetClasses().map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <button
              onClick={() => setDraft(emptyDraft(assetClass))}
              className="flex items-center gap-2 bg-ink text-bone font-eyebrow text-eyebrow px-4 py-2 rounded-full hover:opacity-90 transition-all uppercase tracking-widest">
              <Plus className="w-3 h-3" /> New thesis
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* ── Saved theses ─────────────────────────────────────────────── */}
          <div className="lg:col-span-5 space-y-4">
            <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">
              {getAssetClass(assetClass).label} · {(variants.data ?? []).length} theses
            </p>

            {variants.isLoading ? (
              <div className="flex items-center gap-3 py-8">
                <Loader2 className="w-4 h-4 animate-spin text-amber" />
              </div>
            ) : !(variants.data ?? []).length ? (
              <p className="font-body-base text-[13px] text-muted-foreground">
                No theses yet. Create one, or start from the class defaults.
              </p>
            ) : (
              (variants.data ?? []).map((t: any) => {
                const ov = (typeof t.overrides === "string" ? JSON.parse(t.overrides || "{}") : (t.overrides ?? {})) as Record<string, any>;
                const dials = Object.keys(ov);
                return (
                  <div key={t.id} className="border border-rule bg-paper p-5">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="font-card-title text-[18px] text-ink leading-tight">{t.name}</p>
                      {t.isPrimary && (
                        <span className="font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border border-amber/40 text-amber uppercase tracking-widest shrink-0">
                          Primary
                        </span>
                      )}
                    </div>
                    {t.clientLabel && (
                      <p className="font-body-base text-[12px] text-muted-foreground mb-2">{t.clientLabel}</p>
                    )}
                    {t.description && (
                      <p className="font-body-base text-[13px] text-ink/75 leading-relaxed mb-3">{t.description}</p>
                    )}
                    <p className="font-body-base text-[12px] text-muted-foreground mb-4">
                      {dials.length
                        ? `${dials.length} dial${dials.length === 1 ? "" : "s"} changed from default`
                        : "Class defaults, unchanged"}
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setDraft({
                          id: t.id, name: t.name, description: t.description ?? "",
                          clientLabel: t.clientLabel ?? "", assetClass: t.assetClass,
                          assignedUserId: t.assignedUserId ?? null, overrides: ov,
                        })}
                        className="font-eyebrow text-eyebrow text-amber hover:underline uppercase tracking-widest">
                        Edit
                      </button>
                      <button
                        onClick={() => setDraft({
                          name: `${t.name} (copy)`, description: t.description ?? "",
                          clientLabel: t.clientLabel ?? "", assetClass: t.assetClass,
                          assignedUserId: null, overrides: ov,
                        })}
                        className="font-eyebrow text-eyebrow text-muted-foreground hover:text-amber uppercase tracking-widest inline-flex items-center gap-1">
                        <Copy className="w-3 h-3" /> Clone
                      </button>
                      <button
                        onClick={() => { if (confirm(`Remove "${t.name}"?`)) remove.mutate({ id: t.id }); }}
                        className="font-eyebrow text-eyebrow text-muted-foreground hover:text-clay uppercase tracking-widest inline-flex items-center gap-1 ml-auto">
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Editor ───────────────────────────────────────────────────── */}
          <div className="lg:col-span-7">
            {!draft ? (
              <div className="border border-rule bg-paper p-8">
                <p className="font-card-title text-[18px] text-ink mb-2">Pick a thesis to edit</p>
                <p className="font-body-base text-[13px] text-muted-foreground leading-relaxed">
                  Or create a new one. Every dial previews against your live pipeline before you save,
                  so you can see exactly what widening a criterion would let through.
                </p>
              </div>
            ) : (
              <div className="border border-rule bg-paper p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Name</Label>
                    <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      placeholder="Wingate 2 — Relaxed Envelope"
                      className="h-9 mt-1 border-rule bg-transparent" />
                  </div>
                  <div>
                    <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Who it's for</Label>
                    <Input value={draft.clientLabel} onChange={(e) => setDraft({ ...draft, clientLabel: e.target.value })}
                      placeholder="Cincinnati restoration client"
                      className="h-9 mt-1 border-rule bg-transparent" />
                  </div>
                </div>

                <div>
                  <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Notes</Label>
                  <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="What this client actually buys, and why the dials differ."
                    className="h-9 mt-1 border-rule bg-transparent" />
                </div>

                {!isClient && (
                  <div>
                    <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Assign to client</Label>
                    <Select
                      value={draft.assignedUserId == null ? "none" : String(draft.assignedUserId)}
                      onValueChange={(v) => setDraft({ ...draft, assignedUserId: v === "none" ? null : Number(v) })}
                    >
                      <SelectTrigger className="h-9 mt-1 text-xs border-rule bg-transparent"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {(clients.data ?? []).map((u: any) => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.name || u.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Dials */}
                <div className="border-t border-rule pt-5">
                  <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-4">
                    Criteria · {changedCount} changed from default
                  </p>
                  <div className="space-y-4">
                    {DIALS.map((d) => {
                      const val = draft.overrides[d.key];
                      const isChanged = val !== undefined;
                      return (
                        <div key={d.key} className="grid grid-cols-[1fr_120px] gap-4 items-start">
                          <div>
                            <p className={cn("font-body-base text-[13px]", isChanged ? "text-ink font-medium" : "text-ink/75")}>
                              {d.label}
                            </p>
                            {"help" in d && d.help && (
                              <p className="font-body-base text-[11px] text-muted-foreground mt-0.5 leading-snug">{d.help}</p>
                            )}
                          </div>
                          <div>
                            <Input
                              type="number" min={d.min} max={d.max}
                              value={val ?? ""}
                              placeholder={d.def == null ? "none" : String(d.def)}
                              onChange={(e) => setDial(d.key, e.target.value)}
                              className={cn("h-8 text-xs border-rule bg-transparent text-right",
                                isChanged && "border-amber/50 text-amber")}
                            />
                            <p className="font-eyebrow text-[9px] text-muted-foreground text-right mt-0.5 uppercase tracking-widest">
                              {isChanged ? `default ${d.def ?? "none"}${d.unit}` : `default${d.unit}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    {TOGGLES.map((t) => {
                      const val = draft.overrides[t.key] ?? t.def;
                      const isChanged = draft.overrides[t.key] !== undefined;
                      return (
                        <div key={t.key} className="grid grid-cols-[1fr_120px] gap-4 items-start">
                          <div>
                            <p className={cn("font-body-base text-[13px]", isChanged ? "text-ink font-medium" : "text-ink/75")}>{t.label}</p>
                            <p className="font-body-base text-[11px] text-muted-foreground mt-0.5 leading-snug">{t.help}</p>
                          </div>
                          <div className="flex justify-end pt-1">
                            <Switch checked={!!val} onCheckedChange={(v) => setToggle(t.key, v, t.def)} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Live preview against the real pipeline */}
                <div className="border-t border-rule pt-5">
                  <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-3">
                    Against your pipeline right now
                  </p>
                  {preview.isFetching ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber" />
                      <span className="font-body-base text-[12px] text-muted-foreground">Scoring…</span>
                    </div>
                  ) : preview.data ? (
                    <>
                      <p className="font-data-mono text-[26px] text-amber leading-none mb-1">
                        {preview.data.fits}
                        <span className="text-[14px] text-muted-foreground ml-2">of {preview.data.total} match</span>
                      </p>
                      {preview.data.topReasons.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Why the rest fail</p>
                          {preview.data.topReasons.map((r: any) => (
                            <p key={r.reason} className="font-body-base text-[12px] text-muted-foreground">
                              <span className="font-data-mono text-ink/70">{r.n}</span> · {r.reason}
                            </p>
                          ))}
                        </div>
                      )}
                      {preview.data.sample.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {preview.data.sample.map((sA: any) => (
                            <span key={sA.name} className="font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border border-rule text-muted-foreground">
                              {sA.name} · {sA.city}, {sA.state}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  ) : null}
                </div>

                <div className="flex items-center gap-3 border-t border-rule pt-5">
                  <button
                    onClick={() => save.mutate({
                      id: draft.id,
                      name: draft.name.trim(),
                      description: draft.description.trim() || undefined,
                      clientLabel: draft.clientLabel.trim() || undefined,
                      assetClass: draft.assetClass,
                      assignedUserId: draft.assignedUserId,
                      isPrimary: false,
                      overrides: draft.overrides as any,
                    })}
                    disabled={save.isPending || !draft.name.trim()}
                    className="flex items-center gap-2 bg-ink text-bone font-eyebrow text-eyebrow px-4 py-2.5 rounded-full hover:opacity-90 transition-all uppercase tracking-widest disabled:opacity-50">
                    {save.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    {draft.id ? "Save changes" : "Create thesis"}
                  </button>
                  <button onClick={() => setDraft(null)}
                    className="font-eyebrow text-eyebrow text-muted-foreground hover:text-ink uppercase tracking-widest">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

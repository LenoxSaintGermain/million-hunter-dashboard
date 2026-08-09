/**
 * Off-market discovery — /off-market (operator only)
 *
 * Buildings that are NOT for sale, found in public records. This is the one
 * channel a CoStar seat structurally cannot cover.
 *
 * Measured reality, shown in the UI rather than hidden: across six markets and
 * thirty probes, preservation "most-endangered" lists and code enforcement
 * returned results; land-bank inventories, delinquent-tax rolls and vacant
 * registries returned nothing at all — they sit behind parcel-keyed search
 * portals a web-search model cannot enumerate. The per-source yield is printed
 * after every run so a dry channel is visible instead of looking like "no
 * opportunities here".
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import EditorialTopNav from "@/components/EditorialTopNav";
import { listAssetClasses } from "@shared/assetClasses";
import { RECORD_SOURCE_LABELS, MOTIVATION_BAND_LABEL, type PublicRecordSource } from "@shared/offMarket";
import { toast } from "sonner";
import { Loader2, Radar, Check, ExternalLink, AlertTriangle, Landmark } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/** Observed yield, so nobody wastes a run on a channel that never returns. */
const CHANNEL_NOTE: Record<string, string> = {
  preservation_watch: "Best yield — curated lists are published as readable pages.",
  code_enforcement: "Occasional. Some cities publish demolition lists as documents.",
  land_bank: "No yield so far — inventories sit behind parcel search portals.",
  delinquent_tax: "No yield so far — treasurer rolls are query-only or PDF dumps.",
  vacant_registry: "No yield so far — registries are rarely published as lists.",
};

const ALL_SOURCES: PublicRecordSource[] = [
  "preservation_watch", "code_enforcement", "land_bank", "delinquent_tax", "vacant_registry",
];

const BAND_CLS: Record<string, string> = {
  distressed: "text-clay border-clay/40 bg-clay/10",
  hot: "text-amber border-amber/40 bg-amber/10",
  warm: "text-ink border-rule bg-paper",
  cold: "text-muted-foreground border-rule bg-paper",
};

export default function OffMarketDiscovery() {
  const [city, setCity] = useState("Birmingham");
  const [state, setState] = useState("AL");
  const [assetClass, setAssetClass] = useState("historic");
  const [sources, setSources] = useState<PublicRecordSource[]>(ALL_SOURCES);
  const [result, setResult] = useState<any>(null);
  const [committed, setCommitted] = useState(false);
  const [countyResult, setCountyResult] = useState<any>(null);
  const [minLien, setMinLien] = useState(25000);
  const [nrhpResult, setNrhpResult] = useState<any>(null);

  // The qualifying universe — every NR-listed building in this market, for sale
  // or not. Counting it first shows the size of the board before playing on it.
  const nrhpCount = trpc.scout.nrhpCount.useQuery(
    { states: state.length === 2 ? [state] : undefined, city: city.trim() || undefined },
    { enabled: state.length === 2, refetchOnWindowFocus: false },
  );
  const nrhp = trpc.scout.nrhpDiscover.useMutation({
    onSuccess: (r: any, vars: any) => {
      setNrhpResult(r);
      if (!vars.dryRun) toast.success(r.message);
      else if (!r.found) toast.warning("No National Register buildings match that market.");
    },
    onError: (e) => toast.error(e.message),
  });

  const adapters = trpc.scout.countyAdapters.useQuery();
  const county = trpc.scout.countyDiscover.useMutation({
    onSuccess: (r: any, vars: any) => {
      setCountyResult(r);
      if (!r.adapter) toast.warning(r.message);
      else if (!vars.dryRun) toast.success(r.message);
    },
    onError: (e) => toast.error(e.message),
  });

  const run = trpc.scout.sourceOffMarket.useMutation({
    onSuccess: (r: any, vars: any) => {
      setResult(r);
      if (!vars.dryRun) { setCommitted(true); toast.success(`Added ${r.imported} off-market candidates`); }
      else if (!r.candidates.length) toast.warning("No public records returned anything for that market.");
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleSource = (s: PublicRecordSource) =>
    setSources((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  return (
    <EditorialTopNav>
      <div className="max-w-[1280px] mx-auto w-full px-6 lg:px-10 py-10">

        <div className="border-b border-rule pb-8 mb-8 max-w-2xl">
          <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-2 inline-flex items-center gap-1.5">
            <Radar className="w-3.5 h-3.5 text-amber" /> Off-market discovery
          </p>
          <h1 className="font-hero-h1 text-[clamp(2rem,4vw,3rem)] text-ink leading-[1.05] mb-3">
            Buildings nobody listed
          </h1>
          <p className="font-body-base text-body-base text-muted-foreground leading-relaxed">
            Sourcing from listing sites competes for the inventory a CoStar seat already shows.
            This searches public records instead — preservation watch lists, code enforcement,
            land banks, tax rolls — for buildings that are not for sale.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* ── Run controls ─────────────────────────────────────────────── */}
          <div className="lg:col-span-5 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} className="h-9 mt-1 border-rule bg-transparent" />
              </div>
              <div>
                <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">State</Label>
                <Input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                  className="h-9 mt-1 border-rule bg-transparent" />
              </div>
            </div>

            <div>
              <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Asset class</Label>
              <Select value={assetClass} onValueChange={setAssetClass}>
                <SelectTrigger className="h-9 mt-1 text-xs border-rule bg-transparent"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {listAssetClasses().map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-3">Record sources</p>
              <div className="space-y-2">
                {ALL_SOURCES.map((s) => (
                  <button key={s} onClick={() => toggleSource(s)}
                    className={cn("w-full text-left border p-3 transition-colors",
                      sources.includes(s) ? "border-amber/50 bg-amber/5" : "border-rule bg-paper opacity-60")}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-body-base text-[13px] text-ink">{RECORD_SOURCE_LABELS[s]}</span>
                      {sources.includes(s) && <Check className="w-3.5 h-3.5 text-amber shrink-0" />}
                    </div>
                    <p className="font-body-base text-[11px] text-muted-foreground mt-0.5 leading-snug">{CHANNEL_NOTE[s]}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* National Register — the qualifying universe */}
            <div className="border border-amber/40 bg-amber/5 p-4">
              <p className="font-eyebrow text-eyebrow text-amber uppercase tracking-widest mb-2">
                National Register
              </p>
              <p className="font-body-base text-[12px] text-muted-foreground leading-relaxed mb-3">
                Not a market search — the complete, finite list of buildings that QUALIFY for the
                thesis, listed or not. Roughly 500 new listings a year nationally, so this universe
                barely moves.
              </p>
              {nrhpCount.data && (
                <div className="grid grid-cols-2 gap-3 mb-3 border-t border-rule pt-3">
                  {[
                    { l: "Listed buildings", v: nrhpCount.data.buildings },
                    { l: "Historic districts", v: nrhpCount.data.districts },
                  ].map((x) => (
                    <div key={x.l}>
                      <p className="font-data-mono text-[20px] text-ink leading-none">{x.v.toLocaleString()}</p>
                      <p className="font-eyebrow text-[9px] text-muted-foreground uppercase tracking-widest mt-1">{x.l}</p>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => { setNrhpResult(null); nrhp.mutate({ states: [state], city: city.trim() || undefined, assetClass, dryRun: true }); }}
                disabled={nrhp.isPending || state.length !== 2}
                className="w-full flex items-center justify-center gap-2 border border-amber/50 text-amber font-eyebrow text-eyebrow px-4 py-2.5 rounded-full hover:bg-amber/10 transition-all uppercase tracking-widest disabled:opacity-50">
                {nrhp.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Landmark className="w-3 h-3" />}
                Pull the register
              </button>
              {nrhpResult?.candidates?.length > 0 && (
                <button
                  onClick={() => nrhp.mutate({ states: [state], city: city.trim() || undefined, assetClass, dryRun: false })}
                  disabled={nrhp.isPending}
                  className="w-full mt-3 flex items-center justify-center gap-2 bg-ink text-bone font-eyebrow text-eyebrow px-4 py-2.5 rounded-full hover:opacity-90 transition-all uppercase tracking-widest">
                  <Check className="w-3 h-3" /> Add {nrhpResult.candidates.length} new
                </button>
              )}
            </div>

            {/* County direct data — the higher-confidence channel */}
            <div className="border border-sage/40 bg-sage/5 p-4">
              <p className="font-eyebrow text-eyebrow text-sage uppercase tracking-widest mb-2">
                Direct county data
              </p>
              <p className="font-body-base text-[12px] text-muted-foreground leading-relaxed mb-3">
                Queries the county's own tables rather than searching the web — every figure is a
                database value with a parcel ID. Available where an adapter has been wired:
                {" "}{(adapters.data ?? []).map((a: any) => a.label).join(", ") || "none yet"}.
              </p>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Min tax lien</Label>
                  <Input type="number" min={0} step={5000} value={minLien}
                    onChange={(e) => setMinLien(Number(e.target.value))}
                    className="h-9 mt-1 border-rule bg-transparent" />
                </div>
                <button
                  onClick={() => { setCountyResult(null); county.mutate({ city, state, assetClass, minLien, dryRun: true }); }}
                  disabled={county.isPending || !city.trim() || state.length !== 2}
                  className="flex items-center gap-2 border border-sage/50 text-sage font-eyebrow text-eyebrow px-4 py-2.5 rounded-full hover:bg-sage/10 transition-all uppercase tracking-widest disabled:opacity-50 shrink-0">
                  {county.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radar className="w-3 h-3" />}
                  Query county
                </button>
              </div>
              {countyResult?.candidates?.length > 0 && (
                <button
                  onClick={() => county.mutate({ city, state, assetClass, minLien, dryRun: false })}
                  disabled={county.isPending}
                  className="w-full mt-3 flex items-center justify-center gap-2 bg-ink text-bone font-eyebrow text-eyebrow px-4 py-2.5 rounded-full hover:opacity-90 transition-all uppercase tracking-widest">
                  <Check className="w-3 h-3" /> Add {countyResult.candidates.length} from county
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => { setCommitted(false); run.mutate({ city, state, assetClass, sources, dryRun: true }); }}
                disabled={run.isPending || !city.trim() || state.length !== 2 || !sources.length}
                className="flex items-center gap-2 border border-rule font-eyebrow text-eyebrow px-4 py-2.5 rounded-full hover:border-amber/40 hover:text-amber transition-all uppercase tracking-widest disabled:opacity-50">
                {run.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radar className="w-3 h-3" />}
                Search records
              </button>
              {result && !committed && result.candidates?.length > 0 && (
                <button
                  onClick={() => run.mutate({ city, state, assetClass, sources, dryRun: false })}
                  disabled={run.isPending}
                  className="flex items-center gap-2 bg-ink text-bone font-eyebrow text-eyebrow px-4 py-2.5 rounded-full hover:opacity-90 transition-all uppercase tracking-widest disabled:opacity-50">
                  <Check className="w-3 h-3" /> Add {result.candidates.length}
                </button>
              )}
            </div>
          </div>

          {/* ── Results ──────────────────────────────────────────────────── */}
          <div className="lg:col-span-7">
            {nrhpResult && (
              <div className="mb-8 space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-eyebrow text-eyebrow text-amber uppercase tracking-widest">National Register</p>
                  <span className="font-body-base text-[12px] text-muted-foreground">{nrhpResult.message}</span>
                </div>
                {(nrhpResult.candidates ?? []).slice(0, 12).map((r: any) => (
                  <div key={r.refNumber} className="border border-amber/25 bg-paper p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-card-title text-[16px] text-ink leading-tight">{r.name}</p>
                      {r.isNationalHistoricLandmark && (
                        <span className="font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border border-amber/50 text-amber uppercase tracking-widest shrink-0">
                          Landmark
                        </span>
                      )}
                    </div>
                    <p className="font-body-base text-[12px] text-muted-foreground mt-1">
                      {r.address}, {r.city} {r.state} · listed {r.listedYear ?? "—"} · ref {r.refNumber}
                      {r.contributingBuildings ? ` · ${r.contributingBuildings} contributing` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {countyResult && (
              <div className="mb-8 space-y-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-eyebrow text-eyebrow text-sage uppercase tracking-widest">
                    County records {countyResult.adapter ? `· ${countyResult.adapter.label}` : ""}
                  </p>
                  <span className="font-data-mono text-[13px] text-ink">{countyResult.found ?? 0}</span>
                </div>
                {!countyResult.adapter ? (
                  <p className="font-body-base text-[13px] text-muted-foreground leading-relaxed border-l-2 border-amber pl-4">
                    {countyResult.message}
                  </p>
                ) : (
                  (countyResult.candidates ?? []).map((c: any) => (
                    <div key={c.parcelId} className="border border-sage/30 bg-paper p-4">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <p className="font-card-title text-[16px] text-ink leading-tight">{c.address}, {c.city}</p>
                        <span className={cn("font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border uppercase tracking-widest shrink-0",
                          BAND_CLS[c.motivation.band])}>
                          {MOTIVATION_BAND_LABEL[c.motivation.band as keyof typeof MOTIVATION_BAND_LABEL]} {c.motivation.score}
                        </span>
                      </div>
                      <p className="font-body-base text-[12px] text-muted-foreground mb-2">
                        {c.useDescription} · parcel {c.parcelId}
                      </p>
                      <div className="grid grid-cols-3 gap-3 border-t border-rule pt-2">
                        {[
                          { l: "Tax lien", v: c.signals.taxDelinquentAmount == null ? "—" : `$${Math.round(c.signals.taxDelinquentAmount).toLocaleString()}` },
                          { l: "Assessed", v: c.assessedValue == null ? "—" : `$${Math.round(c.assessedValue).toLocaleString()}` },
                          { l: "Held", v: c.signals.yearsSinceLastSale == null ? "—" : `${c.signals.yearsSinceLastSale} yrs` },
                        ].map((x) => (
                          <div key={x.l}>
                            <p className="font-eyebrow text-[9px] text-muted-foreground uppercase tracking-widest">{x.l}</p>
                            <p className="font-data-mono text-[13px] text-ink">{x.v}</p>
                          </div>
                        ))}
                      </div>
                      <p className="font-body-base text-[12px] text-ink/80 mt-2 leading-relaxed">{c.motivation.headline}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {!result ? (
              <div className="border border-rule bg-paper p-6">
                <p className="font-card-title text-[18px] text-ink mb-2">Nothing searched yet</p>
                <p className="font-body-base text-[13px] text-muted-foreground leading-relaxed">
                  Pick a market and search. Nothing is written until you confirm, and every
                  candidate shows the record it came from.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-0 border border-rule divide-x divide-rule">
                  {[
                    { label: "Buildings", v: result.found },
                    { label: "Already held", v: result.duplicates },
                    { label: committed ? "Added" : "New", v: committed ? result.imported : result.candidates?.length ?? 0 },
                  ].map((x) => (
                    <div key={x.label} className="px-4 py-4 bg-paper">
                      <p className="font-data-mono text-[22px] text-ink leading-none">{x.v}</p>
                      <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mt-2">{x.label}</p>
                    </div>
                  ))}
                </div>

                {/* Per-source yield — a dry channel must look dry, not empty. */}
                <div>
                  <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-2">
                    Yield by record source
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(result.perSource ?? {}).map(([k, v]) => (
                      <span key={k} className={cn("font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border",
                        (v as number) > 0 ? "border-sage/40 text-sage" : "border-rule text-muted-foreground")}>
                        {RECORD_SOURCE_LABELS[k as PublicRecordSource] ?? k} {String(v)}
                      </span>
                    ))}
                  </div>
                  {result.discarded > 0 && (
                    <p className="font-body-base text-[11px] text-muted-foreground mt-2 inline-flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                      {result.discarded} candidate(s) discarded for having no real street address.
                    </p>
                  )}
                </div>

                {(result.candidates ?? []).map((c: any) => (
                  <div key={c.address} className="border border-rule bg-paper p-5">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="font-card-title text-[18px] text-ink leading-tight">{c.name}</p>
                      <span className={cn("font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border uppercase tracking-widest shrink-0",
                        BAND_CLS[c.motivation.band])}>
                        {MOTIVATION_BAND_LABEL[c.motivation.band as keyof typeof MOTIVATION_BAND_LABEL]} {c.motivationScore}
                      </span>
                    </div>
                    <p className="font-body-base text-[12px] text-muted-foreground mb-2">
                      {c.address}{c.ownerName ? ` · owner: ${c.ownerName}` : ""}
                    </p>
                    <p className="font-body-base text-[13px] text-ink/80 leading-relaxed mb-3">{c.motivation.headline}</p>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {(c.signals.sources ?? []).map((s: PublicRecordSource) => (
                        <span key={s} className="font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border border-rule text-muted-foreground">
                          {RECORD_SOURCE_LABELS[s]}
                        </span>
                      ))}
                    </div>

                    {c.signals.notes && (
                      <p className="font-body-base text-[12px] text-muted-foreground leading-relaxed border-l-2 border-rule pl-3 mb-3">
                        {c.signals.notes}
                      </p>
                    )}

                    {!!c.signals.citations?.length && (
                      <a href={c.signals.citations[0]} target="_blank" rel="noopener noreferrer"
                        className="font-eyebrow text-eyebrow text-amber hover:underline uppercase tracking-widest inline-flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> Source record
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </EditorialTopNav>
  );
}

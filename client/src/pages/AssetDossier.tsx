/**
 * Full-page asset dossier — /wingate/asset/:id
 *
 * The property-class equivalent of the business Deal Room (DealDetail.tsx), in
 * the same broadsheet layout: masthead, enrichment strip, 12-column body with an
 * action rail. Property classes never promote into `deals`, so THIS page is the
 * deal record — it has to carry the same weight as the business dossier.
 *
 * Sections come from AssetDossierSections.tsx, shared with the quick-scan modal
 * in /wingate, and are gated by the asset class's declared analysisModules — a
 * new bespoke thesis changes its diligence surface from config alone.
 */
import { useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { getAssetClass, classSupportsModule, criticalFields } from "@shared/assetClasses";
import EditorialTopNav from "@/components/EditorialTopNav";
import InvestorLayout from "@/components/InvestorLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, MapPin, ShieldCheck, Zap, CheckCircle2, XCircle, Share2,
} from "lucide-react";
import {
  ScoreHeadline, HardStopBanner, EconomicsPanel, DimensionsPanel, PenaltiesBonuses,
  VerifyList, StrengthsRisks, DiligencePanel, ProvenancePanel, NarrativePanel,
  SectionLabel, buildDiligenceItems, TIER_META,
  type ScoredAsset,
} from "@/components/AssetDossierSections";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { isTutorialAsset, TUTORIAL_STEPS } from "@shared/tutorial";
import { formatAskingPrice } from "@shared/pricing";
import { computeMotivation, RECORD_SOURCE_LABELS, MOTIVATION_BAND_LABEL } from "@shared/offMarket";
import { Explain } from "@/components/Explain";
import { GraduationCap, Trash2 } from "lucide-react";

const ASSET_STATUSES = ["new", "reviewing", "qualified", "rejected", "acquired"] as const;
type AssetStatus = typeof ASSET_STATUSES[number];

export default function AssetDossier() {
  const [, params] = useRoute("/wingate/asset/:id");
  const assetId = Number(params?.id);
  const { user } = useAuth();
  // Clients read the dossier; they never mutate the pipeline. The server enforces
  // this too (operatorProcedure) — this just avoids showing controls that 403.
  const isClient = (user as any)?.role === "investor" || (user as any)?.role === "insurance";
  const Shell = isClient ? InvestorLayout : EditorialTopNav;

  const [, navigate] = useLocation();
  const q = trpc.scout.getScoredById.useQuery({ id: assetId }, { enabled: Number.isFinite(assetId) });
  const asset = q.data as ScoredAsset | undefined;

  const [status, setStatus] = useState<AssetStatus | null>(null);
  const [verification, setVerification] = useState<any>(null);
  const [narrative, setNarrative] = useState<{ summary: string; strengths: string[]; risks: string[] } | null>(null);
  const [interested, setInterested] = useState(false);
  const [assignTo, setAssignTo] = useState<string>("none");

  // Who can this be handed to, and which thesis does it actually suit?
  const clients = trpc.thesisVariant.assignableUsers.useQuery(undefined, { enabled: !isClient });
  const assign = trpc.thesisVariant.assignAsset.useMutation({
    onSuccess: () => { toast.success("Assigned — it now shows in that client's pipeline."); q.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  // Sharing mints a token so the recipient sees a public highlight card and a
  // way to request access — not a bare URL that dead-ends at a login wall.
  const createShare = trpc.assetShare.createToken.useMutation({
    onSuccess: (r) => {
      const url = `${window.location.origin}/asset-share/${r.token}`;
      navigator.clipboard?.writeText(url);
      toast.success("Share link copied — expires in 30 days");
    },
    onError: (e) => toast.error(e.message),
  });

  const expressInterest = trpc.investor.expressAssetInterest.useMutation({
    onSuccess: () => { setInterested(true); toast.success("Interest registered — your analyst has been notified."); },
    onError: (e) => toast.error(e.message),
  });

  const verify = trpc.scout.verifyListing.useMutation({
    onSuccess: (r: any) => { setVerification(r); toast.success(`Listing checked: ${r.status}`); q.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const aiScore = trpc.scout.scoreAsset.useMutation({
    onSuccess: (r: any) => { setNarrative({ summary: r.summary, strengths: r.strengths ?? [], risks: r.risks ?? [] }); toast.success("Analyst narrative ready"); },
    onError: (e) => toast.error(e.message),
  });
  // Pull real county data for this address — owner, parcel, liens, sale history.
  const enrich = trpc.scout.countyEnrich.useMutation({
    onSuccess: (r: any) => {
      if (!r.enriched) toast.warning(r.reason);
      else toast.success(`${r.adapter}: parcel ${r.parcelId} · motivation ${r.motivation.score}`);
      q.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const rescore = trpc.scout.scoreHistoric.useMutation({
    onSuccess: () => { toast.success("Re-scored"); q.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  // Dismissing the tutorial is an ordinary delete. Nothing re-creates it, and
  // the next-highest-ranked asset simply takes the top slot.
  const dismissTutorial = trpc.scout.deleteAsset.useMutation({
    onSuccess: () => {
      toast.success("Tutorial dismissed — your highest-ranked asset now leads the pipeline.");
      navigate("/wingate");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatus = trpc.scout.updateStatus.useMutation({
    onSuccess: (_r, vars: any) => {
      toast.success(vars?.status === "qualified"
        ? "Moved to Diligence — this dossier is the deal record."
        : `Status set to ${vars?.status}`);
      q.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (q.isLoading) {
    return (
      <Shell>
        <div className="max-w-[1280px] mx-auto w-full px-6 lg:px-10 py-24 flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-amber" />
          <span className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Loading dossier</span>
        </div>
      </Shell>
    );
  }
  if (q.error || !asset) {
    return (
      <Shell>
        <div className="max-w-[1280px] mx-auto w-full px-6 lg:px-10 py-24">
          <p className="font-card-title text-card-title text-ink mb-3">Dossier not found</p>
          <p className="font-body-base text-body-base text-muted-foreground mb-6">
            This asset is no longer in the pipeline, or the link points at a record that was removed.
          </p>
          <Link href="/wingate">
            <span className="font-eyebrow text-eyebrow text-amber hover:underline uppercase tracking-widest cursor-pointer">
              ← Back to Wingate pipeline
            </span>
          </Link>
        </div>
      </Shell>
    );
  }

  const s = asset.historicScore;
  const cls = getAssetClass(asset.assetClass);
  const has = (m: Parameters<typeof classSupportsModule>[1]) => classSupportsModule(cls, m);
  const tier = TIER_META[s.assetTier];
  const currentStatus = (status ?? (asset.status as AssetStatus) ?? "new");
  const diligence = buildDiligenceItems(asset, has);
  // The worked-example record doubles as the first-run walkthrough: every module
  // is populated, so each concept has something real to point at.
  const isTutorial = isTutorialAsset(asset as any);

  return (
    <Shell>
      <div className="max-w-[1280px] mx-auto w-full px-6 lg:px-10 py-10">

        <Link href="/wingate">
          <div className="inline-flex items-center gap-2 font-eyebrow text-eyebrow text-muted-foreground hover:text-amber transition-colors cursor-pointer mb-10 uppercase tracking-widest">
            <ArrowLeft className="w-3 h-3" />
            Wingate Pipeline
          </div>
        </Link>

        {/* ── Masthead ──────────────────────────────────────────────────────── */}
        <div className="border-b border-rule pb-10 mb-10">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">
              {cls.label} Dossier
            </span>
            <span className="w-8 h-px bg-rule" />
            {isTutorial ? (
              <span className="font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border border-amber/50 bg-amber/10 text-amber uppercase tracking-widest inline-flex items-center gap-1">
                <GraduationCap className="w-3 h-3" /> Tutorial
              </span>
            ) : (
              <span className={cn("font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border uppercase tracking-widest", tier.cls)}>
                {tier.label}
              </span>
            )}
            <span className="font-eyebrow text-eyebrow text-muted-foreground border border-rule px-2 py-0.5 rounded-sm uppercase tracking-widest">
              Market {s.marketTier}
            </span>
            <span className="font-eyebrow text-eyebrow text-muted-foreground flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5" />{asset.city}, {asset.state}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-end">
            <div>
              <h1 className="font-hero-h1 text-hero-h1 text-ink leading-[1.05] mb-3">{asset.name}</h1>
              {/* Sourced listings often name the asset by its address — don't say it twice. */}
              <p className="font-body-base text-body-base text-muted-foreground mb-6">
                {String(asset.address).trim() === String(asset.name).trim()
                  ? `${asset.city}, ${asset.state}`
                  : `${asset.address}, ${asset.city}, ${asset.state}`}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-rule pt-8">
                {([
                  { label: "Asking Price", ...(() => { const f = formatAskingPrice(asset.askingPrice == null ? null : Number(asset.askingPrice)); return { value: f.display, hint: f.hint }; })() },
                  (() => {
                    // Each class measures itself differently — GSF for a building
                    // you rehab, net rentable SF for one you lease.
                    const meta = (asset.classMetadata ?? {}) as Record<string, any>;
                    const nrsf = meta.netRentableSqFt;
                    return nrsf != null
                      ? { label: "Net Rentable SF", value: Number(nrsf).toLocaleString() }
                      : { label: cls.id === "historic" ? "Square Feet" : "Net Rentable SF",
                          value: asset.squareFootage ? Number(asset.squareFootage).toLocaleString() : "—" };
                  })(),
                  { label: "Year Built", value: asset.yearBuilt ? String(asset.yearBuilt) : "—" },
                  { label: "Rank Score", value: String(Math.round(s.rankScore)), accent: true },
                ] as { label: string; value: string; accent?: boolean; hint?: string }[]).map((item) => (
                  <div key={item.label}>
                    <p className="font-eyebrow text-eyebrow text-muted-foreground mb-2 uppercase tracking-widest">{item.label}</p>
                    <p className={cn("font-data-mono text-section-h2 leading-none", item.accent ? "text-amber" : "text-ink")}>{item.value}</p>
                    {(item as any).hint && <p className="font-body-base text-[11px] text-muted-foreground mt-2 leading-snug max-w-[200px]">{(item as any).hint}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-stretch lg:items-end gap-3 shrink-0">
              {isClient ? (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(`${window.location.origin}/wingate/asset/${asset.id}`);
                    toast.success("Dossier link copied");
                  }}
                  className="flex items-center justify-center gap-2 border border-rule bg-paper font-eyebrow text-eyebrow px-4 py-2 rounded-full hover:border-amber/40 hover:text-amber transition-all uppercase tracking-widest">
                  <Share2 className="w-3 h-3" />Copy Link
                </button>
              ) : (
                <button
                  onClick={() => createShare.mutate({ assetId: asset.id })}
                  disabled={createShare.isPending}
                  className="flex items-center justify-center gap-2 border border-rule bg-paper font-eyebrow text-eyebrow px-4 py-2 rounded-full hover:border-amber/40 hover:text-amber transition-all uppercase tracking-widest">
                  {createShare.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />}
                  Share Dossier
                </button>
              )}
              {!isClient && (
                <button onClick={() => rescore.mutate({ id: asset.id })} disabled={rescore.isPending}
                  className="flex items-center justify-center gap-2 bg-ink text-bone font-eyebrow text-eyebrow px-4 py-2 rounded-full hover:opacity-90 transition-all uppercase tracking-widest">
                  {rescore.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  Re-score
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Guided tour (tutorial record only) ────────────────────────────── */}
        {isTutorial && (
          <div className="border border-amber/40 bg-amber/5 p-6 mb-10">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="max-w-2xl">
                <p className="font-eyebrow text-eyebrow text-amber uppercase tracking-widest mb-2 inline-flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" /> Guided tour
                </p>
                <p className="font-card-title text-[20px] text-ink leading-tight mb-2">
                  This is a worked example, not a real listing.
                </p>
                <p className="font-body-base text-[13px] text-muted-foreground leading-relaxed">
                  Its figures are composite, and every module is deliberately filled in so each part
                  of the dossier has something to show. Read the notes below to learn how a real
                  asset is scored — then dismiss it whenever you like.
                </p>
              </div>
              {!isClient && (
                <button
                  onClick={() => dismissTutorial.mutate({ id: asset.id })}
                  disabled={dismissTutorial.isPending}
                  className="flex items-center gap-2 border border-rule bg-paper font-eyebrow text-eyebrow px-4 py-2 rounded-full hover:border-clay/50 hover:text-clay transition-all uppercase tracking-widest shrink-0">
                  {dismissTutorial.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Dismiss tutorial
                </button>
              )}
            </div>

            <ol className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {TUTORIAL_STEPS.map((step, i) => (
                <li key={step.anchor} className="flex gap-3">
                  <span className="font-data-mono text-[13px] text-amber shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="font-body-base text-[13px] text-ink font-medium leading-snug">{step.title}</p>
                    <p className="font-body-base text-[12px] text-muted-foreground leading-relaxed mt-0.5">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* ── Enrichment strip ──────────────────────────────────────────────── */}
        <div className="mb-10">
          <ScoreHeadline s={s} tutorial={isTutorial} criticalTotal={criticalFields(cls).length || 5} />
        </div>

        {s.hardStopFailed && <div className="mb-10"><HardStopBanner s={s} /></div>}

        {/* ── Body: content + action rail ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-12">
            {has("economics") && asset.economics && <EconomicsPanel economics={asset.economics} tutorial={isTutorial} />}

            {(has("agScorecard") || has("classScorecard")) && (
              <div>
                <SectionLabel className="mb-4">Scorecard · {s.scorecard.dimensions.length} dimensions</SectionLabel>
                <DimensionsPanel s={s} tutorial={isTutorial} />
                <p className="font-body-base text-[12px] text-muted-foreground mt-4 leading-relaxed">
                  {s.scorecard.marketNote} · {s.scorecard.sourceNote}
                </p>
              </div>
            )}

            {(s.scorecard.penalties.length > 0 || s.scorecard.bonuses.length > 0) && <PenaltiesBonuses s={s} />}

            <StrengthsRisks s={s} />

            {/* Owner motivation — the second axis. The thesis score says whether
                this is the right building; this says whether it can be bought. */}
            {(asset as any).isOffMarket && (() => {
              const sig = (asset as any).offMarketSignals ?? {};
              const m = computeMotivation(sig);
              return (
                <div>
                  <SectionLabel className="mb-4">
                    Owner motivation · {MOTIVATION_BAND_LABEL[m.band]} {m.score}/100
                  </SectionLabel>
                  <p className="font-body-base text-body-base text-ink/85 leading-relaxed mb-4 max-w-[680px]">
                    {m.headline}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {(sig.sources ?? []).map((src: string) => (
                      <span key={src} className="font-eyebrow text-eyebrow px-2 py-0.5 rounded-sm border border-rule text-muted-foreground uppercase tracking-widest">
                        {(RECORD_SOURCE_LABELS as any)[src] ?? src}
                      </span>
                    ))}
                  </div>
                  <div className="divide-y divide-rule border-t border-b border-rule max-w-[680px]">
                    {m.factors.filter((f) => f.present).map((f) => (
                      <div key={f.label} className="py-2.5 flex items-baseline gap-3">
                        <span className="flex-1 font-body-base text-[13px] text-ink">{f.label}</span>
                        <span className="font-data-mono text-[12px] text-amber shrink-0">+{f.points}</span>
                      </div>
                    ))}
                  </div>
                  <p className="font-body-base text-[12px] text-muted-foreground mt-3 max-w-[680px] leading-relaxed">
                    Not for sale. Sourced from public records — confirm current ownership and tax
                    status with the county before any approach.
                  </p>
                </div>
              );
            })()}

            {/* Which theses this asset clears — a fail for one client is a fit
                for another, and that is the whole cross-sell. */}
            {Array.isArray((asset as any).thesisFits) && (asset as any).thesisFits.length > 1 && (
              <div>
                <SectionLabel className="mb-4">Thesis fit · {(asset as any).thesisFits.filter((f: any) => f.fits).length} of {(asset as any).thesisFits.length}</SectionLabel>
                <div className="divide-y divide-rule border-t border-b border-rule max-w-[680px]">
                  {(asset as any).thesisFits.map((f: any) => (
                    <div key={f.thesisId ?? f.thesisName} className="py-3 flex items-start gap-3">
                      {f.fits
                        ? <CheckCircle2 className="w-4 h-4 text-sage shrink-0 mt-0.5" />
                        : <XCircle className="w-4 h-4 text-clay shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-body-base text-body-base text-ink">
                          {f.thesisName}
                          {f.clientLabel && <span className="text-muted-foreground"> · {f.clientLabel}</span>}
                        </p>
                        <p className="font-body-base text-[12px] text-muted-foreground mt-0.5">
                          {f.fits
                            ? `Clears this thesis · ${f.tier} · composite ${f.compositeScore}`
                            : f.reason}
                        </p>
                      </div>
                      <span className="font-data-mono text-[12px] text-muted-foreground shrink-0">{Math.round(f.rankScore)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {diligence.length > 0 && <DiligencePanel items={diligence} classLabel={cls.shortLabel} tutorial={isTutorial} />}

            {narrative && <NarrativePanel narrative={narrative} />}
          </div>

          {/* Action rail */}
          <aside className="lg:col-span-4 space-y-8 lg:sticky lg:top-6 self-start">
            <div className="border border-rule bg-paper p-6 space-y-4">
              <SectionLabel>{isClient ? "Your Move" : "Next Actions"}</SectionLabel>

              {isClient ? (
                <>
                  <button onClick={() => expressInterest.mutate({ assetId: asset.id })}
                    disabled={expressInterest.isPending || interested}
                    className="w-full flex items-center gap-2 border border-rule px-4 py-2.5 font-eyebrow text-eyebrow uppercase tracking-widest hover:border-amber/40 hover:text-amber transition-all disabled:opacity-60">
                    {expressInterest.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 text-sage" />}
                    {interested ? "Interest registered" : "Express interest"}
                  </button>
                  <p className="font-body-base text-[12px] text-muted-foreground leading-relaxed border-t border-rule pt-4">
                    Stage: <span className="text-ink">{currentStatus}</span>. Your analyst maintains this
                    dossier — flag interest and they will follow up with the underwriting pack.
                  </p>
                </>
              ) : (
                <>
                  <button onClick={() => verify.mutate({ id: asset.id })} disabled={verify.isPending}
                    className="w-full flex items-center gap-2 border border-rule px-4 py-2.5 font-eyebrow text-eyebrow uppercase tracking-widest hover:border-amber/40 hover:text-amber transition-all">
                    {verify.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3 text-sage" />}
                    {verify.isPending ? "Checking…" : "Verify listing"}
                  </button>

                  <button onClick={() => enrich.mutate({ id: asset.id })} disabled={enrich.isPending}
                    className="w-full flex items-center gap-2 border border-rule px-4 py-2.5 font-eyebrow text-eyebrow uppercase tracking-widest hover:border-amber/40 hover:text-amber transition-all">
                    {enrich.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3 text-sage" />}
                    {enrich.isPending ? "Checking county…" : "Enrich from county"}
                  </button>

                  <button onClick={() => aiScore.mutate({ id: asset.id })} disabled={aiScore.isPending}
                    className="w-full flex items-center gap-2 border border-rule px-4 py-2.5 font-eyebrow text-eyebrow uppercase tracking-widest hover:border-amber/40 hover:text-amber transition-all">
                    {aiScore.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 text-amber" />}
                    {aiScore.isPending ? "Analyzing…" : "Analyst narrative"}
                  </button>

                  {!cls.promotesToBusinessDeals && (
                    <button
                      onClick={() => { setStatus("qualified"); updateStatus.mutate({ id: asset.id, status: "qualified" }); }}
                      disabled={updateStatus.isPending || currentStatus === "qualified"}
                      className="w-full flex items-center gap-2 border border-rule px-4 py-2.5 font-eyebrow text-eyebrow uppercase tracking-widest hover:border-amber/40 hover:text-amber transition-all disabled:opacity-60">
                      {updateStatus.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 text-sage" />}
                      {currentStatus === "qualified" ? "In diligence" : "Advance to diligence"}
                    </button>
                  )}

                  <div>
                    <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-2 inline-flex items-center gap-1">Stage<Explain k="stage" /></p>
                    <Select
                      value={currentStatus}
                      onValueChange={(next) => { setStatus(next as AssetStatus); updateStatus.mutate({ id: asset.id, status: next as AssetStatus }); }}
                      disabled={updateStatus.isPending}
                    >
                      <SelectTrigger className="h-9 text-xs border-rule bg-transparent"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ASSET_STATUSES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="border-t border-rule pt-4">
                    <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest mb-2">Assign to client</p>
                    <Select
                      value={assignTo}
                      onValueChange={(v) => {
                        setAssignTo(v);
                        assign.mutate({ assetId: asset.id, userId: v === "none" ? null : Number(v) });
                      }}
                      disabled={assign.isPending}
                    >
                      <SelectTrigger className="h-9 text-xs border-rule bg-transparent">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {(clients.data ?? []).map((u: any) => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.name || u.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="font-body-base text-[12px] text-muted-foreground leading-relaxed mt-2">
                      Hand this asset to a client even when it fails your own thesis.
                    </p>
                  </div>

                  {!cls.promotesToBusinessDeals && (
                    <p className="font-body-base text-[12px] text-muted-foreground leading-relaxed border-t border-rule pt-4">
                      {cls.label} assets advance in place. This dossier — scorecard, economics,
                      provenance — is the deal record; there is no separate Deal Room entry.
                    </p>
                  )}
                </>
              )}
            </div>

            {s.verifyFields.length > 0 && <VerifyList s={s} />}

            {has("provenance") && <ProvenancePanel asset={asset} verification={verification} tutorial={isTutorial} />}
          </aside>
        </div>
      </div>
    </Shell>
  );
}

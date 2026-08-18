import { useState } from "react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { isTutorialAsset } from "@shared/tutorial";
import { useAuth } from "@/_core/hooks/useAuth";
import EditorialTopNav from "@/components/EditorialTopNav";
import ScanProgress from "@/components/ScanProgress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  ArrowRight, Trash2, MapPin, ExternalLink,
  Brain, ScanLine, ChevronRight, Activity, Loader2,
} from "lucide-react";

const EASE = [0.16, 1, 0.3, 1] as const;

const fmt = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
};
const elapsed = (d: Date | string | number | null | undefined) => {
  if (!d) return "";
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
const scoreColor = (v: number) =>
  v >= 0.8 ? "text-amber" : v >= 0.65 ? "text-sage" : "text-clay";

const SIG_CFG: Record<string, { label: string; badge: string }> = {
  government_contract: { label: "GOV CONTRACT",   badge: "bg-amber/10 text-amber border-amber/30" },
  demographic_shift:   { label: "DEMOGRAPHIC",    badge: "bg-sage/10 text-sage border-sage/30" },
  infrastructure:      { label: "INFRASTRUCTURE", badge: "bg-ink/10 text-ink/70 border-rule" },
  economic_indicator:  { label: "ECONOMIC",       badge: "bg-clay/10 text-clay border-clay/30" },
  regulatory_change:   { label: "REGULATORY",     badge: "bg-amber/10 text-amber border-amber/30" },
  market_disruption:   { label: "DISRUPTION",     badge: "bg-clay/10 text-clay border-clay/30" },
  other:               { label: "SIGNAL",         badge: "bg-ink/10 text-ink/70 border-rule" },
};

function CoAnalystBanner({ stats, macroPosture }: { stats: any; macroPosture: any }) {
  const h = new Date().getHours();
  const greeting = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
  const directive = stats?.highPriority
    ? `${stats.highPriority} target${stats.highPriority > 1 ? "s" : ""} at high-conviction status. Deployment window open — initiate outreach protocol.`
    : macroPosture?.tailwindCount > 0
    ? `${macroPosture.tailwindCount} active tailwind signal${macroPosture.tailwindCount > 1 ? "s" : ""} detected. Pipeline conditions favorable.`
    : `Good ${greeting}, Lenox. Acquisition intelligence is active. No immediate action required.`;
  return (
    <div className="border-b border-rule bg-amber/5">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-3 flex items-start gap-4">
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          <Brain className="w-3.5 h-3.5 text-amber" />
          <span className="font-eyebrow text-eyebrow text-amber uppercase tracking-widest">Co-Analyst</span>
        </div>
        <span className="w-px h-4 bg-rule shrink-0 mt-0.5" />
        <p className="font-body-base text-body-base text-ink/80 leading-snug">{directive}</p>
      </div>
    </div>
  );
}

function SignalStream() {
  const { isAuthenticated } = useAuth();
  const [openId, setOpenId] = useState<number | null>(null);
  const { data: signals, isLoading, refetch } = trpc.sentinel.list.useQuery(
    { limit: 12 },
    { enabled: isAuthenticated }
  );
  const deleteSignal = trpc.sentinel.delete.useMutation({ onSuccess: () => refetch() });
  const refresh = trpc.sentinel.aiRefresh.useMutation({
    onSuccess: (r: any) => { toast.success(r?.message ?? "Live signals refreshed"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="sticky top-28">
      <div className="flex justify-between items-end mb-8 border-b border-rule pb-4">
        <span className="font-eyebrow text-eyebrow text-ink uppercase tracking-widest">Sentinel Signals</span>
        <div className="flex items-center gap-3">
          <button onClick={() => refresh.mutate({ thesis: "historic" })} disabled={refresh.isPending}
            className="font-eyebrow text-eyebrow text-amber hover:underline uppercase tracking-widest disabled:opacity-50">
            {refresh.isPending ? "Researching…" : "Refresh"}
          </button>
          <span className="w-2 h-2 rounded-full bg-amber animate-pulse" />
          <span className="font-data-mono text-data-mono text-muted-foreground">SONAR</span>
        </div>
      </div>
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-rule bg-paper p-6 animate-pulse">
              <div className="h-3 bg-rule rounded w-1/3 mb-3" />
              <div className="h-5 bg-rule rounded w-3/4 mb-2" />
              <div className="h-3 bg-rule rounded w-1/2" />
            </div>
          ))
        ) : !signals || signals.length === 0 ? (
          <div className="border border-rule bg-paper p-6 text-center">
            <p className="font-eyebrow text-eyebrow text-muted-foreground mb-1">NO LIVE SIGNALS</p>
            <p className="font-body-base text-body-base text-muted-foreground mb-4">Pull current, source-cited market signals via Perplexity sonar-pro.</p>
            <button onClick={() => refresh.mutate({ thesis: "historic" })} disabled={refresh.isPending}
              className="font-eyebrow text-eyebrow text-amber hover:underline uppercase tracking-widest disabled:opacity-50">
              {refresh.isPending ? "Researching…" : "Fetch Live Signals"}
            </button>
          </div>
        ) : (
          signals.map((sig) => {
            const cfg = SIG_CFG[sig.signalType ?? "other"] ?? SIG_CFG["other"];
            const isOpen = openId === sig.id;
            const isHeadwind = (sig as any).direction === "headwind";
            return (
              <motion.div key={sig.id} layout
                className={`group border bg-paper p-6 cursor-pointer transition-shadow hover:shadow-[0_8px_30px_-12px_rgba(15,20,40,0.12)] ${isHeadwind ? "border-clay/30" : "border-rule"}`}
                onClick={() => setOpenId(isOpen ? null : sig.id)}>
                <div className="flex justify-between items-start mb-4">
                  <span className={`font-eyebrow text-eyebrow px-2 py-1 rounded-sm border ${cfg.badge}`}>
                    {cfg.label}{(sig as any).direction && <span className="ml-1">{isHeadwind ? "↓" : "↑"}</span>}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-data-mono text-data-mono text-muted-foreground">{elapsed(sig.createdAt)}</span>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm("Remove this signal?")) deleteSignal.mutate({ id: sig.id }); }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-clay transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <h3 className="font-card-title text-[18px] leading-tight text-ink mb-3 group-hover:text-amber transition-colors">{sig.title}</h3>
                <div className="w-full h-px bg-rule mb-3">
                  <div className="h-px bg-amber" style={{ width: `${Math.round((sig.confidenceScore ?? 0.5) * 100)}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-data-mono text-data-mono text-muted-foreground">{Math.round((sig.confidenceScore ?? 0.5) * 100)}% confidence</span>
                  <div className="flex items-center gap-1 text-ink/60 group-hover:text-amber transition-colors">
                    <span className="font-eyebrow text-eyebrow">DETAILS</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
                {isOpen && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.35, ease: EASE }} className="overflow-hidden">
                    <div className="mt-4 pt-4 border-t border-rule space-y-3">
                      {sig.summary && <p className="font-body-base text-body-base text-ink/80 leading-relaxed">{sig.summary}</p>}
                      {sig.roryPitch && (
                        <div className="border-l-2 border-amber/50 pl-4">
                          <p className="font-eyebrow text-eyebrow text-amber mb-1">LLM THESIS</p>
                          <p className="font-body-base text-body-base text-ink/80 italic">"{sig.roryPitch}"</p>
                        </div>
                      )}
                      {sig.recommendedAction && (
                        <div className="border-l-2 border-sage/50 pl-4">
                          <p className="font-eyebrow text-eyebrow text-sage mb-1">RECOMMENDED ACTION</p>
                          <p className="font-body-base text-body-base text-ink/80">{sig.recommendedAction}</p>
                        </div>
                      )}
                      {sig.sourceUrl && (
                        <a href={sig.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 font-eyebrow text-eyebrow text-amber hover:underline">
                          <ExternalLink className="w-3 h-3" />SOURCE
                        </a>
                      )}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
      {signals && signals.length > 0 && (
        <div className="mt-6 pt-4 border-t border-rule">
          <Link href="/sentinel">
            <div className="flex items-center gap-2 text-ink/60 hover:text-amber transition-colors cursor-pointer">
              <span className="font-eyebrow text-eyebrow uppercase tracking-widest">View All Signals</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}

function DealCard({ deal, rank, onDelete }: { deal: any; rank: number; onDelete: (id: number, name: string) => void }) {
  const score = deal.score != null ? parseFloat(String(deal.score)) : null;
  const isTop = score != null && score >= 0.8;
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: rank * 0.04 }} className="group relative">
      <Link href={`/deal/${deal.id}`}>
        <div className={`border-b border-rule py-8 cursor-pointer transition-colors hover:bg-bone/40 ${isTop ? "border-l-2 border-l-amber pl-6 -ml-6" : ""}`}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
            <div>
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span className="font-eyebrow text-eyebrow text-muted-foreground">{String(rank).padStart(2, "0")}</span>
                {deal.industry && (
                  <span className="font-eyebrow text-eyebrow text-muted-foreground border border-rule px-2 py-0.5 rounded-sm">{deal.industry}</span>
                )}
                {deal.location && (
                  <span className="font-eyebrow text-eyebrow text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5" />{deal.location}
                  </span>
                )}
                {isTop && (
                  <span className="font-eyebrow text-eyebrow text-amber bg-amber/10 border border-amber/30 px-2 py-0.5 rounded-sm">HIGH CONVICTION</span>
                )}
              </div>
              <h3 className="font-card-title text-card-title text-ink group-hover:text-amber transition-colors mb-4 leading-tight">{deal.name}</h3>
              <div className="grid grid-cols-3 gap-8">
                <div>
                  <p className="font-eyebrow text-eyebrow text-muted-foreground mb-1">CASH FLOW</p>
                  <p className="font-data-mono text-[17px] text-ink">{fmt(deal.cashFlow)}</p>
                </div>
                <div>
                  <p className="font-eyebrow text-eyebrow text-muted-foreground mb-1">ASKING</p>
                  <p className="font-data-mono text-[17px] text-ink">{fmt(deal.askingPrice)}</p>
                </div>
                <div>
                  <p className="font-eyebrow text-eyebrow text-muted-foreground mb-1">REVENUE</p>
                  <p className="font-data-mono text-[17px] text-ink">{fmt(deal.revenue)}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3 shrink-0 pt-1">
              {score != null && (
                <div className="text-right">
                  <p className="font-eyebrow text-eyebrow text-muted-foreground mb-1">AI SCORE</p>
                  <p className={`font-data-mono text-section-h2 leading-none ${isTop ? "text-amber" : scoreColor(score)}`}>{score.toFixed(3)}</p>
                </div>
              )}
              <div className="flex items-center gap-1 text-ink/40 group-hover:text-amber transition-colors">
                <span className="font-eyebrow text-eyebrow">REVIEW</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(deal.id, deal.name); }}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute right-0 top-4 z-20 opacity-0 group-hover:opacity-100 p-2 border border-rule bg-paper text-muted-foreground hover:text-clay hover:border-clay/40 hover:bg-clay/5 rounded-sm transition-all shadow-sm"
        title="Remove deal">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

function HistoricPipeline() {
  const { isAuthenticated } = useAuth();
  const { data } = trpc.scout.search.useQuery({}, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  // Filter to only show genuine historic/Wingate-eligible assets on the home dashboard
  const allResults = ((data as any)?.results ?? []) as any[];
  const results = allResults.filter((a: any) => a.isHistoric || a.historicRegisterEligible || a.isStabilized);
  const [sortBy, setSortBy] = useState<"rank" | "composite" | "asking" | "confidence">("rank");
  if (!results.length) return null;
  const tierLabel: Record<string, string> = { tier1: "Tier 1", fasttrack: "Fast-Track", tier2: "Tier 2", tier3: "Tier 3", archive: "Archive" };
  const tierColor: Record<string, string> = {
    tier1: "text-amber",
    fasttrack: "text-amber",
    tier2: "text-violet-500",
    tier3: "text-sky-500",
    archive: "text-muted-foreground",
  };
  const tierBarColor: Record<string, string> = {
    amber: "bg-amber",
    violet: "bg-violet-500",
    sky: "bg-sky-500",
    muted: "bg-muted-foreground",
  };
  // Tutorial record excluded from the value bar — it is a worked example, not
  // inventory — but still shown as a card, pinned first for first-run users.
  const realResults = results.filter((a: any) => !isTutorialAsset(a));
  const pipelineBuckets = [
    { key: "amber", label: "Tier 1 + Fast-Track", value: realResults.reduce((sum, a) => sum + (a.historicScore.assetTier === "tier1" || a.historicScore.assetTier === "fasttrack" ? (a.askingPrice ?? 0) : 0), 0) },
    { key: "violet", label: "Tier 2", value: realResults.reduce((sum, a) => sum + (a.historicScore.assetTier === "tier2" ? (a.askingPrice ?? 0) : 0), 0) },
    { key: "sky", label: "Tier 3", value: realResults.reduce((sum, a) => sum + (a.historicScore.assetTier === "tier3" ? (a.askingPrice ?? 0) : 0), 0) },
    { key: "muted", label: "Archive", value: realResults.reduce((sum, a) => sum + (a.historicScore.assetTier === "archive" ? (a.askingPrice ?? 0) : 0), 0) },
  ];
  const pipelineTotal = pipelineBuckets.reduce((sum, bucket) => sum + bucket.value, 0);
  const sortedResults = [...results].sort((a, b) => {
    // Tutorial always leads — it is the first-run walkthrough.
    const at = isTutorialAsset(a as any), bt = isTutorialAsset(b as any);
    if (at !== bt) return at ? -1 : 1;
    if (sortBy === "asking") {
      if (a.askingPrice == null) return b.askingPrice == null ? 0 : 1;
      if (b.askingPrice == null) return -1;
      return b.askingPrice - a.askingPrice;
    }
    const aScore = a.historicScore;
    const bScore = b.historicScore;
    if (sortBy === "composite") return bScore.compositeScore - aScore.compositeScore;
    if (sortBy === "confidence") return bScore.confidenceScore - aScore.confidenceScore;
    return bScore.rankScore - aScore.rankScore;
  });
  return (
    <section className="mb-12 border border-rule bg-paper p-6">
      <div className="flex items-center justify-between gap-4 mb-4 border-b border-rule pb-3">
        <span className="font-eyebrow text-eyebrow text-ink uppercase tracking-widest">Historic Pipeline · Wingate</span>
        <div className="flex items-center gap-4 shrink-0">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
            <SelectTrigger className="h-7 w-[108px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rank">Rank</SelectItem>
              <SelectItem value="composite">Composite</SelectItem>
              <SelectItem value="asking">Asking</SelectItem>
              <SelectItem value="confidence">Confidence</SelectItem>
            </SelectContent>
          </Select>
          <Link href="/wingate">
            <span className="flex items-center gap-1 font-eyebrow text-eyebrow text-amber hover:underline uppercase tracking-widest cursor-pointer">
              Open Command <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        </div>
      </div>
      {pipelineTotal > 0 && (
        <div className="mb-5">
          <div className="flex h-2 overflow-hidden rounded bg-rule">
            {pipelineBuckets.map((bucket) => (
              <div key={bucket.key} className={tierBarColor[bucket.key]} style={{ width: `${(bucket.value / pipelineTotal) * 100}%` }} />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              {pipelineBuckets.map((bucket) => (
                <span key={bucket.key} className="flex items-center gap-1 font-data-mono text-data-mono text-muted-foreground">
                  <span className={`w-1.5 h-1.5 rounded-full ${tierBarColor[bucket.key]}`} />
                  {bucket.label} {fmt(bucket.value)}
                </span>
              ))}
            </div>
            <span className="font-data-mono text-data-mono text-ink">Total {fmt(pipelineTotal)}</span>
          </div>
        </div>
      )}
      <TooltipProvider>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {sortedResults.slice(0, 6).map((a: any) => {
            const s = a.historicScore;
            const tier = tierLabel[s.assetTier] ?? s.assetTier;
            return (
              <Link key={a.id} href={`/wingate/asset/${a.id}`}>
                <Tooltip>
                <TooltipTrigger asChild>
                    <div className="border border-rule p-4 hover:shadow-[0_8px_30px_-12px_rgba(15,20,40,0.12)] transition-shadow cursor-pointer h-full">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`font-data-mono text-data-mono font-bold ${tierColor[s.assetTier] ?? "text-muted-foreground"}`}>{Math.round(s.rankScore)}</span>
                        <span className={`font-eyebrow text-eyebrow uppercase ${tierColor[s.assetTier] ?? "text-muted-foreground"}`}>{tier}</span>
                      </div>
                      <p className="font-card-title text-[15px] text-ink leading-tight truncate">{a.name}</p>
                      <p className="font-data-mono text-data-mono text-muted-foreground mt-0.5">{a.city}, {a.state} · C{s.compositeScore} · {Math.round(s.confidenceScore * 100)}%✓{s.verifyFields.length ? ` · ${s.verifyFields.length} verify` : ""}</p>
                    </div>
                </TooltipTrigger>
                <TooltipContent className="space-y-1">
                  <p className="font-eyebrow text-eyebrow">{tier} · rank {String(Math.round(s.rankScore)).padStart(2, "0")} · {a.city}, {a.state}</p>
                  <p className="font-data-mono text-data-mono">Composite {s.compositeScore} · Confidence {Math.round(s.confidenceScore * 100)}%</p>
                  <p className="font-data-mono text-data-mono">Cap rate {a.capRate == null ? "—" : `${(a.capRate * 100).toFixed(1)}%`} · Year built {a.yearBuilt ?? "—"}</p>
                  <p className="font-data-mono text-data-mono">{s.verifyFields.length} fields to verify</p>
                </TooltipContent>
                </Tooltip>
              </Link>
            );
          })}
        </div>
      </TooltipProvider>
    </section>
  );
}

export default function Home() {
  const [activeScanJobId, setActiveScanJobId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: macroPosture } = trpc.dashboard.macroPosture.useQuery();
  const { data: topDealsData } = trpc.deals.list.useQuery({ limit: 10 });
  const { data: savedTheses } = trpc.thesis.list.useQuery(undefined, { enabled: isAuthenticated });
  const deleteDeal = trpc.deals.delete.useMutation({
    onSuccess: () => { toast.success("Deal removed"); utils.deals.list.invalidate(); utils.dashboard.stats.invalidate(); },
    onError: (e) => toast.error(`Delete failed: ${e.message}`),
  });
  const triggerScan = trpc.scan.trigger.useMutation({
    onSuccess: (d) => { toast.success(d.message); if (d.jobId) setActiveScanJobId(d.jobId); },
    onError: (e) => toast.error(`Scan failed: ${e.message}`),
  });
  const stats = data?.dealStats;
  const deals = (() => {
    if (!topDealsData) return topDealsData;
    const seen = new Map<string, any>();
    for (const deal of topDealsData) {
      const key = deal.name.trim().toLowerCase();
      const existing = seen.get(key);
      if (!existing || (deal.score ?? 0) > (existing.score ?? 0)) seen.set(key, deal);
    }
    return Array.from(seen.values());
  })();
  const linkedAcquisitionSearch = savedTheses?.find((thesis: any) =>
    thesis.scanJobId && thesis.templateUsed !== "capital_trade" &&
    !(thesis.templateUsed === "wingate" || thesis.compiledFilters?.yearBuiltMax != null),
  );
  const visibleScanJobId = activeScanJobId ?? linkedAcquisitionSearch?.scanJobId ?? null;

  return (
    <EditorialTopNav>
      <CoAnalystBanner stats={stats} macroPosture={macroPosture} />
      <main className="max-w-[1280px] mx-auto w-full px-6 lg:px-10 py-12">

        {/* ── Operator pulse: the work that needs attention, not a static mood ── */}
        <header className="mb-8 border-b border-rule pb-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">SIGNAL HUNTER OS</span>
                <span className="w-5 h-px bg-rule" />
                <span className="font-eyebrow text-eyebrow text-ink border border-rule px-2 py-1 rounded-sm">COMMAND CENTER</span>
              </div>
              <h1 className="font-card-title text-[clamp(1.75rem,4vw,2.5rem)] leading-none text-ink">Your operator pulse</h1>
              <p className="mt-2 max-w-2xl font-body-base text-body-base text-ink/70">
                {isLoading ? "Loading the work that needs review…" : stats?.highPriority
                  ? `${stats.highPriority} high-priority target${stats.highPriority === 1 ? " needs" : "s need"} human review before outreach.`
                  : `${stats?.total ?? 0} active targets · ${macroPosture?.tailwindCount ?? 0} current tailwind signal${(macroPosture?.tailwindCount ?? 0) === 1 ? "" : "s"} · choose the next research action below.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Link href="/aperture/runs"><span className="inline-flex items-center gap-1.5 border border-rule bg-paper px-3 py-2 font-eyebrow text-eyebrow text-ink hover:border-amber hover:text-amber cursor-pointer">Research journeys <ArrowRight className="w-3 h-3" /></span></Link>
              <button onClick={() => triggerScan.mutate({})} disabled={triggerScan.isPending}
                className="flex items-center gap-2 bg-ink text-bone font-eyebrow text-eyebrow px-4 py-2 hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {triggerScan.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanLine className="w-3 h-3" />}
                {triggerScan.isPending ? "SCANNING…" : "RUN SCAN"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-5 border-t border-rule pt-5 mt-5">
            {[
              { label: "PIPELINE VALUE", value: fmt(stats?.totalPipelineValue) },
              { label: "ACTIVE DEALS",   value: isLoading ? "—" : String(stats?.total ?? 0) },
              { label: "AVG SCORE",      value: stats?.avgScore != null ? parseFloat(String(stats.avgScore)).toFixed(3) : "—" },
              { label: "HIGH PRIORITY",  value: isLoading ? "—" : String(stats?.highPriority ?? 0) },
            ].map((item, i) => (
              <div key={i}>
                <p className="font-eyebrow text-eyebrow text-muted-foreground mb-2 uppercase tracking-widest">{item.label}</p>
                <p className="font-data-mono text-[clamp(1.45rem,3vw,2rem)] text-ink leading-none">{item.value}</p>
              </div>
            ))}
          </div>
        </header>

        <HistoricPipeline />

        {visibleScanJobId !== null && (
          <div className="mb-8">
            {linkedAcquisitionSearch && (
              <div className="mb-3 flex flex-col gap-1 border-l-2 border-amber pl-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Thesis-linked acquisition search</p>
                  <p className="font-card-title text-[16px] text-ink">{linkedAcquisitionSearch.name ?? "Untitled acquisition thesis"}</p>
                </div>
                <Link href="/thesis"><span className="font-eyebrow text-eyebrow text-amber hover:underline">Open thesis workspace →</span></Link>
              </div>
            )}
            <ScanProgress jobId={visibleScanJobId} onComplete={() => {
              setActiveScanJobId(null);
              utils.deals.list.invalidate();
              utils.dashboard.stats.invalidate();
            }} />
          </div>
        )}

        {/* ── 12-col editorial grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* LEFT: Deal feed — col-span-8 */}
          <div className="lg:col-span-8">
            <div className="flex items-end justify-between mb-8 border-b border-rule pb-4">
              <span className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">Validation Queue — High Conviction</span>
              <Link href="/scan">
                <div className="flex items-center gap-1 text-ink/50 hover:text-amber transition-colors cursor-pointer">
                  <span className="font-eyebrow text-eyebrow uppercase tracking-widest">All Deals</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </Link>
            </div>
            {isLoading ? (
              <div className="space-y-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="border-b border-rule py-8 animate-pulse">
                    <div className="h-3 bg-rule rounded w-1/4 mb-3" />
                    <div className="h-7 bg-rule rounded w-2/3 mb-4" />
                    <div className="grid grid-cols-3 gap-8">{[0,1,2].map(j => <div key={j} className="h-5 bg-rule rounded" />)}</div>
                  </div>
                ))}
              </div>
            ) : !deals || deals.length === 0 ? (
              <div className="border border-rule bg-paper p-12 text-center">
                <p className="font-eyebrow text-eyebrow text-muted-foreground mb-4">NO TARGETS IN VALIDATION QUEUE</p>
                <button onClick={() => triggerScan.mutate({})} disabled={triggerScan.isPending} className="font-eyebrow text-eyebrow text-amber hover:underline uppercase tracking-widest">
                  {triggerScan.isPending ? "Scanning…" : "Run Target Scan"}
                </button>
              </div>
            ) : (
              <div>
                {deals.map((deal, i) => (
                  <DealCard key={deal.id} deal={deal} rank={i + 1} onDelete={(id, name) => {
                    if (confirm(`Remove "${name}" from the pipeline? This cannot be undone.`)) deleteDeal.mutate({ id });
                  }} />
                ))}
              </div>
            )}
            {deals && deals.length > 0 && (
              <div className="mt-10 pt-8 border-t border-rule flex items-center justify-between">
                <div>
                  <p className="font-eyebrow text-eyebrow text-muted-foreground mb-1">LOGICAL NEXT</p>
                  <p className="font-card-title text-[22px] text-ink leading-tight">
                    {stats?.highPriority ? "Initiate outreach on validated targets" : "Populate the validation queue — run a target scan"}
                  </p>
                </div>
                <Link href={stats?.highPriority ? "/outreach" : "/scan"}>
                  <div className="flex items-center gap-2 bg-ink text-bone font-eyebrow text-eyebrow px-5 py-2.5 rounded-full hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer">
                    {stats?.highPriority ? "Start Outreach" : "Run Scan"}
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
              </div>
            )}
            {data?.recentActivity && data.recentActivity.length > 0 && (
              <div className="mt-14 pt-8 border-t border-rule">
                <div className="flex items-center gap-2 mb-6">
                  <Activity className="w-3 h-3 text-muted-foreground" />
                  <span className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">System Log</span>
                </div>
                <div className="space-y-3">
                  {data.recentActivity.slice(0, 5).map((act: any, i: number) => (
                    <div key={i} className="flex items-start gap-4 py-3 border-b border-rule last:border-0">
                      <span className="font-data-mono text-data-mono text-muted-foreground shrink-0 mt-0.5">{elapsed(act.createdAt)}</span>
                      <p className="font-body-base text-body-base text-ink/70">{act.description ?? act.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Signal Stream — col-span-4 */}
          <div className="lg:col-span-4 lg:border-l lg:border-rule lg:pl-12">
            <SignalStream />
          </div>
        </div>
      </main>
    </EditorialTopNav>
  );
}

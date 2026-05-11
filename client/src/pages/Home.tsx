import { useState } from "react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import EditorialTopNav from "@/components/EditorialTopNav";
import ScanProgress from "@/components/ScanProgress";
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
  const seed = trpc.sentinel.seed.useMutation({ onSuccess: () => { refetch().catch(console.error); } });
  const seedSignals = () => seed.mutate(undefined as any);
  const deleteSignal = trpc.sentinel.delete.useMutation({ onSuccess: () => refetch() });

  return (
    <div className="sticky top-28">
      <div className="flex justify-between items-end mb-8 border-b border-rule pb-4">
        <span className="font-eyebrow text-eyebrow text-ink uppercase tracking-widest">Sentinel Signals</span>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber animate-pulse" />
          <span className="font-data-mono text-data-mono text-muted-foreground">LIVE</span>
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
            <p className="font-eyebrow text-eyebrow text-muted-foreground mb-4">NO SIGNALS ACTIVE</p>
            <button onClick={() => seedSignals()} disabled={seed.isPending}
              className="font-eyebrow text-eyebrow text-amber hover:underline uppercase tracking-widest">
              {seed.isPending ? "Seeding…" : "Seed Intelligence"}
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
      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(deal.id, deal.name); }}
        className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 border border-rule bg-paper text-muted-foreground hover:text-clay hover:border-clay/40 rounded-sm transition-all"
        title="Remove deal">
        <Trash2 className="w-3 h-3" />
      </button>
    </motion.div>
  );
}

export default function Home() {
  const [activeScanJobId, setActiveScanJobId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: macroPosture } = trpc.dashboard.macroPosture.useQuery();
  const { data: topDealsData } = trpc.deals.list.useQuery({ limit: 10 });
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

  return (
    <EditorialTopNav>
      <CoAnalystBanner stats={stats} macroPosture={macroPosture} />
      <main className="max-w-[1280px] mx-auto w-full px-6 lg:px-10 py-12">

        {/* ── Page Hero ─────────────────────────────────────────────────────── */}
        <header className="mb-16 border-b border-rule pb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">SIGNAL HUNTER OS</span>
                <span className="w-8 h-px bg-rule" />
                <span className="font-eyebrow text-eyebrow text-ink border border-rule px-2 py-1 rounded-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber animate-pulse" />
                  COMMAND CENTER
                </span>
              </div>
              <h1 className="font-hero-h1 text-hero-h1 text-ink max-w-3xl mb-4 leading-[1.05]">
                System Status: {isLoading ? "—" : (macroPosture?.posture ?? "Active")}
              </h1>
              {macroPosture?.topSignals && macroPosture.topSignals.length > 0 && (
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  <span className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">TIDE</span>
                  <span className="w-px h-3 bg-rule" />
                  <div className="flex gap-6 flex-wrap">
                    {macroPosture.topSignals.map((sig: any) => (
                      <div key={sig.id} className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${sig.direction === "headwind" ? "bg-clay" : "bg-sage"}`} />
                        <span className="font-body-base text-[13px] text-ink/70">
                          {sig.title.length > 55 ? sig.title.slice(0, 55) + "…" : sig.title}
                        </span>
                        <span className={`font-data-mono text-data-mono ${sig.direction === "headwind" ? "text-clay" : "text-sage"}`}>
                          {Math.round((sig.confidenceScore ?? 0.5) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-4 shrink-0">
              <div className="flex items-center gap-2 border border-rule bg-paper px-4 py-2 rounded-full">
                <span className="w-2 h-2 rounded-full bg-amber animate-pulse" />
                <span className="font-eyebrow text-eyebrow text-ink tracking-widest">{macroPosture?.posture ?? "ACTIVE"}</span>
              </div>
              <button onClick={() => triggerScan.mutate({})} disabled={triggerScan.isPending}
                className="flex items-center gap-2 bg-ink text-bone font-eyebrow text-eyebrow px-5 py-2.5 rounded-full hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {triggerScan.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanLine className="w-3 h-3" />}
                {triggerScan.isPending ? "SCANNING…" : "RUN SCAN"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-rule pt-8 mt-8">
            {[
              { label: "PIPELINE VALUE", value: fmt(stats?.totalPipelineValue) },
              { label: "ACTIVE DEALS",   value: isLoading ? "—" : String(stats?.total ?? 0) },
              { label: "AVG SCORE",      value: stats?.avgScore != null ? parseFloat(String(stats.avgScore)).toFixed(3) : "—" },
              { label: "HIGH PRIORITY",  value: isLoading ? "—" : String(stats?.highPriority ?? 0) },
            ].map((item, i) => (
              <div key={i}>
                <p className="font-eyebrow text-eyebrow text-muted-foreground mb-2 uppercase tracking-widest">{item.label}</p>
                <p className="font-data-mono text-section-h2 text-ink leading-none">{item.value}</p>
              </div>
            ))}
          </div>
        </header>

        {activeScanJobId !== null && (
          <div className="mb-8">
            <ScanProgress jobId={activeScanJobId} onComplete={() => {
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
              <span className="font-eyebrow text-eyebrow text-muted-foreground uppercase tracking-widest">High-Priority Intelligence Feed</span>
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
                <p className="font-eyebrow text-eyebrow text-muted-foreground mb-4">NO DEALS IN PIPELINE</p>
                <button onClick={() => triggerScan.mutate({})} disabled={triggerScan.isPending} className="font-eyebrow text-eyebrow text-amber hover:underline uppercase tracking-widest">
                  {triggerScan.isPending ? "Scanning…" : "Run Market Scan"}
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
                    {stats?.highPriority ? "Initiate outreach on top-scored targets" : "Run a market scan to surface new opportunities"}
                  </p>
                </div>
                <Link href={stats?.highPriority ? "/outreach" : "/scan"}>
                  <div className="flex items-center gap-2 bg-ink text-bone font-eyebrow text-eyebrow px-5 py-2.5 rounded-full hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer">
                    {stats?.highPriority ? "Start Outreach" : "Market Scan"}
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

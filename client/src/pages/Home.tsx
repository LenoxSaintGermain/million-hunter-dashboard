import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import ScanProgress from "@/components/ScanProgress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  TrendingUp, DollarSign, Activity, ArrowUpRight,
  Zap, Brain, RefreshCw, ChevronRight,
  Building2, MapPin, Clock, AlertCircle,
  Landmark, CalendarDays, BarChart2, Megaphone, Waves,
  ExternalLink, Loader2,
} from "lucide-react";

function KpiCard({ label, value, sub, icon: Icon, trend }: {
  label: string; value: string; sub?: string; icon: React.ElementType; trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {sub && (
          <p className={cn("text-xs mt-1 flex items-center gap-1",
            trend === "up" ? "text-emerald-500" : trend === "down" ? "text-destructive" : "text-muted-foreground"
          )}>
            {trend === "up" && <ArrowUpRight className="w-3 h-3" />}
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreBadge({ score }: { score: any }) {
  const v = score == null ? null : parseFloat(String(score));
  if (v == null || isNaN(v)) return <span className="text-xs text-muted-foreground font-mono">—</span>;
  const color = v >= 0.8 ? "text-emerald-500" : v >= 0.65 ? "text-amber-500" : "text-muted-foreground";
  return <span className={cn("text-sm font-bold font-mono", color)}>{v.toFixed(3)}</span>;
}

// ─── Signal type config ──────────────────────────────────────────────────────
const SIGNAL_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  institutional: { icon: Landmark, color: "bg-violet-500/15 text-violet-400 border-violet-500/20", label: "Institutional" },
  government:    { icon: Megaphone, color: "bg-blue-500/15 text-blue-400 border-blue-500/20", label: "Government" },
  seasonal:      { icon: CalendarDays, color: "bg-amber-500/15 text-amber-400 border-amber-500/20", label: "Seasonal" },
  event:         { icon: Zap, color: "bg-pink-500/15 text-pink-400 border-pink-500/20", label: "Event" },
  macro_momentum:{ icon: Waves, color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", label: "Macro" },
};

function ConfidenceBar({ score }: { score: any }) {
  const v = score == null ? null : parseFloat(String(score));
  if (v == null || isNaN(v)) return null;
  const pct = Math.round(v * 100);
  const color = pct >= 85 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-muted-foreground";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground font-mono shrink-0">{pct}%</span>
    </div>
  );
}

function SentinelPanel() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const { data: signals, isLoading, refetch } = trpc.sentinel.list.useQuery({ limit: 10 });
  const seed = trpc.sentinel.seed.useMutation({
    onSuccess: (r) => {
      if (r.seeded) {
        toast.success(`Sentinel seeded with ${r.count} signals`);
        refetch();
      }
    },
  });

  const aiRefresh = trpc.sentinel.aiRefresh.useMutation({
    onSuccess: (r) => {
      toast.success(`${r.message}`);
      refetch();
    },
    onError: (e) => toast.error(`Refresh failed: ${e.message}`),
  });

  // Auto-seed on first load if empty
  const [autoSeeded, setAutoSeeded] = useState(false);
  useEffect(() => {
    if (!isLoading && signals?.length === 0 && !autoSeeded && !seed.isPending) {
      setAutoSeeded(true);
      seed.mutate();
    }
  }, [isLoading, signals, autoSeeded, seed]);

  const elapsed = (ts: number) => {
    const m = Math.round((Date.now() - ts) / 60000);
    return m < 1 ? "just now" : m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
  };

  return (
    <Card className="lg:col-span-2 bg-card border-border flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-3.5 h-3.5 text-primary" />
            <CardTitle className="text-sm font-semibold">Macro Signals Sentinel</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
              onClick={() => aiRefresh.mutate()}
              disabled={aiRefresh.isPending}
            >
              {aiRefresh.isPending
                ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                : <RefreshCw className="w-2.5 h-2.5" />}
              {aiRefresh.isPending ? "Scanning..." : "Refresh"}
            </Button>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-500 font-medium">Live</span>
          </div>
        </div>
        <CardDescription className="text-xs">Institutional moves, permits, events &amp; macro tailwinds</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto max-h-[480px] space-y-2 pr-1">
        {isLoading || seed.isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-muted/10 space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-1.5 w-1/2" />
              </div>
            ))}
          </div>
        ) : !signals?.length ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Waves className="w-8 h-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground">No signals yet</p>
          </div>
        ) : (
          [...signals]
            .sort((a, b) => (parseFloat(String(b.confidenceScore ?? 0)) || 0) - (parseFloat(String(a.confidenceScore ?? 0)) || 0))
            .map((sig) => {
            const cfg = SIGNAL_CONFIG[sig.signalType] ?? SIGNAL_CONFIG.macro_momentum;
            const Icon = cfg.icon;
            const isOpen = expanded === sig.id;
            const isHighUrgency = (parseFloat(String(sig.confidenceScore ?? 0)) || 0) >= 0.88;
            return (
              <div
                key={sig.id}
                className={cn(
                  "rounded-lg border transition-all duration-200 cursor-pointer",
                  isHighUrgency ? "border-rose-500/30 bg-rose-500/5" : isOpen ? "border-primary/30 bg-primary/5" : "border-border bg-muted/10 hover:border-primary/20 hover:bg-muted/20"
                )}
                onClick={() => setExpanded(isOpen ? null : sig.id)}
              >
                <div className="p-3">
                  <div className="flex items-start gap-2.5">
                    <div className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 border", cfg.color)}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground leading-snug line-clamp-2">{sig.title}</p>
                          {isHighUrgency && (
                            <span className="inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0 h-4 rounded text-[9px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/25">
                              ⚡ High Urgency
                            </span>
                          )}
                        </div>
                        <span className={cn("inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ml-1", cfg.color)}>
                          {cfg.label}
                        </span>
                      </div>
                      <ConfidenceBar score={sig.confidenceScore} />
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {elapsed(sig.createdAt)}
                        {sig.impactedAssetClasses && sig.impactedAssetClasses.length > 0 && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span>{sig.impactedAssetClasses.slice(0, 2).join(", ")}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                      <p className="text-xs text-muted-foreground leading-relaxed">{sig.summary}</p>
                      {sig.roryPitch && (
                        <div className="p-2 rounded-lg bg-primary/8 border border-primary/15">
                          <p className="text-[10px] text-primary/70 font-medium mb-1 uppercase tracking-wide">Signal Insight</p>
                          <p className="text-xs text-foreground italic leading-relaxed">"{sig.roryPitch}"</p>
                        </div>
                      )}
                      {sig.recommendedAction && (
                        <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                          <p className="text-[10px] text-emerald-400 font-medium mb-1 uppercase tracking-wide">Recommended Action</p>
                          <p className="text-xs text-foreground leading-relaxed">{sig.recommendedAction}</p>
                        </div>
                      )}
                      {sig.sourceUrl && (
                        <a
                          href={sig.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          Source
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [activeScanJobId, setActiveScanJobId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { data, isLoading, refetch } = trpc.dashboard.stats.useQuery();
  const { data: topDealsData } = trpc.deals.list.useQuery({ limit: 5 });
  const triggerScan = trpc.scan.trigger.useMutation({
    onSuccess: (d) => {
      toast.success(d.message);
      if (d.jobId) setActiveScanJobId(d.jobId);
    },
    onError: (e) => toast.error(`Scan failed: ${e.message}`),
  });

  const fmt = (n: number | null | undefined) => {
    if (n == null) return "—";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
    return `$${n}`;
  };

  const activityIcon: Record<string, React.ElementType> = {
    deal_added: Building2,
    deal_scored: Zap,
    signal_analyzed: Brain,
    red_flag_detected: AlertCircle,
    memo_generated: Activity,
    outreach_sent: ArrowUpRight,
    scan_completed: RefreshCw,
    stage_changed: ChevronRight,
  };

  const activityColor: Record<string, string> = {
    deal_added: "bg-blue-500/20 text-blue-400",
    deal_scored: "bg-amber-500/20 text-amber-400",
    signal_analyzed: "bg-purple-500/20 text-purple-400",
    red_flag_detected: "bg-destructive/20 text-destructive",
    memo_generated: "bg-primary/20 text-primary",
    outreach_sent: "bg-emerald-500/20 text-emerald-400",
    scan_completed: "bg-blue-500/20 text-blue-400",
    stage_changed: "bg-muted/60 text-muted-foreground",
  };

  const stats = data?.dealStats;
  const outStats = data?.outreachStats;

  return (
    <DashboardLayout>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-emerald-500 font-medium">System Operational</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Signal Hunter Command Center</h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              {data?.latestScan
                ? `Last scan: ${new Date(data.latestScan.createdAt).toLocaleString()} · ${(data.latestScan.sources as string[] | null)?.length ?? 0} platforms`
                : "No scan data yet. Trigger a market scan to begin."}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs border-border"
              onClick={() => triggerScan.mutate({})}
              disabled={triggerScan.isPending || activeScanJobId !== null}
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", triggerScan.isPending && "animate-spin")} />
              {triggerScan.isPending ? "Starting..." : activeScanJobId ? "Scan Running..." : "Run Market Scan"}
            </Button>
            <Link href="/scan">
              <Button size="sm" className="h-9 text-xs">
                <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                View Pipeline
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Scan Progress Panel */}
      {activeScanJobId !== null && (
        <ScanProgress
          jobId={activeScanJobId}
          onComplete={() => {
            setActiveScanJobId(null);
            refetch();
            utils.deals.list.invalidate();
            utils.dashboard.stats.invalidate();
          }}
          onRetry={() => {
            setActiveScanJobId(null);
            triggerScan.mutate({});
          }}
        />
      )}

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Pipeline Value"
            value={fmt(stats?.totalPipelineValue)}
            sub={`${stats?.total ?? 0} active deals`}
            icon={DollarSign}
            trend="up"
          />
          <KpiCard
            label="Avg. Deal Score"
            value={stats?.avgScore != null ? parseFloat(String(stats.avgScore)).toFixed(3) : '—'}
            sub="across qualified deals"
            icon={TrendingUp}
            trend="up"
          />
          <KpiCard
            label="High Priority"
            value={String(stats?.highPriority ?? 0)}
            sub="deals ready for outreach"
            icon={Zap}
            trend={stats?.highPriority ? "up" : "neutral"}
          />
          <KpiCard
            label="Outreach Active"
            value={String(outStats?.totalSent ?? 0)}
            sub={`${outStats?.responded ?? 0} responded`}
            icon={Activity}
            trend={outStats?.responded ? "up" : "neutral"}
          />
        </div>
      )}

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Top Opportunities */}
        <Card className="lg:col-span-5 bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-semibold">Top Opportunities</CardTitle>
              <CardDescription className="text-xs">Ranked by AI scoring algorithm</CardDescription>
            </div>
            <Link href="/scan">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
                View all <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : !topDealsData?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="w-10 h-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No deals yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Run a market scan to populate the pipeline</p>
              </div>
            ) : (
              <div className="space-y-1">
                {(topDealsData ?? []).map((deal) => (
                  <Link key={deal.id} href={`/deal/${deal.id}`}>
                    <div className="group flex items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {deal.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {deal.location && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="w-2.5 h-2.5" />{deal.location}
                            </span>
                          )}
                          {deal.industry && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{deal.industry}</Badge>
                          )}
                          {deal.opportunityZone && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0 h-4 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                              OZ
                            </span>
                          )}
                          {deal.tadDistrict && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0 h-4 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                              TAD
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 text-right">
                        <div>
                          <p className="text-xs text-muted-foreground">Cash Flow</p>
                          <p className="text-xs font-semibold text-emerald-500">{fmt(deal.cashFlow)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Score</p>
                          <ScoreBadge score={deal.score} />
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Macro Signals Sentinel */}
        <SentinelPanel />
      </div>
    </DashboardLayout>
  );
}

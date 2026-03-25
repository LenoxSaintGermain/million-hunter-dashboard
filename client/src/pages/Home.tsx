import { trpc } from "@/lib/trpc";
import { useState } from "react";
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

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-xs text-muted-foreground font-mono">—</span>;
  const color = score >= 0.8 ? "text-emerald-500" : score >= 0.65 ? "text-amber-500" : "text-muted-foreground";
  return <span className={cn("text-sm font-bold font-mono", color)}>{score.toFixed(3)}</span>;
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
            value={stats?.avgScore != null ? stats.avgScore.toFixed(3) : '—'}
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
                        <div className="flex items-center gap-2 mt-0.5">
                          {deal.location && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="w-2.5 h-2.5" />{deal.location}
                            </span>
                          )}
                          {deal.industry && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{deal.industry}</Badge>
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

        {/* Live Feed */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Live Feed</CardTitle>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <CardDescription className="text-xs">Real-time system events</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : !data?.recentActivity?.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="w-8 h-8 text-muted-foreground/20 mb-2" />
                <p className="text-xs text-muted-foreground">No activity yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.recentActivity.map((event) => {
                  const Icon = activityIcon[event.type] ?? Activity;
                  const colorClass = activityColor[event.type] ?? "bg-muted/60 text-muted-foreground";
                  const elapsed = Math.round((Date.now() - new Date(event.createdAt).getTime()) / 60000);
                  return (
                    <div key={event.id} className="flex gap-2.5 items-start">
                      <div className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5", colorClass)}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground leading-snug">{event.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {elapsed < 1 ? "just now" : elapsed < 60 ? `${elapsed}m ago` : `${Math.round(elapsed / 60)}h ago`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

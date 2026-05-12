import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Lock,
  Clock,
  Building2,
  MapPin,
  Users,
  Calendar,
  DollarSign,
  BarChart3,
  AlertTriangle,
  Zap,
  ChevronRight,
  Eye,
  Shield,
} from "lucide-react";

// ─── Formatting helpers ───────────────────────────────────────────────────────
function fmt$(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 75 ? "bg-emerald-500" : pct >= 55 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-[var(--sh-fg-3)] uppercase tracking-wide">{label}</span>
        <span className="font-mono font-semibold text-[var(--ink)]">{pct}</span>
      </div>
      <div className="h-1.5 w-full bg-[var(--bone)] rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Empty / Loading states ───────────────────────────────────────────────────
function EmptyState({ isOperator, onRefresh, isRefreshing }: { isOperator: boolean; onRefresh: () => void; isRefreshing: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--bone)] flex items-center justify-center mb-6">
        <Eye className="w-7 h-7 text-[var(--sh-fg-3)]" />
      </div>
      <h2 className="text-xl font-bold text-[var(--ink)] mb-2" style={{ fontFamily: "var(--font-serif)" }}>
        No Live Scenario Yet
      </h2>
      <p className="text-[var(--sh-fg-3)] text-sm max-w-sm mb-8">
        The operator hasn't published a live thesis scenario yet. Check back soon — or if you're the operator, generate one now.
      </p>
      {isOperator && (
        <Button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="bg-[var(--ink)] text-[var(--bone)] hover:opacity-90 rounded-full px-6"
        >
          {isRefreshing ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Generating…</>
          ) : (
            <><Zap className="w-4 h-4 mr-2" />Generate First Scenario</>
          )}
        </Button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DemoScenario() {
  const { isAuthenticated, user } = useAuth();
  const isOperator = isAuthenticated && (user as any)?.role !== "investor";

  const { data: scenario, isLoading, refetch } = trpc.demo.getActive.useQuery(undefined, {
    staleTime: 1000 * 60 * 5, // 5 min cache
  });

  const refreshMutation = trpc.demo.refresh.useMutation({
    onSuccess: () => refetch(),
  });

  const [activeTab, setActiveTab] = useState<"overview" | "signals" | "ic">("overview");

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-sans)" }}
    >
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 border-b border-[var(--rule)] bg-[var(--paper)]/95 backdrop-blur-sm"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <span
                className="text-[13px] font-bold tracking-[0.12em] uppercase text-[var(--ink)] cursor-pointer"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                MILLION HUNTER
              </span>
            </Link>
            <span className="text-[var(--rule)]">·</span>
            <span className="text-[12px] text-[var(--sh-fg-3)] uppercase tracking-wider" style={{ fontFamily: "var(--font-mono)" }}>
              Live Thesis
            </span>
          </div>
          <div className="flex items-center gap-3">
            {scenario && (
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[var(--sh-fg-4)]">
                <Clock className="w-3 h-3" />
                <span>Snapshot: {fmtDate(scenario.snapshotAt)}</span>
              </div>
            )}
            {isOperator ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                className="h-8 text-[12px] rounded-full border-[var(--rule)] text-[var(--sh-fg-2)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
              >
                {refreshMutation.isPending ? (
                  <><RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />Refreshing…</>
                ) : (
                  <><RefreshCw className="w-3 h-3 mr-1.5" />Refresh Scan</>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => (window.location.href = getLoginUrl())}
                className="h-8 text-[12px] rounded-full bg-[var(--ink)] text-[var(--bone)] hover:opacity-90"
              >
                Request Access
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {isLoading ? (
          <div className="flex flex-col gap-4 animate-pulse">
            <div className="h-8 w-64 bg-[var(--bone)] rounded" />
            <div className="h-4 w-96 bg-[var(--bone)] rounded" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-[var(--bone)] rounded-xl" />
              ))}
            </div>
          </div>
        ) : !scenario ? (
          <EmptyState isOperator={isOperator} onRefresh={() => refreshMutation.mutate()} isRefreshing={refreshMutation.isPending} />
        ) : (
          <>
            {/* ── Hero header ─────────────────────────────────────────────── */}
            <div className="mb-8">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border-emerald-500/20 font-mono uppercase tracking-wider">
                      Live Thesis
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full border-[var(--rule)] text-[var(--sh-fg-3)] font-mono">
                      Read-Only
                    </Badge>
                  </div>
                  <h1
                    className="text-2xl sm:text-3xl font-bold text-[var(--ink)] leading-tight mb-2"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {scenario.thesisTitle}
                  </h1>
                  {scenario.thesisSummary && (
                    <p className="text-[var(--sh-fg-2)] text-sm max-w-2xl leading-relaxed">
                      {scenario.thesisSummary}
                    </p>
                  )}
                </div>
                {scenario.score != null && (
                  <div className="flex flex-col items-center justify-center w-20 h-20 rounded-2xl border-2 border-[var(--rule)] bg-[var(--bone)] shrink-0">
                    <span
                      className={cn(
                        "text-2xl font-bold",
                        scenario.score >= 0.75 ? "text-emerald-600" :
                        scenario.score >= 0.6 ? "text-amber-600" : "text-rose-600"
                      )}
                    >
                      {(scenario.score * 100).toFixed(0)}
                    </span>
                    <span className="text-[9px] text-[var(--sh-fg-4)] uppercase tracking-widest mt-0.5">Score</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Meta strip ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-8">
              {[
                { icon: Building2, label: "Business", value: scenario.businessName },
                { icon: MapPin, label: "Location", value: scenario.location },
                { icon: BarChart3, label: "Industry", value: scenario.industry },
                { icon: Users, label: "Employees", value: scenario.employees ? `${scenario.employees}` : null },
                { icon: Calendar, label: "Est.", value: scenario.yearEstablished ? `${scenario.yearEstablished}` : null },
                { icon: DollarSign, label: "Multiple", value: scenario.multiple ? `${scenario.multiple.toFixed(1)}x` : null },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex flex-col gap-1 p-3 rounded-xl border border-[var(--rule)] bg-[var(--bone)]">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3 h-3 text-[var(--sh-fg-4)]" />
                    <span className="text-[10px] text-[var(--sh-fg-4)] uppercase tracking-wider">{label}</span>
                  </div>
                  <span className="text-[13px] font-semibold text-[var(--ink)] truncate">{value ?? "—"}</span>
                </div>
              ))}
            </div>

            {/* ── Financials ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: "Revenue", value: fmt$(scenario.revenue) },
                { label: "Cash Flow", value: fmt$(scenario.cashFlow) },
                { label: "Asking Price", value: fmt$(scenario.askingPrice) },
              ].map(({ label, value }) => (
                <div key={label} className="p-4 rounded-xl border border-[var(--rule)]">
                  <p className="text-[11px] text-[var(--sh-fg-3)] uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-xl font-bold text-[var(--ink)]" style={{ fontFamily: "var(--font-mono)" }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* ── Tab navigation ──────────────────────────────────────────── */}
            <div className="flex gap-1 border-b border-[var(--rule)] mb-6">
              {(["overview", "signals", "ic"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2.5 text-[12px] font-medium uppercase tracking-wider transition-colors",
                    activeTab === tab
                      ? "border-b-2 border-[var(--ink)] text-[var(--ink)] -mb-px"
                      : "text-[var(--sh-fg-3)] hover:text-[var(--sh-fg-2)]"
                  )}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {tab === "overview" ? "Score Breakdown" : tab === "signals" ? "Market Signals" : "IC Summary"}
                </button>
              ))}
            </div>

            {/* ── Tab: Score Breakdown ─────────────────────────────────────── */}
            {activeTab === "overview" && scenario.scoreBreakdown && (
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-4 p-5 rounded-xl border border-[var(--rule)]">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sh-fg-3)]">Score Breakdown</h3>
                  <div className="space-y-3">
                    {Object.entries(scenario.scoreBreakdown).map(([key, val]) => (
                      <ScoreBar
                        key={key}
                        label={key.replace(/([A-Z])/g, " $1").trim()}
                        value={val as number}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  {scenario.keyRisks && scenario.keyRisks.length > 0 && (
                    <div className="p-5 rounded-xl border border-rose-200 bg-rose-50/50">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-rose-600">Key Risks</h3>
                      </div>
                      <ul className="space-y-2">
                        {(scenario.keyRisks as string[]).map((r: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-[13px] text-rose-800">
                            <span className="text-rose-400 mt-0.5">·</span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {scenario.catalysts && scenario.catalysts.length > 0 && (
                    <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50/50">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-4 h-4 text-emerald-600" />
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Catalysts</h3>
                      </div>
                      <ul className="space-y-2">
                        {(scenario.catalysts as string[]).map((c: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-[13px] text-emerald-800">
                            <span className="text-emerald-500 mt-0.5">·</span>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Tab: Market Signals ──────────────────────────────────────── */}
            {activeTab === "signals" && (
              <div className="space-y-3">
                {(!scenario.signals || scenario.signals.length === 0) ? (
                  <p className="text-[var(--sh-fg-3)] text-sm py-8 text-center">No signals available for this snapshot.</p>
                ) : (
                  (scenario.signals as Array<{ type: 'tailwind' | 'headwind' | 'neutral'; title: string; summary: string; source: string; relevanceScore: number }>).map((sig, i) => {
                    const Icon = sig.type === "tailwind" ? TrendingUp : sig.type === "headwind" ? TrendingDown : Minus;
                    const colors: Record<string, string> = {
                      tailwind: "border-emerald-200 bg-emerald-50/50",
                      headwind: "border-rose-200 bg-rose-50/50",
                      neutral: "border-[var(--rule)] bg-[var(--bone)]",
                    };
                    const iconColors: Record<string, string> = {
                      tailwind: "text-emerald-600",
                      headwind: "text-rose-500",
                      neutral: "text-[var(--sh-fg-3)]",
                    };
                    return (
                      <div key={i} className={cn("p-4 rounded-xl border", colors[sig.type])}>
                        <div className="flex items-start gap-3">
                          <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", iconColors[sig.type])} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-[13px] font-semibold text-[var(--ink)]">{sig.title}</span>
                              <Badge variant="outline" className={cn(
                                "text-[9px] px-1.5 py-0 h-4 font-mono uppercase",
                                sig.type === "tailwind" ? "border-emerald-300 text-emerald-700" :
                                sig.type === "headwind" ? "border-rose-300 text-rose-700" :
                                "border-[var(--rule)] text-[var(--sh-fg-3)]"
                              )}>
                                {sig.type}
                              </Badge>
                            </div>
                            <p className="text-[12px] text-[var(--sh-fg-2)] leading-relaxed">{sig.summary}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[10px] text-[var(--sh-fg-4)]">Source: {sig.source}</span>
                              <span className="text-[10px] text-[var(--sh-fg-4)]">
                                Relevance: {Math.round(sig.relevanceScore * 100)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── Tab: IC Summary ──────────────────────────────────────────── */}
            {activeTab === "ic" && (
              <div className="space-y-6">
                {scenario.investmentThesis && (
                  <div className="p-5 rounded-xl border border-[var(--rule)] bg-[var(--bone)]">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sh-fg-3)] mb-3">Investment Thesis</h3>
                    <p className="text-[14px] text-[var(--ink)] leading-relaxed">{scenario.investmentThesis}</p>
                  </div>
                )}
                {scenario.icSummary && (
                  <div className="p-5 rounded-xl border border-[var(--rule)]">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sh-fg-3)] mb-3">IC Committee Summary</h3>
                    <div className="prose prose-sm max-w-none text-[var(--sh-fg-2)]">
                      {scenario.icSummary.split("\n\n").map((para, i) => (
                        <p key={i} className="text-[13px] leading-relaxed mb-3 last:mb-0">{para}</p>
                      ))}
                    </div>
                  </div>
                )}
                {scenario.dataSourcesUsed && scenario.dataSourcesUsed.length > 0 && (
                  <div className="flex items-start gap-2 text-[11px] text-[var(--sh-fg-4)]">
                    <Shield className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>Data sources: {scenario.dataSourcesUsed.join(" · ")}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── CTA gate ─────────────────────────────────────────────────── */}
            {!isAuthenticated && (
              <div className="mt-12 p-8 rounded-2xl border border-[var(--rule)] bg-gradient-to-br from-[var(--bone)] to-[var(--paper)] text-center">
                <Lock className="w-8 h-8 text-[var(--sh-fg-3)] mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[var(--ink)] mb-2" style={{ fontFamily: "var(--font-serif)" }}>
                  Full Pipeline Access
                </h3>
                <p className="text-[var(--sh-fg-2)] text-sm mb-6 max-w-sm mx-auto">
                  This is a single curated thesis. Operator access unlocks the full deal pipeline, AI scoring engine, outreach automation, and IC memo generation.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={() => (window.location.href = getLoginUrl())}
                    className="bg-[var(--ink)] text-[var(--bone)] hover:opacity-90 rounded-full px-6"
                  >
                    Request Operator Access
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                  <Link href="/explore">
                    <Button variant="outline" className="rounded-full px-6 border-[var(--rule)] text-[var(--sh-fg-2)] hover:border-[var(--ink)] hover:text-[var(--ink)]">
                      Browse Deal Search
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

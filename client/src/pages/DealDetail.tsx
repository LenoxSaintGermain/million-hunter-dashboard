import React from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import EditorialTopNav from "@/components/EditorialTopNav";
import CoPilot from "@/components/CoPilot";
import AgentMonitoringPanel from "@/components/AgentMonitoringPanel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  ArrowLeft, Zap, Brain, Globe, Shield, DollarSign,
  FileText, Mail, AlertTriangle, TrendingUp,
  Building2, MapPin, Users, Calendar, ExternalLink,
  GitBranch, BarChart3, UserSearch, CheckCircle2, XCircle, Loader2, Share2,
  Bot, Swords, Wrench, ChevronDown, ChevronRight, Copy, Download,
} from "lucide-react";
import { Link } from "wouter";

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  const ac = accent ?? "var(--ink)";
  return (
    <div style={{
      background: "var(--paper)",
      border: "1px solid var(--rule)",
      borderRadius: 10,
      padding: "14px 16px",
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--sh-fg-3)", marginBottom: 6 }}>{label}</p>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: ac }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "var(--sh-fg-4)", marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

function SignalCard({
  icon: Icon,
  title,
  color,
  children,
}: {
  icon: React.ElementType;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", color)}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function DealDetail() {
  const params = useParams<{ id: string }>();
  const dealId = Number(params.id);

  const { data, isLoading, refetch } = trpc.deals.getById.useQuery({ id: dealId });
  const analyzeSignals = trpc.signals.analyze.useMutation({
    onSuccess: () => { toast.success("Third Signal analysis complete"); refetch(); },
    onError: (e) => toast.error(`Analysis failed: ${e.message}`),
  });
  const generateMemo = trpc.memos.generate.useMutation({
    onSuccess: () => { toast.success("Investment memo generated"); refetch(); },
    onError: (e) => toast.error(`Memo generation failed: ${e.message}`),
  });
  const scoreDeal = trpc.deals.score.useMutation({
    onSuccess: (d) => { toast.success(`Scored: ${parseFloat(String(d.score)).toFixed(3)}`); refetch(); },
  });

  // Deal Share
  const createShareToken = trpc.dealShare.createToken.useMutation({
    onSuccess: (data) => {
      const shareUrl = `${window.location.origin}/deal-share/${data.token}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        toast.success("Investor link copied!", { description: "30-day access link ready to share" });
      }).catch(() => {
        toast.info("Share link generated", { description: shareUrl });
      });
    },
    onError: (e) => toast.error(`Failed to create share link: ${e.message}`),
  });

  // ADK agent mutations
  const runPipeline = trpc.agents.runPipeline.useMutation({
    onSuccess: () => { toast.success("ADK pipeline complete — trajectory logged"); refetch(); },
    onError: (e) => toast.error(`Pipeline failed: ${e.message}`),
  });
  const consensusScore = trpc.agents.consensusScore.useMutation({
    onSuccess: (r) => {
      if (r.divergenceFlag) toast.warning(`⚠️ Models diverge (${(parseFloat(String(r.divergenceScore ?? 0)) * 100).toFixed(0)}%) — manual review recommended`);
      else toast.success(`Consensus: ${parseFloat(String(r.consensusScore ?? 0)).toFixed(3)} — models agree`);
      refetch();
    },
    onError: (e) => toast.error(`Consensus scoring failed: ${e.message}`),
  });
  const sellerSim = trpc.agents.sellerSimulation.useMutation({
    onSuccess: (r) => { toast.success(`Seller profile: ${r.persona?.motivation ?? 'unknown'} motivation, urgency ${r.persona?.urgencyLevel ?? '?'}/10`); refetch(); },
    onError: (e) => toast.error(`Seller simulation failed: ${e.message}`),
  });

  const { data: trajectoryData } = trpc.agents.getTrajectory.useQuery({ dealId }, { enabled: !!dealId });
  const { data: consensusData } = trpc.agents.getConsensusScore.useQuery({ dealId }, { enabled: !!dealId });
  const { data: sellerData } = trpc.agents.getSellerSimulation.useQuery({ dealId }, { enabled: !!dealId });

  // MySQL returns DECIMAL columns as strings — coerce to float everywhere
  const toNum = (v: any): number | null => v == null ? null : parseFloat(String(v));

  const fmt = (n: any, prefix = "$") => {
    const v = toNum(n);
    if (v == null || isNaN(v)) return "—";
    if (v >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `${prefix}${(v / 1_000).toFixed(0)}k`;
    return `${prefix}${v}`;
  };

  const pct = (n: any) => { const v = toNum(n); return v == null ? "—" : `${Math.round(v * 100)}%`; };

  if (isLoading) {
    return (
      <EditorialTopNav>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </EditorialTopNav>
    );
  }

  if (!data) {
    return (
      <EditorialTopNav>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground/20 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">Deal not found</p>
          <Link href="/scan">
            <Button variant="outline" size="sm" className="mt-4">
              <ArrowLeft className="w-3 h-3 mr-1.5" />
              Back to Scan
            </Button>
          </Link>
        </div>
      </EditorialTopNav>
    );
  }

  const { deal, signal, memo } = data;
  const score = toNum(deal.score);
  const scoreColorVal = score == null ? "var(--sh-fg-3)" : score >= 0.8 ? "var(--sage)" : score >= 0.65 ? "var(--amber)" : "var(--clay)";

  return (
    <EditorialTopNav>
      {/* Back nav */}
      <Link href="/scan">
        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground -ml-2">
          <ArrowLeft className="w-3 h-3 mr-1.5" />
          Back to Scan
        </Button>
      </Link>

      {/* Deal header */}
      {/* ── Stitch Intelligence Dossier Hero ─────────────────────────────────── */}
      <div style={{
        background: "var(--surface, #1e2a34)",
        border: "1px solid rgba(255,186,32,0.12)",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        {/* Dossier Header */}
        <div style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "20px 24px",
          background: "rgba(255,186,32,0.03)",
        }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              {/* Eyebrow */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                  color: "var(--signal-gold, #ffba20)",
                  fontFamily: "var(--font-mono)",
                }}>TARGET DOSSIER</span>
                <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 10 }}>·</span>
                {deal.industry && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    color: "var(--on-surface-variant, #d5c4ab)",
                    fontFamily: "var(--font-mono)",
                  }}>{deal.industry}</span>
                )}
                {deal.opportunityZone && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 8px", borderRadius: 4,
                    fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
                    background: "rgba(52,211,153,0.12)",
                    color: "var(--sage)",
                    border: "1px solid rgba(52,211,153,0.25)",
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--sage)", display: "inline-block" }} />
                    OZ
                  </span>
                )}
                {deal.tadDistrict && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 8px", borderRadius: 4,
                    fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
                    background: "rgba(96,165,250,0.12)",
                    color: "#60a5fa",
                    border: "1px solid rgba(96,165,250,0.25)",
                  }}>{deal.tadDistrict}</span>
                )}
                <span style={{
                  padding: "2px 8px", borderRadius: 4,
                  fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
                  background: "rgba(255,186,32,0.10)",
                  color: "var(--signal-gold, #ffba20)",
                  border: "1px solid rgba(255,186,32,0.20)",
                  textTransform: "uppercase" as const,
                }}>{deal.stage.replace(/_/g, " ")}</span>
              </div>
              {/* Deal Name */}
              <h1 style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(22px, 3vw, 32px)",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                color: "var(--on-surface, #dae3ee)",
                lineHeight: 1.2,
                marginBottom: 10,
              }}>{deal.name}</h1>
              {/* Meta row */}
              <div className="flex items-center gap-4 flex-wrap" style={{ fontSize: 12, color: "var(--on-surface-variant, #d5c4ab)" }}>
                {deal.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" style={{ color: "var(--signal-gold, #ffba20)" }} />
                    {deal.location}
                  </span>
                )}
                {deal.employees && (
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3 h-3" />
                    {deal.employees} employees
                  </span>
                )}
                {deal.yearEstablished && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    Est. {deal.yearEstablished}
                  </span>
                )}
                {deal.source && (
                  <span className="flex items-center gap-1.5" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    {deal.source}
                  </span>
                )}
                {deal.listingUrl && (
                  <a href={deal.listingUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:underline"
                    style={{ color: "var(--signal-gold, #ffba20)" }}>
                    <ExternalLink className="w-3 h-3" />View Listing
                  </a>
                )}
              </div>
            </div>
            {/* Conviction Score */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                color: "var(--on-surface-variant, #d5c4ab)",
                fontFamily: "var(--font-mono)",
              }}>Conviction Score</span>
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: 52,
                fontWeight: 400,
                color: score != null && score >= 0.8
                  ? "var(--signal-gold, #ffba20)"
                  : score != null && score >= 0.65
                  ? "var(--amber)"
                  : "var(--clay)",
                lineHeight: 1,
                letterSpacing: "-0.03em",
              }}>
                {score != null ? `${Math.round(score * 100)}%` : "—"}
              </div>
              <div className="flex gap-1.5 mt-1">
                <Button size="sm" style={{
                  height: 28, fontSize: 11, padding: "0 12px",
                  background: "var(--signal-gold, #ffba20)",
                  color: "#0d1117",
                  fontWeight: 700,
                  border: "none",
                }} onClick={() => scoreDeal.mutate({ id: dealId })} disabled={scoreDeal.isPending}>
                  <Zap className="w-3 h-3 mr-1" />
                  {scoreDeal.isPending ? "..." : "Score"}
                </Button>
                <Button size="sm" variant="outline" style={{
                  height: 28, fontSize: 11, padding: "0 10px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "var(--on-surface, #dae3ee)",
                }} onClick={() => createShareToken.mutate({ dealId })} disabled={createShareToken.isPending}>
                  <Share2 className="w-3 h-3 mr-1" />
                  Share
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Financial KPIs — Stitch bento row */}
        <div className="grid grid-cols-2 lg:grid-cols-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {[
            { label: "Annual Revenue", value: fmt(deal.revenue), sub: null, accent: "oklch(0.65 0.22 250)" },
            {
              label: "Cash Flow / SDE",
              value: fmt(deal.cashFlow),
              sub: deal.revenue && deal.cashFlow ? `${Math.round((parseFloat(String(deal.cashFlow)) / parseFloat(String(deal.revenue))) * 100)}% margin` : null,
              accent: "var(--sage)",
            },
            { label: "Asking Price", value: fmt(deal.askingPrice), sub: null, accent: "var(--signal-gold, #ffba20)" },
            {
              label: "Multiple",
              value: toNum(deal.multiple) != null ? `${toNum(deal.multiple)!.toFixed(2)}x` : "—",
              sub: "EBITDA",
              accent: "var(--amber)",
            },
          ].map((kpi, i) => (
            <div key={i} style={{
              padding: "16px 20px",
              borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}>
              <p style={{
                fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const,
                letterSpacing: "0.14em", color: "var(--on-surface-variant, #d5c4ab)",
                fontFamily: "var(--font-mono)", marginBottom: 6,
              }}>{kpi.label}</p>
              <p style={{
                fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 400,
                color: kpi.accent, lineHeight: 1,
              }}>{kpi.value}</p>
              {kpi.sub && <p style={{ fontSize: 11, color: "var(--on-surface-variant, #d5c4ab)", marginTop: 3 }}>{kpi.sub}</p>}
            </div>
          ))}
        </div>

        {/* Macro Alignment Alert — shown when signal analysis exists */}
        {signal?.redTeamSummary && (
          <div style={{
            padding: "14px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            borderLeft: "3px solid var(--signal-gold, #ffba20)",
            background: "rgba(255,186,32,0.04)",
            display: "flex", gap: 12, alignItems: "flex-start",
          }}>
            <TrendingUp className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--signal-gold, #ffba20)" }} />
            <div>
              <p style={{
                fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const,
                letterSpacing: "0.1em", color: "var(--on-surface, #dae3ee)",
                fontFamily: "var(--font-mono)", marginBottom: 4,
              }}>Macro Strategic Alignment</p>
              <p style={{ fontSize: 13, color: "var(--on-surface-variant, #d5c4ab)", lineHeight: 1.5, maxWidth: 800 }}>
                {typeof signal.redTeamSummary === "string"
                  ? signal.redTeamSummary.slice(0, 280) + (signal.redTeamSummary.length > 280 ? "…" : "")
                  : "Third Signal analysis available in the Intelligence tab below."}
              </p>
            </div>
          </div>
        )}

        {/* Agent Copilot Action Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          {[
            {
              icon: Brain,
              label: "Run Third Signal",
              sub: "Analyze macro + competitive signals",
              primary: false,
              action: () => analyzeSignals.mutate({ dealId }),
              pending: analyzeSignals.isPending,
            },
            {
              icon: FileText,
              label: "Generate Investment Memo",
              sub: "Auto-compile IC-ready document",
              primary: true,
              action: () => generateMemo.mutate({ dealId }),
              pending: generateMemo.isPending,
            },
            {
              icon: Mail,
              label: "Draft Outreach",
              sub: "Personalized founder approach",
              primary: false,
              action: () => { toast.info("Navigate to Outreach tab to draft"); },
              pending: false,
            },
          ].map((action, i) => (
            <button
              key={i}
              onClick={action.action}
              disabled={action.pending}
              className="flex items-center gap-3 text-left transition-all"
              style={{
                padding: "14px 20px",
                borderRight: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
                background: action.primary
                  ? "rgba(255,186,32,0.08)"
                  : "transparent",
                cursor: action.pending ? "not-allowed" : "pointer",
                opacity: action.pending ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!action.primary) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = action.primary ? "rgba(255,186,32,0.08)" : "transparent";
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: action.primary ? "rgba(255,186,32,0.15)" : "rgba(255,255,255,0.06)",
                flexShrink: 0,
              }}>
                {action.pending
                  ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: action.primary ? "var(--signal-gold, #ffba20)" : "var(--on-surface-variant, #d5c4ab)" }} />
                  : <action.icon className="w-4 h-4" style={{ color: action.primary ? "var(--signal-gold, #ffba20)" : "var(--on-surface-variant, #d5c4ab)" }} />
                }
              </div>
              <div>
                <p style={{
                  fontSize: 12, fontWeight: 600,
                  color: action.primary ? "var(--signal-gold, #ffba20)" : "var(--on-surface, #dae3ee)",
                  letterSpacing: "0.01em",
                }}>{action.label}</p>
                <p style={{ fontSize: 11, color: "var(--on-surface-variant, #d5c4ab)", marginTop: 1 }}>{action.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
      {/* Tabs */}
      <Tabs defaultValue="signals">
        <TabsList className="bg-card border border-border h-9 flex-wrap gap-0.5">
          <TabsTrigger value="signals" className="text-xs h-7">Third Signal</TabsTrigger>
          <TabsTrigger value="memo" className="text-xs h-7">Investment Memo</TabsTrigger>
          <TabsTrigger value="capital" className="text-xs h-7">Capital Stack</TabsTrigger>
          <TabsTrigger value="outreach" className="text-xs h-7">Outreach</TabsTrigger>
          <TabsTrigger value="consensus" className="text-xs h-7">
            <BarChart3 className="w-3 h-3 mr-1" />Consensus
          </TabsTrigger>
          <TabsTrigger value="seller" className="text-xs h-7">
            <UserSearch className="w-3 h-3 mr-1" />Seller Sim
          </TabsTrigger>
          <TabsTrigger value="agents" className="text-xs h-7">
            <Bot className="h-3 w-3 mr-1" />Agent Loop
          </TabsTrigger>
          <TabsTrigger value="trajectory" className="text-xs h-7">
            <GitBranch className="w-3 h-3 mr-1" />Trajectory
          </TabsTrigger>
        </TabsList>

        {/* Third Signal Tab */}
        <TabsContent value="signals" className="mt-4 space-y-4">
          {!signal ? (
            <Card className="bg-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Brain className="w-10 h-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No Third Signal analysis yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Run the analysis to unlock Owner Psychology, Digital Audit, and Red Team insights</p>
                <Button size="sm" className="mt-4 h-8 text-xs" onClick={() => analyzeSignals.mutate({ dealId })} disabled={analyzeSignals.isPending}>
                  <Brain className="w-3 h-3 mr-1.5" />
                  {analyzeSignals.isPending ? "Analyzing..." : "Run Third Signal Analysis"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Analysis cached — re-run to refresh with latest data</p>
                <Button size="sm" variant="outline" className="h-7 text-xs border-border" onClick={() => analyzeSignals.mutate({ dealId, force: true })} disabled={analyzeSignals.isPending}>
                  <Brain className="w-3 h-3 mr-1.5" />
                  {analyzeSignals.isPending ? "Re-analyzing..." : "Re-analyze"}
                </Button>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
              {/* Owner Psychology */}
              <SignalCard icon={Brain} title="Owner Psychology" color="bg-purple-500/20 text-purple-400">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Distress Score</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(signal.ownerDistressScore ?? 0) * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono text-foreground">{pct(signal.ownerDistressScore)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Retirement Signal</span>
                    <span className={cn("text-xs font-medium", signal.ownerRetirementSignal ? "text-amber-500" : "text-muted-foreground")}>
                      {signal.ownerRetirementSignal ? "Detected" : "Not detected"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Negotiation Style</span>
                    <span className="text-xs font-medium text-foreground capitalize">{signal.ownerNegotiationStyle ?? "—"}</span>
                  </div>
                  {signal.ownerProfileSummary && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground leading-relaxed">{signal.ownerProfileSummary}</p>
                    </div>
                  )}
                </div>
              </SignalCard>

              {/* Digital Audit */}
              <SignalCard icon={Globe} title="Digital Footprint Audit" color="bg-blue-500/20 text-blue-400">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Tech Debt Score</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(signal.techDebtScore ?? 0) * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono text-foreground">{pct(signal.techDebtScore)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Growth Trend</span>
                    <span className={cn("text-xs font-medium capitalize",
                      signal.digitalGrowthTrend === "growing" ? "text-emerald-500" :
                      signal.digitalGrowthTrend === "declining" ? "text-destructive" : "text-muted-foreground"
                    )}>{signal.digitalGrowthTrend ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">SEO Authority</span>
                    <span className="text-xs font-mono text-foreground">{signal.seoAuthorityScore ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Review Sentiment</span>
                    <span className="text-xs font-mono text-foreground">{pct(signal.reviewSentimentScore)}</span>
                  </div>
                  {signal.digitalAuditSummary && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground leading-relaxed">{signal.digitalAuditSummary}</p>
                    </div>
                  )}
                </div>
              </SignalCard>

              {/* Red Team */}
              <SignalCard
                icon={Shield}
                title="Red Team Analysis"
                color={cn("text-white", (signal.killProbability ?? 0) > 0.7 ? "bg-destructive/30" : "bg-emerald-500/20")}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Kill Probability</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", (signal.killProbability ?? 0) > 0.7 ? "bg-destructive" : "bg-emerald-500")}
                          style={{ width: `${(signal.killProbability ?? 0) * 100}%` }}
                        />
                      </div>
                      <span className={cn("text-xs font-mono font-bold",
                        (signal.killProbability ?? 0) > 0.7 ? "text-destructive" : "text-emerald-500"
                      )}>{pct(signal.killProbability)}</span>
                    </div>
                  </div>
                  {Array.isArray(signal.redFlags) && (signal.redFlags as string[]).length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Red Flags</p>
                      {(signal.redFlags as string[]).map((flag, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-destructive">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {flag}
                        </div>
                      ))}
                    </div>
                  )}
                  {signal.redTeamSummary && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground leading-relaxed">{signal.redTeamSummary}</p>
                    </div>
                  )}
                </div>
              </SignalCard>

              {/* Capital Stack Preview */}
              <SignalCard icon={DollarSign} title="Capital Stack" color="bg-emerald-500/20 text-[var(--sage)]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">SBA Eligible</span>
                    <span className={cn("text-xs font-medium", signal.sbaEligible ? "text-emerald-500" : "text-muted-foreground")}>
                      {signal.sbaEligible != null ? (signal.sbaEligible ? "Yes" : "No") : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">DSCR</span>
                    <span className={cn("text-xs font-mono font-bold",
                      (toNum(signal.dscr) ?? 0) >= 1.25 ? "text-emerald-500" : "text-destructive"
                    )}>{toNum(signal.dscr)?.toFixed(2) ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Cash-on-Cash</span>
                    <span className="text-xs font-mono text-foreground">{pct(signal.cashOnCashReturn)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[
                      { label: "SBA Loan", value: fmt(signal.recommendedSbaAmount) },
                      { label: "Seller Note", value: fmt(signal.recommendedSellerNote) },
                      { label: "Equity", value: fmt(signal.recommendedEquity) },
                    ].map((s) => (
                      <div key={s.label} className="bg-muted/30 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                        <p className="text-xs font-semibold text-foreground mt-0.5">{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </SignalCard>
            </div>
            </div>
          )}
        </TabsContent>

        {/* Investment Memo Tab */}
        <TabsContent value="memo" className="mt-4">
          {!memo ? (
            <Card className="bg-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="w-10 h-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No investment memo yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Generate a comprehensive AI investment thesis powered by Gemini 2.5 Pro</p>
                <Button size="sm" className="mt-4 h-8 text-xs" onClick={() => generateMemo.mutate({ dealId })} disabled={generateMemo.isPending}>
                  <FileText className="w-3 h-3 mr-1.5" />
                  {generateMemo.isPending ? "Generating..." : "Generate Investment Memo"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-sm font-semibold">{memo.title ?? "Investment Memo"}</CardTitle>
                  <CardDescription className="text-xs">
                    Generated by {memo.generatedBy ?? "Gemini 2.5 Pro"} · v{memo.version ?? 1} ·{" "}
                    {new Date(memo.createdAt).toLocaleDateString()}
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" className="h-8 text-xs border-border" onClick={() => generateMemo.mutate({ dealId })} disabled={generateMemo.isPending}>
                  {generateMemo.isPending ? "Regenerating..." : "Regenerate"}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm prose-invert max-w-none">
                  <Streamdown>{memo.content ?? ""}</Streamdown>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Capital Stack Tab */}
        <TabsContent value="capital" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Dynamic Capital Stack Wizard</CardTitle>
              <CardDescription className="text-xs">Model the optimal financing structure for this acquisition</CardDescription>
            </CardHeader>
            <CardContent>
              {!signal?.sbaEligible && !signal?.recommendedSbaAmount ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <DollarSign className="w-10 h-10 text-muted-foreground/20 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Run Third Signal analysis first</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">The Capital Stack Wizard requires signal data to model financing</p>
                  <Button size="sm" className="mt-4 h-8 text-xs" onClick={() => analyzeSignals.mutate({ dealId })} disabled={analyzeSignals.isPending}>
                    <Brain className="w-3 h-3 mr-1.5" />
                    {analyzeSignals.isPending ? "Analyzing..." : "Run Analysis"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    {[
                      { label: "SBA 7(a) Loan", amount: signal.recommendedSbaAmount, color: "bg-primary", pctVal: signal.recommendedSbaAmount && deal.askingPrice ? Math.round((signal.recommendedSbaAmount / deal.askingPrice) * 100) : 0 },
                      { label: "Seller Note", amount: signal.recommendedSellerNote, color: "bg-amber-500", pctVal: signal.recommendedSellerNote && deal.askingPrice ? Math.round((signal.recommendedSellerNote / deal.askingPrice) * 100) : 0 },
                      { label: "Equity / Down Payment", amount: signal.recommendedEquity, color: "bg-emerald-500", pctVal: signal.recommendedEquity && deal.askingPrice ? Math.round((signal.recommendedEquity / deal.askingPrice) * 100) : 0 },
                    ].map((layer) => (
                      <div key={layer.label} className="flex items-center gap-3">
                        <div className="w-32 text-xs text-muted-foreground shrink-0">{layer.label}</div>
                        <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                          <div className={cn("h-full rounded-md transition-all", layer.color)} style={{ width: `${layer.pctVal}%` }} />
                        </div>
                        <div className="w-24 text-right">
                          <span className="text-xs font-mono font-bold text-foreground">{fmt(layer.amount)}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">({layer.pctVal}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">DSCR</p>
                      <p className={cn("text-2xl font-bold font-mono",
                        (toNum(signal.dscr) ?? 0) >= 1.25 ? "text-emerald-500" : "text-destructive"
                      )}>{toNum(signal.dscr)?.toFixed(2) ?? "—"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Min 1.25 for SBA approval</p>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">Cash-on-Cash Return</p>
                      <p className="text-2xl font-bold font-mono text-primary">{pct(signal.cashOnCashReturn)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Year 1 projected</p>
                    </div>
                  </div>
                  {signal.capitalStackSummary && (
                    <div className="pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground leading-relaxed">{signal.capitalStackSummary}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Outreach Tab */}
        <TabsContent value="outreach" className="mt-4">
          <OutreachTab dealId={dealId} />
        </TabsContent>

        {/* Consensus Score Tab (MiroFish) */}
        <TabsContent value="consensus" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Multi-Model Consensus Scoring
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  3 Gemini models score in parallel. High divergence = genuine uncertainty = manual review.
                </CardDescription>
              </div>
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => consensusScore.mutate({ dealId })}
                disabled={consensusScore.isPending}
              >
                {consensusScore.isPending ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <BarChart3 className="w-3 h-3 mr-1.5" />}
                Run Consensus
              </Button>
            </CardHeader>
            <CardContent>
              {!consensusData ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BarChart3 className="w-10 h-10 text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">No consensus score yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Run 3-model parallel scoring to detect genuine uncertainty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* ⚠️ Divergence Alert Banner — shown prominently when models disagree */}
                  {consensusData.divergenceFlag && (
                    <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/8">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                        <XCircle className="w-4 h-4 text-[var(--amber)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--amber)]">Models Disagree — Manual Review Required</p>
                        <p className="text-xs text-[var(--amber)]/70 mt-0.5">
                          Divergence score: <span className="font-bold">{((toNum(consensusData.divergenceScore) ?? 0) * 100).toFixed(0)}%</span>. When AI models disagree this significantly, it signals genuine ambiguity in the deal fundamentals. Do not advance to LOI without a direct conversation with the broker.
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-[var(--amber)] border border-amber-500/25">
                            ⚠️ High Uncertainty
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                            Do Not Advance Without Review
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ✅ Agreement Banner — shown when models align */}
                  {!consensusData.divergenceFlag && (
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                      <CheckCircle2 className="w-4 h-4 text-[var(--sage)] shrink-0" />
                      <p className="text-xs text-[var(--sage)] font-medium">All 3 models in agreement — consensus score is reliable</p>
                    </div>
                  )}

                  {/* Consensus header */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">Consensus Score</p>
                      <p className="text-3xl font-bold text-foreground">{(toNum(consensusData.consensusScore) ?? 0).toFixed(3)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Divergence</p>
                      <div className="flex items-center gap-1.5 justify-end mt-1">
                        {consensusData.divergenceFlag ? (
                          <><XCircle className="w-4 h-4 text-[var(--amber)]" /><span className="text-sm font-semibold text-[var(--amber)]">{((toNum(consensusData.divergenceScore) ?? 0) * 100).toFixed(0)}% — Review</span></>
                        ) : (
                          <><CheckCircle2 className="w-4 h-4 text-[var(--sage)]" /><span className="text-sm font-semibold text-[var(--sage)]">Models Agree</span></>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Per-model scores — expanded with full rationale on divergence */}
                  <div className={cn(
                    "gap-3",
                    consensusData.divergenceFlag ? "flex flex-col" : "grid grid-cols-3"
                  )}>
                    {[
                      { name: consensusData.model1Name, score: consensusData.model1Score, rationale: consensusData.model1Rationale },
                      { name: consensusData.model2Name, score: consensusData.model2Score, rationale: consensusData.model2Rationale },
                      { name: consensusData.model3Name, score: consensusData.model3Score, rationale: consensusData.model3Rationale },
                    ].map((m, i) => m.name && (
                      <div key={i} className={cn(
                        "p-3 rounded-lg border border-border/50",
                        consensusData.divergenceFlag ? "bg-muted/20 flex items-start gap-4" : "bg-muted/20"
                      )}>
                        {consensusData.divergenceFlag ? (
                          <>
                            <div className="shrink-0 text-center w-16">
                              <p className="text-xs font-mono text-muted-foreground">{m.name?.split("-").slice(-2).join("-")}</p>
                              <p className="text-2xl font-bold mt-1">{(toNum(m.score) ?? 0).toFixed(3)}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Rationale</p>
                              {m.rationale ? (
                                <p className="text-xs text-foreground/80 leading-relaxed">{m.rationale}</p>
                              ) : (
                                <p className="text-xs text-muted-foreground/50 italic">No rationale provided</p>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-mono text-muted-foreground truncate">{m.name?.split("-").slice(-2).join("-")}</p>
                            <p className="text-xl font-bold mt-1">{(toNum(m.score) ?? 0).toFixed(3)}</p>
                            {m.rationale && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.rationale}</p>}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  {consensusData.summary && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-xs font-medium text-primary mb-1">Synthesis</p>
                      <p className="text-xs text-muted-foreground">{consensusData.summary}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Seller Simulation Tab (MiroFish) */}
        <TabsContent value="seller" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UserSearch className="w-4 h-4 text-primary" />
                  Seller Persona Simulation
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  AI-generated seller profile + negotiation scenarios. Rehearse the LOI before you send it.
                </CardDescription>
              </div>
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => sellerSim.mutate({ dealId })}
                disabled={sellerSim.isPending}
              >
                {sellerSim.isPending ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <UserSearch className="w-3 h-3 mr-1.5" />}
                Simulate Seller
              </Button>
            </CardHeader>
            <CardContent>
              {!sellerData ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <UserSearch className="w-10 h-10 text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">No seller simulation yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Generate a seller persona to rehearse negotiation scenarios before making contact</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Persona card */}
                  {(sellerData.personaJson as any) ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Motivation", value: (sellerData.personaJson as any).motivation, cls: "capitalize" },
                        { label: "Urgency", value: `${(sellerData.personaJson as any).urgencyLevel}/10`, cls: "" },
                        { label: "Price Flexibility", value: (sellerData.personaJson as any).priceFlexibility, cls: "capitalize" },
                        { label: "Legacy Concern", value: (sellerData.personaJson as any).legacyConcern ? "Yes" : "No", cls: "" },
                      ].map((item) => (
                        <div key={item.label} className="p-3 rounded-lg bg-muted/20 border border-border/50">
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className={`text-sm font-semibold mt-0.5 ${item.cls}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {/* Scenarios */}
                  {sellerData.scenariosJson && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Negotiation Scenarios</p>
                      {(sellerData.scenariosJson as any[]).map((s: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg border border-border/50 bg-muted/10">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold">{s.scenario}</p>
                            <Badge variant="outline" className="text-xs h-5">{s.probability}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{s.sellerResponse}</p>
                          {s.counterStrategy && (
                            <p className="text-xs text-primary mt-1">→ {s.counterStrategy}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trajectory Tab (Hermes) */}
        <TabsContent value="trajectory" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-primary" />
                  Agent Trajectory
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Full step-by-step log of every agent that touched this deal. Each agent reads what prior agents found.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-border"
                onClick={() => runPipeline.mutate({ dealId })}
                disabled={runPipeline.isPending}
              >
                {runPipeline.isPending ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Zap className="w-3 h-3 mr-1.5" />}
                Run ADK Pipeline
              </Button>
            </CardHeader>
            <CardContent>
              {!trajectoryData?.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <GitBranch className="w-10 h-10 text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">No trajectory yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Run the ADK pipeline to log every agent step with model, timing, and context</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-4 pl-10">
                    {trajectoryData.map((step, i) => (
                      <div key={step.id} className="relative">
                        <div className="absolute -left-6 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                        <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold text-foreground">{step.agentName}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground">{step.model?.split("-").slice(-2).join("-")}</span>
                              {step.durationMs && <span className="text-xs text-muted-foreground">{step.durationMs}ms</span>}
                            </div>
                          </div>
                          {step.inputSummary && <p className="text-xs text-muted-foreground/70 mb-1"><span className="text-muted-foreground font-medium">In:</span> {step.inputSummary}</p>}
                          {step.outputSummary && <p className="text-xs text-muted-foreground"><span className="text-muted-foreground font-medium">Out:</span> {step.outputSummary}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="agents" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <AgentLoopPanel dealId={dealId} dealName={deal.name} />
            </div>
            <div className="lg:col-span-1">
              <div className="sticky top-4 p-4 bg-[#faf7f2] border border-[#e8e0d4] rounded-xl">
                <AgentMonitoringPanel dealId={dealId} />
              </div>
            </div>
          </div>
        </TabsContent>
       </Tabs>
      {/* Co-Pilot with deal-specific context injected */}
      <CoPilot dealId={dealId} dealName={deal.name} />
    </EditorialTopNav>
  );
}
// ─── Agent Loop Panel (Hermes-pattern: Architect → Red Team → Remediation) ────
function AgentLoopPanel({ dealId, dealName }: { dealId: number; dealName: string }) {
  const [activeRunId, setActiveRunId] = React.useState<number | null>(null);
  const [redTeamRunId, setRedTeamRunId] = React.useState<number | null>(null);
  const [expandedArtifact, setExpandedArtifact] = React.useState<string | null>(null);
  const [expandedFinding, setExpandedFinding] = React.useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: runs, isLoading: runsLoading, refetch: refetchRuns } = trpc.agents.getRuns.useQuery({ dealId });

  const architectMutation = trpc.agents.runDealArchitect.useMutation({
    onSuccess: (data) => {
      toast.success(`Deal Architect complete — ${data.artifacts.length} artifacts generated`);
      setActiveRunId(data.runId);
      refetchRuns();
    },
    onError: (e) => toast.error(`Deal Architect failed: ${e.message}`),
  });

  const redTeamMutation = trpc.agents.runRedTeam.useMutation({
    onSuccess: (data) => {
      toast.success(`Red Team found ${data.findings.length} risks (${data.dealKillers.length} deal-killers)`);
      setRedTeamRunId(data.runId);
      refetchRuns();
    },
    onError: (e) => toast.error(`Red Team failed: ${e.message}`),
  });

  const remediationMutation = trpc.agents.runRemediation.useMutation({
    onSuccess: (data) => {
      toast.success(`Remediation: ${data.goNoGoRecommendation.toUpperCase()} — ${data.remediations.length} actions`);
      refetchRuns();
    },
    onError: (e) => toast.error(`Remediation failed: ${e.message}`),
  });

  const architectRun = runs?.find(r => r.agentType === 'deal_architect' && r.status === 'complete');
  const redTeamRun = runs?.find(r => r.agentType === 'red_team' && r.status === 'complete');
  const remediationRun = runs?.find(r => r.agentType === 'remediation' && r.status === 'complete');

  const isAnyRunning = architectMutation.isPending || redTeamMutation.isPending || remediationMutation.isPending;

  const severityColor: Record<string, string> = {
    critical: "text-[var(--clay)] bg-red-500/10 border-red-500/20",
    high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    medium: "text-[var(--amber)] bg-amber-500/10 border-amber-500/20",
    low: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  };

  const goNoGoColor: Record<string, string> = {
    go: "text-[var(--sage)] bg-emerald-500/10 border-emerald-500/30",
    conditional_go: "text-[var(--amber)] bg-amber-500/10 border-amber-500/30",
    no_go: "text-[var(--clay)] bg-red-500/10 border-red-500/30",
  };

  const artifactIcon: Record<string, React.ReactNode> = {
    cold_outreach_email: <Mail className="h-3.5 w-3.5" />,
    loi_draft: <FileText className="h-3.5 w-3.5" />,
    investment_thesis: <TrendingUp className="h-3.5 w-3.5" />,
    due_diligence_checklist: <CheckCircle2 className="h-3.5 w-3.5" />,
    seller_profile: <UserSearch className="h-3.5 w-3.5" />,
    negotiation_playbook: <Shield className="h-3.5 w-3.5" />,
    financing_model: <DollarSign className="h-3.5 w-3.5" />,
    risk_matrix: <AlertTriangle className="h-3.5 w-3.5" />,
  };

  return (
    <div className="space-y-6">
      {/* Pipeline header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Agent Loop
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hermes-pattern: Architect → Red Team → Remediation
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => architectMutation.mutate({ dealId })}
            disabled={isAnyRunning}
            className="h-8 text-xs"
          >
            {architectMutation.isPending ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Bot className="h-3 w-3 mr-1.5" />}
            Run Full Loop
          </Button>
        </div>
      </div>

      {/* Three-agent pipeline steps */}
      <div className="grid grid-cols-3 gap-3">
        {/* Step 1: Deal Architect */}
        <div className={cn("rounded-xl border p-4 space-y-3 transition-colors", architectRun ? "border-primary/30 bg-primary/5" : "border-border/50 bg-muted/20")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", architectRun ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>1</div>
              <span className="text-sm font-medium">Deal Architect</span>
            </div>
            {architectRun && <CheckCircle2 className="h-4 w-4 text-[var(--sage)]" />}
            {architectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </div>
          <p className="text-xs text-muted-foreground">Generates 6 deal artifacts: cold outreach, LOI, thesis, DD checklist, seller profile, negotiation playbook.</p>
          {architectRun ? (
            <div className="text-xs text-[var(--sage)] font-medium">{(architectRun.artifacts as any[])?.length ?? 0} artifacts ready</div>
          ) : (
            <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => architectMutation.mutate({ dealId })} disabled={isAnyRunning}>
              {architectMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Bot className="h-3 w-3 mr-1" />}
              Generate Artifacts
            </Button>
          )}
        </div>

        {/* Step 2: Red Team */}
        <div className={cn("rounded-xl border p-4 space-y-3 transition-colors", redTeamRun ? "border-red-500/30 bg-red-500/5" : "border-border/50 bg-muted/20")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", redTeamRun ? "bg-red-500 text-white" : "bg-muted text-muted-foreground")}>2</div>
              <span className="text-sm font-medium">Red Team</span>
            </div>
            {redTeamRun && <Swords className="h-4 w-4 text-[var(--clay)]" />}
            {redTeamMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-[var(--clay)]" />}
          </div>
          <p className="text-xs text-muted-foreground">Adversarial stress-test. Finds deal-killers, red flags, and gaps across 6 risk categories.</p>
          {redTeamRun ? (
            <div className="text-xs text-[var(--clay)] font-medium">
              {(redTeamRun.findings as any[])?.filter((f: any) => f.severity === 'critical').length ?? 0} critical · {(redTeamRun.findings as any[])?.length ?? 0} total risks
            </div>
          ) : (
            <Button size="sm" variant="outline" className="w-full h-7 text-xs border-red-500/30 text-[var(--clay)] hover:bg-red-500/10" onClick={() => redTeamMutation.mutate({ dealId, architectRunId: architectRun?.id })} disabled={isAnyRunning}>
              {redTeamMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Swords className="h-3 w-3 mr-1" />}
              Stress-Test Deal
            </Button>
          )}
        </div>

        {/* Step 3: Remediation */}
        <div className={cn("rounded-xl border p-4 space-y-3 transition-colors", remediationRun ? "border-amber-500/30 bg-amber-500/5" : "border-border/50 bg-muted/20")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", remediationRun ? "bg-amber-500 text-black" : "bg-muted text-muted-foreground")}>3</div>
              <span className="text-sm font-medium">Remediation</span>
            </div>
            {remediationRun && <Wrench className="h-4 w-4 text-[var(--amber)]" />}
            {remediationMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-[var(--amber)]" />}
          </div>
          <p className="text-xs text-muted-foreground">Fills gaps, generates missing artifacts, and delivers a Go/No-Go recommendation.</p>
          {remediationRun ? (
            <div className={cn("text-xs font-bold px-2 py-1 rounded border inline-block", goNoGoColor[(remediationRun.remediations as any)?.goNoGoRecommendation] ?? goNoGoColor.conditional_go)}>
              {String((remediationRun as any).goNoGoRecommendation ?? "PENDING").replace(/_/g, " ").toUpperCase()}
            </div>
          ) : (
            <Button size="sm" variant="outline" className="w-full h-7 text-xs border-amber-500/30 text-[var(--amber)] hover:bg-amber-500/10" onClick={() => { if (redTeamRun) remediationMutation.mutate({ dealId, redTeamRunId: redTeamRun.id }); else toast.error("Run Red Team first"); }} disabled={isAnyRunning || !redTeamRun}>
              {remediationMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wrench className="h-3 w-3 mr-1" />}
              Remediate Gaps
            </Button>
          )}
        </div>
      </div>

      {/* Artifacts from Deal Architect */}
      {architectRun && (architectRun.artifacts as any[])?.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Deal Architect Artifacts
              <Badge variant="secondary" className="text-xs ml-auto">{(architectRun.artifacts as any[]).length} files</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(architectRun.artifacts as any[]).map((artifact: any, i: number) => (
              <div key={i} className="border border-border/50 rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => setExpandedArtifact(expandedArtifact === artifact.type ? null : artifact.type)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{artifactIcon[artifact.type] ?? <FileText className="h-3.5 w-3.5" />}</span>
                    <span className="text-sm font-medium">{artifact.title}</span>
                    <Badge variant="outline" className="text-xs">{artifact.type.replace(/_/g, " ")}</Badge>
                  </div>
                  {expandedArtifact === artifact.type ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>
                {expandedArtifact === artifact.type && (
                  <div className="border-t border-border/50 p-4 bg-muted/10">
                    <div className="flex justify-end mb-2">
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { navigator.clipboard.writeText(artifact.content); toast.success("Copied to clipboard"); }}>
                        <Copy className="h-3 w-3 mr-1" />Copy
                      </Button>
                    </div>
                    <Streamdown className="text-sm prose prose-invert max-w-none">{artifact.content}</Streamdown>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Red Team Findings */}
      {redTeamRun && (redTeamRun.findings as any[])?.length > 0 && (
        <Card className="border-red-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Swords className="h-4 w-4 text-[var(--clay)]" />
              Red Team Findings
              <Badge variant="destructive" className="text-xs ml-auto">
                {(redTeamRun.findings as any[]).filter((f: any) => f.severity === 'critical').length} critical
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(redTeamRun.findings as any[]).map((finding: any, i: number) => (
              <div key={i} className={cn("border rounded-lg overflow-hidden", severityColor[finding.severity] ?? "border-border/50")}>
                <button
                  className="w-full flex items-center justify-between p-3 hover:bg-[var(--bone)] transition-colors text-left"
                  onClick={() => setExpandedFinding(expandedFinding === i ? null : i)}
                >
                  <div className="flex items-center gap-2">
                    <Badge className={cn("text-xs border", severityColor[finding.severity])}>{finding.severity}</Badge>
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">{finding.category}</span>
                    <span className="text-sm font-medium text-foreground">{finding.finding}</span>
                  </div>
                  {expandedFinding === i ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                </button>
                {expandedFinding === i && (
                  <div className="border-t border-current/20 p-4 space-y-2 bg-black/20">
                    <div><span className="text-xs font-semibold text-muted-foreground uppercase">Evidence</span><p className="text-sm mt-1">{finding.evidence}</p></div>
                    <div><span className="text-xs font-semibold text-muted-foreground uppercase">Recommendation</span><p className="text-sm mt-1">{finding.recommendation}</p></div>
                    <div className="text-xs text-muted-foreground">Confidence: {(finding.confidenceScore * 100).toFixed(0)}%</div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Remediation Plan */}
      {remediationRun && (
        <Card className="border-amber-500/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wrench className="h-4 w-4 text-[var(--amber)]" />
                Remediation Plan
              </CardTitle>
              {(remediationRun as any).goNoGoRecommendation && (
                <div className={cn("text-sm font-bold px-3 py-1 rounded-full border", goNoGoColor[(remediationRun as any).goNoGoRecommendation] ?? goNoGoColor.conditional_go)}>
                  {String((remediationRun as any).goNoGoRecommendation).replace(/_/g, " ").toUpperCase()}
                </div>
              )}
            </div>
            {(remediationRun as any).executiveSummary && (
              <p className="text-xs text-muted-foreground mt-2">{(remediationRun as any).executiveSummary}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {(remediationRun.remediations as any[])?.map((rem: any, i: number) => (
              <div key={i} className="border border-border/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{rem.findingCategory}</Badge>
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--sage)] ml-auto" />
                </div>
                <p className="text-sm">{rem.action}</p>
                {rem.artifact && (
                  <div className="mt-2 border border-amber-500/20 rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-2.5 hover:bg-amber-500/5 transition-colors text-left"
                      onClick={() => setExpandedArtifact(expandedArtifact === `rem-${i}` ? null : `rem-${i}`)}
                    >
                      <div className="flex items-center gap-2">
                        {artifactIcon[rem.artifact.type] ?? <FileText className="h-3.5 w-3.5" />}
                        <span className="text-xs font-medium">{rem.artifact.title}</span>
                      </div>
                      {expandedArtifact === `rem-${i}` ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                    {expandedArtifact === `rem-${i}` && (
                      <div className="border-t border-amber-500/20 p-3 bg-black/20">
                        <Streamdown className="text-sm prose prose-invert max-w-none">{rem.artifact.content}</Streamdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!architectRun && !redTeamRun && !remediationRun && !isAnyRunning && (
        <div className="text-center py-12 text-muted-foreground">
          <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No agent runs yet</p>
          <p className="text-xs mt-1">Start with Deal Architect to generate all acquisition artifacts</p>
        </div>
      )}

      {/* Running state */}
      {isAnyRunning && (
        <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm">
            {architectMutation.isPending && "Deal Architect generating artifacts..."}
            {redTeamMutation.isPending && "Red Team stress-testing the deal..."}
            {remediationMutation.isPending && "Remediation Agent filling gaps..."}
          </span>
        </div>
      )}
    </div>
  );
}

function OutreachTab({ dealId }: { dealId: number }) {
  const { data: contacts, isLoading, refetch } = trpc.outreach.getByDealId.useQuery({ dealId });
  const createContact = trpc.outreach.create.useMutation({
    onSuccess: () => { toast.success("Contact added"); refetch(); },
  });
  const updateStatus = trpc.outreach.updateStatus.useMutation({
    onSuccess: () => refetch(),
  });

  const statusColor: Record<string, string> = {
    not_contacted: "bg-muted/60 text-muted-foreground",
    email_sent: "bg-blue-500/20 text-blue-400",
    responded: "bg-emerald-500/20 text-[var(--sage)]",
    call_scheduled: "bg-amber-500/20 text-[var(--amber)]",
    nda_sent: "bg-purple-500/20 text-purple-400",
    nda_signed: "bg-primary/20 text-primary",
    passed: "bg-muted/30 text-muted-foreground/60",
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-sm font-semibold">Outreach Pipeline</CardTitle>
          <CardDescription className="text-xs">{contacts?.length ?? 0} contacts tracked</CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs border-border"
          onClick={() => createContact.mutate({ dealId, contactName: "Broker", contactRole: "Business Broker" })}
          disabled={createContact.isPending}
        >
          <Mail className="w-3 h-3 mr-1.5" />
          Add Contact
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : !contacts?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Mail className="w-10 h-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No contacts yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Add broker and seller contacts to track outreach</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
                <div>
                  <p className="text-sm font-medium text-foreground">{c.contactName ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{c.contactRole ?? "Contact"} · {c.contactEmail ?? "No email"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium", statusColor[c.status] ?? "bg-muted text-muted-foreground")}>
                    {c.status.replace(/_/g, " ")}
                  </span>
                  {c.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] border-border"
                      onClick={() => updateStatus.mutate({ id: c.id, status: "sent" })}
                    >
                      Mark Sent
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

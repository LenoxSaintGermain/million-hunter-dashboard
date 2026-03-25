import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
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
} from "lucide-react";
import { Link } from "wouter";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
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
    onSuccess: (d) => { toast.success(`Scored: ${d.score.toFixed(3)}`); refetch(); },
  });

  const fmt = (n: number | null | undefined, prefix = "$") => {
    if (n == null) return "—";
    if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(0)}k`;
    return `${prefix}${n}`;
  };

  const pct = (n: number | null | undefined) => n == null ? "—" : `${Math.round(n * 100)}%`;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
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
      </DashboardLayout>
    );
  }

  const { deal, signal, memo } = data;
  const score = deal.score;
  const scoreColor = score == null ? "text-muted-foreground" : score >= 0.8 ? "text-emerald-500" : score >= 0.65 ? "text-amber-500" : "text-destructive";

  return (
    <DashboardLayout>
      {/* Back nav */}
      <Link href="/scan">
        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground -ml-2">
          <ArrowLeft className="w-3 h-3 mr-1.5" />
          Back to Scan
        </Button>
      </Link>

      {/* Deal header */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/8 via-card to-card p-6">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {deal.industry && <Badge variant="secondary" className="text-xs">{deal.industry}</Badge>}
              {deal.source && <Badge variant="outline" className="text-xs border-border">{deal.source}</Badge>}
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/15 text-primary">
                {deal.stage.replace(/_/g, " ")}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">{deal.name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              {deal.location && (
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{deal.location}</span>
              )}
              {deal.employees && (
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{deal.employees} employees</span>
              )}
              {deal.yearEstablished && (
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Est. {deal.yearEstablished}</span>
              )}
              {deal.listingUrl && (
                <a href={deal.listingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" />View Listing
                </a>
              )}
            </div>
          </div>

          {/* Score + Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-center">
              <div className={cn("text-4xl font-bold font-mono", scoreColor)}>
                {score != null ? score.toFixed(3) : "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">AI Score</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button size="sm" className="h-8 text-xs" onClick={() => scoreDeal.mutate({ id: dealId })} disabled={scoreDeal.isPending}>
                <Zap className="w-3 h-3 mr-1.5" />
                {scoreDeal.isPending ? "Scoring..." : "Score"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-border"
                onClick={() => analyzeSignals.mutate({ dealId })}
                disabled={analyzeSignals.isPending}
              >
                <Brain className="w-3 h-3 mr-1.5" />
                {analyzeSignals.isPending ? "Analyzing..." : "Run Signals"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Annual Revenue" value={fmt(deal.revenue)} />
        <StatCard
          label="Cash Flow / SDE"
          value={fmt(deal.cashFlow)}
          sub={deal.revenue && deal.cashFlow ? `${Math.round((deal.cashFlow / deal.revenue) * 100)}% margin` : undefined}
        />
        <StatCard label="Asking Price" value={fmt(deal.askingPrice)} />
        <StatCard label="Multiple" value={deal.multiple ? `${deal.multiple.toFixed(2)}x` : "—"} sub="EBITDA multiple" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="signals">
        <TabsList className="bg-card border border-border h-9">
          <TabsTrigger value="signals" className="text-xs h-7">Third Signal</TabsTrigger>
          <TabsTrigger value="memo" className="text-xs h-7">Investment Memo</TabsTrigger>
          <TabsTrigger value="capital" className="text-xs h-7">Capital Stack</TabsTrigger>
          <TabsTrigger value="outreach" className="text-xs h-7">Outreach</TabsTrigger>
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
              <SignalCard icon={DollarSign} title="Capital Stack" color="bg-emerald-500/20 text-emerald-400">
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
                      (signal.dscr ?? 0) >= 1.25 ? "text-emerald-500" : "text-destructive"
                    )}>{signal.dscr?.toFixed(2) ?? "—"}</span>
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
                        (signal.dscr ?? 0) >= 1.25 ? "text-emerald-500" : "text-destructive"
                      )}>{signal.dscr?.toFixed(2) ?? "—"}</p>
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
      </Tabs>
    </DashboardLayout>
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
    responded: "bg-emerald-500/20 text-emerald-400",
    call_scheduled: "bg-amber-500/20 text-amber-400",
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
                  {c.status === "not_contacted" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] border-border"
                      onClick={() => updateStatus.mutate({ id: c.id, status: "email_sent" })}
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

/**
 * Insurance Prospector
 *
 * Converts the acquisition deal pipeline into a commercial insurance prospect list.
 * Each qualified deal is scored for premium potential, policy fit, and a pre-call brief.
 * Designed for NY Life / Northwestern Mutual-tier agents.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Shield, TrendingUp, Users, DollarSign, ChevronDown, ChevronUp,
  RefreshCw, Loader2, FileText, Phone, CheckCircle2, AlertTriangle,
  Building2, BarChart3, Briefcase, Heart, Car, Umbrella, Scale
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMoney(cents: number | null | undefined): string {
  if (!cents) return "—";
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`;
  return `$${dollars.toFixed(0)}`;
}

function fmtRevenue(cents: number | null | undefined): string {
  if (!cents) return "—";
  return fmtMoney(cents);
}

const RISK_COLORS: Record<string, string> = {
  low: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  moderate: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  elevated: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  high: "text-red-400 bg-red-400/10 border-red-400/20",
};

const STATUS_COLORS: Record<string, string> = {
  new: "text-muted-foreground bg-muted/30 border-border",
  briefed: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  contacted: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  quoted: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  closed: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  passed: "text-muted-foreground bg-muted/10 border-border",
};

const POLICY_ICONS: Record<string, React.ElementType> = {
  "Key Man": Shield,
  "Key Person": Shield,
  "Buy-Sell": Scale,
  "Business Interruption": AlertTriangle,
  "Commercial Property": Building2,
  "General Liability": Briefcase,
  "Workers' Compensation": Users,
  "Group Benefits": Heart,
  "Commercial Auto": Car,
  "Umbrella": Umbrella,
  "Errors & Omissions": Scale,
  "Professional Liability": Scale,
};

function getPolicyIcon(policy: string): React.ElementType {
  for (const [key, Icon] of Object.entries(POLICY_ICONS)) {
    if (policy.toLowerCase().includes(key.toLowerCase())) return Icon;
  }
  return Shield;
}

// ─── Prospect Card ────────────────────────────────────────────────────────────
interface ProspectRow {
  id: number;
  deal_id: number;
  deal_name: string;
  industry: string | null;
  location: string | null;
  revenue: number | null;
  employees: number | null;
  deal_stage: string;
  prospect_score: number | null;
  estimated_premium_low: number | null;
  estimated_premium_high: number | null;
  risk_profile: "low" | "moderate" | "elevated" | "high";
  policy_fit: Array<{
    policy: string;
    relevance: "high" | "medium" | "low";
    estimatedPremium?: number;
    rationale: string;
  }>;
  brief_text: string | null;
  status: string;
}

function ProspectCard({ prospect, onStatusChange }: {
  prospect: ProspectRow;
  onStatusChange: (dealId: number, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const score = prospect.prospect_score ?? 0;
  const scoreColor = score >= 0.75 ? "text-emerald-400" : score >= 0.5 ? "text-amber-400" : "text-muted-foreground";
  const highPolicies = (prospect.policy_fit ?? []).filter(p => p.relevance === "high");
  const riskClass = RISK_COLORS[prospect.risk_profile] ?? RISK_COLORS.moderate;
  const statusClass = STATUS_COLORS[prospect.status] ?? STATUS_COLORS.new;

  return (
    <Card
      className="border transition-all duration-200 hover:border-primary/30"
      style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}
    >
      <CardContent className="p-0">
        {/* Header Row */}
        <div className="flex items-start gap-4 p-5">
          {/* Score */}
          <div className="flex-shrink-0 w-14 text-center">
            <div className={`text-2xl font-bold tabular-nums font-mono ${scoreColor}`}>
              {(score * 100).toFixed(0)}
            </div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">Score</div>
          </div>

          {/* Main Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground text-sm leading-tight">{prospect.deal_name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {prospect.industry ?? "Business"} · {prospect.location ?? "Unknown"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${riskClass}`}>
                  {prospect.risk_profile} risk
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${statusClass}`}>
                  {prospect.status}
                </span>
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <DollarSign className="w-3 h-3" />
                <span>Rev: <span className="text-foreground font-medium">{fmtRevenue(prospect.revenue)}</span></span>
              </div>
              {prospect.employees && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" />
                  <span><span className="text-foreground font-medium">{prospect.employees}</span> employees</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="w-3 h-3" />
                <span>Est. premium: <span className="text-amber-400 font-medium font-mono">
                  {fmtMoney(prospect.estimated_premium_low)}–{fmtMoney(prospect.estimated_premium_high)}/yr
                </span></span>
              </div>
            </div>

            {/* Top Policy Badges */}
            {highPolicies.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {highPolicies.slice(0, 4).map((p) => {
                  const Icon = getPolicyIcon(p.policy);
                  return (
                    <span
                      key={p.policy}
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-primary/20 bg-primary/5 text-primary"
                    >
                      <Icon className="w-2.5 h-2.5" />
                      {p.policy}
                    </span>
                  );
                })}
                {highPolicies.length > 4 && (
                  <span className="text-[10px] text-muted-foreground px-1">+{highPolicies.length - 4} more</span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-[var(--sh-border)] hover:border-primary/40"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
              {expanded ? "Collapse" : "View Brief"}
            </Button>
            <select
              value={prospect.status}
              onChange={(e) => onStatusChange(prospect.deal_id, e.target.value)}
              className="h-7 text-xs rounded border border-[var(--sh-border)] bg-transparent text-muted-foreground px-2 cursor-pointer hover:border-primary/40 transition-colors"
            >
              <option value="new">New</option>
              <option value="briefed">Briefed</option>
              <option value="contacted">Contacted</option>
              <option value="quoted">Quoted</option>
              <option value="closed">Closed</option>
              <option value="passed">Passed</option>
            </select>
          </div>
        </div>

        {/* Expanded: Policy Fit + Brief */}
        {expanded && (
          <div className="border-t border-[var(--sh-border)] p-5 space-y-5">
            {/* Policy Fit Table */}
            {(prospect.policy_fit ?? []).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Policy Fit Analysis</p>
                <div className="space-y-2">
                  {prospect.policy_fit.map((p) => {
                    const Icon = getPolicyIcon(p.policy);
                    const relColor = p.relevance === "high" ? "text-emerald-400" : p.relevance === "medium" ? "text-amber-400" : "text-muted-foreground";
                    return (
                      <div key={p.policy} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--sh-surface-2)" }}>
                        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${relColor}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-foreground">{p.policy}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {p.estimatedPremium && (
                                <span className="text-[10px] font-mono text-amber-400">{fmtMoney(p.estimatedPremium)}/yr</span>
                              )}
                              <span className={`text-[9px] uppercase font-semibold ${relColor}`}>{p.relevance}</span>
                            </div>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{p.rationale}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pre-Call Brief */}
            {prospect.brief_text && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Phone className="w-3 h-3" />
                  Pre-Call Brief
                </p>
                <div
                  className="p-4 rounded-lg border border-[var(--sh-border)] text-sm text-foreground leading-relaxed whitespace-pre-wrap"
                  style={{ background: "var(--sh-surface-2)", fontFamily: "var(--font-sans)" }}
                >
                  {prospect.brief_text}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InsuranceProspector() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [isBatchScoring, setIsBatchScoring] = useState(false);

  const { data: prospects, isLoading } = trpc.insurance.listProspects.useQuery(
    statusFilter !== "all" || riskFilter !== "all"
      ? {
          status: statusFilter !== "all" ? statusFilter as "new" | "briefed" | "contacted" | "quoted" | "closed" | "passed" : undefined,
          riskProfile: riskFilter !== "all" ? riskFilter as "low" | "moderate" | "elevated" | "high" : undefined,
        }
      : undefined,
    { refetchOnWindowFocus: false }
  );

  const batchScore = trpc.insurance.batchScore.useMutation({
    onSuccess: (result) => {
      setIsBatchScoring(false);
      toast.success(`Scored ${result.scored} prospects`, {
        description: result.errors.length > 0 ? `${result.errors.length} errors` : "All prospects briefed",
      });
      utils.insurance.listProspects.invalidate();
    },
    onError: (e) => {
      setIsBatchScoring(false);
      toast.error(`Batch scoring failed: ${e.message}`);
    },
  });

  const updateStatus = trpc.insurance.updateStatus.useMutation({
    onSuccess: () => utils.insurance.listProspects.invalidate(),
    onError: (e) => toast.error(`Status update failed: ${e.message}`),
  });

  const handleBatchScore = () => {
    setIsBatchScoring(true);
    batchScore.mutate();
  };

  const handleStatusChange = (dealId: number, status: string) => {
    updateStatus.mutate({ dealId, status: status as "new" | "briefed" | "contacted" | "quoted" | "closed" | "passed" });
  };

  const prospectList = (prospects ?? []) as unknown as ProspectRow[];

  // Stats
  const totalPremiumLow = prospectList.reduce((sum, p) => sum + (p.estimated_premium_low ?? 0), 0);
  const totalPremiumHigh = prospectList.reduce((sum, p) => sum + (p.estimated_premium_high ?? 0), 0);
  const avgScore = prospectList.length > 0
    ? prospectList.reduce((sum, p) => sum + (p.prospect_score ?? 0), 0) / prospectList.length
    : 0;
  const highPriorityCount = prospectList.filter(p => (p.prospect_score ?? 0) >= 0.7).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow text-muted-foreground mb-1">Commercial Insurance Intelligence</p>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              Insurance Prospector
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Every business in the acquisition pipeline is a prospective commercial insurance client.
              AI-scored for premium potential, policy fit, and pre-call brief generation.
            </p>
          </div>
          <Button
            onClick={handleBatchScore}
            disabled={isBatchScoring}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isBatchScoring ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scoring Pipeline...</>
            ) : (
              <><RefreshCw className="w-4 h-4 mr-2" />Score All Deals</>
            )}
          </Button>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Prospects",
              value: prospectList.length.toString(),
              icon: Building2,
              sub: `${highPriorityCount} high priority`,
            },
            {
              label: "Est. Premium Pool",
              value: `${fmtMoney(totalPremiumLow)}–${fmtMoney(totalPremiumHigh)}`,
              icon: DollarSign,
              sub: "annual, all prospects",
            },
            {
              label: "Avg Prospect Score",
              value: `${(avgScore * 100).toFixed(0)}`,
              icon: BarChart3,
              sub: "out of 100",
            },
            {
              label: "Briefed",
              value: prospectList.filter(p => p.status !== "new").length.toString(),
              icon: FileText,
              sub: "ready to contact",
            },
          ].map((stat) => (
            <Card key={stat.label} style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{stat.label}</p>
                  <stat.icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p className="text-xl font-bold tabular-nums font-mono text-foreground">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{stat.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground font-medium">Filter:</p>
          <div className="flex gap-2">
            {["all", "new", "briefed", "contacted", "quoted", "closed"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  statusFilter === s
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-[var(--sh-border)] text-muted-foreground hover:border-primary/30"
                }`}
              >
                {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex gap-2">
            {["all", "low", "moderate", "elevated", "high"].map((r) => (
              <button
                key={r}
                onClick={() => setRiskFilter(r)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  riskFilter === r
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-[var(--sh-border)] text-muted-foreground hover:border-primary/30"
                }`}
              >
                {r === "all" ? "All Risk" : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Prospect List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : prospectList.length === 0 ? (
          <Card style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Shield className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-base font-semibold text-foreground mb-2">No prospects scored yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Click "Score All Deals" to run AI analysis on your qualified deal pipeline and generate insurance prospect briefs.
                This typically takes 30–60 seconds for 10–20 deals.
              </p>
              <Button onClick={handleBatchScore} disabled={isBatchScoring}>
                {isBatchScoring ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scoring...</>
                ) : (
                  <><Shield className="w-4 h-4 mr-2" />Score Pipeline Now</>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {prospectList.map((prospect) => (
              <ProspectCard
                key={prospect.deal_id}
                prospect={prospect}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}

        {/* Context Note */}
        <div
          className="p-4 rounded-lg border text-xs text-muted-foreground leading-relaxed"
          style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}
        >
          <p className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            How this works
          </p>
          <p>
            Each business in the acquisition pipeline has been analyzed for revenue, employee count, industry risk class,
            owner dependency signals, and physical asset exposure. The AI underwriting model scores each business against
            9 commercial policy types and generates a pre-call brief — the context an agent needs before the first conversation.
            Premium estimates are directional (±30%) and based on industry benchmarks, not actuarial tables.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

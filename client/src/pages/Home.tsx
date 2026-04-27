import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import ScanProgress from "@/components/ScanProgress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  TrendingUp, DollarSign, Activity, ArrowUpRight,
  Zap, Brain, RefreshCw, ChevronRight,
  Building2, MapPin, Clock, AlertCircle,
  Landmark, CalendarDays, BarChart2, Megaphone, Waves,
  ExternalLink, Loader2, Users,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── Design System Helpers ───────────────────────────────────────────────────
const C = {
  p:   "oklch(0.65 0.22 250)",
  em:  "oklch(0.70 0.18 160)",
  am:  "oklch(0.75 0.20 80)",
  re:  "oklch(0.60 0.22 25)",
  cy:  "oklch(0.75 0.15 200)",
  vi:  "oklch(0.65 0.22 290)",
  ro:  "oklch(0.65 0.20 15)",
  fg1: "oklch(0.95 0.01 260)",
  fg2: "oklch(0.85 0.01 260)",
  fg3: "oklch(0.55 0.01 260)",
  fg4: "oklch(0.40 0.01 260)",
  s1:  "oklch(0.14 0.01 260)",
  s2:  "oklch(0.18 0.01 260)",
  bd:  "oklch(0.22 0.01 260)",
};

const scoreColor = (v: number) => v >= 0.8 ? C.em : v >= 0.65 ? C.am : C.re;
const fmt = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
};

// ─── ScoreBadge ──────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: any }) {
  const v = score == null ? null : parseFloat(String(score));
  if (v == null || isNaN(v)) return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: C.fg4 }}>—</span>
  );
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: scoreColor(v) }}>
      {v.toFixed(3)}
    </span>
  );
}

// ─── ConfidenceBar ───────────────────────────────────────────────────────────
function ConfidenceBar({ score }: { score: any }) {
  const v = score == null ? null : parseFloat(String(score));
  if (v == null || isNaN(v)) return null;
  const pct = Math.round(v * 100);
  const color = pct >= 85 ? C.em : pct >= 70 ? C.am : C.fg3;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: C.s2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.85s cubic-bezier(0.16,1,0.3,1)" }} />
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: C.fg3, flexShrink: 0 }}>{pct}%</span>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, trend, accentColor }: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  trend?: "up" | "down" | "neutral"; accentColor?: string;
}) {
  const accent = accentColor ?? C.p;
  return (
    <div
      className="card-hover-lift"
      style={{
        background: C.s1,
        border: `1px solid ${C.bd}`,
        borderRadius: 12,
        padding: "16px",
        cursor: "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: C.fg4 }}>
          {label}
        </span>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: `${accent}1a`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon style={{ width: 14, height: 14, color: accent }} />
        </div>
      </div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 24, fontWeight: 700, color: C.fg1, lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
          {trend === "up" && <ArrowUpRight style={{ width: 12, height: 12, color: C.em }} />}
          <span style={{ fontSize: 11, color: trend === "up" ? C.em : trend === "down" ? C.re : C.fg3 }}>
            {sub}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Pipeline Velocity Sparkline ─────────────────────────────────────────────
function VelocitySparkline() {
  const { data, isLoading } = trpc.deals.velocity.useQuery();
  const hasData = data && data.length > 0;
  const total = data?.reduce((s, d) => s + (Number(d.count) || 0), 0) ?? 0;
  const safeTotal = isNaN(total) ? 0 : total;
  const trend = data && data.length >= 2
    ? (Number(data[data.length - 1].count) || 0) - (Number(data[data.length - 2].count) || 0)
    : 0;
  const safeTrend = isNaN(trend) ? 0 : trend;

  return (
    <div style={{ background: C.s1, border: `1px solid ${C.bd}`, borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: C.fg4 }}>
            Pipeline Velocity
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: C.fg1 }}>
              {isLoading ? "—" : String(safeTotal)}
            </span>
            <span style={{ fontSize: 11, color: C.fg3 }}>deals / 8 wks</span>
            {!isLoading && safeTrend !== 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: safeTrend > 0 ? C.em : C.re, display: "flex", alignItems: "center", gap: 2 }}>
                <ArrowUpRight style={{ width: 12, height: 12, transform: safeTrend < 0 ? "rotate(180deg)" : undefined }} />
                {safeTrend > 0 ? "+" : ""}{String(safeTrend)} wk
              </span>
            )}
          </div>
        </div>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${C.p}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TrendingUp style={{ width: 14, height: 14, color: C.p }} />
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-14 w-full" />
      ) : !hasData ? (
        <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontSize: 10, color: `${C.fg4}` }}>No data yet — run a scan</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={56}>
          <AreaChart data={data} margin={{ top: 4, right: 0, left: -32, bottom: 0 }}>
            <defs>
              <linearGradient id="velocityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.p} stopOpacity={0.3} />
                <stop offset="95%" stopColor={C.p} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="week" tick={{ fontSize: 9, fill: C.fg3 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: C.fg3 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: C.s1, border: `1px solid ${C.bd}`, borderRadius: 6, fontSize: 11, padding: "4px 8px" }}
              labelStyle={{ color: C.fg3 }}
              itemStyle={{ color: C.fg1 }}
            />
            <Area type="monotone" dataKey="count" name="Deals" stroke={C.p} strokeWidth={1.5} fill="url(#velocityGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Signal type config ──────────────────────────────────────────────────────
const SIGNAL_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
  institutional: { icon: Landmark,    color: C.vi, bg: `${C.vi}15`, border: `${C.vi}25`, label: "Institutional" },
  government:    { icon: Megaphone,   color: C.p,  bg: `${C.p}15`,  border: `${C.p}25`,  label: "Government" },
  seasonal:      { icon: CalendarDays,color: C.am, bg: `${C.am}15`, border: `${C.am}25`, label: "Seasonal" },
  event:         { icon: Zap,         color: C.ro, bg: `${C.ro}15`, border: `${C.ro}25`, label: "Event" },
  macro_momentum:{ icon: Waves,       color: C.em, bg: `${C.em}15`, border: `${C.em}25`, label: "Macro" },
};

// ─── Investor Interests Panel (operator-only) ───────────────────────────────
const INTEREST_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  expressed:         { bg: `oklch(0.75 0.20 80 / 0.15)`, color: `oklch(0.75 0.20 80)` },
  operator_reviewing:{ bg: `oklch(0.75 0.15 200 / 0.15)`, color: `oklch(0.72 0.15 200)` },
  memo_shared:       { bg: `oklch(0.65 0.22 250 / 0.15)`, color: `oklch(0.65 0.22 250)` },
  committed:         { bg: `oklch(0.70 0.18 160 / 0.15)`, color: `oklch(0.70 0.18 160)` },
  passed:            { bg: `oklch(0.40 0.01 260 / 0.1)`,  color: `oklch(0.40 0.01 260)` },
};
const INTEREST_STATUS_LABELS: Record<string, string> = {
  expressed: "Expressed",
  operator_reviewing: "Reviewing",
  memo_shared: "Memo Shared",
  committed: "Committed",
  passed: "Passed",
};

function InvestorInterestsPanel() {
  const utils = trpc.useUtils();
  const { data: interests, isLoading } = trpc.investor.getAllInterests.useQuery(undefined, { retry: false });
  const updateStatus = trpc.investor.updateInterestStatus.useMutation({
    onSuccess: () => utils.investor.getAllInterests.invalidate(),
  });

  if (isLoading || !interests || interests.length === 0) return null;

  return (
    <div style={{
      background: C.s1, border: `1px solid ${C.bd}`, borderRadius: 12,
      padding: 20, gridColumn: "span 7",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `${C.p}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users style={{ width: 14, height: 14, color: C.p }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.fg1 }}>Investor Interests</span>
        </div>
        <span style={{ fontSize: 11, color: C.fg4, fontFamily: "var(--font-mono)" }}>
          {(interests as any[]).length} total
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(interests as any[]).map((interest: any) => {
          const sc = INTEREST_STATUS_COLORS[interest.status] ?? INTEREST_STATUS_COLORS.expressed;
          return (
            <div key={interest.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 12, padding: "10px 12px", borderRadius: 8,
              background: C.s2, border: `1px solid ${C.bd}`,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.fg1 }}>
                  Deal #{interest.dealId}
                  {interest.dealName && ` · ${interest.dealName}`}
                </p>
                {interest.allocationAmount && (
                  <p style={{ fontSize: 11, color: C.em, fontFamily: "var(--font-mono)", marginTop: 2 }}>
                    ${Number(interest.allocationAmount).toLocaleString()} allocation
                  </p>
                )}
                {interest.investorNote && (
                  <p style={{ fontSize: 11, color: C.fg3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {interest.investorNote}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: sc.bg, color: sc.color }}>
                  {INTEREST_STATUS_LABELS[interest.status] ?? interest.status}
                </span>
                <select
                  value={interest.status}
                  onChange={(e) => updateStatus.mutate({ interestId: interest.id, status: e.target.value as any })}
                  style={{ fontSize: 11, background: C.s2, color: C.fg3, border: `1px solid ${C.bd}`, borderRadius: 6, padding: "2px 6px" }}
                >
                  {Object.entries(INTEREST_STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sentinel Panel ──────────────────────────────────────────────────────────
function SentinelPanel() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const { isAuthenticated } = useAuth();
  const { data: signals, isLoading, refetch } = trpc.sentinel.list.useQuery({ limit: 10 }, { enabled: isAuthenticated });
  const seed = trpc.sentinel.seed.useMutation({
    onSuccess: (r) => { if (r.seeded) { toast.success(`Sentinel seeded with ${r.count} signals`); refetch(); } },
  });
  const aiRefresh = trpc.sentinel.aiRefresh.useMutation({
    onSuccess: (r) => { toast.success(`${r.message}`); refetch(); },
    onError: (e) => toast.error(`Refresh failed: ${e.message}`),
  });
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
  const expiryLabel = (expiresAt: number | null | undefined) => {
    if (!expiresAt) return null;
    const msLeft = expiresAt - Date.now();
    if (msLeft <= 0) return { label: "Expired", urgent: false };
    const hLeft = Math.round(msLeft / 3600000);
    const dLeft = Math.round(msLeft / 86400000);
    if (hLeft < 24) return { label: `Expires in ${hLeft}h`, urgent: hLeft < 6 };
    return { label: `Expires in ${dLeft}d`, urgent: false };
  };

  return (
    <div style={{ background: C.s1, border: `1px solid ${C.bd}`, borderRadius: 12, display: "flex", flexDirection: "column", gridColumn: "span 2" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${C.bd}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <BarChart2 style={{ width: 14, height: 14, color: C.p }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.fg1 }}>Macro Signals Sentinel</span>
          </div>
          <p style={{ fontSize: 11, color: C.fg3 }}>Institutional moves, permits, events &amp; macro tailwinds</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => aiRefresh.mutate()}
            disabled={aiRefresh.isPending}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 500, height: 24, padding: "0 8px", borderRadius: 6,
              background: "transparent", border: `1px solid ${C.bd}`, color: C.fg3, cursor: "pointer",
            }}
          >
            {aiRefresh.isPending
              ? <Loader2 style={{ width: 10, height: 10 }} className="animate-spin" />
              : <RefreshCw style={{ width: 10, height: 10 }} />}
            {aiRefresh.isPending ? "Scanning..." : "Refresh"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className="live-dot" />
            <span style={{ fontSize: 10, color: C.em, fontWeight: 500 }}>Live</span>
          </div>
        </div>
      </div>

      {/* Signal list */}
      <div style={{ flex: 1, overflowY: "auto", maxHeight: 480, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {isLoading || seed.isPending ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ padding: 12, borderRadius: 8, border: `1px solid ${C.bd}`, background: `${C.s2}20` }}>
              <Skeleton className="h-3 w-3/4 mb-2" />
              <Skeleton className="h-2 w-full mb-1" />
              <Skeleton className="h-1.5 w-1/2" />
            </div>
          ))
        ) : !signals?.length ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 0", textAlign: "center" }}>
            <Waves style={{ width: 32, height: 32, color: `${C.fg4}`, marginBottom: 8 }} />
            <p style={{ fontSize: 12, color: C.fg3 }}>No signals yet</p>
          </div>
        ) : (
          [...signals]
            .filter((sig) => !sig.expiresAt || sig.expiresAt > Date.now())
            .sort((a, b) => (parseFloat(String(b.confidenceScore ?? 0)) || 0) - (parseFloat(String(a.confidenceScore ?? 0)) || 0))
            .map((sig) => {
              const cfg = SIGNAL_CONFIG[sig.signalType] ?? SIGNAL_CONFIG.macro_momentum;
              const Icon = cfg.icon;
              const isOpen = expanded === sig.id;
              const isHighUrgency = (parseFloat(String(sig.confidenceScore ?? 0)) || 0) >= 0.88;
              return (
                <div
                  key={sig.id}
                  className="signal-hover"
                  onClick={() => setExpanded(isOpen ? null : sig.id)}
                  style={{
                    borderRadius: 8,
                    border: `1px solid ${isHighUrgency ? `${C.re}30` : isOpen ? `${C.p}30` : C.bd}`,
                    background: isHighUrgency ? `${C.re}08` : isOpen ? `${C.p}08` : `${C.s2}20`,
                    cursor: "pointer",
                    padding: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 2,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: cfg.bg, border: `1px solid ${cfg.border}`,
                    }}>
                      <Icon style={{ width: 12, height: 12, color: cfg.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: C.fg1, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {sig.title}
                          </p>
                          {isHighUrgency && (
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 2, marginTop: 2,
                              padding: "0 6px", height: 16, borderRadius: 4,
                              fontSize: 9, fontWeight: 700,
                              background: `${C.re}15`, color: C.re, border: `1px solid ${C.re}25`,
                            }}>⚡ High Urgency</span>
                          )}
                        </div>
                        <span style={{
                          display: "inline-flex", flexShrink: 0, alignItems: "center",
                          padding: "0 6px", height: 16, borderRadius: 4, marginLeft: 4,
                          fontSize: 9, fontWeight: 700,
                          background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                        }}>
                          {cfg.label}
                        </span>
                      </div>
                      <ConfidenceBar score={sig.confidenceScore} />
                      <p style={{ fontSize: 10, color: C.fg3, marginTop: 4, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                        <Clock style={{ width: 10, height: 10 }} />
                        {elapsed(sig.createdAt)}
                        {sig.impactedAssetClasses && sig.impactedAssetClasses.length > 0 && (
                          <><span style={{ color: `${C.fg4}` }}>·</span><span>{sig.impactedAssetClasses.slice(0, 2).join(", ")}</span></>
                        )}
                        {(() => {
                          const exp = expiryLabel(sig.expiresAt);
                          if (!exp) return null;
                          return (
                            <><span style={{ color: C.fg4 }}>·</span><span style={{ color: exp.urgent ? C.am : C.fg3, fontWeight: exp.urgent ? 600 : 400 }}>{exp.label}</span></>
                          );
                        })()}
                      </p>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.bd}`, display: "flex", flexDirection: "column", gap: 8 }}>
                      <p style={{ fontSize: 12, color: C.fg2, lineHeight: 1.6 }}>{sig.summary}</p>
                      {sig.roryPitch && (
                        <div style={{ padding: 10, borderRadius: 6, background: `${C.p}08`, border: `1px solid ${C.p}15` }}>
                          <p style={{ fontSize: 9, color: `${C.p}b0`, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Signal Insight</p>
                          <p style={{ fontSize: 12, color: C.fg1, fontStyle: "italic", lineHeight: 1.6 }}>"{sig.roryPitch}"</p>
                        </div>
                      )}
                      {sig.recommendedAction && (
                        <div style={{ padding: 10, borderRadius: 6, background: `${C.em}08`, border: `1px solid ${C.em}15` }}>
                          <p style={{ fontSize: 9, color: C.em, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Recommended Action</p>
                          <p style={{ fontSize: 12, color: C.fg1, lineHeight: 1.6 }}>{sig.recommendedAction}</p>
                        </div>
                      )}
                      {sig.sourceUrl && (
                        <a href={sig.sourceUrl} target="_blank" rel="noopener noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: C.p, textDecoration: "none" }}
                          onClick={(e) => e.stopPropagation()}>
                          <ExternalLink style={{ width: 10, height: 10 }} />
                          Source
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

// ─── Home ────────────────────────────────────────────────────────────────────
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

  const stats = data?.dealStats;
  const outStats = data?.outreachStats;

  const activityIcon: Record<string, React.ElementType> = {
    deal_added: Building2, deal_scored: Zap, signal_analyzed: Brain,
    red_flag_detected: AlertCircle, memo_generated: Activity,
    outreach_sent: ArrowUpRight, scan_completed: RefreshCw, stage_changed: ChevronRight,
  };
  const activityColor: Record<string, string> = {
    deal_added: C.p, deal_scored: C.am, signal_analyzed: C.vi,
    red_flag_detected: C.re, memo_generated: C.p, outreach_sent: C.em,
    scan_completed: C.p, stage_changed: C.fg3,
  };

  return (
    <DashboardLayout>

      {/* ── Hero Panel ── */}
      <div className="sh-hero-panel" style={{ padding: "24px 28px" }}>
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span className="live-dot" />
                <span style={{ fontSize: 11, color: C.em, fontWeight: 500 }}>System Operational</span>
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: C.fg1, letterSpacing: "-0.01em", marginBottom: 6 }}>
                Signal Hunter Command Center
              </h1>
              <p style={{ fontSize: 13, color: C.fg3, maxWidth: 520 }}>
                {data?.latestScan
                  ? `Last scan: ${new Date(data.latestScan.createdAt).toLocaleString()} · ${(data.latestScan.sources as string[] | null)?.length ?? 0} platforms`
                  : "No scan data yet. Trigger a market scan to begin."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                className="btn-press"
                onClick={() => triggerScan.mutate({})}
                disabled={triggerScan.isPending || activeScanJobId !== null}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  height: 36, padding: "0 14px", borderRadius: 8,
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                  background: "transparent", border: `1px solid ${C.bd}`, color: C.fg2,
                  opacity: (triggerScan.isPending || activeScanJobId !== null) ? 0.6 : 1,
                }}
              >
                <RefreshCw style={{ width: 14, height: 14 }} className={cn(triggerScan.isPending && "animate-spin")} />
                {triggerScan.isPending ? "Starting..." : activeScanJobId ? "Scan Running..." : "Run Market Scan"}
              </button>
              <Link href="/scan">
                <button
                  className="btn-press"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    height: 36, padding: "0 14px", borderRadius: 8,
                    fontSize: 12, fontWeight: 500, cursor: "pointer",
                    background: C.p, border: "none", color: "oklch(0.98 0.005 260)",
                  }}
                >
                  <TrendingUp style={{ width: 14, height: 14 }} />
                  View Pipeline
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scan Progress ── */}
      {activeScanJobId !== null && (
        <ScanProgress
          jobId={activeScanJobId}
          onComplete={() => {
            setActiveScanJobId(null);
            refetch();
            utils.deals.list.invalidate();
            utils.dashboard.stats.invalidate();
          }}
          onRetry={() => { setActiveScanJobId(null); triggerScan.mutate({}); }}
        />
      )}

      {/* ── KPI Cards ── */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Pipeline Value" value={fmt(stats?.totalPipelineValue)}
            sub={`${stats?.total ?? 0} active deals`} icon={DollarSign} trend="up" />
          <KpiCard label="Avg. Deal Score"
            value={stats?.avgScore != null ? parseFloat(String(stats.avgScore)).toFixed(3) : "—"}
            sub="across qualified deals" icon={TrendingUp} trend="up" accentColor={C.am} />
          <KpiCard label="High Priority" value={String(stats?.highPriority ?? 0)}
            sub="deals ready for outreach" icon={Zap}
            trend={stats?.highPriority ? "up" : "neutral"} accentColor={C.em} />
          <KpiCard label="Outreach Active" value={String(outStats?.totalSent ?? 0)}
            sub={`${outStats?.responded ?? 0} responded`} icon={Activity}
            trend={outStats?.responded ? "up" : "neutral"} accentColor={C.cy} />
        </div>
      )}

      {/* ── Pipeline Velocity ── */}
      <VelocitySparkline />

      {/* ── Investor Interests (operator-only) ── */}
      <InvestorInterestsPanel />

      {/* ── Main Grid ── */}
      <div className="grid gap-6 lg:grid-cols-7">

        {/* Top Opportunities */}
        <div style={{ background: C.s1, border: `1px solid ${C.bd}`, borderRadius: 12, gridColumn: "span 5" }}>
          <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${C.bd}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.fg1 }}>Top Opportunities</span>
              <p style={{ fontSize: 11, color: C.fg3, marginTop: 2 }}>Ranked by AI scoring algorithm</p>
            </div>
            <Link href="/scan">
              <button style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: C.fg3, background: "transparent", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = C.fg1)}
                onMouseLeave={(e) => (e.currentTarget.style.color = C.fg3)}>
                View all <ChevronRight style={{ width: 12, height: 12 }} />
              </button>
            </Link>
          </div>
          <div style={{ padding: "8px 12px" }}>
            {isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8 }}>
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : !topDealsData?.length ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0", textAlign: "center" }}>
                <Building2 style={{ width: 40, height: 40, color: C.fg4, marginBottom: 12 }} />
                <p style={{ fontSize: 13, fontWeight: 500, color: C.fg3 }}>No deals yet</p>
                <p style={{ fontSize: 11, color: C.fg4, marginTop: 4 }}>Run a market scan to populate the pipeline</p>
              </div>
            ) : (
              topDealsData.map((deal) => (
                <Link key={deal.id} href={`/deal/${deal.id}`}>
                  <div
                    className="row-hover"
                    style={{
                      display: "flex", alignItems: "center", gap: 16,
                      padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                    }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${C.p}1a`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Building2 style={{ width: 16, height: 16, color: C.p }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: C.fg1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {deal.name}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
                        {deal.location && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: C.fg3 }}>
                            <MapPin style={{ width: 10, height: 10 }} />{deal.location}
                          </span>
                        )}
                        {deal.industry && (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: "0 6px", height: 16, borderRadius: 4, background: `${C.s2}`, color: C.fg3, border: `1px solid ${C.bd}`, display: "inline-flex", alignItems: "center" }}>
                            {deal.industry}
                          </span>
                        )}
                        {deal.opportunityZone && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "0 6px", height: 16, borderRadius: 9999, background: `${C.em}15`, color: C.em, border: `1px solid ${C.em}20`, display: "inline-flex", alignItems: "center" }}>
                            OZ
                          </span>
                        )}
                        {deal.tadDistrict && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "0 6px", height: 16, borderRadius: 9999, background: `${C.p}15`, color: C.p, border: `1px solid ${C.p}20`, display: "inline-flex", alignItems: "center" }}>
                            TAD
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 24, flexShrink: 0, textAlign: "right" }}>
                      <div>
                        <p style={{ fontSize: 10, color: C.fg4, textTransform: "uppercase", letterSpacing: "0.1em" }}>Cash Flow</p>
                        <p style={{ fontSize: 12, fontWeight: 600, color: C.em, fontFamily: "var(--font-mono)" }}>{fmt(deal.cashFlow)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: C.fg4, textTransform: "uppercase", letterSpacing: "0.1em" }}>Score</p>
                        <ScoreBadge score={deal.score} />
                      </div>
                      <ChevronRight style={{ width: 14, height: 14, color: C.fg4 }} />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Macro Signals Sentinel */}
        <SentinelPanel />
      </div>
    </DashboardLayout>
  );
}

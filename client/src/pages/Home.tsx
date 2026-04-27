import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import ScanProgress from "@/components/ScanProgress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  TrendingUp, DollarSign, Activity, ArrowUpRight,
  Zap, Brain, RefreshCw, ChevronRight,
  Building2, MapPin, Clock, AlertCircle,
  Landmark, CalendarDays, BarChart2, Megaphone, Waves,
  ExternalLink, Loader2, Users, Trash2, ArrowRight,
  Target, Radio, ScanLine, Shield,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── Design Tokens (preserved) ───────────────────────────────────────────────
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

// ─── Fade-in animation hook ───────────────────────────────────────────────────
function useFadeIn(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(10px)";
    el.style.transition = `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`;
    const t = setTimeout(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    }, 30);
    return () => clearTimeout(t);
  }, [delay]);
  return ref;
}

// ─── ConfidenceBar ───────────────────────────────────────────────────────────
function ConfidenceBar({ score }: { score: any }) {
  const v = score == null ? null : parseFloat(String(score));
  if (v == null || isNaN(v)) return null;
  const pct = Math.round(v * 100);
  const color = pct >= 85 ? C.em : pct >= 70 ? C.am : C.fg3;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
      <div style={{ flex: 1, height: 2, borderRadius: 1, background: `${C.bd}`, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 1, transition: "width 0.85s cubic-bezier(0.16,1,0.3,1)" }} />
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: C.fg4, flexShrink: 0 }}>{pct}%</span>
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

// ─── Investor Interests Panel ─────────────────────────────────────────────────
const INTEREST_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  expressed:         { bg: `oklch(0.75 0.20 80 / 0.15)`,  color: `oklch(0.75 0.20 80)` },
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
  const ref = useFadeIn(300);
  const { data: interests, isLoading } = trpc.investor.getAllInterests.useQuery(undefined, { retry: false });
  const updateStatus = trpc.investor.updateInterestStatus.useMutation({
    onSuccess: () => utils.investor.getAllInterests.invalidate(),
  });

  if (isLoading || !interests || interests.length === 0) return null;

  return (
    <div ref={ref} style={{
      borderTop: `1px solid ${C.bd}`,
      paddingTop: 20,
    }}>
      {/* Section label */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: C.fg4 }}>Capital Interest</span>
          <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: `${C.p}20`, color: C.p, fontWeight: 700 }}>
            {(interests as any[]).length} active
          </span>
        </div>
        <Users style={{ width: 12, height: 12, color: C.fg4 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {(interests as any[]).map((interest: any) => {
          const sc = INTEREST_STATUS_COLORS[interest.status] ?? INTEREST_STATUS_COLORS.expressed;
          return (
            <div key={interest.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 12, padding: "8px 12px", borderRadius: 6,
              background: `${C.s2}60`, borderLeft: `2px solid ${sc.color}40`,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.fg1 }}>
                  {interest.dealName ?? `Deal #${interest.dealId}`}
                </p>
                {interest.allocationAmount && (
                  <p style={{ fontSize: 10, color: C.em, fontFamily: "var(--font-mono)", marginTop: 1 }}>
                    ${Number(interest.allocationAmount).toLocaleString()} allocation
                  </p>
                )}
                {interest.investorNote && (
                  <p style={{ fontSize: 10, color: C.fg3, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {interest.investorNote}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 9999, background: sc.bg, color: sc.color }}>
                  {INTEREST_STATUS_LABELS[interest.status] ?? interest.status}
                </span>
                <select
                  value={interest.status}
                  onChange={(e) => updateStatus.mutate({ interestId: interest.id, status: e.target.value as any })}
                  style={{ fontSize: 10, background: C.s2, color: C.fg3, border: `1px solid ${C.bd}`, borderRadius: 4, padding: "2px 4px" }}
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

// ─── Macro Signal Stream (live ticker-style) ──────────────────────────────────
function SignalStream() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const { isAuthenticated } = useAuth();
  const ref = useFadeIn(200);
  const { data: signals, isLoading, refetch } = trpc.sentinel.list.useQuery({ limit: 12 }, { enabled: isAuthenticated });
  const seed = trpc.sentinel.seed.useMutation({
    onSuccess: (r) => { if (r.seeded) { toast.success(`Sentinel seeded with ${r.count} signals`); refetch(); } },
  });
  const aiRefresh = trpc.sentinel.aiRefresh.useMutation({
    onSuccess: (r) => { toast.success(r.message); refetch(); },
    onError: (e) => toast.error(`Refresh failed: ${e.message}`),
  });
  const deleteSignal = trpc.sentinel.delete.useMutation({
    onSuccess: () => { toast.success("Signal removed"); refetch(); },
    onError: (e) => toast.error(`Delete failed: ${e.message}`),
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

  const activeSignals = signals
    ? [...signals]
        .filter((s) => !s.expiresAt || s.expiresAt > Date.now())
        .sort((a, b) => (parseFloat(String(b.confidenceScore ?? 0)) || 0) - (parseFloat(String(a.confidenceScore ?? 0)) || 0))
    : [];

  return (
    <div ref={ref} style={{
      background: C.s1,
      border: `1px solid ${C.bd}`,
      borderRadius: 12,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Stream header */}
      <div style={{
        padding: "14px 18px 10px",
        borderBottom: `1px solid ${C.bd}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: `${C.s2}40`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Radio style={{ width: 13, height: 13, color: C.em }} />
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.fg2 }}>
              Signal Stream
            </span>
            <p style={{ fontSize: 10, color: C.fg4, marginTop: 1 }}>Macro · Institutional · Seasonal</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => aiRefresh.mutate()}
            disabled={aiRefresh.isPending}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 9, fontWeight: 600, height: 22, padding: "0 8px", borderRadius: 4,
              background: "transparent", border: `1px solid ${C.bd}`, color: C.fg4, cursor: "pointer",
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}
          >
            {aiRefresh.isPending
              ? <Loader2 style={{ width: 9, height: 9 }} className="animate-spin" />
              : <RefreshCw style={{ width: 9, height: 9 }} />}
            {aiRefresh.isPending ? "Scanning" : "Refresh"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className="live-dot" />
            <span style={{ fontSize: 9, color: C.em, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Live</span>
          </div>
        </div>
      </div>

      {/* Signal feed */}
      <div style={{ flex: 1, overflowY: "auto", maxHeight: 520 }}>
        {isLoading || seed.isPending ? (
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 1 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${C.bd}20` }}>
                <Skeleton className="h-2.5 w-4/5 mb-1.5" />
                <Skeleton className="h-1.5 w-2/3" />
              </div>
            ))}
          </div>
        ) : !activeSignals.length ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", textAlign: "center" }}>
            <Waves style={{ width: 28, height: 28, color: C.fg4, marginBottom: 8 }} />
            <p style={{ fontSize: 11, color: C.fg4 }}>No active signals</p>
          </div>
        ) : (
          activeSignals.map((sig, idx) => {
            const cfg = SIGNAL_CONFIG[sig.signalType] ?? SIGNAL_CONFIG.macro_momentum;
            const Icon = cfg.icon;
            const isOpen = expanded === sig.id;
            const isHighUrgency = (parseFloat(String(sig.confidenceScore ?? 0)) || 0) >= 0.88;
            const isFirst = idx === 0;

            return (
              <div
                key={sig.id}
                onClick={() => setExpanded(isOpen ? null : sig.id)}
                className={cn("signal-entry", isHighUrgency && "urgency-border")}
                style={{
                  padding: "11px 18px",
                  borderBottom: `1px solid ${C.bd}30`,
                  borderLeft: `2px solid ${isHighUrgency ? C.re : isFirst ? C.p : "transparent"}`,
                  background: isOpen ? `${C.p}06` : isHighUrgency ? `${C.re}05` : "transparent",
                  cursor: "pointer",
                  transition: "background 0.2s ease",
                  animationDelay: `${idx * 50}ms`,
                }}
                onMouseEnter={(e) => { if (!isOpen) (e.currentTarget as HTMLDivElement).style.background = `${C.s2}60`; }}
                onMouseLeave={(e) => { if (!isOpen) (e.currentTarget as HTMLDivElement).style.background = isHighUrgency ? `${C.re}05` : "transparent"; }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  {/* Type icon */}
                  <div style={{
                    width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginTop: 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: cfg.bg,
                  }}>
                    <Icon style={{ width: 10, height: 10, color: cfg.color }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title row */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                      <p style={{
                        fontSize: 11, fontWeight: 600, color: C.fg1, lineHeight: 1.4,
                        display: "-webkit-box", WebkitLineClamp: isOpen ? undefined : 2,
                        WebkitBoxOrient: "vertical", overflow: isOpen ? "visible" : "hidden",
                        flex: 1,
                      }}>
                        {isHighUrgency && (
                          <span style={{ color: C.re, marginRight: 4, fontSize: 10 }}>⚡</span>
                        )}
                        {sig.title}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                          background: cfg.bg, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.08em",
                        }}>
                          {cfg.label}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm("Remove this signal?")) deleteSignal.mutate({ id: sig.id }); }}
                          title="Remove"
                          style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: 18, height: 18, borderRadius: 3, border: "none",
                            background: "transparent", color: C.fg4, cursor: "pointer",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.re; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.fg4; }}
                        >
                          <Trash2 style={{ width: 9, height: 9 }} />
                        </button>
                      </div>
                    </div>

                    {/* Confidence bar */}
                    <ConfidenceBar score={sig.confidenceScore} />

                    {/* Meta */}
                    <p style={{ fontSize: 9, color: C.fg4, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock style={{ width: 8, height: 8 }} />
                      {elapsed(sig.createdAt)}
                      {sig.impactedAssetClasses && sig.impactedAssetClasses.length > 0 && (
                        <><span style={{ color: C.bd }}>·</span><span>{sig.impactedAssetClasses.slice(0, 2).join(", ")}</span></>
                      )}
                    </p>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.bd}30` }}>
                        <p style={{ fontSize: 11, color: C.fg2, lineHeight: 1.65 }}>{sig.summary}</p>
                        {sig.roryPitch && (
                          <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 5, background: `${C.p}08`, borderLeft: `2px solid ${C.p}40` }}>
                            <p style={{ fontSize: 9, color: `${C.p}b0`, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Signal Insight</p>
                            <p style={{ fontSize: 11, color: C.fg1, fontStyle: "italic", lineHeight: 1.6 }}>"{sig.roryPitch}"</p>
                          </div>
                        )}
                        {sig.recommendedAction && (
                          <div style={{ marginTop: 6, padding: "8px 10px", borderRadius: 5, background: `${C.em}08`, borderLeft: `2px solid ${C.em}40` }}>
                            <p style={{ fontSize: 9, color: C.em, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Recommended Action</p>
                            <p style={{ fontSize: 11, color: C.fg1, lineHeight: 1.6 }}>{sig.recommendedAction}</p>
                          </div>
                        )}
                        {sig.sourceUrl && (
                          <a href={sig.sourceUrl} target="_blank" rel="noopener noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, color: C.p, textDecoration: "none", marginTop: 6 }}
                            onClick={(e) => e.stopPropagation()}>
                            <ExternalLink style={{ width: 9, height: 9 }} />
                            Source
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Velocity Sparkline (compact) ────────────────────────────────────────────
function VelocityMini() {
  const { data, isLoading } = trpc.deals.velocity.useQuery();
  const total = data?.reduce((s, d) => s + (Number(d.count) || 0), 0) ?? 0;
  const trend = data && data.length >= 2
    ? (Number(data[data.length - 1].count) || 0) - (Number(data[data.length - 2].count) || 0)
    : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.fg4 }}>Velocity</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 2 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: C.fg1 }}>
            {isLoading ? "—" : String(isNaN(total) ? 0 : total)}
          </span>
          <span style={{ fontSize: 10, color: C.fg4 }}>/ 8 wks</span>
          {!isLoading && trend !== 0 && (
            <span style={{ fontSize: 10, fontWeight: 600, color: trend > 0 ? C.em : C.re }}>
              {trend > 0 ? "↑" : "↓"}{Math.abs(trend)}
            </span>
          )}
        </div>
      </div>
      {!isLoading && data && data.length > 0 && (
        <div style={{ flex: 1, height: 36 }}>
          <ResponsiveContainer width="100%" height={36}>
            <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="vg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.p} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={C.p} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                contentStyle={{ background: C.s1, border: `1px solid ${C.bd}`, borderRadius: 4, fontSize: 10, padding: "2px 6px" }}
                labelStyle={{ color: C.fg3 }} itemStyle={{ color: C.fg1 }}
              />
              <Area type="monotone" dataKey="count" name="Deals" stroke={C.p} strokeWidth={1.5} fill="url(#vg2)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Intelligence Feed (ranked deal list) ─────────────────────────────────────
function IntelligenceFeed({ deals, isLoading, onDelete }: {
  deals: any[] | undefined;
  isLoading: boolean;
  onDelete: (id: number, name: string) => void;
}) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ padding: "14px 20px", borderBottom: `1px solid ${C.bd}30` }}>
            <Skeleton className="h-3 w-3/5 mb-2" />
            <Skeleton className="h-2 w-2/5" />
          </div>
        ))}
      </div>
    );
  }

  if (!deals?.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "56px 0", textAlign: "center" }}>
        <ScanLine style={{ width: 36, height: 36, color: C.fg4, marginBottom: 12 }} />
        <p style={{ fontSize: 12, fontWeight: 500, color: C.fg3 }}>No intelligence yet</p>
        <p style={{ fontSize: 11, color: C.fg4, marginTop: 4 }}>Trigger a market scan to populate the feed</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {deals.map((deal, idx) => {
        const score = deal.score != null ? parseFloat(String(deal.score)) : null;
        const isHovered = hoveredId === deal.id;
        const rank = idx + 1;
        const isTop = rank <= 2;

        return (
          <div
            key={deal.id}
            style={{ position: "relative" }}
            onMouseEnter={() => setHoveredId(deal.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <Link href={`/deal/${deal.id}`}>
              <div
                className="feed-entry"
                style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "14px 20px",
                  borderBottom: `1px solid ${C.bd}30`,
                  borderLeft: `2px solid ${isTop ? C.p : "transparent"}`,
                  background: isHovered ? `${C.s2}60` : "transparent",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                  animationDelay: `${idx * 60}ms`,
                }}>
                {/* Rank */}
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                  color: isTop ? C.p : C.fg4,
                  width: 20, flexShrink: 0, textAlign: "center",
                }}>
                  {String(rank).padStart(2, "0")}
                </span>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: C.fg1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {deal.name}
                    </p>
                    {deal.opportunityZone && (
                      <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: `${C.em}15`, color: C.em, flexShrink: 0 }}>OZ</span>
                    )}
                    {deal.tadDistrict && (
                      <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: `${C.p}15`, color: C.p, flexShrink: 0 }}>TAD</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {deal.location && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: C.fg4 }}>
                        <MapPin style={{ width: 9, height: 9 }} />{deal.location}
                      </span>
                    )}
                    {deal.industry && (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 3, background: C.s2, color: C.fg3 }}>
                        {deal.industry}
                      </span>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 9, color: C.fg4, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Cash Flow</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: C.em, fontFamily: "var(--font-mono)" }}>{fmt(deal.cashFlow)}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 9, color: C.fg4, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Score</p>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: score != null ? scoreColor(score) : C.fg4 }}>
                      {score != null && !isNaN(score) ? score.toFixed(3) : "—"}
                    </p>
                  </div>
                  <ArrowRight style={{ width: 13, height: 13, color: isHovered ? C.fg2 : C.fg4, transition: "color 0.15s, transform 0.15s", transform: isHovered ? "translateX(2px)" : "none" }} />
                </div>
              </div>
            </Link>

            {/* Delete — only visible on hover */}
            {isHovered && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(deal.id, deal.name); }}
                title="Remove deal"
                style={{
                  position: "absolute", right: 52, top: "50%", transform: "translateY(-50%)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 22, height: 22, borderRadius: 4, border: `1px solid ${C.bd}`,
                  background: C.s1, color: C.fg4, cursor: "pointer", zIndex: 2,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.re; (e.currentTarget as HTMLButtonElement).style.borderColor = `${C.re}40`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.fg4; (e.currentTarget as HTMLButtonElement).style.borderColor = C.bd; }}
              >
                <Trash2 style={{ width: 10, height: 10 }} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Stat Strip ───────────────────────────────────────────────────────────────
function StatStrip({ stats, outStats, isLoading }: { stats: any; outStats: any; isLoading: boolean }) {
  const ref = useFadeIn(100);
  const items = [
    { label: "Pipeline Value", value: fmt(stats?.totalPipelineValue), color: C.p, icon: DollarSign },
    { label: "Active Deals", value: String(stats?.total ?? 0), color: C.fg2, icon: Building2 },
    { label: "Avg Score", value: stats?.avgScore != null ? parseFloat(String(stats.avgScore)).toFixed(3) : "—", color: C.am, icon: Target, mono: true },
    { label: "High Priority", value: String(stats?.highPriority ?? 0), color: C.em, icon: Zap },
    { label: "Outreach Sent", value: String(outStats?.totalSent ?? 0), color: C.cy, icon: Activity },
    { label: "Responded", value: String(outStats?.responded ?? 0), color: C.em, icon: ArrowUpRight },
  ];

  return (
    <div ref={ref} style={{
      display: "grid",
      gridTemplateColumns: "repeat(6, 1fr)",
      borderBottom: `1px solid ${C.bd}`,
    }}>
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <div key={i} style={{
            padding: "14px 20px",
            borderRight: i < items.length - 1 ? `1px solid ${C.bd}` : "none",
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: C.fg4 }}>
                {item.label}
              </span>
              <Icon style={{ width: 11, height: 11, color: `${item.color}80` }} />
            </div>
            {isLoading ? (
              <Skeleton className="h-5 w-16" />
            ) : (
              <span style={{
                fontFamily: item.mono ? "var(--font-mono)" : "var(--font-sans)",
                fontSize: 20, fontWeight: 700, color: item.color, lineHeight: 1,
              }}>
                {item.value}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Activity Log (compact) ───────────────────────────────────────────────────
function ActivityLog({ activities }: { activities: any[] | undefined }) {
  if (!activities?.length) return null;
  const activityColor: Record<string, string> = {
    deal_added: C.p, deal_scored: C.am, signal_analyzed: C.vi,
    red_flag_detected: C.re, memo_generated: C.p, outreach_sent: C.em,
    scan_completed: C.em, stage_changed: C.fg3,
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {activities.slice(0, 8).map((act: any, i: number) => (
        <div key={i} style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "8px 18px",
          borderBottom: `1px solid ${C.bd}20`,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%", flexShrink: 0, marginTop: 4,
            background: activityColor[act.type] ?? C.fg4,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11, color: C.fg2, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {act.title}
            </p>
            {act.detail && (
              <p style={{ fontSize: 10, color: C.fg4, marginTop: 1 }}>{act.detail}</p>
            )}
          </div>
          <span style={{ fontSize: 9, color: C.fg4, flexShrink: 0, fontFamily: "var(--font-mono)" }}>
            {(() => {
              const m = Math.round((Date.now() - act.createdAt) / 60000);
              return m < 1 ? "now" : m < 60 ? `${m}m` : `${Math.round(m / 60)}h`;
            })()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Command Center (main page) ───────────────────────────────────────────────
export default function Home() {
  const [activeScanJobId, setActiveScanJobId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { data, isLoading, refetch } = trpc.dashboard.stats.useQuery();
  const { data: topDealsData } = trpc.deals.list.useQuery({ limit: 8 });
  const heroRef = useFadeIn(0);
  const feedRef = useFadeIn(150);

  const deleteDeal = trpc.deals.delete.useMutation({
    onSuccess: () => { toast.success("Deal removed"); utils.deals.list.invalidate(); utils.dashboard.stats.invalidate(); },
    onError: (e) => toast.error(`Delete failed: ${e.message}`),
  });
  const triggerScan = trpc.scan.trigger.useMutation({
    onSuccess: (d) => {
      toast.success(d.message);
      if (d.jobId) setActiveScanJobId(d.jobId);
    },
    onError: (e) => toast.error(`Scan failed: ${e.message}`),
  });

  const stats = data?.dealStats;
  const outStats = data?.outreachStats;

  // Derive system state annotation
  const systemAnnotation = (() => {
    if (!stats) return null;
    if ((stats.highPriority ?? 0) > 0) return { text: `${stats.highPriority} deal${stats.highPriority > 1 ? "s" : ""} ready for outreach — initiate contact`, color: C.em };
    if ((stats.total ?? 0) === 0) return { text: "Pipeline empty — run a market scan to begin intelligence gathering", color: C.am };
    if ((outStats?.responded ?? 0) > 0) return { text: `${outStats?.responded} broker response${(outStats?.responded ?? 0) > 1 ? "s" : ""} pending review`, color: C.p };
    return { text: "System nominal — no immediate action required", color: C.fg3 };
  })();

  return (
    <DashboardLayout>
      {/* ── BRIEFING HEADER ─────────────────────────────────────────────────── */}
      <div ref={heroRef} className="sh-hero-panel" style={{ padding: 0, overflow: "hidden" }}>
        {/* Operator briefing bar */}
        <div style={{
          padding: "18px 28px 16px",
          borderBottom: `1px solid ${C.bd}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20,
        }}>
          <div style={{ flex: 1 }}>
            {/* Dateline */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span className="live-dot" />
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: C.em }}>
                System Operational
              </span>
              <span style={{ color: C.bd }}>·</span>
              <span style={{ fontSize: 9, color: C.fg4, fontFamily: "var(--font-mono)" }}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).toUpperCase()}
              </span>
            </div>

            {/* Headline */}
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg1, letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 8 }}>
              Signal Hunter Command Center
            </h1>

            {/* System annotation — proactive insight */}
            {systemAnnotation && (
              <p style={{ fontSize: 12, color: systemAnnotation.color, display: "flex", alignItems: "center", gap: 6 }}>
                <Shield style={{ width: 11, height: 11, flexShrink: 0 }} />
                {systemAnnotation.text}
              </p>
            )}

            {/* Last scan */}
            {data?.latestScan && (
              <p style={{ fontSize: 10, color: C.fg4, marginTop: 6, fontFamily: "var(--font-mono)" }}>
                Last scan: {new Date(data.latestScan.createdAt).toLocaleString()} · {(data.latestScan.sources as string[] | null)?.length ?? 0} platforms
              </p>
            )}
          </div>

          {/* Primary actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, alignItems: "flex-end" }}>
            <button
              className={cn("btn-press", !triggerScan.isPending && !activeScanJobId && "scan-btn-idle")}
              onClick={() => triggerScan.mutate({})}
              disabled={triggerScan.isPending || activeScanJobId !== null}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                height: 40, padding: "0 20px", borderRadius: 8,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: triggerScan.isPending || activeScanJobId !== null ? `${C.p}60` : C.p,
                border: "none", color: "oklch(0.98 0.005 260)",
                letterSpacing: "0.02em",
                transition: "box-shadow 0.2s ease",
              }}
            >
              {triggerScan.isPending || activeScanJobId !== null
                ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> Scanning Market</>
                : <><ScanLine style={{ width: 14, height: 14 }} /> Run Market Scan</>
              }
            </button>
            <Link href="/scan">
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 30, padding: "0 12px", borderRadius: 6,
                fontSize: 11, fontWeight: 500, cursor: "pointer",
                background: "transparent", border: `1px solid ${C.bd}`, color: C.fg3,
              }}>
                <TrendingUp style={{ width: 12, height: 12 }} />
                View Pipeline
              </button>
            </Link>
          </div>
        </div>

        {/* Scan progress */}
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

        {/* Stat strip */}
        <StatStrip stats={stats} outStats={outStats} isLoading={isLoading} />
      </div>

      {/* ── MAIN EDITORIAL GRID ──────────────────────────────────────────────── */}
      <div className="editorial-grid" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 0, minHeight: 0 }}>

        {/* LEFT: Intelligence Feed + Activity */}
        <div ref={feedRef} style={{ borderRight: `1px solid ${C.bd}`, display: "flex", flexDirection: "column" }}>

          {/* Feed header */}
          <div style={{
            padding: "14px 20px 10px",
            borderBottom: `1px solid ${C.bd}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: `${C.s2}30`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Brain style={{ width: 13, height: 13, color: C.p }} />
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.fg2 }}>
                  Intelligence Feed
                </span>
                <p style={{ fontSize: 9, color: C.fg4, marginTop: 1 }}>Ranked by AI acquisition score</p>
              </div>
            </div>
            <Link href="/scan">
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 9, fontWeight: 600, height: 22, padding: "0 8px", borderRadius: 4,
                background: "transparent", border: `1px solid ${C.bd}`, color: C.fg4, cursor: "pointer",
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>
                All Deals <ChevronRight style={{ width: 9, height: 9 }} />
              </button>
            </Link>
          </div>

          {/* Deal feed */}
          <IntelligenceFeed
            deals={topDealsData}
            isLoading={isLoading}
            onDelete={(id, name) => {
              if (confirm(`Remove "${name}" from the pipeline? This cannot be undone.`)) {
                deleteDeal.mutate({ id });
              }
            }}
          />

          {/* Velocity strip */}
          {!isLoading && (
            <div style={{
              padding: "14px 20px",
              borderTop: `1px solid ${C.bd}`,
              background: `${C.s2}20`,
            }}>
              <VelocityMini />
            </div>
          )}

          {/* Investor interests */}
          {!isLoading && (
            <div style={{ padding: "0 20px 20px" }}>
              <InvestorInterestsPanel />
            </div>
          )}

          {/* Activity log */}
          {data?.recentActivity && data.recentActivity.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.bd}` }}>
              <div style={{ padding: "12px 18px 8px", display: "flex", alignItems: "center", gap: 8 }}>
                <Activity style={{ width: 11, height: 11, color: C.fg4 }} />
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: C.fg4 }}>
                  System Log
                </span>
              </div>
              <ActivityLog activities={data.recentActivity} />
            </div>
          )}
        </div>

        {/* RIGHT: Signal Stream */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <SignalStream />
        </div>
      </div>
    </DashboardLayout>
  );
}

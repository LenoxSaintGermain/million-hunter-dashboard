import { useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { trpc } from "@/lib/trpc";
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

// ─── Motion constants (Tripoli ease) ─────────────────────────────────────────
const EASE = [0.16, 1, 0.3, 1] as const;

// ─── Design Tokens ───────────────────────────────────────────────────────────
const C = {
  p:   "var(--ink)",
  em:  "var(--sage)",
  am:  "var(--amber)",
  ba:  "var(--amber)",              // burnt amber — Editorial Finance accent
  re:  "var(--clay)",
  cy:  "var(--sh-cyan)",
  vi:  "var(--sh-violet)",
  ro:  "var(--clay)",
  fg1: "var(--ink)",
  fg2: "oklch(0.35 0.018 250)",
  fg3: "oklch(0.48 0.018 250)",
  fg4: "oklch(0.60 0.012 250)",
  s1:  "var(--paper)",
  s2:  "var(--bone)",
  bd:  "var(--rule)",
};

const scoreColor = (v: number) => v >= 0.8 ? "var(--sage)" : v >= 0.65 ? "var(--amber)" : "var(--clay)";
const fmt = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
};

// ─── Animated SVG Sparkline (Tripoli NavSparkline pattern) ───────────────────
function NavSparkline({ trace, height = 48, color = C.p }: { trace: number[]; height?: number; color?: string }) {
  if (!trace || trace.length < 2) return null;
  const w = 240;
  const h = height;
  const min = Math.min(...trace);
  const max = Math.max(...trace);
  const range = max - min || 1;
  const stepX = w / (trace.length - 1);
  const points = trace.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return [x, y] as const;
  });
  const linePath = points.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(" ");
  const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height }} aria-hidden>
      <motion.path
        d={areaPath}
        fill={color}
        opacity={0.07}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.07 }}
        transition={{ duration: 0.8, ease: EASE }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.4, ease: EASE }}
      />
    </svg>
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
      <div style={{ flex: 1, height: 2, borderRadius: 1, background: "var(--rule)", overflow: "hidden" }}>
        <motion.div
          style={{ height: "100%", borderRadius: 1, background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
        />
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
  const { data: interests, isLoading } = trpc.investor.getAllInterests.useQuery(undefined, { retry: false });
  const updateStatus = trpc.investor.updateInterestStatus.useMutation({
    onSuccess: () => utils.investor.getAllInterests.invalidate(),
  });

  if (isLoading || !interests || interests.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay: 0.35 }}
      style={{ borderTop: `1px solid ${C.bd}`, paddingTop: 20 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="eyebrow">Capital Interest</span>
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
                  style={{ fontSize: 10, background: "var(--bone)", color: "var(--sh-fg-3)", border: `1px solid ${C.bd}`, borderRadius: 4, padding: "2px 4px" }}
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
    </motion.div>
  );
}

// ─── Signal Stream ────────────────────────────────────────────────────────────
function SignalStream() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const { isAuthenticated } = useAuth();
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
    <motion.div
      initial={{ opacity: 0, x: 16, filter: "blur(4px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.8, ease: EASE, delay: 0.25 }}
      style={{
        background: C.s1,
        border: `1px solid ${C.bd}`,
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
      }}
    >
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
            <p className="eyebrow" style={{ marginTop: 2 }}>Macro · Institutional · Seasonal</p>
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
              <motion.div
                key={sig.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: 0.05 + idx * 0.05 }}
                onClick={() => setExpanded(isOpen ? null : sig.id)}
                className={cn(isHighUrgency && "urgency-border")}
                style={{
                  padding: "11px 18px",
                  borderBottom: `1px solid ${C.bd}30`,
                  borderLeft: `2px solid ${isHighUrgency ? C.re : isFirst ? C.ba : "transparent"}`,
                  background: isOpen ? `${C.p}06` : isHighUrgency ? `${C.re}05` : "transparent",
                  cursor: "pointer",
                  transition: "background 0.2s ease",
                }}
                onMouseEnter={(e) => { if (!isOpen) (e.currentTarget as HTMLDivElement).style.background = `${C.s2}60`; }}
                onMouseLeave={(e) => { if (!isOpen) (e.currentTarget as HTMLDivElement).style.background = isHighUrgency ? `${C.re}05` : "transparent"; }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginTop: 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: cfg.bg,
                  }}>
                    <Icon style={{ width: 10, height: 10, color: cfg.color }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                      <p style={{
                        fontSize: 11, fontWeight: 600, color: C.fg1, lineHeight: 1.4,
                        display: "-webkit-box", WebkitLineClamp: isOpen ? undefined : 2,
                        WebkitBoxOrient: "vertical", overflow: isOpen ? "visible" : "hidden",
                        flex: 1,
                      }}>
                        {isHighUrgency && <span style={{ color: C.re, marginRight: 4, fontSize: 10 }}>⚡</span>}
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

                    <ConfidenceBar score={sig.confidenceScore} />

                    <p style={{ fontSize: 9, color: C.fg4, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock style={{ width: 8, height: 8 }} />
                      {elapsed(sig.createdAt)}
                      {sig.impactedAssetClasses && sig.impactedAssetClasses.length > 0 && (
                        <><span style={{ color: C.bd }}>·</span><span>{sig.impactedAssetClasses.slice(0, 2).join(", ")}</span></>
                      )}
                    </p>

                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        transition={{ duration: 0.35, ease: EASE }}
                        style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.bd}30`, overflow: "hidden" }}
                      >
                        <p style={{ fontSize: 11, color: C.fg2, lineHeight: 1.65 }}>{sig.summary}</p>
                        {sig.roryPitch && (
                          <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 5, background: "oklch(0.66 0.14 55 / 0.06)", borderLeft: "2px solid oklch(0.66 0.14 55 / 0.30)" }}>
                            <p style={{ fontSize: 9, color: "var(--amber)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Signal Insight</p>
                            <p style={{ fontSize: 11, color: C.fg1, fontStyle: "italic", lineHeight: 1.6 }}>"{sig.roryPitch}"</p>
                          </div>
                        )}
                        {sig.recommendedAction && (
                          <div style={{ marginTop: 6, padding: "8px 10px", borderRadius: 5, background: "oklch(0.55 0.06 155 / 0.06)", borderLeft: "2px solid oklch(0.55 0.06 155 / 0.30)" }}>
                            <p style={{ fontSize: 9, color: "var(--sage)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Recommended Action</p>
                            <p style={{ fontSize: 11, color: C.fg1, lineHeight: 1.6 }}>{sig.recommendedAction}</p>
                          </div>
                        )}
                        {sig.sourceUrl && (
                          <a href={sig.sourceUrl} target="_blank" rel="noopener noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--amber)", textDecoration: "none", marginTop: 6 }}
                            onClick={(e) => e.stopPropagation()}>
                            <ExternalLink style={{ width: 9, height: 9 }} />
                            Source
                          </a>
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

// ─── Velocity Sparkline (animated SVG) ───────────────────────────────────────
function VelocityMini() {
  const { data, isLoading } = trpc.deals.velocity.useQuery();
  const total = data?.reduce((s, d) => s + (Number(d.count) || 0), 0) ?? 0;
  const trend = data && data.length >= 2
    ? (Number(data[data.length - 1].count) || 0) - (Number(data[data.length - 2].count) || 0)
    : 0;
  const trace = data?.map((d) => Number(d.count) || 0) ?? [];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div>
        <span className="eyebrow">Velocity</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 4 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: C.fg1, letterSpacing: "-0.02em" }}>
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
      {!isLoading && trace.length > 1 && (
        <div style={{ flex: 1, height: 36 }}>
          <NavSparkline trace={trace} height={36} color={C.p} />
        </div>
      )}
    </div>
  );
}

// ─── Intelligence Feed ────────────────────────────────────────────────────────
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
          <motion.div
            key={deal.id}
            initial={{ opacity: 0, x: -8, filter: "blur(2px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.1 + idx * 0.06 }}
            style={{ position: "relative" }}
            onMouseEnter={() => setHoveredId(deal.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <Link href={`/deal/${deal.id}`}>
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "14px 20px",
                  borderBottom: `1px solid ${C.bd}30`,
                  borderLeft: `2px solid ${isTop ? C.ba : "transparent"}`,
                  background: isHovered ? `${C.s2}60` : "transparent",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
              >
                {/* Rank — Fraunces display number */}
                <span style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 18, fontWeight: 400,
                  color: isTop ? C.ba : C.fg4,
                  width: 24, flexShrink: 0, textAlign: "center",
                  letterSpacing: "-0.02em",
                }}>
                  {String(rank).padStart(2, "0")}
                </span>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Business name — Fraunces */}
                  <p style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 15, fontWeight: 400,
                    color: C.fg1,
                    letterSpacing: "-0.015em",
                    lineHeight: 1.2,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    marginBottom: 4,
                  }}>
                    {deal.name}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {deal.location && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: C.fg4 }}>
                        <MapPin style={{ width: 9, height: 9 }} />{deal.location}
                      </span>
                    )}
                    {deal.industry && (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 3, background: "var(--bone)", color: "var(--sh-fg-3)" }}>
                        {deal.industry}
                      </span>
                    )}
                    {deal.opportunityZone && (
                      <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: `${C.em}15`, color: C.em }}>OZ</span>
                    )}
                    {deal.tadDistrict && (
                      <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: `${C.p}15`, color: C.p }}>TAD</span>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <p className="eyebrow" style={{ marginBottom: 2 }}>Cash Flow</p>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 400, color: C.em, letterSpacing: "-0.01em" }}>{fmt(deal.cashFlow)}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p className="eyebrow" style={{ marginBottom: 2 }}>Score</p>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: score != null ? scoreColor(score) : C.fg4 }}>
                      {score != null && !isNaN(score) ? score.toFixed(3) : "—"}
                    </p>
                  </div>
                  <ArrowRight style={{
                    width: 13, height: 13,
                    color: isHovered ? C.fg2 : C.fg4,
                    transition: "color 0.15s, transform 0.15s",
                    transform: isHovered ? "translateX(2px)" : "none",
                  }} />
                </div>
              </div>
            </Link>

            {/* Delete — visible on hover */}
            {isHovered && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(deal.id, deal.name); }}
                title="Remove deal"
                style={{
                  position: "absolute", right: 52, top: "50%", transform: "translateY(-50%)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 22, height: 22, borderRadius: 4, border: `1px solid ${C.bd}`,
                  background: "var(--paper)", color: "var(--sh-fg-4)", cursor: "pointer", zIndex: 2,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.re; (e.currentTarget as HTMLButtonElement).style.borderColor = `${C.re}40`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.fg4; (e.currentTarget as HTMLButtonElement).style.borderColor = C.bd; }}
              >
                <Trash2 style={{ width: 10, height: 10 }} />
              </button>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Stat Strip (Tripoli pattern: no card borders, hairline separators) ───────
function StatStrip({ stats, outStats, isLoading }: { stats: any; outStats: any; isLoading: boolean }) {
  const items = [
    { label: "Pipeline Value", value: fmt(stats?.totalPipelineValue), color: C.ba, icon: DollarSign },
    { label: "Active Deals",   value: String(stats?.total ?? 0),      color: C.fg2, icon: Building2 },
    { label: "Avg Score",      value: stats?.avgScore != null ? parseFloat(String(stats.avgScore)).toFixed(3) : "—", color: C.am, icon: Target, mono: true },
    { label: "High Priority",  value: String(stats?.highPriority ?? 0), color: C.em, icon: Zap },
    { label: "Outreach Sent",  value: String(outStats?.totalSent ?? 0), color: C.cy, icon: Activity },
    { label: "Responded",      value: String(outStats?.responded ?? 0), color: C.em, icon: ArrowUpRight },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(6, 1fr)",
      borderBottom: `1px solid ${C.bd}`,
    }}>
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.15 + i * 0.05 }}
            style={{
              padding: "16px 20px",
              borderRight: i < items.length - 1 ? `1px solid ${C.bd}` : "none",
              display: "flex", flexDirection: "column", gap: 6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="eyebrow">{item.label}</span>
              <Icon style={{ width: 11, height: 11, color: `${item.color}80` }} />
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <span style={{
                fontFamily: item.mono ? "var(--font-mono)" : "var(--font-display)",
                fontSize: 24, fontWeight: 400, color: item.color, lineHeight: 1,
                letterSpacing: item.mono ? "0" : "-0.025em",
              }}>
                {item.value}
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Activity Log ─────────────────────────────────────────────────────────────
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
      <motion.div
        initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: EASE }}
        style={{ padding: 0, overflow: "hidden", background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: "var(--radius-lg)" }}
      >
        {/* Operator briefing bar */}
        <div style={{
          padding: "20px 28px 18px",
          borderBottom: `1px solid ${C.bd}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20,
        }}>
          <div style={{ flex: 1 }}>
            {/* Dateline */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span className="live-dot" />
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: C.em }}>
                System Operational
              </span>
              <span style={{ color: C.bd }}>·</span>
              <span className="dateline">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).toUpperCase()}
              </span>
            </div>

            {/* Headline — Fraunces display */}
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
              fontWeight: 400,
              color: C.fg1,
              letterSpacing: "-0.025em",
              lineHeight: 1.0,
              marginBottom: 10,
              textWrap: "balance",
            }}>
              Signal Hunter Command Center
            </h1>

            {/* System annotation */}
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
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className={cn(!triggerScan.isPending && !activeScanJobId && "scan-btn-idle")}
              onClick={() => triggerScan.mutate({})}
              disabled={triggerScan.isPending || activeScanJobId !== null}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                height: 42, padding: "0 22px", borderRadius: 9999,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: triggerScan.isPending || activeScanJobId !== null ? "oklch(0.18 0.018 250 / 0.5)" : "var(--ink)",
                border: "none", color: "var(--paper)",
                letterSpacing: "0.02em",
              }}
            >
              {triggerScan.isPending || activeScanJobId !== null
                ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> Scanning Market</>
                : <><ScanLine style={{ width: 14, height: 14 }} /> Run Market Scan</>
              }
            </motion.button>
            <Link href="/scan">
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 30, padding: "0 14px", borderRadius: 9999,
                fontSize: 11, fontWeight: 500, cursor: "pointer",
                background: "transparent", border: `1px solid ${C.bd}`, color: C.fg3,
              }}>
                <TrendingUp style={{ width: 12, height: 12 }} />
                View Pipeline →
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
      </motion.div>

      {/* ── MAIN EDITORIAL GRID ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
        className="editorial-grid"
        style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 0, minHeight: 0, background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}
      >
        {/* LEFT: Intelligence Feed + Activity */}
        <div style={{ borderRight: "1px solid var(--rule)", display: "flex", flexDirection: "column" }}>

          {/* Feed header */}
          <div style={{
            padding: "14px 20px 10px",
            borderBottom: `1px solid ${C.bd}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: `${C.s2}30`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Brain style={{ width: 13, height: 13, color: C.ba }} />
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: C.fg2 }}>
                  Intelligence Feed
                </span>
                <p className="eyebrow" style={{ marginTop: 2 }}>Ranked by AI acquisition score</p>
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

          {/* Deal feed — deduplicated by name (keep highest-score entry per unique name) */}
          <IntelligenceFeed
            deals={(() => {
              if (!topDealsData) return topDealsData;
              const seen = new Map<string, any>();
              for (const deal of topDealsData) {
                const key = deal.name.trim().toLowerCase();
                const existing = seen.get(key);
                if (!existing || (deal.score ?? 0) > (existing.score ?? 0)) {
                  seen.set(key, deal);
                }
              }
              return Array.from(seen.values());
            })()}
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
                <span className="eyebrow">System Log</span>
              </div>
              <ActivityLog activities={data.recentActivity} />
            </div>
          )}
        </div>

        {/* RIGHT: Signal Stream */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <SignalStream />
        </div>
      </motion.div>
    </DashboardLayout>
  );
}

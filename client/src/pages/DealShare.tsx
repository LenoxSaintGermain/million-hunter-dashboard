import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Users, Calendar, TrendingUp, DollarSign,
  Shield, Brain, Building2, ExternalLink, Eye, Clock,
  CheckCircle2, XCircle, BarChart3, Zap, AlertTriangle,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toNum = (v: any): number | null => v == null ? null : parseFloat(String(v));
const fmt = (n: any, prefix = "$") => {
  const v = toNum(n);
  if (v == null || isNaN(v)) return "—";
  if (v >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${prefix}${(v / 1_000).toFixed(0)}k`;
  return `${prefix}${v}`;
};
const pct = (n: any) => { const v = toNum(n); return v == null ? "—" : `${Math.round(v * 100)}%`; };
const fmtDate = (ts: number | null | undefined) => {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function MetricPill({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded-2xl p-5 border",
      accent
        ? "bg-gradient-to-br from-emerald-950/60 to-emerald-900/30 border-emerald-500/30 shadow-[0_0_24px_-4px_rgba(16,185,129,0.2)]"
        : "bg-white/[0.03] border-white/10"
    )}>
      <span className={cn("text-3xl font-bold font-mono tracking-tight", accent ? "text-emerald-400" : "text-white")}>
        {value}
      </span>
      <span className="text-xs text-white/50 mt-1 text-center">{label}</span>
    </div>
  );
}

function Section({ title, icon: Icon, children, className }: { title: string; icon: React.ElementType; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/[0.03] p-6", className)}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-white/70" />
        </div>
        <h3 className="text-sm font-semibold text-white/80 uppercase tracking-widest">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ScoreMeter({ score }: { score: number | null }) {
  const s = score ?? 0;
  const color = s >= 0.8 ? "#10b981" : s >= 0.65 ? "#f59e0b" : "#ef4444";
  const label = s >= 0.8 ? "High Conviction" : s >= 0.65 ? "Qualified" : "Review";
  const circumference = 2 * Math.PI * 40;
  const offset = circumference * (1 - s);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-mono" style={{ color }}>
            {score != null ? score.toFixed(3) : "—"}
          </span>
        </div>
      </div>
      <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: `${color}20`, color }}>
        {label}
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DealShare() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const { data, isLoading, error } = trpc.dealShare.getByToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080A0F] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center animate-pulse">
            <Building2 className="w-6 h-6 text-white/30" />
          </div>
          <p className="text-sm text-white/40">Loading deal briefing…</p>
        </div>
      </div>
    );
  }

  // ── Error / Expired ───────────────────────────────────────────────────────
  if (error || !data) {
    const msg = (error as any)?.message ?? "This link is invalid or has expired.";
    return (
      <div className="min-h-screen bg-[#080A0F] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-950/40 border border-red-500/20 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Access Denied</h1>
          <p className="text-sm text-white/50">{msg}</p>
        </div>
      </div>
    );
  }

  const { deal, signal, memo, viewCount, expiresAt } = data;
  const score = toNum(deal.score);
  const margin = deal.revenue && deal.cashFlow
    ? Math.round((toNum(deal.cashFlow)! / toNum(deal.revenue)!) * 100)
    : null;

  // Capital stack from signal
  const capital = signal ? {
    sbaAmount: toNum(signal.recommendedSbaAmount),
    sellerNote: toNum(signal.recommendedSellerNote),
    equity: toNum(signal.recommendedEquity),
    dscr: toNum(signal.dscr),
    cashOnCash: toNum(signal.cashOnCashReturn),
    sbaEligible: signal.sbaEligible,
  } : null;

  const redFlags: string[] = Array.isArray(signal?.redFlags) ? signal!.redFlags as string[] : [];

  return (
    <div className="min-h-screen bg-[#080A0F] text-white font-sans">
      {/* ── Ambient background ─────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[120px] opacity-40" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">

        {/* ── Watermark / meta ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-xs font-semibold text-white/40 tracking-widest uppercase">Project Million · Confidential</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/30">
            {viewCount != null && (
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{viewCount} view{viewCount !== 1 ? "s" : ""}</span>
            )}
            {expiresAt && (
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Expires {fmtDate(expiresAt)}</span>
            )}
          </div>
        </div>

        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
          <div className="relative">
            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {deal.industry && <Badge variant="secondary" className="text-xs bg-white/10 text-white/70 border-0">{deal.industry}</Badge>}
              {deal.opportunityZone && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Opportunity Zone
                </span>
              )}
              {deal.tadDistrict && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  {deal.tadDistrict}
                </span>
              )}
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20">
                {deal.stage.replace(/_/g, " ")}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2 leading-tight">
                  {deal.name}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
                  {deal.location && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{deal.location}</span>}
                  {deal.employees && <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{deal.employees} employees</span>}
                  {deal.yearEstablished && <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Est. {deal.yearEstablished}</span>}
                  {deal.listingUrl && (
                    <a href={deal.listingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary/70 hover:text-primary transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />View Listing
                    </a>
                  )}
                </div>
                {deal.description && (
                  <p className="mt-4 text-sm text-white/60 leading-relaxed max-w-xl">{deal.description}</p>
                )}
              </div>
              <div className="shrink-0">
                <ScoreMeter score={score} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Financial KPIs ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricPill label="Annual Revenue" value={fmt(deal.revenue)} />
          <MetricPill label={`Cash Flow${margin ? ` · ${margin}% margin` : ""}`} value={fmt(deal.cashFlow)} accent />
          <MetricPill label="Asking Price" value={fmt(deal.askingPrice)} />
          <MetricPill label="EBITDA Multiple" value={toNum(deal.multiple) != null ? `${toNum(deal.multiple)!.toFixed(2)}x` : "—"} />
        </div>

        {/* ── Capital Stack ──────────────────────────────────────────────────── */}
        {capital && (capital.sbaAmount || capital.sellerNote || capital.equity) && (
          <Section title="Capital Stack" icon={DollarSign}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              {capital.sbaAmount && (
                <div className="rounded-xl bg-blue-950/30 border border-blue-500/20 p-4">
                  <p className="text-xs text-blue-400/70 mb-1">SBA 7(a) Loan</p>
                  <p className="text-2xl font-bold text-blue-300">{fmt(capital.sbaAmount)}</p>
                  {capital.sbaEligible && <p className="text-xs text-blue-400/60 mt-1">SBA Eligible ✓</p>}
                </div>
              )}
              {capital.sellerNote && (
                <div className="rounded-xl bg-amber-950/30 border border-amber-500/20 p-4">
                  <p className="text-xs text-amber-400/70 mb-1">Seller Note</p>
                  <p className="text-2xl font-bold text-amber-300">{fmt(capital.sellerNote)}</p>
                </div>
              )}
              {capital.equity && (
                <div className="rounded-xl bg-purple-950/30 border border-purple-500/20 p-4">
                  <p className="text-xs text-purple-400/70 mb-1">Equity Required</p>
                  <p className="text-2xl font-bold text-purple-300">{fmt(capital.equity)}</p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-6 pt-4 border-t border-white/5">
              {capital.dscr != null && (
                <div>
                  <p className="text-xs text-white/40 mb-0.5">DSCR</p>
                  <p className={cn("text-lg font-bold", (capital.dscr ?? 0) >= 1.25 ? "text-emerald-400" : "text-amber-400")}>
                    {capital.dscr.toFixed(2)}x
                  </p>
                </div>
              )}
              {capital.cashOnCash != null && (
                <div>
                  <p className="text-xs text-white/40 mb-0.5">Cash-on-Cash Return</p>
                  <p className="text-lg font-bold text-emerald-400">{pct(capital.cashOnCash)}</p>
                </div>
              )}
              {signal?.capitalStackSummary && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/40 mb-0.5">Analyst Note</p>
                  <p className="text-xs text-white/60 leading-relaxed">{signal.capitalStackSummary}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── OZ / TAD Impact ────────────────────────────────────────────────── */}
        {(deal.opportunityZone || deal.tadDistrict) && (
          <Section title="Opportunity Zone & TAD Impact" icon={TrendingUp}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {deal.opportunityZone && (
                <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/20 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <p className="text-sm font-semibold text-emerald-300">Opportunity Zone</p>
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Capital gains invested through a Qualified Opportunity Fund (QOF) may defer and reduce federal tax liability. 
                    10-year holds can eliminate capital gains on appreciation entirely — a structural advantage unavailable in non-OZ deals.
                  </p>
                  {deal.ozTractId && <p className="text-xs text-emerald-400/60 mt-2">Tract: {deal.ozTractId}</p>}
                  {deal.ozPotentialGain && (
                    <p className="text-sm font-bold text-emerald-400 mt-2">Est. OZ Gain: {fmt(deal.ozPotentialGain)}</p>
                  )}
                </div>
              )}
              {deal.tadDistrict && (
                <div className="rounded-xl bg-blue-950/30 border border-blue-500/20 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <p className="text-sm font-semibold text-blue-300">TAD District</p>
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Tax Allocation District financing redirects incremental property tax revenue to fund public infrastructure improvements, 
                    creating a government-backed demand tailwind for assets in the corridor.
                  </p>
                  <p className="text-xs text-blue-400/60 mt-2">{deal.tadDistrict}</p>
                </div>
              )}
            </div>
            {(deal.eventRevenueLow || deal.eventRevenueHigh) && (
              <div className="mt-4 rounded-xl bg-white/[0.03] border border-white/10 p-4 flex items-center gap-4">
                <BarChart3 className="w-5 h-5 text-primary/60 shrink-0" />
                <div>
                  <p className="text-xs text-white/40 mb-0.5">Event Revenue Proximity</p>
                  <p className="text-sm font-semibold text-white">
                    {fmt(deal.eventRevenueLow)} – {fmt(deal.eventRevenueHigh)} incremental revenue potential
                  </p>
                  {deal.eventProximityMiles && (
                    <p className="text-xs text-white/40">{deal.eventProximityMiles.toFixed(1)} mi from nearest major venue</p>
                  )}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* ── Third Signal Intelligence ───────────────────────────────────────── */}
        {signal && (
          <Section title="Third Signal Intelligence" icon={Brain}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              {signal.ownerDistressScore != null && (
                <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
                  <p className="text-xs text-white/40 mb-1">Owner Distress Score</p>
                  <p className={cn("text-2xl font-bold", toNum(signal.ownerDistressScore)! >= 0.6 ? "text-emerald-400" : "text-amber-400")}>
                    {pct(signal.ownerDistressScore)}
                  </p>
                  {signal.ownerNegotiationStyle && (
                    <p className="text-xs text-white/40 mt-1 capitalize">{signal.ownerNegotiationStyle} negotiator</p>
                  )}
                </div>
              )}
              {signal.reviewSentimentScore != null && (
                <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
                  <p className="text-xs text-white/40 mb-1">Review Sentiment</p>
                  <p className={cn("text-2xl font-bold", toNum(signal.reviewSentimentScore)! >= 0.6 ? "text-emerald-400" : "text-amber-400")}>
                    {pct(signal.reviewSentimentScore)}
                  </p>
                  {signal.digitalGrowthTrend && (
                    <p className="text-xs text-white/40 mt-1 capitalize">{signal.digitalGrowthTrend} digital trend</p>
                  )}
                </div>
              )}
              {signal.killProbability != null && (
                <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
                  <p className="text-xs text-white/40 mb-1">Kill Probability</p>
                  <p className={cn("text-2xl font-bold", toNum(signal.killProbability)! <= 0.3 ? "text-emerald-400" : toNum(signal.killProbability)! <= 0.6 ? "text-amber-400" : "text-red-400")}>
                    {pct(signal.killProbability)}
                  </p>
                </div>
              )}
            </div>
            {signal.ownerProfileSummary && (
              <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 mb-4">
                <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Owner Psychology</p>
                <p className="text-sm text-white/70 leading-relaxed">{signal.ownerProfileSummary}</p>
              </div>
            )}
            {redFlags.length > 0 && (
              <div className="rounded-xl bg-red-950/20 border border-red-500/15 p-4">
                <p className="text-xs text-red-400/70 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" />Red Flags ({redFlags.length})
                </p>
                <div className="space-y-1.5">
                  {redFlags.map((flag, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <XCircle className="w-3.5 h-3.5 text-red-400/60 mt-0.5 shrink-0" />
                      <p className="text-xs text-white/60">{flag}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* ── Investment Memo Excerpt ─────────────────────────────────────────── */}
        {memo && (memo.executiveSummary || memo.investmentThesis) && (
          <Section title="Investment Thesis" icon={Shield}>
            {memo.executiveSummary && (
              <div className="mb-4">
                <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Executive Summary</p>
                <p className="text-sm text-white/70 leading-relaxed">{memo.executiveSummary}</p>
              </div>
            )}
            {memo.investmentThesis && (
              <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
                <p className="text-xs text-primary/60 mb-2 uppercase tracking-wider">Investment Thesis</p>
                <p className="text-sm text-white/80 leading-relaxed italic">{memo.investmentThesis}</p>
              </div>
            )}
          </Section>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/25">
          <p>Generated by Project Million · Third Signal Intelligence Platform</p>
          <p>This document is confidential and intended solely for the recipient.</p>
        </div>
      </div>
    </div>
  );
}

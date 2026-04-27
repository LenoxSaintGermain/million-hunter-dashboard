import { useState } from "react";
import { trpc } from "@/lib/trpc";
import InvestorLayout from "@/components/InvestorLayout";
import { Link } from "wouter";
import {
  TrendingUp,
  MapPin,
  ChevronRight,
  Star,
  DollarSign,
  Activity,
  Search,
  CheckCircle2,
  Dna,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { computeDnaMatchScore, type DnaProfile, type DnaMatchResult } from "@/lib/dnaMatch";

// ─── Stage config ─────────────────────────────────────────────────────────────
const STAGE_LABELS: Record<string, string> = {
  new: "New",
  scanning: "Scanning",
  qualified: "Qualified",
  high_priority: "Priority",
  in_diligence: "Diligence",
  loi_sent: "LOI Sent",
  under_contract: "Under Contract",
  closed: "Closed",
  passed: "Passed",
};

const STAGE_COLORS: Record<string, { bg: string; color: string }> = {
  high_priority: { bg: "var(--sh-primary-15)", color: "var(--sh-primary)" },
  in_diligence: { bg: "var(--sh-cyan-15)", color: "var(--sh-cyan)" },
  loi_sent: { bg: "oklch(0.55 0.18 280 / 0.15)", color: "oklch(0.75 0.18 280)" },
  under_contract: { bg: "oklch(0.55 0.18 150 / 0.15)", color: "oklch(0.72 0.18 150)" },
  qualified: { bg: "oklch(0.55 0.01 260 / 0.15)", color: "var(--sh-fg-2)" },
  new: { bg: "oklch(0.55 0.01 260 / 0.1)", color: "var(--sh-fg-3)" },
};

// ─── Match tier colors (OKLCH DS tokens) ─────────────────────────────────────
const TIER_STYLES = {
  strong: {
    bg: "oklch(0.55 0.18 145 / 0.15)",
    color: "oklch(0.72 0.18 145)",
    border: "oklch(0.72 0.18 145 / 0.3)",
    glow: "oklch(0.72 0.18 145 / 0.12)",
    label: "Strong Match",
  },
  good: {
    bg: "oklch(0.55 0.18 60 / 0.15)",
    color: "oklch(0.75 0.18 60)",
    border: "oklch(0.75 0.18 60 / 0.3)",
    glow: "oklch(0.75 0.18 60 / 0.1)",
    label: "Good Match",
  },
  partial: {
    bg: "oklch(0.55 0.01 260 / 0.12)",
    color: "var(--sh-fg-3)",
    border: "var(--sh-border)",
    glow: "transparent",
    label: "Partial Match",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined, prefix = "$") {
  if (!n) return "—";
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n}`;
}

function ScoreMeter({ score }: { score: number | null | undefined }) {
  if (!score) return <span style={{ color: "var(--sh-fg-4)" }}>—</span>;
  const pct = Math.round(score * 100);
  const color =
    score >= 0.8 ? "var(--sh-primary)" : score >= 0.65 ? "oklch(0.75 0.18 60)" : "oklch(0.65 0.18 20)";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--sh-surface-3)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="sh-mono text-[11px] font-bold" style={{ color }}>{score.toFixed(3)}</span>
    </div>
  );
}

// ─── DNA Match Badge ──────────────────────────────────────────────────────────
function DNAMatchBadge({ match }: { match: DnaMatchResult }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const style = TIER_STYLES[match.tier];

  const breakdown = [
    { label: "Sector", pts: match.sectorPts, max: 30 },
    { label: "Deal Size", pts: match.sizePts, max: 25 },
    { label: "Risk Fit", pts: match.riskPts, max: 25 },
    { label: "IRR Proxy", pts: match.irrPts, max: 20 },
  ];

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowBreakdown((v) => !v);
        }}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-200 hover:scale-105"
        style={{
          background: style.bg,
          color: style.color,
          border: `1px solid ${style.border}`,
          boxShadow: `0 0 8px ${style.glow}`,
        }}
        title="Click to see score breakdown"
      >
        <Dna className="w-3 h-3 shrink-0" />
        <span className="sh-mono">{match.total}</span>
        <span className="hidden sm:inline opacity-80">· {style.label}</span>
        <Info className="w-2.5 h-2.5 opacity-50" />
      </button>

      {/* Breakdown popover */}
      {showBreakdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowBreakdown(false); }}
          />
          <div
            className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl p-3 shadow-2xl"
            style={{
              background: "var(--sh-surface-1)",
              border: `1px solid ${style.border}`,
              boxShadow: `0 8px 32px oklch(0 0 0 / 0.4), 0 0 0 1px ${style.border}`,
            }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Dna className="w-3.5 h-3.5" style={{ color: style.color }} />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: style.color }}>
                  DNA Match
                </span>
              </div>
              <span className="sh-mono text-[20px] font-black leading-none" style={{ color: style.color }}>
                {match.total}
              </span>
            </div>

            {/* Sub-score bars */}
            <div className="space-y-2">
              {breakdown.map(({ label, pts, max }) => {
                const pct = Math.round((pts / max) * 100);
                const barColor = pct >= 80 ? "oklch(0.72 0.18 145)" : pct >= 50 ? "oklch(0.75 0.18 60)" : "var(--sh-fg-4)";
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-medium" style={{ color: "var(--sh-fg-3)" }}>{label}</span>
                      <span className="sh-mono text-[10px]" style={{ color: "var(--sh-fg-2)" }}>
                        {pts}<span style={{ color: "var(--sh-fg-4)" }}>/{max}</span>
                      </span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--sh-surface-3)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: barColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer label */}
            <div
              className="mt-3 pt-2.5 text-center text-[10px] font-semibold uppercase tracking-wider"
              style={{ borderTop: "1px solid var(--sh-border)", color: style.color }}
            >
              {style.label}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Interest Modal ────────────────────────────────────────────────────────────
function InterestModal({ deal, onClose }: { deal: any; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();

  const express = trpc.investor.expressInterest.useMutation({
    onSuccess: () => {
      toast.success("Interest sent to operator.");
      utils.investor.getMyInterests.invalidate();
      onClose();
    },
    onError: () => toast.error("Failed to send interest."),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: "var(--sh-surface-1)", border: "1px solid var(--sh-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="sh-h3 mb-1" style={{ color: "var(--sh-fg-1)" }}>Express Interest</h3>
        <p className="sh-small mb-5" style={{ color: "var(--sh-fg-3)" }}>{deal.name}</p>

        <div className="space-y-4">
          <div>
            <label className="sh-label block mb-1.5">INTENDED ALLOCATION (OPTIONAL)</label>
            <input
              type="number"
              placeholder="e.g. 250000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm"
              style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border)", color: "var(--sh-fg-1)", fontFamily: "var(--font-mono)" }}
            />
          </div>
          <div>
            <label className="sh-label block mb-1.5">NOTE TO OPERATOR (OPTIONAL)</label>
            <textarea
              placeholder="Questions, conditions, or context…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
              style={{ background: "var(--sh-surface-2)", border: "1px solid var(--sh-border)", color: "var(--sh-fg-1)" }}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm"
            style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-3)", border: "1px solid var(--sh-border)" }}>
            Cancel
          </button>
          <button
            onClick={() => express.mutate({ dealId: deal.id, allocationAmount: amount ? parseFloat(amount) : undefined, investorNote: note || undefined })}
            disabled={express.isPending}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: "var(--sh-primary)", color: "oklch(0.98 0 0)" }}
          >
            {express.isPending ? "Sending…" : "Send to Operator →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Deal Card ────────────────────────────────────────────────────────────────
function DealCard({ deal, isTop, onInterest, hasInterest, dnaProfile }: {
  deal: any;
  isTop: boolean;
  onInterest: (d: any) => void;
  hasInterest: boolean;
  dnaProfile: DnaProfile | null;
}) {
  const stageStyle = STAGE_COLORS[deal.stage] ?? STAGE_COLORS.new;

  // Compute match score if DNA profile is available
  const match = dnaProfile
    ? computeDnaMatchScore(
        { industry: deal.industry, askingPrice: deal.askingPrice, cashFlow: deal.cashFlow, score: deal.score },
        dnaProfile
      )
    : null;

  const tierStyle = match ? TIER_STYLES[match.tier] : null;

  return (
    <div
      className="relative group rounded-2xl border cursor-pointer transition-all duration-200 hover:border-[var(--sh-primary-20)]"
      style={{
        background: "var(--sh-surface-1)",
        borderColor: isTop
          ? "var(--sh-primary-20)"
          : match?.tier === "strong"
          ? tierStyle!.border
          : "var(--sh-border)",
        boxShadow: isTop
          ? "0 0 0 1px var(--sh-primary-10)"
          : match?.tier === "strong"
          ? `0 0 16px ${tierStyle!.glow}`
          : undefined,
      }}
    >
      {isTop && (
        <div className="absolute -top-px left-4 px-2.5 py-0.5 rounded-b-lg text-[10px] font-bold uppercase tracking-wider"
          style={{ background: "var(--sh-primary)", color: "oklch(0.98 0 0)" }}>
          Top Signal
        </div>
      )}
      {hasInterest && (
        <div className="absolute top-3 right-3">
          <CheckCircle2 className="w-4 h-4" style={{ color: "var(--sh-primary)" }} />
        </div>
      )}

      <Link href={`/investor/deal/${deal.id}`}>
        <div className="p-5">
          {/* Title row + DNA badge */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="inline-flex items-center text-[10px] font-bold px-2 h-[18px] rounded-[5px]"
                  style={{ background: stageStyle.bg, color: stageStyle.color }}>
                  {STAGE_LABELS[deal.stage] ?? deal.stage}
                </span>
                {deal.industry && (
                  <span className="text-[10px] font-medium px-2 h-[18px] inline-flex items-center rounded-[5px]"
                    style={{ background: "var(--sh-surface-3)", color: "var(--sh-fg-3)" }}>
                    {deal.industry}
                  </span>
                )}
                {deal.opportunityZone && (
                  <span className="text-[10px] font-bold px-2 h-[18px] inline-flex items-center rounded-[5px]"
                    style={{ background: "var(--sh-cyan-15)", color: "var(--sh-cyan)" }}>
                    OZ
                  </span>
                )}
              </div>
              <h3 className="text-[15px] font-bold leading-snug" style={{ color: "var(--sh-fg-1)" }}>{deal.name}</h3>
              {deal.location && (
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3 shrink-0" style={{ color: "var(--sh-fg-4)" }} />
                  <span className="text-[12px]" style={{ color: "var(--sh-fg-3)" }}>{deal.location}</span>
                </div>
              )}
            </div>

            {/* DNA Match Badge — top-right of card header */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              {match && <DNAMatchBadge match={match} />}
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--sh-primary)" }} />
            </div>
          </div>

          {/* Financials grid */}
          <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden mb-4" style={{ background: "var(--sh-border)" }}>
            {[
              { label: "Revenue", value: fmt(deal.revenue) },
              { label: "Cash Flow", value: fmt(deal.cashFlow) },
              { label: "Asking", value: fmt(deal.askingPrice) },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center py-3 gap-0.5" style={{ background: "var(--sh-surface-2)" }}>
                <span className="sh-mono text-[13px] font-bold" style={{ color: "var(--sh-fg-1)" }}>{value}</span>
                <span className="sh-label">{label}</span>
              </div>
            ))}
          </div>

          <ScoreMeter score={deal.score} />
        </div>
      </Link>

      {/* Express Interest CTA */}
      <div className="px-5 pb-4">
        <button
          onClick={(e) => { e.preventDefault(); onInterest(deal); }}
          className="w-full py-2 rounded-lg text-[12px] font-semibold transition-colors"
          style={{
            background: hasInterest ? "var(--sh-surface-2)" : "var(--sh-primary-15)",
            color: hasInterest ? "var(--sh-fg-3)" : "var(--sh-primary)",
            border: `1px solid ${hasInterest ? "var(--sh-border)" : "var(--sh-primary-20)"}`,
          }}
        >
          {hasInterest ? "✓ Interest Expressed" : "Express Interest →"}
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DealRoom() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("active");
  const [interestDeal, setInterestDeal] = useState<any>(null);
  const [sortMode, setSortMode] = useState<"signal" | "match">("signal");

  const { data: deals, isLoading } = trpc.deals.list.useQuery({ limit: 50 });
  const { data: dna } = trpc.investor.getDnaStatus.useQuery();
  const { data: myInterests = [] } = trpc.investor.getMyInterests.useQuery();

  const interestedIds = new Set((myInterests as any[]).map((i) => i.dealId));

  // Build a typed DnaProfile only when quiz is completed
  const dnaProfile: DnaProfile | null =
    dna?.quizCompleted
      ? {
          riskTolerance: dna.riskTolerance,
          timeHorizon: dna.timeHorizon,
          liquidityNeed: dna.liquidityNeed,
          esgConviction: dna.esgConviction,
          sectorAffinity: dna.sectorAffinity as string[],
        }
      : null;

  const filtered = (deals ?? []).filter((d) => {
    const matchSearch =
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.location ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (d.industry ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStage =
      stageFilter === "all" ||
      (stageFilter === "active" &&
        ["qualified", "high_priority", "in_diligence", "loi_sent", "under_contract"].includes(d.stage));
    return matchSearch && matchStage && !d.isArchived;
  });

  // Sort by AI signal score or DNA match score
  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === "match" && dnaProfile) {
      const scoreA = computeDnaMatchScore(
        { industry: a.industry, askingPrice: a.askingPrice, cashFlow: a.cashFlow, score: a.score },
        dnaProfile
      ).total;
      const scoreB = computeDnaMatchScore(
        { industry: b.industry, askingPrice: b.askingPrice, cashFlow: b.cashFlow, score: b.score },
        dnaProfile
      ).total;
      return scoreB - scoreA;
    }
    return (b.score ?? 0) - (a.score ?? 0);
  });

  // Avg DNA match for summary bar
  const avgMatch =
    dnaProfile && sorted.length
      ? Math.round(
          sorted.reduce(
            (s, d) =>
              s +
              computeDnaMatchScore(
                { industry: d.industry, askingPrice: d.askingPrice, cashFlow: d.cashFlow, score: d.score },
                dnaProfile
              ).total,
            0
          ) / sorted.length
        )
      : null;

  return (
    <InvestorLayout>
      {/* DNA Archetype Banner */}
      {dna?.quizCompleted && (
        <div
          className="rounded-xl px-5 py-3 flex items-center justify-between"
          style={{ background: "var(--sh-surface-1)", border: "1px solid var(--sh-border)" }}
        >
          <div className="flex items-center gap-3">
            <span className="sh-label">YOUR DNA</span>
            <span className="text-sm font-semibold" style={{ color: "var(--sh-primary)" }}>
              {dna.archetypeLabel ?? dna.archetypeCode}
            </span>
            {avgMatch !== null && (
              <>
                <span style={{ color: "var(--sh-fg-4)" }}>·</span>
                <span className="sh-label">AVG MATCH</span>
                <span
                  className="sh-mono text-sm font-bold"
                  style={{
                    color:
                      avgMatch >= 80
                        ? "oklch(0.72 0.18 145)"
                        : avgMatch >= 60
                        ? "oklch(0.75 0.18 60)"
                        : "var(--sh-fg-3)",
                  }}
                >
                  {avgMatch}
                </span>
              </>
            )}
          </div>
          <span className="sh-small" style={{ color: "var(--sh-fg-3)" }}>
            {(myInterests as any[]).length} interest{(myInterests as any[]).length !== 1 ? "s" : ""} expressed
          </span>
        </div>
      )}

      {/* Page header */}
      <div>
        <h1 className="sh-h2" style={{ color: "var(--sh-fg-1)" }}>Deal Room</h1>
        <p className="sh-body mt-1" style={{ color: "var(--sh-fg-3)" }}>
          Curated acquisition opportunities — ranked by AI signal score
        </p>
      </div>

      {/* Filters + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1" style={{ maxWidth: 400 }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--sh-fg-4)" }} />
          <input
            type="text"
            placeholder="Search deals, locations, industries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-[13px] border border-border outline-none"
            style={{ background: "var(--sh-surface-2)", color: "var(--sh-fg-1)" }}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Stage filter */}
          <div className="flex items-center gap-1.5 p-1 rounded-lg" style={{ background: "var(--sh-surface-2)" }}>
            {[{ value: "active", label: "Active" }, { value: "all", label: "All" }].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStageFilter(opt.value)}
                className="px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all"
                style={{
                  background: stageFilter === opt.value ? "var(--sh-primary)" : "transparent",
                  color: stageFilter === opt.value ? "oklch(0.98 0 0)" : "var(--sh-fg-3)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sort toggle — only show if DNA is complete */}
          {dnaProfile && (
            <div className="flex items-center gap-1.5 p-1 rounded-lg" style={{ background: "var(--sh-surface-2)" }}>
              {[
                { value: "signal", label: "Signal" },
                { value: "match", label: "DNA Match" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortMode(opt.value as "signal" | "match")}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all"
                  style={{
                    background: sortMode === opt.value ? "oklch(0.55 0.18 145 / 0.2)" : "transparent",
                    color: sortMode === opt.value ? "oklch(0.72 0.18 145)" : "var(--sh-fg-3)",
                  }}
                >
                  {opt.value === "match" && <Dna className="w-3 h-3" />}
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden" style={{ background: "var(--sh-border)" }}>
        {[
          { label: "Deals", value: sorted.length, icon: Activity },
          {
            label: "Avg Signal",
            value: sorted.length ? (sorted.reduce((s, d) => s + (d.score ?? 0), 0) / sorted.length).toFixed(3) : "—",
            icon: Star,
          },
          { label: "Total Pipeline", value: fmt(sorted.reduce((s, d) => s + (d.askingPrice ?? 0), 0)), icon: DollarSign },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex flex-col items-center justify-center py-4 gap-1" style={{ background: "var(--sh-surface-1)" }}>
            <Icon className="w-4 h-4 mb-1" style={{ color: "var(--sh-primary)" }} />
            <span className="sh-mono text-lg font-bold" style={{ color: "var(--sh-fg-1)" }}>{value}</span>
            <span className="sh-label">{label}</span>
          </div>
        ))}
      </div>

      {/* Deal cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: "var(--sh-surface-2)" }} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-border"
          style={{ background: "var(--sh-surface-1)" }}>
          <TrendingUp className="w-10 h-10 mb-3" style={{ color: "var(--sh-fg-4)" }} />
          <p className="sh-body font-semibold" style={{ color: "var(--sh-fg-2)" }}>No deals match your filters</p>
          <p className="sh-small mt-1" style={{ color: "var(--sh-fg-4)" }}>Try adjusting the search or stage filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((deal, idx) => (
            <DealCard
              key={deal.id}
              deal={deal}
              isTop={idx === 0 && (deal.score ?? 0) >= 0.75}
              onInterest={setInterestDeal}
              hasInterest={interestedIds.has(deal.id)}
              dnaProfile={dnaProfile}
            />
          ))}
        </div>
      )}

      {/* Interest Modal */}
      {interestDeal && <InterestModal deal={interestDeal} onClose={() => setInterestDeal(null)} />}
    </InvestorLayout>
  );
}

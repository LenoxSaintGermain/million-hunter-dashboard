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
  Filter,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="sh-mono text-[11px] font-bold" style={{ color }}>
        {score.toFixed(3)}
      </span>
    </div>
  );
}

export default function DealRoom() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("active");

  const { data: deals, isLoading } = trpc.deals.list.useQuery({ limit: 50 });

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

  // Sort by score desc
  const sorted = [...filtered].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const stageOptions = [
    { value: "active", label: "Active Deals" },
    { value: "all", label: "All Deals" },
  ];

  return (
    <InvestorLayout>
      {/* ── Page header ── */}
      <div>
        <h1 className="sh-h2" style={{ color: "var(--sh-fg-1)" }}>Deal Room</h1>
        <p className="sh-body mt-1" style={{ color: "var(--sh-fg-3)" }}>
          Curated acquisition opportunities — ranked by AI signal score
        </p>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div
          className="relative flex-1"
          style={{ maxWidth: 400 }}
        >
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--sh-fg-4)" }}
          />
          <input
            type="text"
            placeholder="Search deals, locations, industries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-[13px] border border-border outline-none transition-all"
            style={{
              background: "var(--sh-surface-2)",
              color: "var(--sh-fg-1)",
            }}
          />
        </div>

        {/* Stage filter pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg" style={{ background: "var(--sh-surface-2)" }}>
          {stageOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStageFilter(opt.value)}
              className="px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all duration-150"
              style={{
                background: stageFilter === opt.value ? "var(--sh-primary)" : "transparent",
                color: stageFilter === opt.value ? "oklch(0.98 0 0)" : "var(--sh-fg-3)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary bar ── */}
      <div
        className="grid grid-cols-3 gap-px rounded-xl overflow-hidden"
        style={{ background: "var(--sh-border)" }}
      >
        {[
          { label: "Deals", value: sorted.length, icon: Activity },
          {
            label: "Avg Score",
            value: sorted.length
              ? (sorted.reduce((s, d) => s + (d.score ?? 0), 0) / sorted.length).toFixed(3)
              : "—",
            icon: Star,
          },
          {
            label: "Total Pipeline",
            value: fmt(sorted.reduce((s, d) => s + (d.askingPrice ?? 0), 0)),
            icon: DollarSign,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex flex-col items-center justify-center py-4 gap-1"
            style={{ background: "var(--sh-surface-1)" }}
          >
            <Icon className="w-4 h-4 mb-1" style={{ color: "var(--sh-primary)" }} />
            <span className="sh-mono text-lg font-bold" style={{ color: "var(--sh-fg-1)" }}>
              {value}
            </span>
            <span className="sh-label">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Deal cards ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 rounded-2xl animate-pulse"
              style={{ background: "var(--sh-surface-2)" }}
            />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-border"
          style={{ background: "var(--sh-surface-1)" }}
        >
          <TrendingUp className="w-10 h-10 mb-3" style={{ color: "var(--sh-fg-4)" }} />
          <p className="sh-body font-semibold" style={{ color: "var(--sh-fg-2)" }}>No deals match your filters</p>
          <p className="sh-small mt-1" style={{ color: "var(--sh-fg-4)" }}>Try adjusting the search or stage filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((deal, idx) => {
            const stageStyle = STAGE_COLORS[deal.stage] ?? STAGE_COLORS.new;
            const isTopDeal = idx === 0 && (deal.score ?? 0) >= 0.75;

            return (
              <Link key={deal.id} href={`/investor/deal/${deal.id}`}>
                <div
                  className={cn(
                    "relative group rounded-2xl border cursor-pointer transition-all duration-200",
                    "hover:border-[var(--sh-primary-20)]"
                  )}
                  style={{
                    background: "var(--sh-surface-1)",
                    borderColor: isTopDeal ? "var(--sh-primary-20)" : "var(--sh-border)",
                    boxShadow: isTopDeal ? "0 0 0 1px var(--sh-primary-10)" : undefined,
                  }}
                >
                  {/* Top deal badge */}
                  {isTopDeal && (
                    <div
                      className="absolute -top-px left-4 px-2.5 py-0.5 rounded-b-lg text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: "var(--sh-primary)", color: "oklch(0.98 0 0)" }}
                    >
                      Top Signal
                    </div>
                  )}

                  <div className="p-5">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span
                            className="inline-flex items-center text-[10px] font-bold px-2 h-[18px] rounded-[5px]"
                            style={{ background: stageStyle.bg, color: stageStyle.color }}
                          >
                            {STAGE_LABELS[deal.stage] ?? deal.stage}
                          </span>
                          {deal.industry && (
                            <span
                              className="text-[10px] font-medium px-2 h-[18px] inline-flex items-center rounded-[5px]"
                              style={{ background: "var(--sh-surface-3)", color: "var(--sh-fg-3)" }}
                            >
                              {deal.industry}
                            </span>
                          )}
                          {deal.opportunityZone && (
                            <span
                              className="text-[10px] font-bold px-2 h-[18px] inline-flex items-center rounded-[5px]"
                              style={{ background: "var(--sh-cyan-15)", color: "var(--sh-cyan)" }}
                            >
                              OZ
                            </span>
                          )}
                        </div>
                        <h3 className="text-[15px] font-bold leading-snug" style={{ color: "var(--sh-fg-1)" }}>
                          {deal.name}
                        </h3>
                        {deal.location && (
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3 shrink-0" style={{ color: "var(--sh-fg-4)" }} />
                            <span className="text-[12px]" style={{ color: "var(--sh-fg-3)" }}>
                              {deal.location}
                            </span>
                          </div>
                        )}
                      </div>
                      <ChevronRight
                        className="w-4 h-4 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "var(--sh-primary)" }}
                      />
                    </div>

                    {/* Financials grid */}
                    <div
                      className="grid grid-cols-3 gap-px rounded-xl overflow-hidden mb-4"
                      style={{ background: "var(--sh-border)" }}
                    >
                      {[
                        { label: "Revenue", value: fmt(deal.revenue) },
                        { label: "Cash Flow", value: fmt(deal.cashFlow) },
                        { label: "Asking", value: fmt(deal.askingPrice) },
                      ].map(({ label, value }) => (
                        <div
                          key={label}
                          className="flex flex-col items-center py-3 gap-0.5"
                          style={{ background: "var(--sh-surface-2)" }}
                        >
                          <span className="sh-mono text-[13px] font-bold" style={{ color: "var(--sh-fg-1)" }}>
                            {value}
                          </span>
                          <span className="sh-label">{label}</span>
                        </div>
                      ))}
                    </div>

                    {/* AI Score bar */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="sh-label">AI Signal Score</span>
                      </div>
                      <ScoreMeter score={deal.score} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </InvestorLayout>
  );
}

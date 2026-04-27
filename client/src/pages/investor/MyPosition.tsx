import { trpc } from "@/lib/trpc";
import InvestorLayout from "@/components/InvestorLayout";
import { Link } from "wouter";
import {
  Briefcase,
  TrendingUp,
  DollarSign,
  Target,
  ChevronRight,
  Star,
  MapPin,
} from "lucide-react";

function fmt(n: number | null | undefined, prefix = "$") {
  if (!n) return "—";
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n}`;
}

const STAGE_LABELS: Record<string, string> = {
  qualified: "Qualified",
  high_priority: "Priority",
  in_diligence: "In Diligence",
  loi_sent: "LOI Sent",
  under_contract: "Under Contract",
  closed: "Closed",
};

const STAGE_COLORS: Record<string, { bg: string; color: string }> = {
  high_priority: { bg: "var(--sh-primary-15)", color: "var(--sh-primary)" },
  in_diligence: { bg: "var(--sh-cyan-15)", color: "var(--sh-cyan)" },
  loi_sent: { bg: "oklch(0.55 0.18 280 / 0.15)", color: "oklch(0.75 0.18 280)" },
  under_contract: { bg: "oklch(0.55 0.18 150 / 0.15)", color: "oklch(0.72 0.18 150)" },
  closed: { bg: "oklch(0.55 0.18 150 / 0.2)", color: "oklch(0.72 0.18 150)" },
  qualified: { bg: "oklch(0.55 0.01 260 / 0.15)", color: "var(--sh-fg-2)" },
};

export default function MyPosition() {
  const { data: deals } = trpc.deals.list.useQuery({ limit: 100 });

  // Active deals = anything past qualified (getDeals already filters archived)
  const activeDeals = (deals ?? []).filter(
    (d) =>
      ["qualified", "high_priority", "in_diligence", "loi_sent", "under_contract", "closed"].includes(d.stage)
  );

  const advancedDeals = (deals ?? []).filter(
    (d) =>
      ["in_diligence", "loi_sent", "under_contract", "closed"].includes(d.stage)
  );

  const totalPipeline = activeDeals.reduce((s, d) => s + (d.askingPrice ?? 0), 0);
  const totalCashFlow = activeDeals.reduce((s, d) => s + (d.cashFlow ?? 0), 0);
  const avgScore = activeDeals.length
    ? activeDeals.reduce((s, d) => s + (d.score ?? 0), 0) / activeDeals.length
    : 0;

  // Stage funnel
  const stageCounts = activeDeals.reduce<Record<string, number>>((acc, d) => {
    acc[d.stage] = (acc[d.stage] ?? 0) + 1;
    return acc;
  }, {});

  const funnelStages = [
    { key: "qualified", label: "Qualified" },
    { key: "high_priority", label: "Priority" },
    { key: "in_diligence", label: "Diligence" },
    { key: "loi_sent", label: "LOI Sent" },
    { key: "under_contract", label: "Under Contract" },
    { key: "closed", label: "Closed" },
  ];

  return (
    <InvestorLayout>
      {/* Header */}
      <div>
        <h1 className="sh-h2" style={{ color: "var(--sh-fg-1)" }}>My Position</h1>
        <p className="sh-body mt-1" style={{ color: "var(--sh-fg-3)" }}>
          Portfolio snapshot — deal flow exposure and pipeline metrics
        </p>
      </div>

      {/* ── Portfolio KPIs ── */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl overflow-hidden"
        style={{ background: "var(--sh-border)" }}
      >
        {[
          {
            label: "Active Deals",
            value: activeDeals.length,
            icon: Briefcase,
            color: "var(--sh-primary)",
          },
          {
            label: "Total Pipeline",
            value: fmt(totalPipeline),
            icon: DollarSign,
            color: "var(--sh-cyan)",
          },
          {
            label: "Annual Cash Flow",
            value: fmt(totalCashFlow),
            icon: TrendingUp,
            color: "oklch(0.75 0.18 280)",
          },
          {
            label: "Avg AI Score",
            value: avgScore > 0 ? avgScore.toFixed(3) : "—",
            icon: Star,
            color: "oklch(0.75 0.18 60)",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="flex flex-col items-center justify-center py-5 gap-1.5"
            style={{ background: "var(--sh-surface-1)" }}
          >
            <Icon className="w-4 h-4" style={{ color }} />
            <span className="sh-mono text-xl font-black" style={{ color }}>
              {value}
            </span>
            <span className="sh-label">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Deal Funnel ── */}
      <div
        className="p-5 rounded-2xl border border-border"
        style={{ background: "var(--sh-surface-1)" }}
      >
        <h3 className="sh-label mb-4">Deal Funnel</h3>
        <div className="space-y-2">
          {funnelStages.map(({ key, label }) => {
            const count = stageCounts[key] ?? 0;
            const maxCount = Math.max(...Object.values(stageCounts), 1);
            const pct = (count / maxCount) * 100;
            const style = STAGE_COLORS[key] ?? { bg: "var(--sh-surface-3)", color: "var(--sh-fg-3)" };
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="sh-label w-28 shrink-0">{label}</span>
                <div className="flex-1 h-6 rounded-lg overflow-hidden" style={{ background: "var(--sh-surface-2)" }}>
                  <div
                    className="h-full rounded-lg flex items-center px-2 transition-all duration-500"
                    style={{ width: count > 0 ? `${Math.max(pct, 8)}%` : "0%", background: style.bg }}
                  >
                    {count > 0 && (
                      <span className="sh-mono text-[11px] font-bold" style={{ color: style.color }}>
                        {count}
                      </span>
                    )}
                  </div>
                </div>
                <span className="sh-mono text-[12px] w-6 text-right" style={{ color: count > 0 ? style.color : "var(--sh-fg-4)" }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Advanced deals ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="sh-label">Advanced Pipeline</h3>
          <Link href="/investor">
            <button className="text-[12px] font-semibold" style={{ color: "var(--sh-primary)" }}>
              View all →
            </button>
          </Link>
        </div>

        {advancedDeals.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-border"
            style={{ background: "var(--sh-surface-1)" }}
          >
            <Target className="w-8 h-8 mb-2" style={{ color: "var(--sh-fg-4)" }} />
            <p className="sh-small font-semibold" style={{ color: "var(--sh-fg-3)" }}>
              No deals in advanced stages yet
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {advancedDeals
              .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
              .map((deal) => {
                const stageStyle = STAGE_COLORS[deal.stage] ?? STAGE_COLORS.qualified;
                const score = deal.score ?? 0;
                const scoreColor =
                  score >= 0.8 ? "var(--sh-primary)" : score >= 0.65 ? "oklch(0.75 0.18 60)" : "var(--sh-fg-3)";

                return (
                  <Link key={deal.id} href={`/investor/deal/${deal.id}`}>
                    <div
                      className="flex items-center gap-3 p-4 rounded-xl border cursor-pointer group transition-all duration-150 hover:border-[var(--sh-primary-20)]"
                      style={{ background: "var(--sh-surface-1)", borderColor: "var(--sh-border)" }}
                    >
                      {/* Stage badge */}
                      <span
                        className="inline-flex items-center text-[10px] font-bold px-2 h-[18px] rounded-[5px] shrink-0"
                        style={{ background: stageStyle.bg, color: stageStyle.color }}
                      >
                        {STAGE_LABELS[deal.stage] ?? deal.stage}
                      </span>

                      {/* Name + location */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate" style={{ color: "var(--sh-fg-1)" }}>
                          {deal.name}
                        </p>
                        {deal.location && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 shrink-0" style={{ color: "var(--sh-fg-4)" }} />
                            <span className="sh-small truncate">{deal.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Financials */}
                      <div className="hidden sm:flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="sh-mono text-[12px] font-bold" style={{ color: "var(--sh-fg-1)" }}>
                            {fmt(deal.askingPrice)}
                          </p>
                          <p className="sh-label">Asking</p>
                        </div>
                        <div className="text-right">
                          <p className="sh-mono text-[12px] font-bold" style={{ color: scoreColor }}>
                            {score > 0 ? score.toFixed(3) : "—"}
                          </p>
                          <p className="sh-label">Score</p>
                        </div>
                      </div>

                      <ChevronRight
                        className="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "var(--sh-primary)" }}
                      />
                    </div>
                  </Link>
                );
              })}
          </div>
        )}
      </div>
    </InvestorLayout>
  );
}

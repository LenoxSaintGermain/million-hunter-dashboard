import { useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import InvestorLayout from "@/components/InvestorLayout";
import { Streamdown } from "streamdown";
import {
  ArrowLeft,
  MapPin,
  Building2,
  TrendingUp,
  FileText,
  Activity,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

function fmt(n: number | null | undefined, prefix = "$") {
  if (!n) return "—";
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n}`;
}

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  scanning: "Scanning",
  qualified: "Qualified",
  high_priority: "High Priority",
  in_diligence: "In Diligence",
  loi_sent: "LOI Sent",
  under_contract: "Under Contract",
  closed: "Closed",
  passed: "Passed",
};

export default function InvestorDealDetail() {
  const { id } = useParams<{ id: string }>();
  const dealId = parseInt(id ?? "0");
  const [activeTab, setActiveTab] = useState<"overview" | "memo" | "signals">("overview");

  // deals.getById returns { deal, signal, memo, contacts }
  const { data, isLoading } = trpc.deals.getById.useQuery({ id: dealId }, { enabled: !!dealId });
  const deal = data?.deal;
  const signal = data?.signal;
  const memo = data?.memo;

  if (isLoading) {
    return (
      <InvestorLayout>
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-48 rounded-lg" style={{ background: "var(--sh-surface-2)" }} />
          <div className="h-40 rounded-2xl" style={{ background: "var(--sh-surface-2)" }} />
          <div className="h-64 rounded-2xl" style={{ background: "var(--sh-surface-2)" }} />
        </div>
      </InvestorLayout>
    );
  }

  if (!deal) {
    return (
      <InvestorLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="sh-body" style={{ color: "var(--sh-fg-3)" }}>Deal not found.</p>
          <Link href="/investor">
            <button className="mt-4 text-sm" style={{ color: "var(--sh-primary)" }}>← Back to Deal Room</button>
          </Link>
        </div>
      </InvestorLayout>
    );
  }

  const score = deal.score ?? 0;
  const scoreColor =
    score >= 0.8 ? "var(--sh-primary)" : score >= 0.65 ? "oklch(0.75 0.18 60)" : "oklch(0.65 0.18 20)";

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Activity },
    { id: "memo" as const, label: "Investment Memo", icon: FileText },
    { id: "signals" as const, label: "Third Signals", icon: TrendingUp },
  ];

  // Parse red flags from signal
  const redFlags: string[] = (() => {
    if (!signal?.redFlags) return [];
    if (Array.isArray(signal.redFlags)) return signal.redFlags as string[];
    if (typeof signal.redFlags === "string") {
      try { return JSON.parse(signal.redFlags); } catch { return [signal.redFlags]; }
    }
    return [];
  })();

  return (
    <InvestorLayout>
      {/* Back nav */}
      <Link href="/investor">
        <button
          className="flex items-center gap-1.5 text-[13px] font-medium transition-colors"
          style={{ color: "var(--sh-fg-3)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Deal Room
        </button>
      </Link>

      {/* ── Deal header ── */}
      <div
        className="rounded-2xl border border-border p-6"
        style={{ background: "var(--sh-surface-1)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
          {/* Icon */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "var(--sh-primary-15)" }}
          >
            <Building2 className="w-7 h-7" style={{ color: "var(--sh-primary)" }} />
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span
                className="inline-flex items-center text-[11px] font-bold px-2.5 h-5 rounded-[6px]"
                style={{ background: "var(--sh-primary-15)", color: "var(--sh-primary)" }}
              >
                {STAGE_LABELS[deal.stage] ?? deal.stage}
              </span>
              {deal.industry && (
                <span
                  className="text-[11px] font-medium px-2.5 h-5 inline-flex items-center rounded-[6px]"
                  style={{ background: "var(--sh-surface-3)", color: "var(--sh-fg-3)" }}
                >
                  {deal.industry}
                </span>
              )}
              {deal.opportunityZone && (
                <span
                  className="text-[11px] font-bold px-2.5 h-5 inline-flex items-center rounded-[6px]"
                  style={{ background: "var(--sh-cyan-15)", color: "var(--sh-cyan)" }}
                >
                  OZ Eligible
                </span>
              )}
            </div>
            <h1 className="sh-h2 leading-tight" style={{ color: "var(--sh-fg-1)" }}>{deal.name}</h1>
            {deal.location && (
              <div className="flex items-center gap-1.5 mt-2">
                <MapPin className="w-3.5 h-3.5" style={{ color: "var(--sh-fg-4)" }} />
                <span className="text-[13px]" style={{ color: "var(--sh-fg-3)" }}>{deal.location}</span>
              </div>
            )}
          </div>

          {/* Score */}
          <div
            className="flex flex-col items-center justify-center px-5 py-3 rounded-xl shrink-0"
            style={{ background: "var(--sh-surface-2)" }}
          >
            <span className="sh-label mb-1">AI Score</span>
            <span className="sh-mono text-3xl font-black" style={{ color: scoreColor }}>
              {score > 0 ? score.toFixed(3) : "—"}
            </span>
            <div className="w-20 h-1 rounded-full overflow-hidden mt-2" style={{ background: "var(--sh-surface-3)" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.round(score * 100)}%`, background: scoreColor }}
              />
            </div>
          </div>
        </div>

        {/* Financial KPIs */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-xl overflow-hidden"
          style={{ background: "var(--sh-border)" }}
        >
          {[
            { label: "Revenue", value: fmt(deal.revenue), color: "var(--sh-primary)" },
            { label: "Cash Flow", value: fmt(deal.cashFlow), color: "var(--sh-cyan)" },
            { label: "Asking Price", value: fmt(deal.askingPrice), color: "oklch(0.75 0.18 280)" },
            {
              label: "Multiple",
              value: deal.multiple ? `${deal.multiple.toFixed(1)}x` : "—",
              color: "oklch(0.75 0.18 60)",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="flex flex-col items-center py-4 gap-1"
              style={{ background: "var(--sh-surface-2)" }}
            >
              <span className="sh-mono text-[18px] font-bold" style={{ color }}>
                {value}
              </span>
              <span className="sh-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl"
        style={{ background: "var(--sh-surface-2)" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150"
            style={{
              background: activeTab === tab.id ? "var(--sh-surface-1)" : "transparent",
              color: activeTab === tab.id ? "var(--sh-fg-1)" : "var(--sh-fg-3)",
              boxShadow: activeTab === tab.id ? "0 1px 3px oklch(0 0 0 / 0.2)" : undefined,
            }}
          >
            <tab.icon className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {deal.description && (
            <div
              className="p-5 rounded-2xl border border-border"
              style={{ background: "var(--sh-surface-1)" }}
            >
              <h3 className="sh-label mb-3">Business Overview</h3>
              <p className="sh-body leading-relaxed" style={{ color: "var(--sh-fg-2)" }}>
                {deal.description}
              </p>
            </div>
          )}

          <div
            className="p-5 rounded-2xl border border-border"
            style={{ background: "var(--sh-surface-1)" }}
          >
            <h3 className="sh-label mb-4">Deal Details</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: "Year Est.", value: deal.yearEstablished ?? "—" },
                { label: "Employees", value: deal.employees ?? "—" },
                { label: "EBITDA", value: fmt(deal.ebitda) },
                { label: "Source", value: deal.source ?? "—" },
                { label: "OZ Tract", value: deal.ozTractId ?? "—" },
                { label: "OZ Gain Est.", value: fmt(deal.ozPotentialGain) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="sh-label mb-0.5">{label}</p>
                  <p className="text-[14px] font-semibold" style={{ color: "var(--sh-fg-1)" }}>
                    {String(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Red flags from signal */}
          {redFlags.length > 0 && (
            <div
              className="p-5 rounded-2xl border"
              style={{
                background: "oklch(0.55 0.18 20 / 0.06)",
                borderColor: "oklch(0.55 0.18 20 / 0.2)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" style={{ color: "oklch(0.65 0.18 20)" }} />
                <h3 className="sh-label" style={{ color: "oklch(0.65 0.18 20)" }}>
                  {redFlags.length} Risk Signal{redFlags.length > 1 ? "s" : ""} Detected
                </h3>
              </div>
              <ul className="space-y-1.5">
                {redFlags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "oklch(0.65 0.18 20)" }} />
                    <span className="sh-small" style={{ color: "oklch(0.65 0.18 20)" }}>{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {activeTab === "memo" && (
        <div className="space-y-4">
          {!memo ? (
            <div
              className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-border"
              style={{ background: "var(--sh-surface-1)" }}
            >
              <FileText className="w-10 h-10 mb-3" style={{ color: "var(--sh-fg-4)" }} />
              <p className="sh-body font-semibold" style={{ color: "var(--sh-fg-2)" }}>No memo generated yet</p>
              <p className="sh-small mt-1" style={{ color: "var(--sh-fg-4)" }}>
                The operator will generate an investment memo when this deal advances to diligence.
              </p>
            </div>
          ) : (
            <div
              className="p-6 rounded-2xl border border-border"
              style={{ background: "var(--sh-surface-1)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4" style={{ color: "var(--sh-primary)" }} />
                <h3 className="text-[14px] font-bold" style={{ color: "var(--sh-fg-1)" }}>
                  {memo.title ?? "Investment Memo"}
                </h3>
                <span className="ml-auto sh-label">
                  {new Date(memo.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="prose prose-invert max-w-none text-[14px] leading-relaxed" style={{ color: "var(--sh-fg-2)" }}>
                <Streamdown>{memo.content ?? ""}</Streamdown>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "signals" && (
        <div className="space-y-4">
          {!signal ? (
            <div
              className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-border"
              style={{ background: "var(--sh-surface-1)" }}
            >
              <TrendingUp className="w-10 h-10 mb-3" style={{ color: "var(--sh-fg-4)" }} />
              <p className="sh-body font-semibold" style={{ color: "var(--sh-fg-2)" }}>No signals analyzed yet</p>
              <p className="sh-small mt-1" style={{ color: "var(--sh-fg-4)" }}>
                Third Signal analysis hasn't been run on this deal yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Owner Psychology */}
              {signal.ownerProfileSummary && (
                <div className="p-5 rounded-2xl border border-border" style={{ background: "var(--sh-surface-1)" }}>
                  <h3 className="sh-label mb-3">Owner Psychology</h3>
                  <p className="sh-body leading-relaxed" style={{ color: "var(--sh-fg-2)" }}>
                    {signal.ownerProfileSummary}
                  </p>
                  {signal.ownerDistressScore != null && (
                    <div className="mt-3 flex items-center gap-3">
                      <span className="sh-label">Distress Score</span>
                      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--sh-surface-3)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round((signal.ownerDistressScore ?? 0) * 100)}%`,
                            background: (signal.ownerDistressScore ?? 0) > 0.6 ? "var(--sh-primary)" : "var(--sh-fg-4)",
                          }}
                        />
                      </div>
                      <span className="sh-mono text-[11px] font-bold" style={{ color: "var(--sh-fg-2)" }}>
                        {((signal.ownerDistressScore ?? 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Digital Audit */}
              {signal.digitalAuditSummary && (
                <div className="p-5 rounded-2xl border border-border" style={{ background: "var(--sh-surface-1)" }}>
                  <h3 className="sh-label mb-3">Digital Audit</h3>
                  <p className="sh-body leading-relaxed" style={{ color: "var(--sh-fg-2)" }}>
                    {signal.digitalAuditSummary}
                  </p>
                </div>
              )}

              {/* Capital Stack */}
              {signal.capitalStackSummary && (
                <div className="p-5 rounded-2xl border border-border" style={{ background: "var(--sh-surface-1)" }}>
                  <h3 className="sh-label mb-3">Capital Stack</h3>
                  <p className="sh-body leading-relaxed" style={{ color: "var(--sh-fg-2)" }}>
                    {signal.capitalStackSummary}
                  </p>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {[
                      { label: "SBA Amount", value: fmt(signal.recommendedSbaAmount) },
                      { label: "Seller Note", value: fmt(signal.recommendedSellerNote) },
                      { label: "Equity", value: fmt(signal.recommendedEquity) },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center">
                        <p className="sh-mono text-[14px] font-bold" style={{ color: "var(--sh-primary)" }}>{value}</p>
                        <p className="sh-label mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Red Team */}
              {signal.redTeamSummary && (
                <div
                  className="p-5 rounded-2xl border"
                  style={{
                    background: "oklch(0.55 0.18 20 / 0.06)",
                    borderColor: "oklch(0.55 0.18 20 / 0.2)",
                  }}
                >
                  <h3 className="sh-label mb-3" style={{ color: "oklch(0.65 0.18 20)" }}>Red Team Analysis</h3>
                  <p className="sh-body leading-relaxed" style={{ color: "var(--sh-fg-2)" }}>
                    {signal.redTeamSummary}
                  </p>
                  {signal.killProbability != null && (
                    <div className="mt-3 flex items-center gap-3">
                      <span className="sh-label" style={{ color: "oklch(0.65 0.18 20)" }}>Kill Probability</span>
                      <span className="sh-mono text-[13px] font-bold" style={{ color: "oklch(0.65 0.18 20)" }}>
                        {((signal.killProbability ?? 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </InvestorLayout>
  );
}
